import type { Request, Response } from 'express'
import crypto from 'node:crypto'
import bcrypt from 'bcryptjs'
import { supabase } from '../lib/supabase.js'
import { getAccessRole } from '../lib/access.js'
import { createShareLinkSchema } from '../schemas/shareLink.schema.js'

/** 32 random bytes, URL-safe. Long enough that guessing is not a threat model. */
function newToken(): string {
  return crypto.randomBytes(32).toString('base64url')
}

export async function createShareLinkController(req: Request, res: Response) {
  const { success, error, data } = createShareLinkSchema.safeParse(req.body)
  if (!success) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', issues: error.issues },
    })
  }

  // Owner only. An editor on a shared folder may add files to it, but handing
  // the owner's content to the entire internet is not theirs to decide.
  const role = await getAccessRole(req.userId, data.resourceType, data.resourceId)
  if (role !== 'owner') {
    return res.status(404).json({
      error: { code: 'RESOURCE_NOT_FOUND', message: 'Not found' },
    })
  }

  const expiresAt = data.expiresInDays
    ? new Date(Date.now() + data.expiresInDays * 24 * 60 * 60 * 1000).toISOString()
    : null

  const passwordHash = data.password ? await bcrypt.hash(data.password, 10) : null

  const { data: link, error: insertError } = await supabase
    .from('share_links')
    .insert({
      token: newToken(),
      resource_type: data.resourceType,
      resource_id: data.resourceId,
      created_by: req.userId,
      password_hash: passwordHash,
      expires_at: expiresAt,
    })
    .select('id, token, resource_type, resource_id, expires_at, created_at, last_used_at')
    .single()

  if (insertError || !link) {
    console.error('create share link failed', insertError)
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Could not create the link' },
    })
  }

  // has_password rather than the hash: the caller set it, they do not need it back
  return res.status(201).json({ link: { ...link, has_password: Boolean(passwordHash) } })
}

export async function listShareLinksController(req: Request, res: Response) {
  const { resourceType, resourceId } = req.params

  if (resourceType !== 'file' && resourceType !== 'folder') {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'resourceType must be file or folder' },
    })
  }

  const role = await getAccessRole(req.userId, resourceType, resourceId as string)
  if (role !== 'owner') {
    return res.status(404).json({
      error: { code: 'RESOURCE_NOT_FOUND', message: 'Not found' },
    })
  }

  const { data: links, error } = await supabase
    .from('share_links')
    .select('id, token, resource_type, resource_id, expires_at, created_at, last_used_at, password_hash')
    .eq('resource_type', resourceType)
    .eq('resource_id', resourceId)
    .eq('created_by', req.userId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('list share links failed', error)
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Could not load links' },
    })
  }

  // the hash never leaves the server; the owner only needs to know one exists
  return res.status(200).json({
    links: links.map(({ password_hash, ...rest }) => ({
      ...rest,
      has_password: Boolean(password_hash),
    })),
  })
}

export async function deleteShareLinkController(req: Request, res: Response) {
  const { id } = req.params

  // scoped to created_by, so one owner cannot revoke another's link by id
  const { data: deleted, error } = await supabase
    .from('share_links')
    .delete()
    .eq('id', id)
    .eq('created_by', req.userId)
    .select('id')

  if (error) {
    console.error('delete share link failed', error)
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Could not revoke the link' },
    })
  }

  if (!deleted || deleted.length === 0) {
    return res.status(404).json({
      error: { code: 'LINK_NOT_FOUND', message: 'Link not found' },
    })
  }

  return res.status(200).json({ success: true })
}
