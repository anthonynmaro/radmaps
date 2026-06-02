import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import { renderProductTemplateMockup } from '~/server/utils/productTemplateMockups'
import { PRODUCTS } from '~/utils/products'
import { getProductMockupTemplate, PRODUCT_MOCKUP_SCENE_FILES } from '~/utils/productMockups'

type PhysicalProductFormat = 'poster' | 'framed' | 'wall_hanging' | 'aluminum' | 'acrylic'

async function fixtureArtwork(): Promise<Buffer> {
  return sharp({
    create: {
      width: 1200,
      height: 1800,
      channels: 3,
      background: '#14345b',
    },
  })
    .jpeg({ quality: 95 })
    .toBuffer()
}

function productFor(type: PhysicalProductFormat) {
  const product = PRODUCTS.find(item => item.type === type)
  if (!product) throw new Error(`Missing fixture product for ${type}`)
  return product
}

function wallHanging12x18() {
  const product = PRODUCTS.find(item =>
    item.product_uid.includes('wall_hanging_poster_310-mm_black_wood')
    && item.product_uid.includes('250-gsm-100lb-uncoated-offwhite-archival'))
  if (!product) throw new Error('Missing 12x18 black rail wall-hanging fixture product')
  return product
}

function aluminum12x18() {
  const product = PRODUCTS.find(item => item.product_uid.startsWith('metallic_300x450-mm-12x18-inch'))
  if (!product) throw new Error('Missing 12x18 aluminum fixture product')
  return product
}

async function meanLuminance(buffer: Buffer, box: { left: number; top: number; width: number; height: number }): Promise<number> {
  const { data, info } = await sharp(buffer)
    .extract(box)
    .raw()
    .toBuffer({ resolveWithObject: true })
  let sum = 0
  for (let index = 0; index < data.length; index += info.channels) {
    sum += (data[index] + data[index + 1] + data[index + 2]) / 3
  }
  return sum / (data.length / info.channels)
}

