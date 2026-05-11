import { z } from 'zod'
import { serverSupabaseClient, serverSupabaseServiceRole, serverSupabaseUser } from '#supabase/server'
import type { H3Event } from 'h3'
import type { MapAsset, MapAssetKind, StyleConfig } from '~/types'
import { classifyAssetQuality, computeEffectiveDpi, defaultAssetPlacement } from '~/utils/imageAssets'
import { processUploadedImageFile } from './imageUploadSecurity'

const ASSET_BUCKET = 'maps'

const mapIdSchema = z.string().uuid()
const kindSchema = z.enum(['logo', 'image'])
const assetIdSchema = z.string().uuid()

export async function handleMapAssetUpload(event: H3Event, forcedKind?: MapAssetKind) {
  const user = await serverSupabaseUser(event)
  if (!user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const rawMapId = getRouterParam(event, 'id')
  const mapIdParsed = mapIdSchema.safeParse(rawMapId)
  if (!mapIdParsed.success) throw createError({ statusCode: 400, message: 'Invalid map ID' })
  const mapId = mapIdParsed.data

  const supabase = await serverSupabaseClient(event)
  const adminSupabase = await serverSupabaseServiceRole(event)

  const { data: mapRow, error: mapErr } = await supabase
    .from('maps')
    .select('id, style_config')
    .eq('id', mapId)
    .eq('user_id', user.id)
    .single()

  if (mapErr || !mapRow) throw createError({ statusCode: 404, message: 'Map not found' })

  const form = await readFormData(event)
  const rawKind = forcedKind ?? String(form.get('kind') || 'image')
  const kindParsed = kindSchema.safeParse(rawKind)
  if (!kindParsed.success) throw createError({ statusCode: 400, message: 'Invalid asset kind' })
  const kind = kindParsed.data

  const replaceRaw = form.get('replace_asset_id')
  const replaceAssetId = typeof replaceRaw === 'string' && assetIdSchema.safeParse(replaceRaw).success ? replaceRaw : null
  const imageFile = form.get('image') as File | null
  if (!imageFile || typeof imageFile === 'string') {
    throw createError({ statusCode: 400, message: 'No image file provided' })
  }

  const processed = await processUploadedImageFile(imageFile, kind)
  const assetId = replaceAssetId ?? crypto.randomUUID()
  const basePath = `assets/${user.id}/${mapId}/${assetId}`
  const originalPath = `${basePath}/original.${processed.originalExt}`
  const renderPath = `${basePath}/render.${processed.renderExt}`

  const { error: originalUploadError } = await adminSupabase.storage
    .from(ASSET_BUCKET)
    .upload(originalPath, processed.originalBuffer, {
      contentType: processed.detectedMime,
      upsert: true,
    })
  if (originalUploadError) throw createError({ statusCode: 500, message: `Original upload failed: ${originalUploadError.message}` })

  const { error: renderUploadError } = await adminSupabase.storage
    .from(ASSET_BUCKET)
    .upload(renderPath, processed.renderBuffer, {
      contentType: processed.renderMime,
      upsert: true,
    })
  if (renderUploadError) throw createError({ statusCode: 500, message: `Render upload failed: ${renderUploadError.message}` })

  const { data: { publicUrl: sourceUrl } } = adminSupabase.storage.from(ASSET_BUCKET).getPublicUrl(originalPath)
  const { data: { publicUrl: renderUrl } } = adminSupabase.storage.from(ASSET_BUCKET).getPublicUrl(renderPath)

  const styleConfig = (mapRow.style_config ?? {}) as StyleConfig
  const existingAssets = styleConfig.image_overlays ?? []
  const existing = replaceAssetId ? existingAssets.find(asset => asset.id === replaceAssetId) : undefined
  const placement = existing
    ? {
        x: existing.x,
        y: existing.y,
        width: existing.width,
        height: existing.height,
        rotation: existing.rotation,
        opacity: existing.opacity,
        z_index: existing.z_index,
      }
    : defaultAssetPlacement(kind, processed.width, processed.height, styleConfig.print_size ?? '24x36')

  const assetBase: MapAsset = {
    id: assetId,
    kind,
    source_url: sourceUrl,
    render_url: renderUrl,
    mime_type: processed.renderMime,
    width_px: processed.width,
    height_px: processed.height,
    file_size_bytes: imageFile.size,
    ...placement,
    quality_status: 'good',
  }
  const effectiveDpi = computeEffectiveDpi(assetBase, styleConfig.print_size ?? '24x36')
  const asset: MapAsset = {
    ...assetBase,
    quality_status: classifyAssetQuality(effectiveDpi),
  }

  const nextAssets = replaceAssetId
    ? existingAssets.map(existingAsset => existingAsset.id === replaceAssetId ? asset : existingAsset)
    : kind === 'logo'
      ? [...existingAssets.filter(existingAsset => existingAsset.kind !== 'logo'), asset]
      : [...existingAssets, asset]

  const nextStyleConfig: StyleConfig = {
    ...styleConfig,
    image_overlays: nextAssets,
    ...(kind === 'logo'
      ? {
          show_logo: true,
          logo_url: renderUrl,
          logo_position: 'footer-left' as const,
          show_branding: false,
        }
      : {}),
  }

  const { error: updateError } = await adminSupabase
    .from('maps')
    .update({
      style_config: nextStyleConfig,
      updated_at: new Date().toISOString(),
    })
    .eq('id', mapId)
    .eq('user_id', user.id)

  if (updateError) throw createError({ statusCode: 500, message: `Asset saved but style update failed: ${updateError.message}` })

  return { asset, url: renderUrl, style_config: nextStyleConfig }
}
