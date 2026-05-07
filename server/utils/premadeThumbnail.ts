import { createHash } from 'node:crypto'
import type { H3Event } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import type { RouteStats } from '~/types'
import { stableStringify } from '~/utils/render/hash'
import { createRenderTicket } from '~/utils/render/renderTicket'
import { getPremadeThumbnailPath } from '~/utils/render/storagePaths'
import {
  PREMADE_THUMBNAIL_HASH_VERSION,
  PREMADE_THUMBNAIL_PRODUCT_UID,
  PREMADE_THUMBNAIL_QUALITY,
  getPremadeThumbnailFraming,
} from '~/utils/render/thumbnailFraming'
import { validateJpegBasics } from '~/server/utils/jpegMeta'
import { takeScreenshot } from '~/server/utils/screenshotService'

interface RenderPremadeThumbnailArgs {
  event: H3Event
  premadeId: string
  updatedBy?: string
  force?: boolean
}

export interface PremadeThumbnailResult {
  status: 'cached' | 'rendered'
  preview_image_url: string
  thumbnail_hash: string
}

export async function renderPremadeThumbnail(args: RenderPremadeThumbnailArgs): Promise<PremadeThumbnailResult> {
  const { event, premadeId, updatedBy, force = false } = args
  const config = useRuntimeConfig()
  const supabase = await serverSupabaseServiceRole(event)

  const { data: premade, error: fetchError } = await supabase
    .from('premade_maps')
    .select('id, title, source_map_id, geojson, bbox, stats, style_config, preview_image_url, needs_preview')
    .eq('id', premadeId)
    .maybeSingle()

  if (fetchError) throw createError({ statusCode: 500, message: fetchError.message })
  if (!premade) throw createError({ statusCode: 404, message: 'Premade map not found' })
  if (!premade.geojson?.features?.length || !premade.bbox || !premade.style_config) {
    throw createError({ statusCode: 422, message: 'Premade map needs route data, bbox, and style config before preview rendering' })
  }

  const framing = getPremadeThumbnailFraming()
  const geojson = premade.geojson as GeoJSON.FeatureCollection
  const stats = (premade.stats ?? {}) as RouteStats
  const thumbnailHash = createHash('sha256').update(stableStringify({
    version: PREMADE_THUMBNAIL_HASH_VERSION,
    widthPx: framing.fullWidthPx,
    heightPx: framing.fullHeightPx,
    geojson,
    stats,
    style_config: premade.style_config ?? {},
  })).digest('hex')
  const thumbnailPath = getPremadeThumbnailPath(premadeId, thumbnailHash)

  if (!force && !premade.needs_preview && typeof premade.preview_image_url === 'string' && premade.preview_image_url.includes(thumbnailPath)) {
    await syncSourceMapThumbnail(supabase, premade.source_map_id, premade.preview_image_url)
    return {
      status: 'cached',
      preview_image_url: premade.preview_image_url,
      thumbnail_hash: thumbnailHash,
    }
  }

  const deviceScaleFactor = 1
  const ticket = createRenderTicket({
    kind: 'premade',
    subject: premadeId,
    renderClass: 'thumbnail',
    widthPx: framing.fullWidthPx,
    heightPx: framing.fullHeightPx,
    deviceScaleFactor,
    productUid: PREMADE_THUMBNAIL_PRODUCT_UID,
    expiresAt: Date.now() + 10 * 60_000,
  }, config.renderTicketSecret)

  const siteUrl = config.public.siteUrl || 'https://radmaps.studio'
  const renderUrl = new URL(`/render/premade/${premadeId}`, siteUrl)
  renderUrl.searchParams.set('ticket', ticket)

  console.info('[premade-thumbnail] Browserless screenshot starting', {
    premadeId,
    widthPx: framing.fullWidthPx,
    heightPx: framing.fullHeightPx,
    renderHost: renderUrl.hostname,
  })

  const screenshot = await takeScreenshot({
    url: renderUrl.toString(),
    widthPx: framing.fullWidthPx,
    heightPx: framing.fullHeightPx,
    deviceScaleFactor,
    format: 'jpeg',
    quality: PREMADE_THUMBNAIL_QUALITY,
    waitForFunction: 'window.__RENDER_READY === true && window.__RADMAPS_RENDER_STATUS?.routeLayerPresent === true',
    timeoutMs: Math.min(Number(config.browserlessTimeoutMs) || 60_000, 60_000),
  })

  validateJpegBasics({
    buffer: screenshot.buffer,
    expectedWidth: framing.fullWidthPx,
    expectedHeight: framing.fullHeightPx,
    maxFileSizeMb: 25,
  })

  const { error: uploadError } = await supabase.storage
    .from('maps')
    .upload(thumbnailPath, screenshot.buffer, {
      contentType: screenshot.contentType,
      upsert: true,
      cacheControl: '86400',
    })
  if (uploadError) {
    throw createError({ statusCode: 500, message: `Premade thumbnail upload failed: ${uploadError.message}` })
  }

  const { data: publicUrl } = supabase.storage.from('maps').getPublicUrl(thumbnailPath)
  const previewUrl = publicUrl.publicUrl
  const update: Record<string, unknown> = {
    preview_image_url: previewUrl,
    needs_preview: false,
  }
  if (updatedBy) update.updated_by = updatedBy

  const { error: updateError } = await supabase
    .from('premade_maps')
    .update(update)
    .eq('id', premadeId)
  if (updateError) throw createError({ statusCode: 500, message: updateError.message })

  await syncSourceMapThumbnail(supabase, premade.source_map_id, previewUrl)

  return {
    status: 'rendered',
    preview_image_url: previewUrl,
    thumbnail_hash: thumbnailHash,
  }
}

async function syncSourceMapThumbnail(supabase: any, sourceMapId: string | null | undefined, previewUrl: string) {
  if (!sourceMapId) return
  const { error } = await supabase
    .from('maps')
    .update({ thumbnail_url: previewUrl })
    .eq('id', sourceMapId)
  if (error) {
    console.warn('[premade-thumbnail] source map thumbnail sync failed:', error.message)
  }
}
