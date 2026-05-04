/**
 * POST /api/maps/:id/render
 *
 * Two paths, gated by the `RENDER_PIPELINE_V4_ENABLED` runtime flag:
 *
 *   1. v4 path (flag = true): compute hashes, check the proof cache,
 *      capture the dedicated Nuxt render page through Browserless, then
 *      upload the proof artifact.
 *      Returns one of:
 *        { status: 'cached',      render_url, proof_render_hash }
 *
 *   2. Legacy path (flag = false, default): kicks off the legacy
 *      Puppeteer worker fire-and-forget; client polls `maps.status`.
 *
 * The flag defaults to OFF (see nuxt.config.ts), so existing behavior
 * is preserved verbatim until it's flipped ON in production.
 */
import type { H3Event } from 'h3'
import { serverSupabaseClient, serverSupabaseServiceRole, serverSupabaseUser } from '#supabase/server'
import { DEFAULT_STYLE_CONFIG, type StyleConfig, type RouteStats } from '~/types'
import { computeMapContentHash, computeChromeHash, computeProofRenderHash } from '~/utils/render/hash'
import { getPrintFraming } from '~/utils/print/printFraming'
import { getProviderProfile } from '~/utils/print/providerProfile'
import { createRenderTicket } from '~/utils/render/renderTicket'
import { getProofPath } from '~/utils/render/storagePaths'
import { takeScreenshot } from '~/server/utils/screenshotService'
import { validateJpegBasics } from '~/server/utils/jpegMeta'

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const mapId = getRouterParam(event, 'id')
  if (!mapId) throw createError({ statusCode: 400, message: 'Map ID required' })

  const config = useRuntimeConfig()
  const supabase = await serverSupabaseClient(event)

  // ─── v4 branch ────────────────────────────────────────────────────────────
  if (config.renderPipelineV4Enabled) {
    return await handleV4Render({ event, mapId, userId: user.id, config })
  }

  // ─── Legacy branch (preserved verbatim) ───────────────────────────────────

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

  const jobId = crypto.randomUUID()

  // Mark map as rendering so the UI can show an in-progress state.
  // The worker will update status → 'rendered' (and is_public → true) when done.
  await supabase
    .from('maps')
    .update({ status: 'rendering' })
    .eq('id', mapId)

  const {
    quality = 'print',
    render_width_px,
    render_height_px,
    framing,
  } = await readBody(event).catch(() => ({}))

  // Fire the render job without awaiting — Puppeteer can take 60-90s
  // which would exceed the Vercel serverless function timeout.
  const workerUrl = config.renderWorkerUrl || 'http://localhost:3002'
  const workerSecret = config.renderWorkerSecret || 'dev-secret'

  // We deliberately don't await this — fire-and-forget
  $fetch(`${workerUrl}/render`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${workerSecret}`,
      'Content-Type': 'application/json',
      'X-Job-Id': jobId,
    },
    body: {
      job_id: jobId,
      map_id: map.id,
      geojson: map.geojson,
      style_config: map.style_config ?? DEFAULT_STYLE_CONFIG,
      title: map.title,
      subtitle: map.subtitle,
      stats: map.stats,
      bbox: map.bbox,
      mapbox_token: config.public.mapboxToken,
      maptiler_token: config.public.maptilerToken,
      quality,
      // Product-specific render dimensions (when provided)
      render_width_px,
      render_height_px,
      // User-adjusted map framing from ProductSelector
      framing,
    },
    // No timeout — the worker handles its own timeout internally
    timeout: 0,
  }).catch((err) => {
    // Log the raw error server-side (includes internal URL) but never expose it to the client
    console.error(`[render ${jobId}] Worker request failed:`, err.message)
    const msg = /ECONNREFUSED|fetch failed|no response/i.test(err.message)
      ? 'Render service unavailable. Please try again in a moment.'
      : 'Render failed. Please try again.'
    supabase
      .from('maps')
      .update({ render_url: `error:${msg}` })
      .eq('id', mapId)
      .then(() => {})
  })

  // Return immediately — client will poll map status
  return { job_id: jobId, status: 'queued' }
})

// ─── v4 handler ──────────────────────────────────────────────────────────────
//
// Self-contained so the legacy path stays untouched. Uses the
// service-role client for the render_cache read because the table has
// no per-user RLS and the user is already authenticated above.

interface V4Args {
  event: H3Event
  mapId: string
  userId: string
  config: ReturnType<typeof useRuntimeConfig>
}

async function handleV4Render(args: V4Args) {
  const { event, mapId, userId, config } = args
  const supabase = await serverSupabaseClient(event)
  const adminClient = await serverSupabaseServiceRole(event)

  const body = await readBody(event).catch(() => ({})) as {
    product_uid?: string
    render_backend?: 'native' | 'browser'
  }

  // 1. Load map row with everything we need to hash + dispatch.
  const { data: map, error: fetchError } = await supabase
    .from('maps')
    .select('id, user_id, geojson, style_config, stats, bbox, proof_render_hash, proof_render_url')
    .eq('id', mapId)
    .eq('user_id', userId)
    .single()

  if (fetchError || !map) {
    throw createError({ statusCode: 404, message: 'Map not found' })
  }

  const styleConfig = (map.style_config ?? DEFAULT_STYLE_CONFIG) as StyleConfig
  const stats = (map.stats ?? {}) as RouteStats
  const geojson = (map.geojson ?? { type: 'FeatureCollection', features: [] }) as GeoJSON.FeatureCollection
  const bbox = map.bbox as [number, number, number, number] | null

  // Resolve product UID. Checkout pins the concrete Gelato product UID;
  // editor proofs fall back to the canonical 2:3 style size.
  const productUid = body.product_uid ?? styleConfig.print_size
  if (!productUid) {
    throw createError({ statusCode: 400, message: 'product_uid required (no print_size in style_config)' })
  }

  const framing = getPrintFraming(productUid, 'proof')

  // 2. Compute the three hashes.
  const mapContentHash = computeMapContentHash(styleConfig, geojson, framing)
  const chromeHash = computeChromeHash(styleConfig, stats)
  const proofRenderHash = computeProofRenderHash(mapContentHash, chromeHash)

  // 3. Proof cache hit on the maps row itself — fully cached, no work.
  if (map.proof_render_hash === proofRenderHash && map.proof_render_url) {
    return {
      status: 'cached' as const,
      render_url: map.proof_render_url,
      proof_render_hash: proofRenderHash,
    }
  }

  const deviceScaleFactor = 1
  const ticket = createRenderTicket({
    kind: 'map',
    subject: mapId,
    renderClass: 'proof',
    widthPx: framing.fullWidthPx,
    heightPx: framing.fullHeightPx,
    deviceScaleFactor,
    productUid,
    expiresAt: Date.now() + 10 * 60_000,
  }, config.renderTicketSecret)

  const siteUrl = config.public.siteUrl || 'https://radmaps.studio'
  const renderUrl = new URL(`/render/map/${mapId}`, siteUrl)
  renderUrl.searchParams.set('ticket', ticket)

  const screenshot = await takeScreenshot({
    url: renderUrl.toString(),
    widthPx: Math.round(framing.fullWidthPx / deviceScaleFactor),
    heightPx: Math.round(framing.fullHeightPx / deviceScaleFactor),
    deviceScaleFactor,
    format: 'jpeg',
    quality: 95,
    waitForFunction: 'window.__RENDER_READY === true && window.__RADMAPS_RENDER_STATUS?.routeLayerPresent === true',
    timeoutMs: config.browserlessTimeoutMs,
  })

  const profile = getProviderProfile(productUid)
  validateJpegBasics({
    buffer: screenshot.buffer,
    expectedWidth: framing.fullWidthPx,
    expectedHeight: framing.fullHeightPx,
    maxFileSizeMb: profile.maxFileSizeMb,
  })

  const proofPath = getProofPath(mapId, proofRenderHash)
  const { error: uploadError } = await adminClient.storage
    .from('maps')
    .upload(proofPath, screenshot.buffer, {
      contentType: screenshot.contentType,
      upsert: true,
      cacheControl: '3600',
    })
  if (uploadError) {
    throw createError({ statusCode: 500, message: `Proof upload failed: ${uploadError.message}` })
  }

  const { data: publicUrl } = adminClient.storage.from('maps').getPublicUrl(proofPath)
  const proofUrl = publicUrl.publicUrl

  const { error: updateError } = await adminClient
    .from('maps')
    .update({
      proof_render_url: proofUrl,
      proof_render_hash: proofRenderHash,
      map_content_hash: mapContentHash,
      chrome_hash: chromeHash,
      render_url: proofUrl,
      status: 'rendered',
    })
    .eq('id', mapId)
  if (updateError) {
    throw createError({ statusCode: 500, message: `Map proof update failed: ${updateError.message}` })
  }

  return {
    status: 'cached' as const,
    render_url: proofUrl,
    proof_render_hash: proofRenderHash,
  }
}
