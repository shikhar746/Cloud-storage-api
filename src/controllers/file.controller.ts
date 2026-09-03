import crypto from 'crypto'
import type { Request, Response } from 'express'
import { supabase } from '../lib/supabase.js'
import { env } from '../config/env.js'
import { uploadFileSchema } from '../schemas/file.schema.js'

export async function uploadFileController(req: Request, res: Response) {
  // 1. multer puts the file here — no file means nothing to do
  if (!req.file) {
    return res.status(400).json({
      error: { code: "NO_FILE", message: "No file uploaded" },
    })
  }

  // 2. multipart text fields arrive as STRINGS, so "" is what an empty
  //    form field gives you — normalize it away before zod sees it
  const rawFolderId = req.body?.folderId
  const { success, error, data } = uploadFileSchema.safeParse({
    folderId: rawFolderId === "" || rawFolderId === "null" ? null : rawFolderId,
  })

  if (!success) {
    return res.status(400).json({
      error: { code: "VALIDATION_ERROR", issues: error.issues },
    })
  }

  const folderId = data.folderId ?? null

  // 3. service role key bypasses RLS — this check is the ONLY thing
  //    stopping someone uploading into another user's folder
  if (folderId) {
    const { data: folder, error: folderError } = await supabase
      .from("folders")
      .select("id")
      .eq("id", folderId)
      .eq("owner_id", req.userId)
      .eq("is_deleted", false)
      .single()

    if (folderError || !folder) {
      return res.status(404).json({
        error: { code: "FOLDER_NOT_FOUND", message: "Folder not found" },
      })
    }
  }

  // 4. generated key, never the user's filename
  const storageKey = `${req.userId}/${crypto.randomUUID()}`

  const { error: uploadError } = await supabase.storage
    .from(env.SUPABASE_STORAGE_BUCKET)
    .upload(storageKey, req.file.buffer, {
      contentType: req.file.mimetype,
      upsert: false,
    })

  if (uploadError) {
    console.error("storage upload failed", uploadError)
    return res.status(500).json({
      error: { code: "UPLOAD_FAILED", message: "Failed to store file" },
    })
  }

  // 5. blob is up. if the row fails now, the blob is orphaned —
  //    so delete it before bailing out
  const { data: file, error: insertError } = await supabase
    .from("files")
    .insert({
      name: req.file.originalname,
      mime_type: req.file.mimetype,
      size_bytes: req.file.size,
      storage_key: storageKey,
      owner_id: req.userId,
      folder_id: folderId,
    })
    .select("id, name, mime_type, size_bytes, folder_id, created_at")
    .single()

  if (insertError) {
    await supabase.storage.from(env.SUPABASE_STORAGE_BUCKET).remove([storageKey])
    console.error("file insert failed", insertError)
    return res.status(500).json({
      error: { code: "INTERNAL_ERROR", message: "Failed to save file" },
    })
  }

  return res.status(201).json({ file })
}

export async function getFileController(req:Request, res: Response){
    const { id }= req.params

    const {data: file, error: fileError } = await supabase
        .from("files")
        .select("id, name, mime_type, size_bytes, storage_key, folder_id, created_at")
        .eq("id", id)
        .eq("owner_id", req.userId)//doing the authorization part
        .eq("is_deleted", false)
        .single()

    if(fileError|| !file)
        return res.status(404).json({
            error: {code : "FILE_NOT_FOUND", message: "File not found"}
        })

     const { data: signed, error: signedError } = await supabase.storage
    .from(env.SUPABASE_STORAGE_BUCKET)
    .createSignedUrl(file.storage_key, 60 * 60)

    if (signedError || !signed) {
        console.error("sign url failed", signedError, file.storage_key)
        return res.status(404).json({
        error: { code: "FILE_NOT_FOUND", message: "File not found" },
        })
    }   

    const { storage_key, ...safeFile } = file

    return res.status(200).json({
        file: safeFile,
        signedUrl: signed.signedUrl,
    })
}

export async function deleteFileController(req: Request, res: Response) {
    const { id } = req.params

    const { data: file, error: fileError } = await supabase
        .from("files")
        .update({ is_deleted: true })
        .eq("id", id)
        .eq("owner_id", req.userId)
        .eq("is_deleted", false)
        .select("id")
        .single()

    if (fileError || !file)
        return res.status(404).json({
            error: { code: "FILE_NOT_FOUND", message: "File not found" },
        })

    return res.status(204).send()
}

export async function listFileController (req: Request, res: Response){
  const {folderId} = req.query

  let query = supabase
    .from("files")
    .select("id, name, mime_type, size_bytes, created_at")
    .eq("owner_id", req.userId)
    .eq("is_deleted", false)
    .order("created_at", { ascending: false })

  query = folderId  
    ? query.eq("folder_id", folderId)
    : query.is("folder_id", null)

  const {data:files, error} = await query
  
  if(error)
    return res.status(500).json({
      error: { code: "INTERNAL_ERROR", message: "Failed to list files" },
    })
  
  return res.status(200).json({ files })
}