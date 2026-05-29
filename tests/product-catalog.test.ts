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
  it('does not contain duplicate product UIDs', () => {
    const productUids = PRODUCTS.map(product => product.product_uid)
    expect(new Set(productUids).size).toBe(productUids.length)
  })

  it('resolves every enabled physical product through the selector helpers', () => {
    for (const product of PRODUCTS.filter(product => product.type !== 'digital')) {
      const matching = PRODUCTS.filter(candidate =>
        candidate.type === product.type &&
        candidate.size_label === product.size_label &&
        (candidate.material_key || null) === (product.material_key || null),
      )
      expect(matching, `${product.type} ${product.size_label} ${product.material_key || ''}`).toHaveLength(1)
      expect(getProductForSelection({
        type: product.type,
        sizeLabel: product.size_label,
        materialKey: product.material_key,
      })?.product_uid).toBe(product.product_uid)
    }
  })

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
    expect(PRODUCTS.filter(product => product.type === 'aluminum')).toHaveLength(10)
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

  it('keeps unsupported framed sizes disabled instead of exposing unpriced Gelato UIDs', () => {
    expect(getProductForSelection({ type: 'framed', sizeLabel: '16×24"' })?.product_uid).toBe(
      'framed_poster_400x600-mm-16x24-inch_black_aluminum_w12xt22-mm_plexiglass_400x600-mm-16x24-inch_200-gsm-80lb-coated-silk_4-0_ver',
    )
    expect(getProductForSelection({ type: 'framed', sizeLabel: '16×24"' })?.price_cents).toBe(6800)
    expect(getProductSizeAvailability({
      type: 'framed',
      sizeLabel: '32×48"',
    })).toMatchObject({
      available: false,
      reason: 'Framed is not offered in 32×48"',
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

  it('maps Gelato poster paper choices across the supported poster size matrix', () => {
    for (const sizeLabel of ['8×12"', '12×18"', '16×24"', '24×36"']) {
      expect(getProductSizeAvailability({
        type: 'poster',
        sizeLabel,
        materialKey: 'poster_archival_250',
      }).available, `${sizeLabel} archival`).toBe(true)
      expect(getProductSizeAvailability({
        type: 'poster',
        sizeLabel,
        materialKey: 'poster_silk_200',
      }).available, `${sizeLabel} silk`).toBe(true)
    }

    expect(getProductSizeAvailability({
      type: 'poster',
      sizeLabel: '20×30"',
      materialKey: 'poster_archival_250',
    })).toMatchObject({
      available: false,
      reason: 'Poster is not offered in 20×30"',
    })
    expect(getProductSizeAvailability({
      type: 'poster',
      sizeLabel: '32×48"',
      materialKey: 'poster_silk_200',
    })).toMatchObject({
      available: false,
      reason: 'Silk 200 gsm is not offered in 32×48"',
    })
  })
})
