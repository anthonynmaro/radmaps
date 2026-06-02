import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import sharp from 'sharp'
import type { PrintProduct } from '~/types'
import { getProductMockupTemplate, type ProductMockupBox, type ProductMockupTemplate } from '~/utils/productMockups'

export interface RenderProductTemplateMockupInput {
  product: PrintProduct
  template?: ProductMockupTemplate
  artworkUrl?: string
  artworkBuffer?: Buffer
}

export interface RenderProductTemplateMockupResult {
  buffer: Buffer
  contentType: 'image/jpeg'
  widthPx: number
  heightPx: number
  template: ProductMockupTemplate
  validation: Record<string, unknown>
}

interface PixelBox {
  left: number
  top: number
  width: number
  height: number
}

interface PixelBleed {
  left: number
  top: number
  right: number
  bottom: number
}

interface NamedChromeOverlay {
  id: string
  input: Buffer
  left: number
  top: number
  box: PixelBox
}

export async function renderProductTemplateMockup(input: RenderProductTemplateMockupInput): Promise<RenderProductTemplateMockupResult> {
  const template = input.template ?? getProductMockupTemplate(input.product)
  if (!template) {
    throw createError({ statusCode: 422, message: `No product mockup template is registered for ${input.product.product_uid}` })
  }

  const templatePath = join(process.cwd(), template.relativePath)
  const [templateBuffer, artworkBuffer] = await Promise.all([
    readFile(templatePath).catch((error) => {
      throw createError({ statusCode: 500, message: `Mockup template asset is missing: ${template.relativePath} (${error.message})` })
    }),
    input.artworkBuffer ? Promise.resolve(input.artworkBuffer) : fetchArtworkBuffer(input.artworkUrl),
  ])

  const metadata = await sharp(templateBuffer).metadata()
  const width = metadata.width || 0
  const height = metadata.height || 0
  if (width <= 0 || height <= 0) {
    throw createError({ statusCode: 500, message: `Mockup template asset has invalid dimensions: ${template.relativePath}` })
  }

  const artworkBox = toPixelBox(template.artworkBox, width, height)
  const compositeArtworkBox = overprintedArtworkBox(artworkBox, width, height, artworkOverprintBleed(template))
  const artworkLayer = await sharp(artworkBuffer)
    .rotate()
    .resize(compositeArtworkBox.width, compositeArtworkBox.height, { fit: 'fill' })
    .jpeg({ quality: 95, mozjpeg: true })
    .toBuffer()

  const composites: sharp.OverlayOptions[] = [
    {
      input: artworkLayer,
      left: compositeArtworkBox.left,
      top: compositeArtworkBox.top,
    },
  ]
  const chromeBoxes: Record<string, PixelBox> = {}

  if (template.finish === 'wall_hanging') {
    const railOverlays = await wallHangingRailOverlays(templateBuffer, width, height, artworkBox)
    for (const overlay of railOverlays) {
      chromeBoxes[overlay.id] = overlay.box
      composites.push({
        input: overlay.input,
        left: overlay.left,
        top: overlay.top,
      })
    }
  }

  if (template.finish === 'acrylic') {
    composites.push({ input: await acrylicChromeOverlay(width, height, compositeArtworkBox), left: 0, top: 0 })
  }

  if (template.finish === 'metallic') {
    composites.push({ input: await metallicSheenOverlay(width, height, compositeArtworkBox), left: 0, top: 0 })
  }

  const fullBuffer = await sharp(templateBuffer)
    .composite(composites)
    .jpeg({ quality: 92, mozjpeg: true })
    .toBuffer()

  const outputBuffer = await sharp(fullBuffer)
    .resize(1800, 1800, { fit: 'inside' })
    .jpeg({ quality: 90, mozjpeg: true })
    .toBuffer()

  const outputMetadata = await sharp(outputBuffer).metadata()

  return {
    buffer: outputBuffer,
    contentType: 'image/jpeg',
    widthPx: outputMetadata.width || 1800,
    heightPx: outputMetadata.height || 1800,
    template,
    validation: {
      template_id: template.id,
      template_path: template.relativePath,
      template_finish: template.finish,
      artwork_box: artworkBox,
      composite_artwork_box: compositeArtworkBox,
      chrome_boxes: chromeBoxes,
      template_width_px: width,
      template_height_px: height,
    },
  }
}

async function fetchArtworkBuffer(url: string | undefined): Promise<Buffer> {
  if (!url) {
    throw createError({ statusCode: 422, message: 'Artwork URL is required' })
  }
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw createError({ statusCode: 422, message: 'Artwork URL is invalid' })
  }

  const allowLocalhost = process.env.NODE_ENV !== 'production'
  const localhost = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1' || parsed.hostname === '::1'
  if (parsed.protocol !== 'https:' && !(allowLocalhost && parsed.protocol === 'http:' && localhost)) {
    throw createError({ statusCode: 422, message: 'Mockup artwork must be an HTTPS URL' })
  }

  const response = await fetch(parsed)
  if (!response.ok) {
    throw createError({ statusCode: 502, message: `Could not download proof artwork for mockup: ${response.status}` })
  }
  const arrayBuffer = await response.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

function toPixelBox(box: ProductMockupBox, width: number, height: number): PixelBox {
  return {
    left: Math.round(box.x * width),
    top: Math.round(box.y * height),
    width: Math.round(box.w * width),
    height: Math.round(box.h * height),
  }
}

