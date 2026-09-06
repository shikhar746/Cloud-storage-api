import { supabase } from './supabase.js'

/**
 * Marks which of these rows the caller has starred.
 *
 * Stars are per-user, so "starred" cannot be a column on the resource and has
 * to be joined in per request. One query covers both lists — the alternative,
 * asking per row, would turn a folder listing into N+1 round trips.
 */
export async function attachStarred<
  F extends { id: string },
  D extends { id: string },
>(
  userId: string,
  folders: F[],
  files: D[]
): Promise<{ folders: (F & { starred: boolean })[]; files: (D & { starred: boolean })[] }> {
  const ids = [...folders.map((f) => f.id), ...files.map((f) => f.id)]

  let starred = new Set<string>()
  if (ids.length > 0) {
    const { data, error } = await supabase
      .from('stars')
      .select('resource_type, resource_id')
      .eq('user_id', userId)
      .in('resource_id', ids)

    // a failed star lookup must not fail the listing — the worst case is a
    // star that renders hollow until the next refresh
    if (error) console.error('star lookup failed', error)
    else starred = new Set(data.map((s) => `${s.resource_type}:${s.resource_id}`))
  }

  return {
    folders: folders.map((f) => ({ ...f, starred: starred.has(`folder:${f.id}`) })),
    files: files.map((f) => ({ ...f, starred: starred.has(`file:${f.id}`) })),
  }
}
