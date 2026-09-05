import { z } from 'zod'

export const createFolderSchema = z.object({
  name: z.string()
    .min(1, "Name is required")
    .max(255, "Name must be at most 255 characters"),
  parentId: z.uuid().nullable().optional(),
})

export const updateFolderSchema = z.object({
    name: z.string().min(1).max(255).optional(),
    parentId: z.uuid().nullable().optional(),
}).refine(
    (d) => d.name !== undefined || d.parentId !== undefined,
    { message: "Provide at least one field to update" }
)

export type CreateFolderInput = z.infer<typeof createFolderSchema>
export type UpdateFolderInput = z.infer<typeof updateFolderSchema>
