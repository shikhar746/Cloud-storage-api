import type { Request, Response } from 'express'
import { supabase } from '../lib/supabase.js'

export async function searchController(req: Request, res: Response) {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : ''

  if (!q) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Query parameter q is required' },
    })
  }

  // % and _ are LIKE wildcards — escape them so a literal search works
  const pattern = `%${q.replace(/[\\%_]/g, '\\$&')}%`

  const { data: folders, error: foldersError } = await supabase
    .from('folders')
    .select('id, name, parent_id, created_at')
    .eq('owner_id', req.userId)
    .eq('is_deleted', false)
    .ilike('name', pattern)
    .limit(50)

  if (foldersError) {
    console.error('search folders failed', foldersError)
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Search failed' },
    })
  }

  const { data: files, error: filesError } = await supabase
    .from('files')
    .select('id, name, mime_type, size_bytes, folder_id, created_at')
    .eq('owner_id', req.userId)
    .eq('is_deleted', false)
    .ilike('name', pattern)
    .limit(50)

  if (filesError) {
    console.error('search files failed', filesError)
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Search failed' },
    })
  }

  return res.status(200).json({ folders, files })
}
