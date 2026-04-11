/**
 * GET /api/maps/:id/versions
 * Returns saved style snapshots for a map (owned by the authenticated user).
 */
import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const mapId = getRouterParam(event, 'id')
  if (!mapId) throw createError({ statusCode: 400, message: 'Missing map ID' })

  const supabase = await serverSupabaseClient(event)

  const { data: versions, error } = await supabase
    .from('map_versions')
    .select('id, label, style_config, created_at')
    .eq('map_id', mapId)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) throw createError({ statusCode: 500, message: 'Failed to load versions' })

  return versions ?? []
})
