import { describe, expect, it } from 'vitest'
import {
  PRODUCTS,
  SIZES,
  formatHasMaterialChoice,
  getDefaultMaterialKeyForFormat,
  getMaterialsForSize,
  getProductForSelection,
  getProductFormatOptions,
  getProductMaterialOptions,
  getProductSizeAvailability,
  getVisibleProductMaterialOptions,
} from '~/utils/products'

describe('product catalog selector helpers', () => {
  it('exposes aluminum as a first-class format with both Gelato metallic materials', () => {
    const formats = getProductFormatOptions().map(format => format.type)
    expect(formats).toContain('aluminum')
    expect(formatHasMaterialChoice('aluminum')).toBe(true)

    const materials = getVisibleProductMaterialOptions('aluminum')
    expect(materials.map(material => material.key)).toEqual([
      'aluminum_white_matte',
      'aluminum_brushed',
    ])
    expect(materials.map(material => material.label)).toEqual([
      'White Matte Aluminum',
      'Brushed Aluminum',
    ])
    expect(materials[1]?.warning).toMatch(/metallic base/i)
  })

  it('maps every enabled aluminum size/material option to exactly one SKU', () => {
    const enabledSizes = ['8×12"', '12×18"', '16×24"', '20×30"', '24×36"']
    const materials = getProductMaterialOptions('aluminum')

    for (const sizeLabel of enabledSizes) {
      for (const material of materials) {
        const matching = PRODUCTS.filter(product =>
          product.type === 'aluminum' &&
          product.size_label === sizeLabel &&
          product.material_key === material.key,
        )
        expect(matching, `${sizeLabel} ${material.key}`).toHaveLength(1)
        expect(getProductForSelection({
          type: 'aluminum',
          sizeLabel,
          materialKey: material.key,
        })?.product_uid).toBe(matching[0]?.product_uid)
      }
    }
  })

  it('keeps 32×48 aluminum unavailable without removing the size from the selector', () => {
    expect(SIZES.map(size => size.label)).toContain('32×48"')
    expect(getProductSizeAvailability({
      type: 'aluminum',
      sizeLabel: '32×48"',
      materialKey: 'aluminum_white_matte',
    })).toMatchObject({
      available: false,
      reason: 'Aluminum is not offered in 32×48"',
    })
  })

  it('derives available formats from products rather than a static size matrix', () => {
    expect(getMaterialsForSize('20×30"')).toEqual([
      'canvas',
      'aluminum',
      'digital',
    ])
  })

  it('keeps poster paper as a material choice and digital fixed at 9.99', () => {
    expect(getVisibleProductMaterialOptions('poster').map(material => material.key)).toEqual([
      'poster_archival_250',
      'poster_silk_200',
    ])
    expect(getDefaultMaterialKeyForFormat('poster', '16×24"')).toBe('poster_archival_250')
    expect(getProductForSelection({ type: 'digital' })?.price_cents).toBe(999)
  })
})
