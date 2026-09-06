import type { Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import { supabase } from '../lib/supabase.js'
import { env } from '../config/env.js'
import { publicAccessSchema } from '../schemas/shareLink.schema.js'

const SIGNED_URL_TTL_SECONDS = 60 * 60

interface ShareLinkRow {
  id: string
  token: string
  resource_type: 'file' | 'folder'
  resource_id: string
  password_hash: string | null
  expires_at: string | null
}

type LinkFailure = { status: number; code: string; message: string }

/**
 * Looks a link up and enforces existence and expiry — but NOT the password,
 * which callers check separately, because the metadata endpoint has to be able
 * to say "this one needs a password" without having been given one.
 */
async function loadLink(token: string): Promise<ShareLinkRow | LinkFailure> {
  const { data: link, error } = await supabase
    .from('share_links')
    .select('id, token, resource_type, resource_id, password_hash, expires_at')
    .eq('token', token)
    .maybeSingle()

  // A failed query and a genuinely absent link both end up denying access,
  // which is the right default — but only one of them is a bug, so say which.
  if (error) console.error('share link lookup failed', error)

  if (!link) {
    return { status: 404, code: 'LINK_NOT_FOUND', message: 'This link does not exist' }
  }

  // 410 rather than 404: the link genuinely existed, and telling the visitor it
  // expired is more useful than pretending it was never real
  if (link.expires_at && new Date(link.expires_at).getTime() <= Date.now()) {
    return { status: 410, code: 'LINK_EXPIRED', message: 'This link has expired' }
  }

  return link as ShareLinkRow
}

function isFailure(value: ShareLinkRow | LinkFailure): value is LinkFailure {
  return 'status' in value
}

/** Walks up from a folder to confirm it really sits under the shared one. */
async function isDescendantFolder(folderId: string, ancestorId: string): Promise<boolean> {
  if (folderId === ancestorId) return true

  // annotated rather than inferred: `current` is assigned from the row and the
  // row is fetched using `current`, which TypeScript reads as a circular
  // initializer (TS7022) unless the shape is stated outright
  type FolderRef = { id: string; parent_id: string | null }

  let current: string | null = folderId
  // bounded like getAccessRole, so malformed data cannot loop forever
  for (let depth = 0; current && depth < 50; depth++) {
    const { data } = await supabase
      .from('folders')
      .select('id, parent_id')
      .eq('id', current)
      .eq('is_deleted', false)
      .maybeSingle()

    const folder = data as FolderRef | null
    if (!folder) return false
    if (folder.id === ancestorId) return true
    current = folder.parent_id
  }
  return false
}

async function passwordAccepted(
  link: ShareLinkRow,
  supplied: string | undefined
): Promise<boolean> {
  if (!link.password_hash) return true
  if (!supplied) return false
  return bcrypt.compare(supplied, link.password_hash)
}

function touch(linkId: string) {
  // fire and forget: a failed timestamp update must not fail the download
  void supabase
    .from('share_links')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', linkId)
    .then(({ error }) => {
      if (error) console.error('share link touch failed', error)
    })
}

async function resourceName(link: ShareLinkRow): Promise<string | null> {
  const table = link.resource_type === 'file' ? 'files' : 'folders'
  const { data } = await supabase
    .from(table)
    .select('name')
    .eq('id', link.resource_id)
    .eq('is_deleted', false)
    .maybeSingle()
  return data?.name ?? null
}

/**
 * Metadata only, and deliberately thin.
 *
 * When a link is password protected this reveals nothing beyond "a password is
 * needed" — not the name, not the size, not the owner. Naming the file before
 * the password is checked would leak the very thing the password protects.
 */
export async function getPublicShareController(req: Request, res: Response) {
  const link = await loadLink(req.params.token as string)
  if (isFailure(link)) {
    return res.status(link.status).json({ error: { code: link.code, message: link.message } })
  }

  if (link.password_hash) {
    return res.status(200).json({
      resourceType: link.resource_type,
      requiresPassword: true,
      expiresAt: link.expires_at,
    })
  }

  const name = await resourceName(link)
  if (!name) {
    return res.status(404).json({
      error: { code: 'RESOURCE_GONE', message: 'The shared item no longer exists' },
    })
  }

  return res.status(200).json({
    resourceType: link.resource_type,
    requiresPassword: false,
    expiresAt: link.expires_at,
    name,
  })
}

async function listPublicFolder(res: Response, link: ShareLinkRow, folderId: string) {
  const { data: folder } = await supabase
    .from('folders')
    .select('id, name, parent_id, created_at')
    .eq('id', folderId)
    .eq('is_deleted', false)
    .maybeSingle()

  if (!folder) {
    return res.status(404).json({
      error: { code: 'RESOURCE_GONE', message: 'The shared folder no longer exists' },
    })
  }

  const [{ data: folders }, { data: files }] = await Promise.all([
    supabase
      .from('folders')
      .select('id, name, parent_id, created_at')
      .eq('parent_id', folderId)
      .eq('is_deleted', false),
    supabase
      .from('files')
      .select('id, name, mime_type, size_bytes, folder_id, created_at')
      .eq('folder_id', folderId)
      .eq('is_deleted', false),
  ])

  touch(link.id)

  const isRoot = folder.id === link.resource_id

  return res.status(200).json({
    resourceType: 'folder',
    // the shared folder is the visitor's root, so parent_id is stripped at that
    // boundary and the UI cannot offer to navigate above it
    folder: { ...folder, parent_id: isRoot ? null : folder.parent_id },
    isRoot,
    children: { folders: folders ?? [], files: files ?? [] },
  })
}

/** Opens the link: a signed URL for a file, or a listing for a folder. */
export async function accessPublicShareController(req: Request, res: Response) {
  const parsed = publicAccessSchema.safeParse(req.body ?? {})
  if (!parsed.success) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', issues: parsed.error.issues },
    })
  }

  const link = await loadLink(req.params.token as string)
  if (isFailure(link)) {
    return res.status(link.status).json({ error: { code: link.code, message: link.message } })
  }

  if (!(await passwordAccepted(link, parsed.data.password))) {
    return res.status(401).json({
      error: { code: 'INVALID_PASSWORD', message: 'Incorrect password' },
    })
  }

  if (link.resource_type === 'file') {
    const { data: file } = await supabase
      .from('files')
      .select('id, name, mime_type, size_bytes, created_at, storage_key')
      .eq('id', link.resource_id)
      .eq('is_deleted', false)
      .maybeSingle()

    if (!file) {
      return res.status(404).json({
        error: { code: 'RESOURCE_GONE', message: 'The shared file no longer exists' },
      })
    }

    const { data: signed } = await supabase.storage
      .from(env.SUPABASE_STORAGE_BUCKET)
      .createSignedUrl(file.storage_key, SIGNED_URL_TTL_SECONDS)

    if (!signed) {
      return res.status(404).json({
        error: { code: 'RESOURCE_GONE', message: 'The shared file no longer exists' },
      })
    }

    touch(link.id)
    const { storage_key, ...safeFile } = file
    return res
      .status(200)
      .json({ resourceType: 'file', file: safeFile, signedUrl: signed.signedUrl })
  }

  return listPublicFolder(res, link, link.resource_id)
}

