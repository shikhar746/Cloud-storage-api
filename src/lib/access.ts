import { supabase } from './supabase.js'

export type AccessRole = 'owner' | 'editor' | 'viewer' | null
export type ResourceType = 'file' | 'folder'

const MAX_DEPTH = 50

export async function getAccessRole(
  userId: string,
  resourceType: ResourceType,
  resourceId: string
): Promise<AccessRole> {
  // 1. does it exist, and do we own it?
  const table = resourceType === 'file' ? 'files' : 'folders'
  const parentColumn = resourceType === 'file' ? 'folder_id' : 'parent_id'

  const { data: resource, error: resourceError } = await supabase
    .from(table)
    .select(`id, owner_id, ${parentColumn}`)
    .eq('id', resourceId)
    .eq('is_deleted', false)
    .single()

  if (resourceError || !resource) return null

  if (resource.owner_id === userId) return 'owner'

  // 2. shared with us directly?
  const { data: direct } = await supabase
    .from('shares')
    .select('role')
    .eq('resource_type', resourceType)
    .eq('resource_id', resourceId)
    .eq('grantee_user_id', userId)
    .single()

  if (direct) return direct.role as AccessRole

  // 3. walk up the folder chain looking for a shared ancestor
  const ancestorIds: string[] = []
  let currentId: string | null = (resource as Record<string, any>)[parentColumn]
  let depth = 0

  while (currentId && depth < MAX_DEPTH) {
    const { data: folder } = await supabase
      .from('folders')
      .select('id, parent_id')
      .eq('id', currentId)
      .eq('is_deleted', false)
      .single()

    if (!folder) break

    ancestorIds.push(folder.id)
    currentId = folder.parent_id
    depth++
  }

  if (ancestorIds.length === 0) return null

  const { data: inherited } = await supabase
    .from('shares')
    .select('role')
    .eq('resource_type', 'folder')
    .in('resource_id', ancestorIds)
    .eq('grantee_user_id', userId)

  if (!inherited || inherited.length === 0) return null

  // closest ancestor wins is the ideal, but any editor grant beats viewer
  return inherited.some(s => s.role === 'editor') ? 'editor' : 'viewer'
}