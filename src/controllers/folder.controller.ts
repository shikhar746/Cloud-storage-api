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