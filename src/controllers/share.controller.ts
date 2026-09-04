import type { Request, Response } from 'express'
import { supabase } from '../lib/supabase.js'
import { getAccessRole } from '../lib/access.js'
import { createShareSchema } from '../schemas/share.schema.js'

export async function createShareController(req: Request, res: Response) {
  const { success, error, data } = createShareSchema.safeParse(req.body)

  if (!success) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', issues: error.issues },
    })
  }

  // only the owner may share
  const role = await getAccessRole(req.userId, data.resourceType, data.resourceId)

  if (role !== 'owner') {
    return res.status(403).json({
      error: { code: 'FORBIDDEN', message: 'Only the owner can share this' },
    })
  }

  if (data.granteeUserId === req.userId) {
    return res.status(400).json({
      error: { code: 'INVALID_GRANTEE', message: 'Cannot share with yourself' },
    })
  }

  const { data: grantee } = await supabase
    .from('users')
    .select('id')
    .eq('id', data.granteeUserId)
    .single()

  if (!grantee) {
    return res.status(404).json({
      error: { code: 'USER_NOT_FOUND', message: 'User not found' },
    })
  }

  const { data: share, error: insertError } = await supabase
    .from('shares')
    .upsert({
      resource_type: data.resourceType,
      resource_id: data.resourceId,
      grantee_user_id: data.granteeUserId,
      role: data.role,
      created_by: req.userId,
    }, { onConflict: 'resource_type,resource_id,grantee_user_id' })
    .select('id, resource_type, resource_id, grantee_user_id, role, created_at')
    .single()

  if (insertError) {
    console.error('create share failed', insertError)
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to create share' },
    })
  }

  return res.status(201).json({ share })
}