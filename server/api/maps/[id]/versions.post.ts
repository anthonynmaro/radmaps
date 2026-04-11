/**
 * POST /api/maps/:id/versions
 * Body: { label?: string }
 * Saves a named snapshot of the map's current style_config.
 * Requires authentication.
 */
import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const mapId = getRouterParam(event, 'id')
  if (!mapId) throw createError({ statusCode: 400, message: 'Missing map ID' })

  const body = await readBody(event).catch(() => ({}))
  const label = (body?.label as string)?.trim() || null

  const supabase = await serverSupabaseClient(event)

  // Verify ownership and get current style_config
  const { data: map, error: mapError } = await supabase
    .from('maps')
    .select('id, style_config')
    .eq('id', mapId)
    .eq('user_id', user.id)
    .single()

  if (mapError || !map) {
    throw createError({ statusCode: 404, message: 'Map not found' })
  }

  const { data: version, error: insertError } = await supabase
    .from('map_versions')
    .insert({
      map_id: mapId,
      user_id: user.id,
      label,
      style_config: map.style_config,
    })
    .select('id, label, created_at')
    .single()

  if (insertError) {
    throw createError({ statusCode: 500, message: 'Failed to save version' })
  }

  return version
})