function artworkOverprintBleed(template: ProductMockupTemplate): PixelBleed {
  if (template.finish === 'metallic') {
    return { left: 4, top: 12, right: 14, bottom: 4 }
  }
  if (template.finish === 'acrylic') {
    return { left: 3, top: 8, right: 10, bottom: 3 }
  }
  return { left: 0, top: 0, right: 0, bottom: 0 }
}

function overprintedArtworkBox(box: PixelBox, width: number, height: number, bleed: PixelBleed): PixelBox {
  return clampPixelBox({
    left: box.left - bleed.left,
    top: box.top - bleed.top,
    width: box.width + bleed.left + bleed.right,
    height: box.height + bleed.top + bleed.bottom,
  }, width, height)
}

async function wallHangingRailOverlays(templateBuffer: Buffer, width: number, height: number, box: PixelBox): Promise<NamedChromeOverlay[]> {
  const railHeight = Math.max(16, Math.round(box.width * 0.11))
  const sideBleed = Math.max(6, Math.round(box.width * 0.045))
  const left = clampInt(box.left - sideBleed, 0, width - 1)
  const stripWidth = Math.min(width - left, box.width + sideBleed * 2)
  const topRail = clampPixelBox({
    left,
    top: box.top - railHeight,
    width: stripWidth,
    height: railHeight,
  }, width, height)
  const bottomRail = clampPixelBox({
    left,
    top: box.top + box.height - Math.round(railHeight * 0.7),
    width: stripWidth,
    height: Math.round(railHeight * 1.18),
  }, width, height)

  return Promise.all([
    chromeOverlayFromTemplate('top_rail', templateBuffer, topRail),
    chromeOverlayFromTemplate('bottom_rail', templateBuffer, bottomRail),
  ])
}

async function chromeOverlayFromTemplate(id: string, templateBuffer: Buffer, box: PixelBox): Promise<NamedChromeOverlay> {
  return {
    id,
    input: await sharp(templateBuffer).extract(box).toBuffer(),
    left: box.left,
    top: box.top,
    box,
  }
}

function clampPixelBox(box: PixelBox, width: number, height: number): PixelBox {
  const left = clampInt(box.left, 0, width - 1)
  const top = clampInt(box.top, 0, height - 1)
  return {
    left,
    top,
    width: clampInt(box.width, 1, width - left),
    height: clampInt(box.height, 1, height - top),
  }
}

function clampInt(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)))
}

async function acrylicChromeOverlay(width: number, height: number, box: PixelBox): Promise<Buffer> {
  const screwRadius = Math.round(Math.min(box.width, box.height) * 0.018)
  const screwInset = Math.round(screwRadius * 1.65)
  const screwCenters = [
    [box.left + screwInset, box.top + screwInset],
    [box.left + box.width - screwInset, box.top + screwInset],
    [box.left + screwInset, box.top + box.height - screwInset],
    [box.left + box.width - screwInset, box.top + box.height - screwInset],
  ]

  const screws = screwCenters.map(([cx, cy]) => `
    <radialGradient id="s${cx}-${cy}" cx="35%" cy="30%" r="65%">
      <stop offset="0" stop-color="rgba(255,255,255,0.95)" />
      <stop offset="0.42" stop-color="rgba(210,210,205,0.72)" />
      <stop offset="1" stop-color="rgba(58,58,56,0.52)" />
    </radialGradient>
    <circle cx="${cx}" cy="${cy}" r="${screwRadius}" fill="url(#s${cx}-${cy})" />
    <circle cx="${cx}" cy="${cy}" r="${Math.max(1, Math.round(screwRadius * 0.35))}" fill="rgba(255,255,255,0.44)" />
  `).join('')

  const svg = `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="glareA" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="rgba(255,255,255,0)" />
          <stop offset="0.5" stop-color="rgba(255,255,255,0.28)" />
          <stop offset="1" stop-color="rgba(255,255,255,0)" />
        </linearGradient>
      </defs>
      <path d="M ${box.left + box.width * 0.05} ${box.top} L ${box.left + box.width * 0.33} ${box.top} L ${box.left + box.width * 0.03} ${box.top + box.height * 0.36} L ${box.left} ${box.top + box.height * 0.36} Z" fill="url(#glareA)" />
      <path d="M ${box.left + box.width * 0.30} ${box.top} L ${box.left + box.width * 0.47} ${box.top} L ${box.left + box.width * 0.12} ${box.top + box.height * 0.39} L ${box.left + box.width * 0.02} ${box.top + box.height * 0.39} Z" fill="rgba(255,255,255,0.12)" />
      ${screws}
    </svg>
  `

  return Buffer.from(svg)
}

async function metallicSheenOverlay(width: number, height: number, box: PixelBox): Promise<Buffer> {
  const svg = `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="metalSheen" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color="rgba(255,255,255,0.03)" />
          <stop offset="0.28" stop-color="rgba(255,255,255,0.09)" />
          <stop offset="0.62" stop-color="rgba(0,0,0,0.05)" />
          <stop offset="1" stop-color="rgba(255,255,255,0.04)" />
        </linearGradient>
      </defs>
      <rect x="${box.left}" y="${box.top}" width="${box.width}" height="${box.height}" fill="url(#metalSheen)" />
    </svg>
  `
  return Buffer.from(svg)
}
