// utils/print/printFraming.ts
//
// Phase 0 foundation: print framing geometry calculator.
//
// PrintFraming converts a (productUid, renderClass) pair into the full
// pixel geometry the render pipeline needs:
//   - the full bleed canvas (the renderer viewport)
//   - the trim box (where the paper will be cut)
//   - the safe box (where chrome text MUST live)
//
// The real Vue poster renders at the full-bleed viewport. Header/footer,
// border, logo, and text live in MapPreview.vue.
//
// v4 locked decision #13: per-product DPI tiering uses
// providerProfile.maxDpi rather than render-worker logic.

import { getProviderProfile, type PrintProviderProfile } from './providerProfile'

export type RenderClass = 'proof' | 'final'

/** Default DPI per render class, before maxDpi clamping. */
const RENDER_CLASS_DPI: Record<RenderClass, number> = {
  // Proof renders go to web preview only; lower DPI saves render time.
  proof: 150,
  // Final print targets the provider's preferred resolution; clamped per-product.
  final: 300,
}

const MM_PER_INCH = 25.4

export interface Box {
  x: number
  y: number
  w: number
  h: number
}

export interface PrintFraming {
  /** Trim width in inches (provider profile). */
  trimWidthIn: number
  /** Trim height in inches (provider profile). */
  trimHeightIn: number
  /** Bleed in inches (converted from profile mm). */
  bleedIn: number
  /** Safe margin in inches (converted from profile mm). */
  safeMarginIn: number
  /** Effective DPI after maxDpi clamping. */
  dpi: number
  /** Full canvas width in pixels (trim + 2 × bleed). */
  fullWidthPx: number
  /** Full canvas height in pixels (trim + 2 × bleed). */
  fullHeightPx: number
  /** Bleed-edge box: the entire raster canvas. */
  bleedBox: Box
  /** Trim box (paper edge): inset from bleed by `bleedIn`. */
  trimBox: Box
  /** Safe box (text/chrome safe area): inset from trim by `safeMarginIn`. */
  safeBox: Box
  /**
   * Map viewport in pixels. Current model: this equals `bleedBox`; MapPreview
   * handles all poster chrome inside that full renderer viewport.
   */
  mapViewportPx: Box
}

/**
 * Compute print framing for a given product UID and render class.
 *
 * Steps:
 *  1. Resolve the PrintProviderProfile from `productUid`.
 *  2. Pick base DPI from `RENDER_CLASS_DPI[renderClass]`.
 *  3. Clamp DPI to `profile.maxDpi` (e.g. 32×48 → 200, not 300).
 *  4. Convert mm → inches → pixels at the effective DPI.
 *  5. Compute bleed/trim/safe boxes.
 */
export function getPrintFraming(productUid: string, renderClass: RenderClass): PrintFraming {
  const profile: PrintProviderProfile = getProviderProfile(productUid)

  const baseDpi = RENDER_CLASS_DPI[renderClass]
  // v4: maxDpi is the source-of-truth cap.
  const dpi = Math.min(baseDpi, profile.maxDpi)

  const bleedIn = profile.bleedMm / MM_PER_INCH
  const safeMarginIn = profile.safeMarginMm / MM_PER_INCH

  const trimWidthIn = profile.trimWidthIn
  const trimHeightIn = profile.trimHeightIn

  const fullWidthIn = trimWidthIn + 2 * bleedIn
  const fullHeightIn = trimHeightIn + 2 * bleedIn

  const fullWidthPx = Math.round(fullWidthIn * dpi)
  const fullHeightPx = Math.round(fullHeightIn * dpi)

  const bleedPx = Math.round(bleedIn * dpi)
  const safeMarginPx = Math.round(safeMarginIn * dpi)

  const trimWidthPx = Math.round(trimWidthIn * dpi)
  const trimHeightPx = Math.round(trimHeightIn * dpi)

  const bleedBox: Box = {
    x: 0,
    y: 0,
    w: fullWidthPx,
    h: fullHeightPx,
  }

  const trimBox: Box = {
    x: bleedPx,
    y: bleedPx,
    w: trimWidthPx,
    h: trimHeightPx,
  }

  const safeBox: Box = {
    x: bleedPx + safeMarginPx,
    y: bleedPx + safeMarginPx,
    w: trimWidthPx - 2 * safeMarginPx,
    h: trimHeightPx - 2 * safeMarginPx,
  }

  // v4: map viewport == full bleed canvas (oversized).
  const mapViewportPx: Box = { ...bleedBox }

  return {
    trimWidthIn,
    trimHeightIn,
    bleedIn,
    safeMarginIn,
    dpi,
    fullWidthPx,
    fullHeightPx,
    bleedBox,
    trimBox,
    safeBox,
    mapViewportPx,
  }
}
