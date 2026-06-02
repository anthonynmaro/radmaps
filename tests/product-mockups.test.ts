import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { PRODUCTS } from '~/utils/products'
import {
  computeProductMockupHash,
  getMockupSupportedProducts,
  getProductMockupTemplate,
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
    expect(computeProductMockupHash({ ...base, templateVersion: 'gelato-saved-template-assets-v2' })).not.toBe(hash)
    expect(computeProductMockupHash({ ...base, rendererVersion: 'template-asset-compositor-v2' })).not.toBe(hash)
  })

  it('keeps the mockup storage path helper stable', () => {
    expect(getProductMockupPath('premade', '22222222-2222-2222-2222-222222222222', 'flat_8x12', 'abc123')).toBe(
      'renders/mockups/premade/22222222-2222-2222-2222-222222222222/flat_8x12/abc123.jpg',
    )
  })
})
