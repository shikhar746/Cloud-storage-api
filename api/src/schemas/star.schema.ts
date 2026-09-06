import { z } from 'zod'

export const createStarSchema = z.object({
  resourceType: z.enum(['file', 'folder']),
  resourceId: z.uuid(),
})

// the same pair, but arriving as route params rather than a body
export const starParamsSchema = z.object({
  resourceType: z.enum(['file', 'folder']),
  resourceId: z.uuid(),
})

export type CreateStarInput = z.infer<typeof createStarSchema>
