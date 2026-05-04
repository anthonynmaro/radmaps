// utils/print/providerProfile.ts
//
// Phase 0 foundation: PrintProviderProfile registry.
//
// A PrintProviderProfile encapsulates everything the render pipeline needs
// to know about a given POD product (Gelato in v1) so DPI tiering, bleed,
// safe margin, and acceptable file formats live next to the product UID
// rather than scattered through render-worker code (locked decision #13).
//
// `maxDpi` is the v4 addition: large products (e.g. 32×48") render at
// 200 DPI rather than 300 to avoid OOM and Gelato file-size limits.
//
// TODO: All bleed values below are placeholders pending verification
// against Gelato's official template PDFs for each product UID.
// Confirm before any production fulfillment.
//
// NOTE: The editor is locked to a single 2:3 poster shape. Product
// dimensions are resolved here from either the short size key used by
// StyleConfig (`24x36`) or the concrete Gelato product_uid selected at
// checkout (`flat_600x900-mm-24x36-inch_...`).

import type { PrintSize } from '~/types'
import { PRODUCTS } from '~/utils/products'

export type AcceptedFormat = 'jpeg' | 'pdf' | 'png'
export type ColorProfile = 'sRGB' | 'CMYK-FOGRA39' | 'CMYK-SWOP'

export interface PrintProviderProfile {
  /** POD provider key — only 'gelato' for v1. */
  provider: 'gelato'
  /**
   * Canonical RadMaps size key for this geometry. Concrete Gelato
   * product_uid values are normalized to these profiles at lookup time.
   */
  productUid: string
  /** Trim width in inches. Source of truth for framing geometry. */
  trimWidthIn: number
  /** Trim height in inches. */
  trimHeightIn: number
  /** Bleed in millimetres. TODO: verify against Gelato template PDFs. */
  bleedMm: number
  /** Safe margin in millimetres (inset from trim). */
  safeMarginMm: number
  /** All file formats Gelato will accept for this product. */
  acceptedFormats: AcceptedFormat[]
  /** Format we will actually emit for this product (launch: jpeg). */
  preferredFormat: AcceptedFormat
  /** Provider-imposed maximum file size in megabytes. */
  maxFileSizeMb: number
  /** ICC color profile expected by the provider. */
  colorProfile: ColorProfile
  /**
   * Per-product DPI cap. The render-worker's `getPrintFraming` clamps
   * the requested DPI to this value. 32×48 caps at 200 to keep the
   * rasterised file under Gelato's size + memory limits.
   */
  maxDpi: number
}

// ─── Registry ────────────────────────────────────────────────────────────────
//
// satisfies-style: every supported 2:3 PrintSize value MUST have a profile here.
// Adding a PrintSize without a corresponding profile is a TS error.