describe('product mockup renderer', () => {
  it('composites artwork into the provided room/lobby template scenes', async () => {
    const artworkBuffer = await fixtureArtwork()
    const products = [
      productFor('poster'),
      productFor('framed'),
      productFor('wall_hanging'),
      productFor('aluminum'),
      productFor('acrylic'),
    ]

    for (const product of products) {
      const rendered = await renderProductTemplateMockup({ product, artworkBuffer })
      const metadata = await sharp(rendered.buffer).metadata()

      expect(rendered.contentType).toBe('image/jpeg')
      expect(metadata.width).toBe(1800)
      expect(metadata.height).toBe(1800)
      expect(rendered.template.sceneFile).not.toBe('Close-Up-Plain-Gray-0.jpeg')
      expect([
        PRODUCT_MOCKUP_SCENE_FILES.bedroomWhite,
        PRODUCT_MOCKUP_SCENE_FILES.lobbyDarkEmerald,
      ]).toContain(rendered.template.sceneFile)
      expect(rendered.validation.artwork_box).toMatchObject({
        width: expect.any(Number),
        height: expect.any(Number),
      })
    }
  }, 20000)

  it('renders a requested gallery template scene', async () => {
    const product = productFor('poster')
    const template = getProductMockupTemplate(product, PRODUCT_MOCKUP_SCENE_FILES.plainGray)!
    const rendered = await renderProductTemplateMockup({
      product,
      template,
      artworkBuffer: await fixtureArtwork(),
    })

    expect(rendered.template.id).toBe(template.id)
    expect(rendered.template.sceneFile).toBe(PRODUCT_MOCKUP_SCENE_FILES.plainGray)
    expect(rendered.validation.template_path).toContain(PRODUCT_MOCKUP_SCENE_FILES.plainGray)
  }, 10000)

  it('overprints aluminum face edges so source template artwork does not leak through', async () => {
    const artworkBuffer = await sharp({
      create: {
        width: 1200,
        height: 1800,
        channels: 3,
        background: '#e7f4ee',
      },
    })
      .jpeg({ quality: 95 })
      .toBuffer()
    const rendered = await renderProductTemplateMockup({ product: aluminum12x18(), artworkBuffer })
    const artworkBox = rendered.validation.artwork_box as { left: number; top: number; width: number; height: number }
    const compositeBox = rendered.validation.composite_artwork_box as { left: number; top: number; width: number; height: number }
    const templateWidth = rendered.validation.template_width_px as number
    const scale = rendered.widthPx / templateWidth

    expect(compositeBox.left).toBeLessThan(artworkBox.left)
    expect(compositeBox.top).toBeLessThan(artworkBox.top)
    expect(compositeBox.left + compositeBox.width).toBeGreaterThan(artworkBox.left + artworkBox.width)

    const topEdgeSample = {
      left: Math.round((artworkBox.left + 16) * scale),
      top: Math.round((artworkBox.top - 8) * scale),
      width: Math.round((artworkBox.width - 32) * scale),
      height: Math.max(2, Math.round(4 * scale)),
    }
    const rightEdgeSample = {
      left: Math.round((artworkBox.left + artworkBox.width + 5) * scale),
      top: Math.round((artworkBox.top + 24) * scale),
      width: Math.max(2, Math.round(4 * scale)),
      height: Math.round((artworkBox.height - 48) * scale),
    }

    await expect(meanLuminance(rendered.buffer, topEdgeSample)).resolves.toBeGreaterThan(170)
    await expect(meanLuminance(rendered.buffer, rightEdgeSample)).resolves.toBeGreaterThan(170)
  }, 10000)

  it('restores wall-hanging chrome without leaking source artwork in gallery scenes', async () => {
    const artworkBuffer = await sharp({
      create: {
        width: 1200,
        height: 1800,
        channels: 3,
        background: '#e7f4ee',
      },
    })
      .jpeg({ quality: 95 })
      .toBuffer()
    const product = wallHanging12x18()

    for (const sceneFile of [PRODUCT_MOCKUP_SCENE_FILES.lobbyDarkEmerald, PRODUCT_MOCKUP_SCENE_FILES.plainGray]) {
      const template = getProductMockupTemplate(product, sceneFile)!
      const rendered = await renderProductTemplateMockup({ product, template, artworkBuffer })
      const artworkBox = rendered.validation.artwork_box as { left: number; width: number }
      const templateWidth = rendered.validation.template_width_px as number
      const scale = rendered.widthPx / templateWidth
      const chromeBoxes = rendered.validation.chrome_boxes as Record<string, { left: number; top: number; width: number; height: number }>
      const topRailSampleOffset = sceneFile === PRODUCT_MOCKUP_SCENE_FILES.lobbyDarkEmerald ? 0.9 : 0.72

      const topRailSample = {
        left: Math.round((chromeBoxes.top_rail.left + chromeBoxes.top_rail.width * 0.12) * scale),
        top: Math.round((chromeBoxes.top_rail.top + chromeBoxes.top_rail.height * topRailSampleOffset) * scale),
        width: Math.round(chromeBoxes.top_rail.width * 0.76 * scale),
        height: Math.max(2, Math.round(chromeBoxes.top_rail.height * 0.12 * scale)),
      }
      const clearFooterSample = {
        left: Math.round((artworkBox.left + artworkBox.width * 0.14) * scale),
        top: Math.round((chromeBoxes.bottom_rail.top - 16) * scale),
        width: Math.round(artworkBox.width * 0.72 * scale),
        height: Math.max(2, Math.round(6 * scale)),
      }
      const bottomRailSample = {
        left: Math.round((chromeBoxes.bottom_rail.left + chromeBoxes.bottom_rail.width * 0.12) * scale),
        top: Math.round((chromeBoxes.bottom_rail.top + chromeBoxes.bottom_rail.height * 0.45) * scale),
        width: Math.round(chromeBoxes.bottom_rail.width * 0.76 * scale),
        height: Math.max(2, Math.round(chromeBoxes.bottom_rail.height * 0.14 * scale)),
      }

      const topRailLuminance = await meanLuminance(rendered.buffer, topRailSample)
      const clearFooterLuminance = await meanLuminance(rendered.buffer, clearFooterSample)
      const bottomRailLuminance = await meanLuminance(rendered.buffer, bottomRailSample)

      expect(topRailLuminance, `${sceneFile} top rail`).toBeLessThan(105)
      expect(clearFooterLuminance, `${sceneFile} cleared footer area`).toBeGreaterThan(170)
      expect(bottomRailLuminance, `${sceneFile} bottom rail`).toBeLessThan(105)
    }
  }, 16000)

  it('restores wall-hanging rails above the replacement artwork', async () => {
    const artworkBuffer = await sharp({
      create: {
        width: 1200,
        height: 1800,
        channels: 3,
        background: '#ff00ff',
      },
    })
      .jpeg({ quality: 95 })
      .toBuffer()
    const rendered = await renderProductTemplateMockup({ product: wallHanging12x18(), artworkBuffer })
    const artworkBox = rendered.validation.artwork_box as { top: number; height: number }
    const templateWidth = rendered.validation.template_width_px as number
    const scale = rendered.widthPx / templateWidth
    const chromeBoxes = rendered.validation.chrome_boxes as Record<string, { left: number; top: number; width: number; height: number }>

    expect(chromeBoxes.top_rail).toMatchObject({
      top: expect.any(Number),
      height: expect.any(Number),
    })
    expect(chromeBoxes.bottom_rail).toMatchObject({
      top: expect.any(Number),
      height: expect.any(Number),
    })
    expect(chromeBoxes.top_rail.top).toBeLessThan(artworkBox.top)
    expect(chromeBoxes.bottom_rail.top).toBeLessThanOrEqual(artworkBox.top + artworkBox.height)

    const bottomRailSample = {
      left: Math.round((chromeBoxes.bottom_rail.left + chromeBoxes.bottom_rail.width * 0.25) * scale),
      top: Math.round((chromeBoxes.bottom_rail.top + chromeBoxes.bottom_rail.height * 0.05) * scale),
      width: Math.round(chromeBoxes.bottom_rail.width * 0.5 * scale),
      height: Math.max(2, Math.round(chromeBoxes.bottom_rail.height * 0.12 * scale)),
    }
    await expect(meanLuminance(rendered.buffer, bottomRailSample)).resolves.toBeLessThan(90)
  }, 10000)
})
