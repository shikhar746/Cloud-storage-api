import { z } from "zod";

export const uploadFileSchema = z.object({
  folderId: z.uuid().nullable().optional(),
})

export const updateFileSchema = z.object({
    name: z.string().min(1).max(255).optional(),
    folderId: z.uuid().nullable().optional(),
}).refine(
    (d) => d.name !== undefined || d.folderId !== undefined,
    { message: "Provide at least one field to update" }
)