export const GELATO_PROFILES: Record<PrintSize, PrintProviderProfile> = {
  '8x12': {
    provider: 'gelato',
    productUid: '8x12',
    trimWidthIn: 8,
    trimHeightIn: 12,
    bleedMm: 3, // TODO: confirm Gelato template PDF
    safeMarginMm: 5, // TODO: confirm
    acceptedFormats: ['jpeg', 'pdf'],
    preferredFormat: 'jpeg',
    maxFileSizeMb: 200,
    colorProfile: 'sRGB',
    maxDpi: 300,
  },
  '12x18': {
    provider: 'gelato',
    productUid: '12x18',
    trimWidthIn: 12,
    trimHeightIn: 18,
    bleedMm: 3, // TODO: confirm Gelato template PDF
    safeMarginMm: 5, // TODO: confirm
    acceptedFormats: ['jpeg', 'pdf'],
    preferredFormat: 'jpeg',
    maxFileSizeMb: 200,
    colorProfile: 'sRGB',
    maxDpi: 300,
  },
  '16x24': {
    provider: 'gelato',
    productUid: '16x24',
    trimWidthIn: 16,
    trimHeightIn: 24,
    bleedMm: 3, // TODO: confirm Gelato template PDF
    safeMarginMm: 5, // TODO: confirm
    acceptedFormats: ['jpeg', 'pdf'],
    preferredFormat: 'jpeg',
    maxFileSizeMb: 200,
    colorProfile: 'sRGB',
    maxDpi: 300,
  },
  '20x30': {
    provider: 'gelato',
    productUid: '20x30',
    trimWidthIn: 20,
    trimHeightIn: 30,
    bleedMm: 3, // TODO: confirm Gelato template PDF
    safeMarginMm: 5, // TODO: confirm
    acceptedFormats: ['jpeg', 'pdf'],
    preferredFormat: 'jpeg',
    maxFileSizeMb: 200,
    colorProfile: 'sRGB',
    maxDpi: 300,
  },
  '24x36': {
    provider: 'gelato',
    productUid: '24x36',
    trimWidthIn: 24,
    trimHeightIn: 36,
    bleedMm: 3, // TODO: confirm Gelato template PDF
    safeMarginMm: 5, // TODO: confirm
    acceptedFormats: ['jpeg', 'pdf'],
    preferredFormat: 'jpeg',
    maxFileSizeMb: 200,
    colorProfile: 'sRGB',
    maxDpi: 300,
  },
  '32x48': {
    provider: 'gelato',
    productUid: '32x48',
    trimWidthIn: 32,
    trimHeightIn: 48,
    bleedMm: 5, // TODO: confirm
    safeMarginMm: 8, // TODO: confirm
    acceptedFormats: ['jpeg', 'pdf'],
    preferredFormat: 'jpeg',
    maxFileSizeMb: 200,
    colorProfile: 'sRGB',
    // v4 locked decision: 32×48 caps at 200 DPI (not 300) for memory + size.
    maxDpi: 200,
  },
}

// Kept as a compatibility export for existing tests and call sites that
// explicitly inspect oversize DPI caps.
export const GELATO_OVERSIZE_PROFILES: Record<string, PrintProviderProfile> = {
  '32x48': GELATO_PROFILES['32x48'],
}

const LEGACY_SIZE_ALIASES: Record<string, PrintSize> = {
  '8x10': '8x12',
  '11x14': '12x18',
  '16x20': '16x24',
  '18x24': '24x36',
}

function sizeLabelToKey(sizeLabel: string | undefined): PrintSize | null {
  if (!sizeLabel || sizeLabel === 'Digital') return null
  const key = sizeLabel
    .replace(/"/g, '')
    .replace('×', 'x')
    .trim()
  return (GELATO_PROFILES as Record<string, PrintProviderProfile>)[key]
    ? key as PrintSize
    : null
}

// ─── Lookup ──────────────────────────────────────────────────────────────────

/**
 * Resolve a PrintProviderProfile by product UID.
 *
 * Lookup order:
 *  1. Short 2:3 size keys (`24x36`)
 *  2. Legacy short keys from older map rows (`18x24` → `24x36`)
 *  3. Concrete Gelato product_uid values from checkout
 *
 * Throws if the UID is unknown — callers should surface this as a
 * configuration error rather than silently rendering with a fallback.
 */
export function getProviderProfile(productUid: string): PrintProviderProfile {
  const fromSizes = (GELATO_PROFILES as Record<string, PrintProviderProfile>)[productUid]
  if (fromSizes) return fromSizes

  const legacyAlias = LEGACY_SIZE_ALIASES[productUid]
  if (legacyAlias) return GELATO_PROFILES[legacyAlias]

  const product = PRODUCTS.find((p) => p.product_uid === productUid)
  const productSizeKey = sizeLabelToKey(product?.size_label)
  if (productSizeKey) return GELATO_PROFILES[productSizeKey]

  throw new Error(`Unknown print product UID: "${productUid}"`)
}
