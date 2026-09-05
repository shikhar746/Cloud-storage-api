import type { Request, Response } from "express";
import { createFolderSchema, updateFolderSchema } from "../schemas/folder.schema.js";
import { supabase } from "../lib/supabase.js";
import { env } from "../config/env.js"
import { getAccessRole } from "../lib/access.js"

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

  // owned, or shared with us directly / through a parent folder
  const role = await getAccessRole(req.userId, 'folder', id as string)
  if (!role) {
    return res.status(404).json({
      error: { code: "FOLDER_NOT_FOUND", message: "Folder not found" },
    })
  }

  // 1. fetch the folder itself
  const { data: folder, error: folderError } = await supabase
    .from("folders")
    .select("id, name, parent_id, owner_id, created_at")
    .eq("id", id)
    .eq("is_deleted", false)
    .single()

  if (folderError || !folder) {
    return res.status(404).json({
      error: { code: "FOLDER_NOT_FOUND", message: "Folder not found" },
    })
  }
    const { data: folders, error: foldersError } = await supabase
        .from("folders")
        .select("id, name, parent_id, owner_id, created_at")
        .eq("parent_id", id)
        .eq("is_deleted", false)

    if (foldersError) {
        console.error("list child folders failed", foldersError)
        return res.status(500).json({
            error: { code: "INTERNAL_ERROR", message: "Failed to load folder" },
        })
    }

    const { data: files, error: filesError } = await supabase
        .from("files")
        .select("id, name, mime_type, size_bytes, folder_id, owner_id, created_at")
        .eq("folder_id", id)
        .eq("is_deleted", false)

    if (filesError) {
        console.error("list files failed", filesError)
        return res.status(500).json({
            error: { code: "INTERNAL_ERROR", message: "Failed to load folder" },
        })
    }

  // the caller's role here also covers the children: access to a shared folder
  // is inherited by everything inside it (see getAccessRole)
  return res.status(200).json({
    folder,
    children: { folders, files },
    role,
  })
}

export async function getRootController(req: Request, res: Response){
    const {data: folders, error: foldersError}= await supabase
        .from("folders")
        .select("id, name, parent_id, owner_id, created_at")
        .is("parent_id", null)
        .eq("owner_id", req.userId)
        .eq("is_deleted", false)

    const{data: files, error: filesError} = await supabase
        .from("files")
        .select("id, name, mime_type, size_bytes, folder_id, owner_id, created_at")
        .is("folder_id", null)
        .eq("owner_id", req.userId)
        .eq("is_deleted", false)

    if (filesError || foldersError) {
        console.error("list root failed", filesError, foldersError)
        return res.status(500).json({
            error: { code: "INTERNAL_ERROR", message: "Failed to load root" },
        })
    }

    // root only ever holds the caller's own items
    return res.status(200).json({
        folder: null,
        children: {folders, files},
        role: 'owner',
    })
}

export async function deleteFolderController(req:Request, res:Response){
    const {id} = req.params

    const { data: folder, error: folderError } = await supabase
        .from("folders")
        .select("id")
        .eq("id", id)
        .eq("owner_id", req.userId)
        .eq("is_deleted", false)
        .single()

    if (folderError || !folder)
        return res.status(404).json({
            error: { code: "FOLDER_NOT_FOUND", message: "Folder not found" },
        })
    const allFolderIds = [id]
    let currentLevel = [id]

    while (currentLevel.length > 0) {
        const { data: children, error: childError } = await supabase
            .from("folders")
            .select("id")
            .in("parent_id", currentLevel)
            .eq("owner_id", req.userId)
            .eq("is_deleted", false)

        if (childError) {
            console.error("cascade lookup failed", childError)
            return res.status(500).json({
                error: { code: "INTERNAL_ERROR", message: "Failed to delete folder" },
            })
        }

        currentLevel = children.map(c => c.id)
        allFolderIds.push(...currentLevel)
    }

    const { error: filesUpdateError } = await supabase
        .from("files")
        .update({ is_deleted: true })
        .in("folder_id", allFolderIds)
        .eq("owner_id", req.userId)

    if (filesUpdateError) {
        console.error("cascade folder update failed", filesUpdateError)
        return res.status(500).json({
            error: { code: "INTERNAL_ERROR", message: "Failed to delete folder" },
        })
    }

    const { error: folderUpdateError } = await supabase
    .from("folders")
    .update({ is_deleted: true })
    .in("id", allFolderIds)
    .eq("owner_id", req.userId)

    if (folderUpdateError) {

        if (folderUpdateError.code === "23505") {
            return res.status(409).json({
                error: {
                    code: "NAME_CONFLICT",
                    message: "A folder with that name already exists here",
                },
        })
    }
        console.error("cascade folder update failed", folderUpdateError)
        return res.status(500).json({
            error: { code: "INTERNAL_ERROR", message: "Failed to delete folder" },
        })
    }

    return res.status(204).send()
}

