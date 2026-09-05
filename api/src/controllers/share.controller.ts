import type { Request, Response } from 'express'
import { supabase } from '../lib/supabase.js'
import { getAccessRole, type ResourceType } from '../lib/access.js'
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

export async function listSharedWithMeController(req: Request, res: Response) {
  const { data: shares, error: sharesError } = await supabase
    .from('shares')
    .select('id, resource_type, resource_id, role, created_at, users!created_by(id, email, name)')
    .eq('grantee_user_id', req.userId)

  if (sharesError) {
    console.error('list shared-with-me failed', sharesError)
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to load shared items' },
    })
  }

  // only the directly shared resources are listed. what sits inside a shared
  // folder is reachable by opening it, and getAccessRole already lets that in.
  const folderIds = shares.filter(s => s.resource_type === 'folder').map(s => s.resource_id)
  const fileIds = shares.filter(s => s.resource_type === 'file').map(s => s.resource_id)

  const byResourceId = new Map(shares.map(s => [s.resource_id, s]))

  // a share row outlives the resource being trashed, so filter on is_deleted
  // here rather than trusting the share to have been cleaned up
  const [folderResult, fileResult] = await Promise.all([
    folderIds.length > 0
      ? supabase
          .from('folders')
          .select('id, name, parent_id, owner_id, created_at')
          .in('id', folderIds)
          .eq('is_deleted', false)
      : Promise.resolve({ data: [], error: null }),
    fileIds.length > 0
      ? supabase
          .from('files')
          .select('id, name, mime_type, size_bytes, folder_id, owner_id, created_at')
          .in('id', fileIds)
          .eq('is_deleted', false)
      : Promise.resolve({ data: [], error: null }),
  ])

  if (folderResult.error || fileResult.error) {
    console.error('shared-with-me lookup failed', folderResult.error, fileResult.error)
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to load shared items' },
    })
  }

  const decorate = <T extends { id: string }>(row: T) => {
    const share = byResourceId.get(row.id)
    const sharedBy = share?.users as unknown as
      | { id: string; email: string; name: string | null }
      | null
    return {
      ...row,
      share_id: share?.id,
      role: share?.role,
      shared_at: share?.created_at,
      shared_by: sharedBy ?? null,
    }
  }

  return res.status(200).json({
    folders: (folderResult.data ?? []).map(decorate),
    files: (fileResult.data ?? []).map(decorate),
  })
}

export async function listSharesController(req: Request, res: Response) {
  const { resourceType, resourceId } = req.params
//reason why typeof resourseId is checked is that req.params return a string or undefined or null
  if (typeof resourceId !== 'string' || (resourceType !== 'file' && resourceType !== 'folder')) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'resourceType must be file or folder' },
    })
  }

  const role = await getAccessRole(req.userId, resourceType, resourceId)

  if (role !== 'owner') {
    return res.status(403).json({
      error: { code: 'FORBIDDEN', message: 'Only the owner can view shares' },
    })
  }

  const { data: shares, error: listError } = await supabase
    .from('shares')
    .select('id, role, created_at, users!grantee_user_id(id, email, name)')
    .eq('resource_type', resourceType)
    .eq('resource_id', resourceId)

  if (listError) {
    console.error('list shares failed', listError)
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to load shares' },
    })
  }

  return res.status(200).json({ shares })
}

export async function deleteShareController(req: Request, res: Response) {
  const { id } = req.params

  // need the row first — ownership lives on the resource, not the share
  const { data: share } = await supabase
    .from('shares')
    .select('id, resource_type, resource_id')
    .eq('id', id)
    .maybeSingle()

  if (!share) {
    return res.status(404).json({
      error: { code: 'SHARE_NOT_FOUND', message: 'Share not found' },
    })
  }

  const role = await getAccessRole(
    req.userId,
    share.resource_type as ResourceType,
    share.resource_id
  )

  if (role !== 'owner') {
    return res.status(403).json({
      error: { code: 'FORBIDDEN', message: 'Only the owner can revoke shares' },
    })
  }

  const { error: deleteError } = await supabase
    .from('shares')
    .delete()
    .eq('id', id)

  if (deleteError) {
    console.error('delete share failed', deleteError)
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to revoke share' },
    })
  }

  return res.status(204).send()
}