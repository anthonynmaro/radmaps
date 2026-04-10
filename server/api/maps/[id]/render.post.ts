/**
 * POST /api/maps/:id/render
 * Trigger a high-resolution render job on the Railway worker service.
 * The worker renders the map at 300 DPI using Puppeteer + MapLibre GL JS,
 * then uploads JPEG + PDF to Supabase Storage.
 */
import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const mapId = getRouterParam(event, 'id')
  if (!mapId) throw createError({ statusCode: 400, message: 'Map ID required' })

  const supabase = await serverSupabaseClient(event)

  // Verify ownership
  const { data: map, error: fetchError } = await supabase
    .from('maps')
    .select('id, user_id, geojson, style_config, title, subtitle, stats, bbox')
    .eq('id', mapId)
    .eq('user_id', user.id)
    .single()

  if (fetchError || !map) {
    throw createError({ statusCode: 404, message: 'Map not found' })
  }

  const config = useRuntimeConfig()

  // Call the Railway render worker
  const response = await $fetch<{ job_id: string }>(`${config.renderWorkerUrl}/render`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.renderWorkerSecret}`,
      'Content-Type': 'application/json',
    },
    body: {
      map_id: map.id,
      geojson: map.geojson,
      style_config: map.style_config,
      title: map.title,
      subtitle: map.subtitle,
      stats: map.stats,
      bbox: map.bbox,
      mapbox_token: config.public.mapboxToken,
    },
  })

  return { job_id: response.job_id, status: 'queued' }
})