export async function restoreFolderController(req: Request, res: Response) {
    const { id } = req.params

    // look before writing — we may need to change the parent
    const { data: target, error: targetError } = await supabase
        .from("folders")
        .select("id, parent_id")
        .eq("id", id)
        .eq("owner_id", req.userId)
        .eq("is_deleted", true)
        .single()

    if (targetError || !target)
        return res.status(404).json({
            error: { code: "FOLDER_NOT_FOUND", message: "Folder not found" },
        })

    // if the original parent is still in the trash, restore to root instead
    let parentIsDeleted = false

    if (target.parent_id) {
        const { data: parent } = await supabase
            .from("folders")
            .select("id, is_deleted")
            .eq("id", target.parent_id)
            .eq("owner_id", req.userId)
            .single()

        parentIsDeleted = !parent || parent.is_deleted
    }

    const restoreUpdate: Record<string, unknown> = { is_deleted: false }
    if (parentIsDeleted) restoreUpdate.parent_id = null

    const { data: folder, error: folderError } = await supabase
        .from("folders")
        .update(restoreUpdate)
        .eq("id", id)
        .eq("owner_id", req.userId)
        .eq("is_deleted", true)
        .select("id")
        .single()

    if (folderError) {
        if (folderError.code === "23505") {
            return res.status(409).json({
                error: {
                    code: "NAME_CONFLICT",
                    message: "A folder with that name already exists there. Rename it and try again.",
                },
            })
        }
        console.error("restore failed", folderError)
        return res.status(500).json({
            error: { code: "INTERNAL_ERROR", message: "Failed to restore folder" },
        })
    }

    if (!folder)
        return res.status(404).json({
            error: { code: "FOLDER_NOT_FOUND", message: "Folder not found" },
        })

    // collect descendants that were cascade-deleted along with this folder
    const allFolderIds = [id]
    let currentLevel = [id]

    while (currentLevel.length > 0) {
        const { data: children, error: childError } = await supabase
            .from("folders")
            .select("id")
            .in("parent_id", currentLevel)
            .eq("owner_id", req.userId)
            .eq("is_deleted", true)

        if (childError) {
            console.error("cascade lookup failed", childError)
            return res.status(500).json({
                error: { code: "INTERNAL_ERROR", message: "Failed to restore folder" },
            })
        }

        currentLevel = children.map(c => c.id)
        allFolderIds.push(...currentLevel)
    }

    const { error: filesUpdateError } = await supabase
        .from("files")
        .update({ is_deleted: false })
        .in("folder_id", allFolderIds)
        .eq("owner_id", req.userId)

    if (filesUpdateError) {
        console.error("cascade file restore failed", filesUpdateError)
        return res.status(500).json({
            error: { code: "INTERNAL_ERROR", message: "Failed to restore folder" },
        })
    }

    const { error: folderUpdateError } = await supabase
        .from("folders")
        .update({ is_deleted: false })
        .in("id", allFolderIds)
        .eq("owner_id", req.userId)

    if (folderUpdateError) {
        console.error("cascade folder restore failed", folderUpdateError)
        return res.status(500).json({
            error: { code: "INTERNAL_ERROR", message: "Failed to restore folder" },
        })
    }

    return res.status(204).send()
}

export async function getTrashController(req: Request, res: Response) {
    const { data: folders, error: foldersError } = await supabase
        .from("folders")
        .select("id, name, parent_id, owner_id, created_at")
        .eq("owner_id", req.userId)
        .eq("is_deleted", true)

    if (foldersError) {
        console.error("list trash folders failed", foldersError)
        return res.status(500).json({
            error: { code: "INTERNAL_ERROR", message: "Failed to load trash" },
        })
    }

    const { data: files, error: filesError } = await supabase
        .from("files")
        .select("id, name, mime_type, size_bytes, folder_id, owner_id, created_at")
        .eq("owner_id", req.userId)
        .eq("is_deleted", true)

    if (filesError) {
        console.error("list trash files failed", filesError)
        return res.status(500).json({
            error: { code: "INTERNAL_ERROR", message: "Failed to load trash" },
        })
    }

    // anything whose parent is also deleted got here by cascade — hide it
    const deletedFolderIds = new Set(folders.map(f => f.id))

    const topLevelFolders = folders.filter(
        f => f.parent_id === null || !deletedFolderIds.has(f.parent_id)
    )

    const topLevelFiles = files.filter(
        f => f.folder_id === null || !deletedFolderIds.has(f.folder_id)
    )

    return res.status(200).json({
        folders: topLevelFolders,
        files: topLevelFiles,
    })
}

