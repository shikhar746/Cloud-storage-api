import { z } from 'zod'

export const createShareLinkSchema = z.object({
  resourceType: z.enum(['file', 'folder']),
  resourceId: z.uuid(),
  // null / omitted means the link never expires
  expiresInDays: z.number().int().positive().max(3650).nullable().optional(),
  // omitted means no password. Bounded at 72 because bcrypt silently truncates
  // beyond that, which would make the tail of a long password meaningless.
  password: z.string().min(4).max(72).nullable().optional(),
})

export const publicAccessSchema = z.object({
  password: z.string().max(72).optional(),
})

export type CreateShareLinkInput = z.infer<typeof createShareLinkSchema>
