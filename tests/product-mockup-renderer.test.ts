import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import { renderProductTemplateMockup } from '~/server/utils/productTemplateMockups'
import { PRODUCTS } from '~/utils/products'
import { PRODUCT_MOCKUP_SCENE_FILES } from '~/utils/productMockups'

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
})
