import { fileTypeFromBuffer } from 'file-type'
import { createError } from 'h3'
import sharp from 'sharp'
import type { MapAsset, MapAssetKind } from '~/types'

export const MAX_LOGO_BYTES = 5 * 1024 * 1024
export const MAX_IMAGE_BYTES = 20 * 1024 * 1024
export const MAX_INPUT_PIXELS = 50_000_000

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp'])

export type ProcessedUploadImage = {
  originalBuffer: Buffer
  renderBuffer: Buffer
  detectedMime: MapAsset['mime_type']
  originalExt: 'jpg' | 'png' | 'webp'
  renderMime: MapAsset['mime_type']
  renderExt: 'jpg' | 'png'
  width: number
  height: number
}

function normalizeMime(mime: string): MapAsset['mime_type'] | null {
  if (mime === 'image/jpg') return 'image/jpeg'
  if (mime === 'image/jpeg' || mime === 'image/png' || mime === 'image/webp') return mime
  return null
}

function extForMime(mime: MapAsset['mime_type']): 'jpg' | 'png' | 'webp' {
  if (mime === 'image/jpeg') return 'jpg'
  if (mime === 'image/webp') return 'webp'
  return 'png'
}

export async function processUploadedImageFile(imageFile: File, kind: MapAssetKind): Promise<ProcessedUploadImage> {
  const maxBytes = kind === 'logo' ? MAX_LOGO_BYTES : MAX_IMAGE_BYTES
  if (imageFile.size > maxBytes) {
    throw createError({
      statusCode: 413,
      message: kind === 'logo' ? 'Logo too large. Use a PNG, JPG, or WebP under 5 MB.' : 'Image too large. Use a PNG, JPG, or WebP under 20 MB.',
    })
  }

  const clientMime = normalizeMime(imageFile.type)
  if (!clientMime || !ALLOWED_MIME.has(clientMime)) {
    throw createError({ statusCode: 400, message: 'Invalid image type. Use PNG, JPG, or WebP. SVG is not supported yet.' })
  }

  const originalBuffer = Buffer.from(await imageFile.arrayBuffer())
  const detected = await fileTypeFromBuffer(originalBuffer)
  const detectedMime = detected?.mime ? normalizeMime(detected.mime) : null
  if (!detectedMime || !ALLOWED_MIME.has(detectedMime)) {
    throw createError({ statusCode: 400, message: 'Invalid image file. The uploaded bytes are not a PNG, JPG, or WebP image.' })
  }
  if (detectedMime !== clientMime) {
    throw createError({ statusCode: 400, message: 'Image type mismatch. Please upload a valid PNG, JPG, or WebP file.' })
  }

  const input = sharp(originalBuffer, {
    failOn: 'warning',
    limitInputPixels: MAX_INPUT_PIXELS,
  }).rotate()

  let metadata: sharp.Metadata
  try {
    metadata = await input.metadata()
  } catch {
    throw createError({ statusCode: 400, message: 'Image could not be decoded safely.' })
  }

  if (!metadata.width || !metadata.height) {
    throw createError({ statusCode: 400, message: 'Image dimensions could not be read.' })
  }
  if (metadata.width * metadata.height > MAX_INPUT_PIXELS) {
    throw createError({ statusCode: 413, message: 'Image dimensions are too large. Use an image under 50 megapixels.' })
  }

  const hasAlpha = Boolean(metadata.hasAlpha)
  const normalized = sharp(originalBuffer, {
    failOn: 'warning',
    limitInputPixels: MAX_INPUT_PIXELS,
  }).rotate()

  const renderMime: MapAsset['mime_type'] = kind === 'logo' || hasAlpha ? 'image/png' : 'image/jpeg'
  const renderExt = renderMime === 'image/png' ? 'png' : 'jpg'
  const rendered = renderMime === 'image/png'
    ? await normalized.png({ compressionLevel: 9, adaptiveFiltering: true }).toBuffer({ resolveWithObject: true })
    : await normalized.jpeg({ quality: 92, mozjpeg: true }).toBuffer({ resolveWithObject: true })

  return {
    originalBuffer,
    renderBuffer: rendered.data,
    detectedMime,
    originalExt: extForMime(detectedMime),
    renderMime,
    renderExt,
    width: rendered.info.width,
    height: rendered.info.height,
  }
}
