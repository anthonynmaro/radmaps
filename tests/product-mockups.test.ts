import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { PRODUCTS } from '~/utils/products'
import {
  computeProductMockupHash,
  getMockupSupportedProducts,
  getProductMockupTemplate,
  PRODUCT_MOCKUP_SCENE_FILES,
  PRODUCT_MOCKUP_PROVIDER,
  PRODUCT_MOCKUP_RENDERER_VERSION,
  PRODUCT_MOCKUP_TEMPLATE_VERSION,
} from '~/utils/productMockups'
import { getProductMockupPath } from '~/utils/render/storagePaths'

describe('product mockups', () => {
  it('supports every physical template-backed product and excludes digital', () => {
    const physicalProducts = PRODUCTS.filter(product => product.type !== 'digital')
    expect(PRODUCT_MOCKUP_PROVIDER).toBe('gelato_template_asset')
    expect(getMockupSupportedProducts().map(product => product.product_uid)).toEqual(
      physicalProducts.map(product => product.product_uid),
    )
  })

  it('resolves every physical product to an existing saved template image', () => {
    for (const product of PRODUCTS.filter(product => product.type !== 'digital')) {
      const template = getProductMockupTemplate(product)
      expect(template, product.product_uid).toBeTruthy()
      expect(template?.relativePath).toContain(product.product_uid)
      expect(
        existsSync(join(process.cwd(), template!.relativePath)),
        template!.relativePath,
      ).toBe(true)
    }
  })

  it('uses the provided room and lobby scenes instead of the plain gray close-up', () => {
    const scenes = new Set(
      PRODUCTS
        .filter(product => product.type !== 'digital')
        .map(product => getProductMockupTemplate(product)?.sceneFile),
    )
    expect(scenes).toEqual(new Set([
      PRODUCT_MOCKUP_SCENE_FILES.bedroomWhite,
      PRODUCT_MOCKUP_SCENE_FILES.lobbyDarkEmerald,
    ]))

    for (const product of PRODUCTS.filter(product => product.type === 'framed')) {
      expect(getProductMockupTemplate(product)?.sceneFile).toBe(PRODUCT_MOCKUP_SCENE_FILES.lobbyDarkEmerald)
    }
    for (const product of PRODUCTS.filter(product => product.type !== 'digital' && product.type !== 'framed')) {
      expect(getProductMockupTemplate(product)?.sceneFile).toBe(PRODUCT_MOCKUP_SCENE_FILES.bedroomWhite)
    }
  })

  it('scales insertion boxes by product size inside the provided scenes', () => {
    const poster8 = getProductMockupTemplate(PRODUCTS.find(product => product.product_uid.startsWith('flat_a4-8x12-inch'))!)!
    const poster24 = getProductMockupTemplate(PRODUCTS.find(product => product.product_uid.startsWith('flat_600x900-mm-24x36-inch'))!)!
    const framed12 = getProductMockupTemplate(PRODUCTS.find(product => product.product_uid.startsWith('framed_poster_mounted_premium_300x450-mm-12x18-inch'))!)!

    expect(poster24.artworkBox.w).toBeGreaterThan(poster8.artworkBox.w)
    expect(poster24.artworkBox.h).toBeGreaterThan(poster8.artworkBox.h)
    expect(framed12.artworkBox.x + framed12.artworkBox.w).toBeLessThan(0.6)
    expect(framed12.artworkBox.y + framed12.artworkBox.h).toBeLessThan(0.7)
  })

  it('changes hash when the source render, product, template, or renderer changes', () => {
    const product = getMockupSupportedProducts()[0]
    const template = getProductMockupTemplate(product)!
    const base = {
      sourceType: 'map' as const,
      sourceId: '11111111-1111-1111-1111-111111111111',
      sourceRenderHash: 'proof-a',
      productUid: product.product_uid,
      templateId: template.id,
      templateVersion: PRODUCT_MOCKUP_TEMPLATE_VERSION,
      rendererVersion: PRODUCT_MOCKUP_RENDERER_VERSION,
    }
    const hash = computeProductMockupHash(base)
    expect(computeProductMockupHash({ ...base, sourceRenderHash: 'proof-b' })).not.toBe(hash)
    expect(computeProductMockupHash({ ...base, productUid: getMockupSupportedProducts()[1].product_uid })).not.toBe(hash)
    expect(computeProductMockupHash({ ...base, templateId: `${template.id}-next` })).not.toBe(hash)
    expect(computeProductMockupHash({ ...base, templateVersion: 'gelato-saved-template-room-scenes-v3' })).not.toBe(hash)
    expect(computeProductMockupHash({ ...base, rendererVersion: 'template-asset-compositor-v3' })).not.toBe(hash)
  })

  it('keeps the mockup storage path helper stable', () => {
    expect(getProductMockupPath('premade', '22222222-2222-2222-2222-222222222222', 'flat_8x12', 'abc123')).toBe(
      'renders/mockups/premade/22222222-2222-2222-2222-222222222222/flat_8x12/abc123.jpg',
    )
  })
})