export async function updateFolderController(req: Request, res: Response) {
    const { id } = req.params

    const { success, error, data } = updateFolderSchema.safeParse(req.body)
    if (!success) {
        return res.status(400).json({
            error: { code: "VALIDATION_ERROR", issues: error.issues },
        })
    }

    // editing (rename/move) requires owner or editor access to the folder itself
    const role = await getAccessRole(req.userId, 'folder', id as string)
    if (role !== 'owner' && role !== 'editor') {
        return res.status(404).json({
            error: { code: "FOLDER_NOT_FOUND", message: "Folder not found" },
        })
    }

    // only validate the destination when the folder is actually moving
    if (data.parentId) {
        if (data.parentId === id) {
            return res.status(400).json({
                error: { code: "INVALID_MOVE", message: "Cannot move a folder into itself" },
            })
        }

        const parentRole = await getAccessRole(req.userId, 'folder', data.parentId)
        if (parentRole !== 'owner' && parentRole !== 'editor') {
            return res.status(404).json({
                error: { code: "PARENT_NOT_FOUND", message: "Parent folder not found" },
            })
        }

        // walk down from this folder — if the destination is somewhere below it,
        // the move would create a cycle
        let currentLevel = [id]

        while (currentLevel.length > 0) {
            const { data: children, error: childError } = await supabase
                .from("folders")
                .select("id")
                .in("parent_id", currentLevel)
                .eq("is_deleted", false)

            if (childError) {
                console.error("descendant lookup failed", childError)
                return res.status(500).json({
                    error: { code: "INTERNAL_ERROR", message: "Failed to update folder" },
                })
            }

            currentLevel = children.map(c => c.id)

            if (currentLevel.includes(data.parentId)) {
                return res.status(400).json({
                    error: {
                        code: "INVALID_MOVE",
                        message: "Cannot move a folder into its own subfolder",
                    },
                })
            }
        }
    }

    const updates: Record<string, unknown> = {}
    if (data.name !== undefined) updates.name = data.name
    if (data.parentId !== undefined) updates.parent_id = data.parentId

    const { data: folder, error: updateError } = await supabase
        .from("folders")
        .update(updates)
        .eq("id", id)
        .eq("is_deleted", false)
        .select("id, name, parent_id, owner_id, created_at")
        .single()

    if (updateError) {
        if (updateError.code === "23505") {
            return res.status(409).json({
                error: {
                    code: "FOLDER_EXISTS",
                    message: "A folder with that name already exists here",
                },
            })
        }
        console.error("update folder failed", updateError)
        return res.status(500).json({
            error: { code: "INTERNAL_ERROR", message: "Failed to update folder" },
        })
    }

    return res.status(200).json({ folder })
}

export async function permanentDeleteFolderController(req: Request, res: Response) {
  const { id } = req.params

  const { data: folder, error: selectError } = await supabase
    .from("folders")
    .select("id")
    .eq("id", id)
    .eq("owner_id", req.userId)
    .eq("is_deleted", true)
    .single()

  if (selectError || !folder) {
    return res.status(404).json({
      error: { code: "FOLDER_NOT_FOUND", message: "Folder not found" },
    })
  }

  // collect the whole subtree
  const allFolderIds = [id]
  let currentLevel = [id]

  while (currentLevel.length > 0) {
    const { data: children, error: childError } = await supabase
      .from("folders")
      .select("id")
      .in("parent_id", currentLevel)
      .eq("owner_id", req.userId)
      .eq("is_deleted", true)

    if (childError) {
      console.error("cascade lookup failed", childError)
      return res.status(500).json({
        error: { code: "INTERNAL_ERROR", message: "Failed to delete folder" },
      })
    }

    currentLevel = children.map(c => c.id)
    allFolderIds.push(...currentLevel)
  }

  // find every file in that subtree so we can clear the bucket
  const { data: files, error: filesError } = await supabase
    .from("files")
    .select("storage_key")
    .in("folder_id", allFolderIds)
    .eq("owner_id", req.userId)

  if (filesError) {
    console.error("file lookup failed", filesError)
    return res.status(500).json({
      error: { code: "INTERNAL_ERROR", message: "Failed to delete folder" },
    })
  }

  const storageKeys = files.map(f => f.storage_key)

  if (storageKeys.length > 0) {
    const { error: storageError } = await supabase.storage
      .from(env.SUPABASE_STORAGE_BUCKET)
      .remove(storageKeys)

    if (storageError) {
      console.error("bulk storage delete failed", storageError, storageKeys)
      // log and continue — a stuck row is worse than a logged orphan
    }
  }

  const { error: dbError } = await supabase
    .from("folders")
    .delete()
    .in("id", allFolderIds)
    .eq("owner_id", req.userId)

  if (dbError) {
    console.error("db delete failed", dbError)
    return res.status(500).json({
      error: { code: "DELETE_FAILED", message: "Failed to delete folder" },
    })
  }

  return res.status(204).send()
}