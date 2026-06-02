import { z } from 'zod'
import { serverSupabaseClient, serverSupabaseServiceRole, serverSupabaseUser } from '#supabase/server'
import { FLAGS } from '~/utils/knownFlags'
import { isFeatureEnabled } from '~/server/utils/featureFlags'
import { getStaffSession } from '~/server/utils/adminAuth'
import { getPublishedPremadeBySlug } from '~/server/utils/premadeCatalog'
import { getProduct } from '~/utils/products'
import {
  computeProductMockupHash,
  getProductMockupTemplate,
  hashString,
  isMockupSupportedProduct,
  PRODUCT_MOCKUP_PROVIDER,
  PRODUCT_MOCKUP_RENDERER_VERSION,
  PRODUCT_MOCKUP_TEMPLATE_VERSION,
  type ProductMockupSourceType,
} from '~/utils/productMockups'
import { renderProductTemplateMockup } from '~/server/utils/productTemplateMockups'
import { getProductMockupPath } from '~/utils/render/storagePaths'

const requestSchema = z.object({
  source: z.discriminatedUnion('type', [
    z.object({
      type: z.literal('map'),
      id: z.string().uuid(),
    }),
    z.object({
      type: z.literal('premade'),
      id: z.string().trim().min(1).max(120).regex(/^[a-z0-9-]+$/i),
    }),
  ]),
  product_uid: z.string().min(1),
  mockup_template_id: z.string().min(1).max(360).optional(),
  force: z.boolean().optional(),
})

interface MockupSource {
  type: ProductMockupSourceType
  id: string
  artworkUrl?: string
  artworkBuffer?: Buffer
  sourceRenderHash: string
}

export default defineEventHandler(async (event) => {
  const body = requestSchema.parse(await readBody(event))
  const product = getProduct(body.product_uid)
  if (!isMockupSupportedProduct(product)) {
    throw createError({ statusCode: 400, message: 'A physical product_uid is required for mockup rendering' })
  }

  const staff = await getStaffSession(event).catch(() => null)
  const force = Boolean(body.force && staff)
  const enabled = await isFeatureEnabled(event, FLAGS.PRODUCT_MOCKUPS, { staffSession: staff })
  const localDevEnabled = process.env.NODE_ENV !== 'production'
  if (!enabled && !force && !localDevEnabled) {
    throw createError({ statusCode: 404, message: 'Product mockups are not enabled' })
  }

  const supabase = await serverSupabaseClient(event)
  const adminClient = await serverSupabaseServiceRole(event)
  const user = await serverSupabaseUser(event).catch(() => null)
  const source = body.source.type === 'map'
    ? await loadMapSource(supabase, body.source.id, user?.id)
    : await loadPremadeSource(adminClient, body.source.id)

  const template = getProductMockupTemplate(product, body.mockup_template_id)
  if (!template) {
    throw createError({ statusCode: 422, message: `No product mockup template is registered for ${product.product_uid}` })
  }

  const templateId = template.id
  const mockupHash = computeProductMockupHash({
    sourceType: source.type,
    sourceId: source.id,
    sourceRenderHash: source.sourceRenderHash,
    productUid: product.product_uid,
    templateId,
    templateVersion: PRODUCT_MOCKUP_TEMPLATE_VERSION,
    rendererVersion: PRODUCT_MOCKUP_RENDERER_VERSION,
  })

  let cacheAvailable = true
  const { data: cached, error: cacheError } = await adminClient
    .from('product_mockups')
    .select('mockup_url, mockup_url_expires_at')
    .eq('source_type', source.type)
    .eq('source_id', source.id)
    .eq('product_uid', product.product_uid)
    .eq('mockup_hash', mockupHash)
    .maybeSingle()

  if (cacheError) {
    if (isProductMockupCacheUnavailable(cacheError)) cacheAvailable = false
    else throw createError({ statusCode: 500, message: cacheError.message })
  }
  if (!force && cached?.mockup_url && !isExpired(cached.mockup_url_expires_at)) {
    return {
      status: 'ready' as const,
      cached: true,
      mockup_url: cached.mockup_url,
      product_uid: product.product_uid,
      mockup_template_id: templateId,
      mockup_hash: mockupHash,
      provider: PRODUCT_MOCKUP_PROVIDER,
    }
  }

  const renderedMockup = await renderProductTemplateMockup({
    product,
    template,
    artworkUrl: source.artworkUrl,
    artworkBuffer: source.artworkBuffer,
  })

  const artifactPath = getProductMockupPath(source.type, source.id, product.product_uid, mockupHash)
  const { error: uploadError } = await adminClient.storage
    .from('maps')
    .upload(artifactPath, renderedMockup.buffer, {
      contentType: renderedMockup.contentType,
      upsert: true,
      cacheControl: '3600',
    })

  if (uploadError) {
    throw createError({ statusCode: 500, message: `Mockup upload failed: ${uploadError.message}` })
  }

  const { data: publicUrl } = adminClient.storage.from('maps').getPublicUrl(artifactPath)
  const mockupUrl = publicUrl.publicUrl
  if (cacheAvailable) {
    const { error: upsertError } = await adminClient
      .from('product_mockups')
      .upsert({
        provider: PRODUCT_MOCKUP_PROVIDER,
        source_type: source.type,
        source_id: source.id,
        product_uid: product.product_uid,
        source_render_hash: source.sourceRenderHash,
        mockup_template_id: templateId,
        mockup_template_version: PRODUCT_MOCKUP_TEMPLATE_VERSION,
        renderer_version: PRODUCT_MOCKUP_RENDERER_VERSION,
        mockup_hash: mockupHash,
        artifact_path: artifactPath,
        mockup_url: mockupUrl,
        mockup_url_expires_at: null,
        provider_product_id: null,
        provider_variant_id: null,
        provider_status: 'ready',
        width_px: renderedMockup.widthPx,
        height_px: renderedMockup.heightPx,
        validation_result: {
          provider: PRODUCT_MOCKUP_PROVIDER,
          ...renderedMockup.validation,
        },
      }, {
        onConflict: 'source_type,source_id,product_uid,mockup_hash',
      })

    if (upsertError && !isProductMockupCacheUnavailable(upsertError)) {
      throw createError({ statusCode: 500, message: upsertError.message })
    }
  }

  return {
    status: 'ready' as const,
    cached: false,
    mockup_url: mockupUrl,
    product_uid: product.product_uid,
    mockup_template_id: templateId,
    mockup_hash: mockupHash,
    provider: PRODUCT_MOCKUP_PROVIDER,
  }
})

