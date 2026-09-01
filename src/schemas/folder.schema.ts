import { z } from 'zod'

export const createFolderSchema = z.object({
  name: z.string()
    .min(1, "Name is required")
    .max(255, "Name must be at most 255 characters"),
  parentId: z.uuid().nullable().optional(),
})

export type CreateFolderInput = z.infer<typeof createFolderSchema>
