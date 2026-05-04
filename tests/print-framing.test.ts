import { describe, it, expect } from 'vitest'
import { getPrintFraming, type RenderClass } from '../utils/print/printFraming'
import { GELATO_PROFILES, GELATO_OVERSIZE_PROFILES } from '../utils/print/providerProfile'
import { PRODUCTS } from '../utils/products'
import { PRINT_SIZES } from '../types'

const MM_PER_INCH = 25.4

describe('getPrintFraming — every product size at every render class', () => {
  const cases: { uid: string; renderClass: RenderClass }[] = []
  for (const size of PRINT_SIZES) {
    cases.push({ uid: size.id, renderClass: 'proof' })
    cases.push({ uid: size.id, renderClass: 'final' })
  }

  for (const { uid, renderClass } of cases) {
    it(`${uid} @ ${renderClass} — pixel dimensions match (trim + 2*bleed) * dpi`, () => {
      const framing = getPrintFraming(uid, renderClass)
      const profile = (GELATO_PROFILES as Record<string, typeof GELATO_PROFILES['24x36']>)[uid]
      expect(profile).toBeDefined()

      const expectedDpi = Math.min(renderClass === 'final' ? 300 : 150, profile.maxDpi)
      expect(framing.dpi).toBe(expectedDpi)

      const bleedIn = profile.bleedMm / MM_PER_INCH
      const expectedFullW = Math.round((profile.trimWidthIn + 2 * bleedIn) * expectedDpi)
      const expectedFullH = Math.round((profile.trimHeightIn + 2 * bleedIn) * expectedDpi)

      expect(framing.fullWidthPx).toBe(expectedFullW)
      expect(framing.fullHeightPx).toBe(expectedFullH)
      expect(framing.bleedBox.w).toBe(expectedFullW)
      expect(framing.bleedBox.h).toBe(expectedFullH)
    })

    it(`${uid} @ ${renderClass} — mapViewportPx equals bleedBox (oversized model)`, () => {
      const framing = getPrintFraming(uid, renderClass)
      expect(framing.mapViewportPx).toEqual(framing.bleedBox)
    })

    it(`${uid} @ ${renderClass} — safeBox is properly inset from trimBox`, () => {
      const framing = getPrintFraming(uid, renderClass)
      const profile = (GELATO_PROFILES as Record<string, typeof GELATO_PROFILES['24x36']>)[uid]

      const safeMarginPx = Math.round((profile.safeMarginMm / MM_PER_INCH) * framing.dpi)

      // safeBox sits inside trimBox by safeMarginPx on each side
      expect(framing.safeBox.x).toBe(framing.trimBox.x + safeMarginPx)
      expect(framing.safeBox.y).toBe(framing.trimBox.y + safeMarginPx)
      expect(framing.safeBox.w).toBe(framing.trimBox.w - 2 * safeMarginPx)
      expect(framing.safeBox.h).toBe(framing.trimBox.h - 2 * safeMarginPx)

      // trimBox origin sits at bleedPx on each axis. (Width/height are
      // rounded from inches independently of the bleed inset, so we
      // compare to the trim-from-inches calculation rather than to
      // bleedBox-minus-bleed which can differ by a single pixel after
      // independent rounding — the implementation prefers the direct
      // trim-in-pixels conversion.)
      const bleedPx = Math.round((profile.bleedMm / MM_PER_INCH) * framing.dpi)
      const trimWPx = Math.round(profile.trimWidthIn * framing.dpi)
      const trimHPx = Math.round(profile.trimHeightIn * framing.dpi)
      expect(framing.trimBox.x).toBe(bleedPx)
      expect(framing.trimBox.y).toBe(bleedPx)
      expect(framing.trimBox.w).toBe(trimWPx)
      expect(framing.trimBox.h).toBe(trimHPx)
      // bleedBox is at least as wide/tall as trim + 2*bleed (within 1px of rounding)
      expect(Math.abs(framing.bleedBox.w - (trimWPx + 2 * bleedPx))).toBeLessThanOrEqual(1)
      expect(Math.abs(framing.bleedBox.h - (trimHPx + 2 * bleedPx))).toBeLessThanOrEqual(1)
    })
  }
})

describe('maxDpi cap (32×48 enforces 200 DPI)', () => {
  it('32×48 final caps at 200 DPI even though base final is 300', () => {
    const profile = GELATO_OVERSIZE_PROFILES['32x48']
    expect(profile.maxDpi).toBe(200)

    const framing = getPrintFraming('32x48', 'final')
    expect(framing.dpi).toBe(200)
  })

  it('32×48 proof at 150 DPI is below maxDpi so cap does not engage', () => {
    const framing = getPrintFraming('32x48', 'proof')
    expect(framing.dpi).toBe(150)
  })

  it('32×48 final pixel dimensions reflect the 200 DPI cap (NOT 300)', () => {
    const framing = getPrintFraming('32x48', 'final')
    const profile = GELATO_OVERSIZE_PROFILES['32x48']
    const bleedIn = profile.bleedMm / MM_PER_INCH
    const expectedFullW = Math.round((profile.trimWidthIn + 2 * bleedIn) * 200)
    const expectedFullH = Math.round((profile.trimHeightIn + 2 * bleedIn) * 200)
    expect(framing.fullWidthPx).toBe(expectedFullW)
    expect(framing.fullHeightPx).toBe(expectedFullH)
  })
})

describe('unknown product UID throws', () => {
  it('unknown UID surfaces as a configuration error', () => {
    expect(() => getPrintFraming('not-a-real-product', 'final')).toThrow()
  })
})

describe('inches conversions are correct', () => {
  it('24x36 final uses 3mm bleed and 5mm safe margin from profile', () => {
    const framing = getPrintFraming('24x36', 'final')
    expect(framing.trimWidthIn).toBe(24)
    expect(framing.trimHeightIn).toBe(36)
    expect(framing.bleedIn).toBeCloseTo(3 / 25.4, 8)
    expect(framing.safeMarginIn).toBeCloseTo(5 / 25.4, 8)
  })

  it('legacy 18x24 keys normalize to the canonical 24x36 ratio family', () => {
    const framing = getPrintFraming('18x24', 'final')
    expect(framing.trimWidthIn).toBe(24)
    expect(framing.trimHeightIn).toBe(36)
  })

  it('real Gelato product UIDs resolve to their 2:3 product profile', () => {
    const product = PRODUCTS.find((p) => p.type === 'poster' && p.size_label === '24×36"')
    expect(product).toBeDefined()
    const framing = getPrintFraming(product!.product_uid, 'final')
    expect(framing.trimWidthIn).toBe(24)
    expect(framing.trimHeightIn).toBe(36)
  })
})