/**
 * Opening a subfolder through a folder link. The requested folder must sit
 * under the shared one — without that check, a token for one folder would read
 * any folder in the database by id.
 */
export async function browsePublicShareController(req: Request, res: Response) {
  const parsed = publicAccessSchema.safeParse(req.body ?? {})
  if (!parsed.success) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', issues: parsed.error.issues },
    })
  }

  const link = await loadLink(req.params.token as string)
  if (isFailure(link)) {
    return res.status(link.status).json({ error: { code: link.code, message: link.message } })
  }

  if (!(await passwordAccepted(link, parsed.data.password))) {
    return res.status(401).json({
      error: { code: 'INVALID_PASSWORD', message: 'Incorrect password' },
    })
  }

  if (link.resource_type !== 'folder') {
    return res.status(400).json({
      error: { code: 'NOT_A_FOLDER', message: 'This link does not point at a folder' },
    })
  }

  const folderId = req.params.folderId as string
  if (!(await isDescendantFolder(folderId, link.resource_id))) {
    return res.status(404).json({
      error: { code: 'FOLDER_NOT_FOUND', message: 'Not found' },
    })
  }

  return listPublicFolder(res, link, folderId)
}

/** A single file reached through a link, verified to be within its scope. */
export async function publicFileController(req: Request, res: Response) {
  const parsed = publicAccessSchema.safeParse(req.body ?? {})
  if (!parsed.success) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', issues: parsed.error.issues },
    })
  }

  const link = await loadLink(req.params.token as string)
  if (isFailure(link)) {
    return res.status(link.status).json({ error: { code: link.code, message: link.message } })
  }

  if (!(await passwordAccepted(link, parsed.data.password))) {
    return res.status(401).json({
      error: { code: 'INVALID_PASSWORD', message: 'Incorrect password' },
    })
  }

  const { data: file } = await supabase
    .from('files')
    .select('id, name, mime_type, size_bytes, folder_id, created_at, storage_key')
    .eq('id', req.params.fileId as string)
    .eq('is_deleted', false)
    .maybeSingle()

  if (!file) {
    return res.status(404).json({ error: { code: 'FILE_NOT_FOUND', message: 'Not found' } })
  }

  // the file must BE the shared one, or live somewhere beneath a shared folder
  const allowed =
    link.resource_type === 'file'
      ? file.id === link.resource_id
      : Boolean(file.folder_id) && (await isDescendantFolder(file.folder_id!, link.resource_id))

  if (!allowed) {
    return res.status(404).json({ error: { code: 'FILE_NOT_FOUND', message: 'Not found' } })
  }

  const { data: signed } = await supabase.storage
    .from(env.SUPABASE_STORAGE_BUCKET)
    .createSignedUrl(file.storage_key, SIGNED_URL_TTL_SECONDS)

  if (!signed) {
    return res.status(404).json({ error: { code: 'FILE_NOT_FOUND', message: 'Not found' } })
  }

  touch(link.id)
  const { storage_key, ...safeFile } = file
  return res.status(200).json({ file: safeFile, signedUrl: signed.signedUrl })
}