function isExpired(expiresAt: string | null | undefined): boolean {
  if (!expiresAt) return false
  const time = new Date(expiresAt).getTime()
  return Number.isFinite(time) && time <= Date.now()
}

function isProductMockupCacheUnavailable(error: any): boolean {
  const code = String(error?.code || '')
  const message = String(error?.message || '')
  return code === '42P01'
    || code === '23514'
    || /product_mockups|provider.*check|relation .* does not exist/i.test(message)
}

async function loadMapSource(supabase: any, mapId: string, userId?: string | null): Promise<MockupSource> {
  if (!userId) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const { data, error } = await supabase
    .from('maps')
    .select('id, proof_render_url, proof_render_hash, render_url')
    .eq('id', mapId)
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw createError({ statusCode: 500, message: error.message })
  if (!data) throw createError({ statusCode: 404, message: 'Map not found' })

  const artworkUrl = data.proof_render_url || data.render_url
  if (!artworkUrl || String(artworkUrl).startsWith('error:')) {
    throw createError({ statusCode: 422, message: 'Render a print proof before creating a product mockup' })
  }

  return {
    type: 'map',
    id: data.id,
    artworkUrl,
    sourceRenderHash: data.proof_render_hash || hashString(artworkUrl),
  }
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

async function loadPremadeSource(adminClient: any, premadeKey: string): Promise<MockupSource> {
  let data: any | undefined

  if (isUuid(premadeKey)) {
    const result = await adminClient
      .from('premade_maps')
      .select('id, slug, status, render_url, preview_image_url, updated_at')
      .eq('id', premadeKey)
      .eq('status', 'published')
      .maybeSingle()

    if (result.error) throw createError({ statusCode: 500, message: result.error.message })
    data = result.data
  }

  if (!data) {
    data = await getPublishedPremadeBySlug(adminClient, premadeKey, {
      staticFallbackWhenNoPublished: process.env.NODE_ENV !== 'production',
    })
  }

  if (!data) throw createError({ statusCode: 404, message: 'Premade map not found' })

  const artworkUrl = data.render_url || data.preview_image_url
  const fallbackArtworkBuffer = !artworkUrl && process.env.NODE_ENV !== 'production'
    ? renderStaticPremadeArtwork(data)
    : null
  if (!artworkUrl && !fallbackArtworkBuffer) {
    throw createError({ statusCode: 422, message: 'Premade map needs a render_url or preview_image_url before mockup rendering' })
  }

  return {
    type: 'premade',
    id: data.id || data.slug,
    artworkUrl,
    artworkBuffer: fallbackArtworkBuffer ?? undefined,
    sourceRenderHash: hashString(`${artworkUrl || fallbackArtworkBuffer?.toString('base64')}:${data.updated_at ?? ''}`),
  }
}

function renderStaticPremadeArtwork(premade: any): Buffer | null {
  if (!premade?.geojson?.features?.length || !Array.isArray(premade.bbox)) return null

  const width = 1200
  const height = 1800
  const style = premade.style_config ?? {}
  const background = style.background_color || '#F7F4EF'
  const labelBg = style.label_bg_color || background
  const labelText = style.label_text_color || '#1C1917'
  const routeColor = style.route_color || '#C1121F'
  const mapBg = style.map_background_color || '#ECE7DF'
  const routePath = staticPremadeRoutePath(premade.geojson, premade.bbox, {
    x: 130,
    y: 390,
    width: 940,
    height: 1060,
  })

  const title = escapeXml(premade.title || 'RadMaps')
  const subtitle = escapeXml(premade.subtitle || premade.region || '')

  return Buffer.from(`
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${width}" height="${height}" fill="${escapeXml(background)}" />
      <rect x="0" y="0" width="${width}" height="320" fill="${escapeXml(labelBg)}" />
      <text x="130" y="150" fill="${escapeXml(labelText)}" font-family="Arial, sans-serif" font-size="64" font-weight="700">${title}</text>
      <text x="130" y="220" fill="${escapeXml(labelText)}" opacity="0.7" font-family="Arial, sans-serif" font-size="30">${subtitle}</text>
      <rect x="130" y="390" width="940" height="1060" fill="${escapeXml(mapBg)}" stroke="rgba(28,25,23,0.18)" stroke-width="2" />
      <g opacity="0.26" stroke="rgba(28,25,23,0.45)" stroke-width="1">
        ${Array.from({ length: 12 }, (_, index) => `<line x1="${130 + index * 85}" y1="390" x2="${130 + index * 85}" y2="1450" />`).join('')}
        ${Array.from({ length: 13 }, (_, index) => `<line x1="130" y1="${390 + index * 85}" x2="1070" y2="${390 + index * 85}" />`).join('')}
      </g>
      ${routePath ? `<path d="${routePath}" fill="none" stroke="${escapeXml(routeColor)}" stroke-width="18" stroke-linecap="round" stroke-linejoin="round" />` : ''}
      <rect x="0" y="1510" width="${width}" height="290" fill="${escapeXml(labelBg)}" />
      <text x="130" y="1630" fill="${escapeXml(labelText)}" opacity="0.82" font-family="Arial, sans-serif" font-size="34">${escapeXml(premade.location_label || premade.region || '')}</text>
      <text x="130" y="1695" fill="${escapeXml(labelText)}" opacity="0.58" font-family="Arial, sans-serif" font-size="24">RADMAPS</text>
    </svg>
  `)
}

function staticPremadeRoutePath(
  geojson: any,
  bbox: [number, number, number, number],
  box: { x: number; y: number; width: number; height: number },
): string {
  const coordinates: Array<[number, number]> = geojson.features
    .flatMap((feature: any) => {
      const geometry = feature?.geometry
      if (geometry?.type === 'LineString') return geometry.coordinates
      if (geometry?.type === 'MultiLineString') return geometry.coordinates.flat()
      return []
    })
    .filter((coordinate: unknown): coordinate is [number, number] =>
      Array.isArray(coordinate)
      && typeof coordinate[0] === 'number'
      && typeof coordinate[1] === 'number',
    )

  if (coordinates.length < 2) return ''

  const [minLng, minLat, maxLng, maxLat] = bbox
  const lngRange = maxLng - minLng || 0.0001
  const latRange = maxLat - minLat || 0.0001
  const scale = Math.min(box.width / lngRange, box.height / latRange)
  const offsetX = box.x + (box.width - lngRange * scale) / 2
  const offsetY = box.y + (box.height - latRange * scale) / 2
  const stride = Math.max(1, Math.floor(coordinates.length / 260))

  return coordinates
    .filter((_, index) => index % stride === 0)
    .map(([lng, lat], index) => {
      const x = offsetX + (lng - minLng) * scale
      const y = offsetY + (maxLat - lat) * scale
      return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`
    })
    .join(' ')
}

function escapeXml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&apos;',
  }[char] ?? char))
}
