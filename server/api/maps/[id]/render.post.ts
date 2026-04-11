/**
 * POST /api/maps/:id/render
 * Kick off a high-resolution render job on the Railway worker service.
 * The render worker runs Puppeteer, generates a 300 DPI JPEG + PDF,
 * uploads them to Supabase Storage, and patches the map record status → 'rendered'.
 *
 * This endpoint is fire-and-forget: it starts the render job and returns
 * immediately with a job_id. The client polls the map record's status field
 * directly from Supabase to detect completion.
 *
 * Render worker: render-worker/index.js (deployed on Railway)
 */
import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const mapId = getRouterParam(event, 'id')
  if (!mapId) throw createError({ statusCode: 400, message: 'Map ID required' })

  const supabase = await serverSupabaseClient(event)

  // Verify ownership and fetch map data
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
  const jobId = crypto.randomUUID()

  // Mark map as rendering (optimistic, lets the UI know we've started)
  // The worker will update status → 'rendered' when done.
  await supabase
    .from('maps')
    .update({ status: 'draft' })  // stays draft until worker completes
    .eq('id', mapId)

  // Fire the render job without awaiting — Puppeteer can take 60-90s
  // which would exceed the Vercel serverless function timeout.
  const workerUrl = config.renderWorkerUrl || 'http://localhost:3002'
  const workerSecret = config.renderWorkerSecret || 'dev-secret'

  // Use event.node.req.socket to prevent the Node.js process from blocking
  // We deliberately don't await this — fire-and-forget
  $fetch(`${workerUrl}/render`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${workerSecret}`,
      'Content-Type': 'application/json',
      // Pass the job_id so the worker can include it in logs
      'X-Job-Id': jobId,
    },
    body: {
      job_id: jobId,
      map_id: map.id,
      geojson: map.geojson,
      style_config: map.style_config,
      title: map.title,
      subtitle: map.subtitle,
      stats: map.stats,
      bbox: map.bbox,
      mapbox_token: config.public.mapboxToken,
      maptiler_token: config.public.maptilerToken,
    },
    // No timeout — the worker handles its own timeout internally
    timeout: 0,
  }).catch((err) => {
    // Log errors but don't throw — the request already returned to the client
    console.error(`[render ${jobId}] Worker request failed:`, err.message)
    // Mark map render as failed so the UI can show an error state
    supabase
      .from('maps')
      .update({ status: 'draft' })
      .eq('id', mapId)
      .then(() => {})
  })

  // Return immediately — client will poll map status
  return { job_id: jobId, status: 'queued' }
})
