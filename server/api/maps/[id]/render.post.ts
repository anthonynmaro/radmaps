/**
 * POST /api/maps/:id/render
 *
 * Browser screenshot proof render path. Computes hashes, checks the proof cache,
 * captures the dedicated Nuxt render page, validates the JPEG, uploads the
 * proof artifact, and stores proof metadata on the map row.
 */
import type { H3Event } from 'h3'
import { serverSupabaseClient, serverSupabaseServiceRole, serverSupabaseUser } from '#supabase/server'
import { DEFAULT_STYLE_CONFIG, type StyleConfig, type RouteStats } from '~/types'
import { computeMapContentHash, computeChromeHash, computeProofRenderHash } from '~/utils/render/hash'
import { getPrintFraming } from '~/utils/print/printFraming'
import { getProviderProfile } from '~/utils/print/providerProfile'
import { createRenderTicket } from '~/utils/render/renderTicket'
import { RENDER_READY_EXPRESSION } from '~/utils/render/readiness'
import { resolveBrowserRenderViewport } from '~/utils/render/renderViewport'
import { getProofPath } from '~/utils/render/storagePaths'
import { takeScreenshot } from '~/server/utils/screenshotService'
import { validateJpegBasics } from '~/server/utils/jpegMeta'
import { normalizeBrowserScreenshot } from '~/server/utils/normalizeBrowserScreenshot'
import { assertRateLimit } from '~/server/utils/rateLimit'

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const mapId = getRouterParam(event, 'id')
  if (!mapId) throw createError({ statusCode: 400, message: 'Map ID required' })

  const body = ((await readBody(event).catch(() => ({}))) ?? {}) as RenderMapProofBody
  const renderIntent = body.render_intent ?? 'checkout'
  if (renderIntent === 'editor-thumbnail') {
    assertRateLimit(event, { key: 'map-render-editor-thumbnail', userId: user.id, limit: 120, windowMs: 60 * 60_000 })
  } else if (renderIntent === 'share') {
    assertRateLimit(event, { key: 'map-render-share', userId: user.id, limit: 30, windowMs: 60 * 60_000 })
  } else {
    assertRateLimit(event, { key: 'map-render', userId: user.id, limit: 10, windowMs: 60 * 60_000 })
  }

  const config = useRuntimeConfig()
  return await renderMapProof({ event, mapId, userId: user.id, config, body })
})

interface RenderMapProofBody {
  product_uid?: string
  render_intent?: 'editor-thumbnail' | 'share' | 'checkout'
}

interface V4Args {
  event: H3Event
  mapId: string
  userId: string
  config: ReturnType<typeof useRuntimeConfig>
  allowServiceRead?: boolean
  body?: RenderMapProofBody
}

export async function renderMapProof(args: V4Args) {
  const { event, mapId, userId, config, allowServiceRead = false } = args
  const supabase = await serverSupabaseClient(event)
  const adminClient = await serverSupabaseServiceRole(event)

  const body = args.body ?? ((await readBody(event).catch(() => ({}))) ?? {}) as RenderMapProofBody

  // 1. Load map row with everything we need to hash + dispatch.
  const readClient = allowServiceRead ? adminClient : supabase
  const { data: map, error: fetchError } = await readClient
    .from('maps')
    .select('id, user_id, geojson, style_config, stats, bbox, render_url, thumbnail_url, proof_render_hash, proof_render_url')
    .eq('id', mapId)
    .eq('user_id', userId)
    .single()

  if (fetchError || !map) {
    throw createError({ statusCode: 404, message: 'Map not found' })
  }

  const styleConfig = (map.style_config ?? DEFAULT_STYLE_CONFIG) as StyleConfig
  const stats = (map.stats ?? {}) as RouteStats
  const geojson = (map.geojson ?? { type: 'FeatureCollection', features: [] }) as GeoJSON.FeatureCollection

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
    const patch: Record<string, unknown> = {}
    if (map.thumbnail_url !== map.proof_render_url) patch.thumbnail_url = map.proof_render_url
    if (map.render_url !== map.proof_render_url) patch.render_url = map.proof_render_url
    if (Object.keys(patch).length > 0) {
      await adminClient
        .from('maps')
        .update(patch)
        .eq('id', mapId)
    }
    return {
      status: 'cached' as const,
      render_url: map.proof_render_url,
      proof_render_hash: proofRenderHash,
    }
  }

  const renderViewport = resolveBrowserRenderViewport(framing, styleConfig, {
    fallbackDeviceScaleFactor: 1,
  })
  const deviceScaleFactor = renderViewport.deviceScaleFactor
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

  const screenshotWidthPx = renderViewport.viewportWidthPx
  const screenshotHeightPx = renderViewport.viewportHeightPx
  const timeoutMs = config.browserlessTimeoutMs
  const screenshotStartedAt = Date.now()

  console.info('[render:v4] proof screenshot starting', {
    mapId,
    productUid,
    widthPx: screenshotWidthPx,
    heightPx: screenshotHeightPx,
    deviceScaleFactor,
    targetCssWidthPx: renderViewport.targetCssWidthPx,
    renderHost: renderUrl.hostname,
    timeoutMs,
  })

  let screenshot: Awaited<ReturnType<typeof takeScreenshot>>
  try {
    screenshot = await takeScreenshot({
      url: renderUrl.toString(),
      widthPx: screenshotWidthPx,
      heightPx: screenshotHeightPx,
      deviceScaleFactor,
      format: 'jpeg',
      quality: 95,
      waitForFunction: RENDER_READY_EXPRESSION,
      timeoutMs,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const friendlyMessage = /timed out|timeout|408/i.test(message)
      ? 'Render service timed out. Please try again in a moment.'
      : 'Render service unavailable. Please try again in a moment.'

  console.error('[render:v4] proof screenshot failed', {
      mapId,
      productUid,
      widthPx: screenshotWidthPx,
      heightPx: screenshotHeightPx,
      deviceScaleFactor,
      targetCssWidthPx: renderViewport.targetCssWidthPx,
      renderHost: renderUrl.hostname,
      timeoutMs,
      durationMs: Date.now() - screenshotStartedAt,
      error: message,
    })

    await adminClient
      .from('maps')
      .update({ render_url: `error:${friendlyMessage}` })
      .eq('id', mapId)

    throw createError({ statusCode: 503, message: friendlyMessage })
  }

  console.info('[render:v4] proof screenshot complete', {
    mapId,
    productUid,
    widthPx: screenshot.widthPx,
    heightPx: screenshot.heightPx,
    bytes: screenshot.buffer.byteLength,
    renderMs: screenshot.renderMs,
  })

  const proofBuffer = await normalizeBrowserScreenshot({
    buffer: screenshot.buffer,
    expectedWidth: framing.fullWidthPx,
    expectedHeight: framing.fullHeightPx,
    maxOversizePx: deviceScaleFactor,
    quality: 95,
  })

  const profile = getProviderProfile(productUid)
  validateJpegBasics({
    buffer: proofBuffer,
    expectedWidth: framing.fullWidthPx,
    expectedHeight: framing.fullHeightPx,
    maxFileSizeMb: profile.maxFileSizeMb,
  })

  const proofPath = getProofPath(mapId, proofRenderHash)
  const { error: uploadError } = await adminClient.storage
    .from('maps')
    .upload(proofPath, proofBuffer, {
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
      thumbnail_url: proofUrl,
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
