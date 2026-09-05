import { z } from 'zod'

export const createShareSchema = z.object({
  resourceType: z.enum(['file', 'folder']),
  resourceId: z.uuid(),
  granteeUserId: z.uuid(),
  role: z.enum(['viewer', 'editor']),
})



export type CreateShareInput = z.infer<typeof createShareSchema>
