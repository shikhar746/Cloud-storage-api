import type { Request, Response } from "express";
import { createFolderSchema } from "../schemas/folder.schema.js";
import { supabase } from "../lib/supabase.js";



export async function createFolderController(req:Request, res:Response){
    const { success, error, data } = createFolderSchema.safeParse(req.body)
    if (!success) {
        return res.status(400).json({
            error: { code: "VALIDATION_ERROR", issues: error.issues },
        })
    }
    const parentId = data.parentId ?? null
    if(parentId){
        const { data: parent, error: parentError } = await supabase
            .from('folders')
            .select("id")
            .eq('id', parentId)
            .eq('owner_id', req.userId)
            .eq("is_deleted", false)
            .single()

        if (parentError || !parent) {
            return res.status(404).json({
                error: { code: "PARENT_NOT_FOUND", message: "Parent folder not found" },
            })
        }
    }

    const { data: folder, error: folderError } = await supabase
        .from('folders')
        .insert({
            name: data.name,
            parent_id: parentId,
            owner_id: req.userId,
        })
        .select()
        .single()

    if (folderError) {
        if (folderError.code === "23505") {
            return res.status(409).json({
                error: { code: "FOLDER_EXISTS", message: "A folder with that name already exists here" },
            })
        }
        console.error("create folder failed", folderError)
        return res.status(500).json({
            error: { code: "INTERNAL_ERROR", message: "Failed to create folder" },
        })
    }

    return res.status(201).json({
        folder,
    })
}   

export async function getFolderController(req: Request, res: Response) {
  const { id } = req.params

  // 1. fetch the folder itself
  const { data: folder, error: folderError } = await supabase
    .from("folders")
    .select("id, name, parent_id, created_at")
    .eq("id", id)
    .eq("owner_id", req.userId)
    .eq("is_deleted", false)
    .single()

  if (folderError || !folder) {
    return res.status(404).json({
      error: { code: "FOLDER_NOT_FOUND", message: "Folder not found" },
    })
  }
    const { data: folders, error: foldersError } = await supabase
        .from("folders")
        .select("id, name, parent_id, created_at")
        .eq("parent_id", id)
        .eq("owner_id", req.userId)
        .eq("is_deleted", false)
    
    if (foldersError) {
        console.error("list child folders failed", foldersError)
        return res.status(500).json({
            error: { code: "INTERNAL_ERROR", message: "Failed to load folder" },
        })
    }

    const { data: files, error: filesError } = await supabase
        .from("files")
        .select("id, name, mime_type, size_bytes, created_at")
        .eq("folder_id", id)
        .eq("owner_id", req.userId)
        .eq("is_deleted", false)

    if (filesError) {
        console.error("list files failed", filesError)
        return res.status(500).json({
            error: { code: "INTERNAL_ERROR", message: "Failed to load folder" },
        })
    }

  return res.status(200).json({
    folder,
    children: { folders, files },
  })
}

export async function getRootController(req: Request, res: Response){
    const {data: folders, error: foldersError}= await supabase
        .from("folders")
        .select("id, name, parent_id, created_at")
        .is("parent_id", null)
        .eq("owner_id", req.userId)
        .eq("is_deleted", false)

    const{data: files, error: filesError} = await supabase
        .from("files")
        .select("id, name, mime_type, size_bytes, created_at")
        .is("folder_id", null)
        .eq("owner_id", req.userId)
        .eq("is_deleted", false)

    if (filesError || foldersError) {
        console.error("list root failed", filesError, foldersError)
        return res.status(500).json({
            error: { code: "INTERNAL_ERROR", message: "Failed to load root" },
        })
    }

    return res.status(200).json({
        folder: null,
        children: {folders, files},
    })
}