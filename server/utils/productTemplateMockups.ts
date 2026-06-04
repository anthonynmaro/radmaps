import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import sharp from 'sharp'
import type { PrintProduct } from '~/types'
import { getProductMockupArtworkBleedPx } from '~/utils/productMockupGeometry'
import { getProductMockupChromeBoxes } from '~/utils/productMockupChrome'
import { getProductMockupAcrylicRivetBoxes } from '~/utils/productMockupHardware'
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
  const compositeArtworkBox = overprintedArtworkBox(
    artworkBox,
    width,
    height,
    getProductMockupArtworkBleedPx(template.finish, template.sceneFile),
  )
  const artworkLayer = await sharp(artworkBuffer)
    .rotate()
    .resize(compositeArtworkBox.width, compositeArtworkBox.height, { fit: 'cover' })
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

  if (template.finish === 'wall_hanging' || template.finish === 'framed') {
    const chromeOverlays = await templateChromeOverlays(template, templateBuffer, width, height)
    for (const overlay of chromeOverlays) {
      chromeBoxes[overlay.id] = overlay.box
      composites.push({
        input: overlay.input,
        left: overlay.left,
        top: overlay.top,
      })
    }
  }

  if (template.finish === 'acrylic') {
    composites.push({ input: await acrylicGlareOverlay(width, height, compositeArtworkBox), left: 0, top: 0 })
    const rivetOverlays = await templateAcrylicRivetOverlays(template, templateBuffer, width, height)
    for (const overlay of rivetOverlays) {
      chromeBoxes[overlay.id] = overlay.box
      composites.push({
        input: overlay.input,
        left: overlay.left,
        top: overlay.top,
      })
    }
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
      template_asset_product_uid: template.assetProductUid,
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

function overprintedArtworkBox(box: PixelBox, width: number, height: number, bleed: PixelBleed): PixelBox {
  return clampPixelBox({
    left: box.left - bleed.left,
    top: box.top - bleed.top,
    width: box.width + bleed.left + bleed.right,
    height: box.height + bleed.top + bleed.bottom,
  }, width, height)
}

async function templateChromeOverlays(template: ProductMockupTemplate, templateBuffer: Buffer, width: number, height: number): Promise<NamedChromeOverlay[]> {
  return Promise.all(
    getProductMockupChromeBoxes(template).map(chrome =>
      chromeOverlayFromTemplate(chrome.id, templateBuffer, toPixelBox(chrome.box, width, height)),
    ),
  )
}

async function templateAcrylicRivetOverlays(template: ProductMockupTemplate, templateBuffer: Buffer, width: number, height: number): Promise<NamedChromeOverlay[]> {
  void templateBuffer
  return Promise.all(getProductMockupAcrylicRivetBoxes(template.artworkBox, template.finish, template.sceneFile).map(async (rivet) => {
    const box = toPixelBox(rivet.box, width, height)
    return {
      id: rivet.id,
      input: await acrylicStandOffOverlay(box),
      left: box.left,
      top: box.top,
      box,
    }
  }))
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

async function acrylicStandOffOverlay(box: PixelBox): Promise<Buffer> {
  const size = Math.max(1, Math.min(box.width, box.height))
  const center = size / 2
  const outerRadius = size * 0.49

  const svg = Buffer.from(`
    <svg width="${box.width}" height="${box.height}" viewBox="0 0 ${box.width} ${box.height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="metalFace" cx="50%" cy="50%" r="52%">
          <stop offset="0" stop-color="#d7d9d6" />
          <stop offset="0.44" stop-color="#d4d7d5" />
          <stop offset="0.62" stop-color="#a5aaa8" />
          <stop offset="0.82" stop-color="#565b5e" />
          <stop offset="1" stop-color="#2c3033" />
        </radialGradient>
        <radialGradient id="metalHighlight" cx="34%" cy="28%" r="42%">
          <stop offset="0" stop-color="rgba(255,255,255,0.96)" />
          <stop offset="0.28" stop-color="rgba(255,255,255,0.46)" />
          <stop offset="1" stop-color="rgba(255,255,255,0)" />
        </radialGradient>
        <filter id="softHardwareShadow" x="-35%" y="-35%" width="170%" height="170%">
          <feDropShadow dx="0" dy="${Math.max(0.8, size * 0.035)}" stdDeviation="${Math.max(0.8, size * 0.04)}" flood-color="rgba(0,0,0,0.34)" />
        </filter>
        <clipPath id="discClip">
          <circle cx="${center}" cy="${center}" r="${outerRadius}" />
        </clipPath>
      </defs>
      <circle cx="${center}" cy="${center}" r="${outerRadius}" fill="url(#metalFace)" filter="url(#softHardwareShadow)" />
      <g clip-path="url(#discClip)" opacity="0.28">
        <path d="M ${size * -0.16} ${size * 0.70} L ${size * 0.70} ${size * -0.16}" stroke="white" stroke-width="${Math.max(1, size * 0.05)}" />
        <path d="M ${size * 0.00} ${size * 0.88} L ${size * 0.88} ${size * 0.00}" stroke="#62686a" stroke-width="${Math.max(1, size * 0.045)}" />
        <path d="M ${size * 0.22} ${size} L ${size} ${size * 0.22}" stroke="white" stroke-width="${Math.max(1, size * 0.035)}" />
      </g>
      <circle cx="${center}" cy="${center}" r="${outerRadius}" fill="url(#metalHighlight)" />
      <circle cx="${center}" cy="${center}" r="${outerRadius - 0.8}" fill="none" stroke="rgba(255,255,255,0.52)" stroke-width="${Math.max(1, size * 0.035)}" />
      <circle cx="${center}" cy="${center}" r="${outerRadius - 1.4}" fill="none" stroke="rgba(0,0,0,0.20)" stroke-width="${Math.max(0.6, size * 0.018)}" />
    </svg>
  `)

  return sharp(svg).png().toBuffer()
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

async function acrylicGlareOverlay(width: number, height: number, box: PixelBox): Promise<Buffer> {
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
