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

  it('exposes the template-backed physical formats', () => {
    const formats = getProductFormatOptions().map(format => format.type)
    expect(formats).toEqual([
      'poster',
      'framed',
      'wall_hanging',
      'aluminum',
      'acrylic',
      'digital',
    ])
    expect(formatHasMaterialChoice('aluminum')).toBe(true)
    expect(formatHasMaterialChoice('framed')).toBe(true)
    expect(formatHasMaterialChoice('wall_hanging')).toBe(true)
    expect(formatHasMaterialChoice('acrylic')).toBe(false)

    const materials = getVisibleProductMaterialOptions('aluminum')
    expect(materials.map(material => material.key)).toEqual(['aluminum_matte'])
    expect(materials.map(material => material.label)).toEqual(['Matte Aluminum'])
  })

  it('maps every enabled aluminum size/material option to exactly one SKU', () => {
    expect(PRODUCTS.filter(product => product.type === 'aluminum')).toHaveLength(5)
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
      materialKey: 'aluminum_matte',
    })).toMatchObject({
      available: false,
      reason: 'Aluminum is not offered in 32×48"',
    })
  })

  it('keeps unsupported framed sizes disabled instead of exposing missing template variants', () => {
    expect(getProductSizeAvailability({
      type: 'framed',
      sizeLabel: '16×24"',
      materialKey: 'framed_black_wood',
    })).toMatchObject({
      available: false,
      reason: 'Framed is not offered in 16×24"',
    })
    expect(getProductForSelection({
      type: 'framed',
      sizeLabel: '24×36"',
      materialKey: 'framed_black_wood',
    })?.product_uid).toBe(
      'framed_poster_mounted_premium_600x900-mm-24x36-inch_black_wood_w20xt20-mm_plexiglass_600x900-mm-24x36-inch_200-gsm-80lb-coated-silk_4-0_ver',
    )
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
      'aluminum',
      'acrylic',
      'digital',
    ])
  })

  it('keeps poster paper as a material choice and digital fixed at 9.99', () => {
    expect(getVisibleProductMaterialOptions('poster').map(material => material.key)).toEqual([
      'poster_archival_250',
    ])
    expect(getDefaultMaterialKeyForFormat('poster', '16×24"')).toBe('poster_archival_250')
    expect(getProductForSelection({ type: 'digital' })?.price_cents).toBe(999)
  })

  it('maps Gelato poster paper choices only across the template-backed poster matrix', () => {
    for (const sizeLabel of ['8×12"', '16×24"', '24×36"']) {
      expect(getProductSizeAvailability({
        type: 'poster',
        sizeLabel,
        materialKey: 'poster_archival_250',
      }).available, `${sizeLabel} archival`).toBe(true)
    }

    expect(getProductSizeAvailability({
      type: 'poster',
      sizeLabel: '12×18"',
      materialKey: 'poster_archival_250',
    })).toMatchObject({
      available: false,
      reason: 'Poster is not offered in 12×18"',
    })
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
      materialKey: 'poster_archival_250',
    })).toMatchObject({
      available: false,
      reason: 'Poster is not offered in 32×48"',
    })
  })

  it('exposes wall-hanging paper and rail variants from the saved templates', () => {
    const materials = getVisibleProductMaterialOptions('wall_hanging')
    expect(materials).toHaveLength(8)
    expect(materials.map(material => material.key)).toEqual([
      'wall_hanging_archival_black_wood',
      'wall_hanging_archival_white_wood',
      'wall_hanging_archival_natural_wood',
      'wall_hanging_archival_dark_wood',
      'wall_hanging_silk_black_wood',
      'wall_hanging_silk_white_wood',
      'wall_hanging_silk_natural_wood',
      'wall_hanging_silk_dark_wood',
    ])
    expect(getProductSizeAvailability({
      type: 'wall_hanging',
      sizeLabel: '24×36"',
      materialKey: 'wall_hanging_archival_natural_wood',
    }).available).toBe(true)
  })
})
