import { describe, it, expect } from 'vitest'
import {
  PRODUCTS, SIZES,
  getProduct, getProductsByType, getProductBySize, getMaterialsForSize,
  getRenderDimensions, formatPrice, GELATO_BLEED_PX_AT_300DPI,
} from '../utils/products'

// ── getProduct ────────────────────────────────────────────────────────────────

describe('getProduct', () => {
  it('returns the product for a known UID', () => {
    const p = getProduct('digital')
    expect(p).toBeDefined()
    expect(p?.type).toBe('digital')
  })

  it('returns undefined for an unknown UID', () => {
    expect(getProduct('nonexistent-uid')).toBeUndefined()
  })

  it('returns the flat 16×24 poster by exact UID', () => {
    const p = getProduct('flat_400x600-mm-16x24-inch_250-gsm-100lb-uncoated-offwhite-archival_4-0_ver')
    expect(p?.name).toBe('16×24" Poster')
    expect(p?.type).toBe('poster')
  })
})

// ── getProductsByType ─────────────────────────────────────────────────────────

describe('getProductsByType', () => {
  it('filters posters only', () => {
    const posters = getProductsByType('poster')
    expect(posters.length).toBeGreaterThan(0)
    expect(posters.every(p => p.type === 'poster')).toBe(true)
  })

  it('filters wall_hangings only', () => {
    const wh = getProductsByType('wall_hanging')
    expect(wh.every(p => p.type === 'wall_hanging')).toBe(true)
  })

  it('filters canvas only', () => {
    const c = getProductsByType('canvas')
    expect(c.every(p => p.type === 'canvas')).toBe(true)
  })

  it('filters framed only', () => {
    const f = getProductsByType('framed')
    expect(f.every(p => p.type === 'framed')).toBe(true)
  })

  it('returns exactly one digital product', () => {
    const d = getProductsByType('digital')
    expect(d).toHaveLength(1)
  })

  it('union of all types equals full catalog', () => {
    const types = ['poster', 'wall_hanging', 'canvas', 'framed', 'digital'] as const
    const total = types.reduce((sum, t) => sum + getProductsByType(t).length, 0)
    expect(total).toBe(PRODUCTS.length)
  })
})

// ── getProductBySize ──────────────────────────────────────────────────────────

describe('getProductBySize', () => {
  it('returns the 16×24 poster', () => {
    const p = getProductBySize('16×24"', 'poster')
    expect(p).toBeDefined()
    expect(p?.size_label).toBe('16×24"')
  })

  it('returns undefined for an unavailable size+type combo (20×30 wall_hanging)', () => {
    expect(getProductBySize('20×30"', 'wall_hanging')).toBeUndefined()
  })

  it('digital type always returns the digital product regardless of size', () => {
    expect(getProductBySize('8×12"', 'digital')?.type).toBe('digital')
    expect(getProductBySize('32×48"', 'digital')?.type).toBe('digital')
    expect(getProductBySize('nonexistent', 'digital')?.type).toBe('digital')
  })
})

// ── getMaterialsForSize ───────────────────────────────────────────────────────

describe('getMaterialsForSize', () => {
  it('8×12" supports poster, wall_hanging, canvas, framed, digital', () => {
    const types = getMaterialsForSize('8×12"')
    expect(types).toContain('poster')
    expect(types).toContain('wall_hanging')
    expect(types).toContain('canvas')
    expect(types).toContain('framed')
    expect(types).toContain('digital')
  })

  it('20×30" supports only canvas and digital', () => {
    const types = getMaterialsForSize('20×30"')
    expect(types).toContain('canvas')
    expect(types).toContain('digital')
    expect(types).not.toContain('poster')
    expect(types).not.toContain('wall_hanging')
  })

  it('returns empty array for unknown size', () => {
    expect(getMaterialsForSize('99×99"')).toEqual([])
  })
})

// ── getRenderDimensions ───────────────────────────────────────────────────────

describe('getRenderDimensions', () => {
  it('digital product has no bleed — returns recommended_px dimensions unchanged', () => {
    const digital = PRODUCTS.find(p => p.type === 'digital')!
    const dims = getRenderDimensions(digital)
    expect(dims.width).toBe(digital.recommended_px_w)
    expect(dims.height).toBe(digital.recommended_px_h)
  })

  it('print product adds 2 * GELATO_BLEED_PX_AT_300DPI to each dimension', () => {
    const poster = PRODUCTS.find(p => p.type === 'poster')!
    const dims = getRenderDimensions(poster)
    expect(dims.width).toBe(poster.recommended_px_w + GELATO_BLEED_PX_AT_300DPI * 2)
    expect(dims.height).toBe(poster.recommended_px_h + GELATO_BLEED_PX_AT_300DPI * 2)
  })
})

// ── formatPrice ───────────────────────────────────────────────────────────────

describe('formatPrice', () => {
  it('formats 999 cents as $9.99', () => {
    expect(formatPrice(999)).toBe('$9.99')
  })

  it('formats 0 as $0.00', () => {
    expect(formatPrice(0)).toBe('$0.00')
  })

  it('formats 4999 as $49.99', () => {
    expect(formatPrice(4999)).toBe('$49.99')
  })
})

// ── Catalog integrity ─────────────────────────────────────────────────────────

describe('catalog integrity', () => {
  it('all products have a non-empty product_uid', () => {
    for (const p of PRODUCTS) {
      expect(p.product_uid).toBeTruthy()
    }
  })

  it('no duplicate product_uids in catalog', () => {
    const uids = PRODUCTS.map(p => p.product_uid)
    expect(new Set(uids).size).toBe(uids.length)
  })

  it('all products have a 2:3 aspect ratio', () => {
    for (const p of PRODUCTS) {
      expect(p.aspect_ratio).toBeCloseTo(2 / 3, 5)
    }
  })

  it('all print products have positive recommended dimensions', () => {
    for (const p of PRODUCTS.filter(p => p.type !== 'digital')) {
      expect(p.recommended_px_w).toBeGreaterThan(0)
      expect(p.recommended_px_h).toBeGreaterThan(0)
    }
  })

  it('SIZES catalog has 6 entries', () => {
    expect(SIZES).toHaveLength(6)
  })
})
