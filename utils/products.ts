import type { PrintProduct } from '~/types'

/**
 * Gelato product catalogue.
 *
 * Product UIDs follow Gelato's encoding format:
 *   {type}_{WxH-mm-WxH-inch}_{paper}_{colorSides}_{orientation}
 *
 * Examples:
 *   flat_210x297-mm-8x12-inch_170-gsm-65lb-uncoated_4-0_ver   (poster, A4-ish, portrait)
 *   framed_300x400-mm-12x16-inch_200-gsm-80lb-satin_4-0_ver   (framed, 12×16", portrait)
 *   canvas_406x508-mm-16x20-inch_4-0_ver                      (canvas, 16×20", portrait)
 *
 * IMPORTANT: Run `GET /api/gelato/catalog` to verify these UIDs against your
 * Gelato dashboard before going live. The UIDs below use Gelato's standard
 * naming convention for US-inch products in portrait orientation.
 *
 * Gelato docs: https://dashboard.gelato.com/docs/
 * Product UID reference: https://support.gelato.com/en/articles/8996081-what-is-a-product-uid
 */

export const PRODUCTS: PrintProduct[] = [
  // ─── Matte Posters (170 gsm / 65 lb uncoated) ─────────────────────────────
  {
    product_uid: 'flat_127x178-mm-5x7-inch_170-gsm-65lb-uncoated_4-0_ver',
    name: '5×7" Poster',
    type: 'poster',
    size_label: '5×7"',
    width_in: 5,
    height_in: 7,
    aspect_ratio: 5 / 7,
    price_cents: 1999,
    recommended_px_w: 1500,   // 5in × 300 DPI
    recommended_px_h: 2100,   // 7in × 300 DPI
  },
  {
    product_uid: 'flat_203x254-mm-8x10-inch_170-gsm-65lb-uncoated_4-0_ver',
    name: '8×10" Poster',
    type: 'poster',
    size_label: '8×10"',
    width_in: 8,
    height_in: 10,
    aspect_ratio: 8 / 10,
    price_cents: 2999,
    recommended_px_w: 2400,
    recommended_px_h: 3000,
  },
  {
    product_uid: 'flat_300x400-mm-12x16-inch_170-gsm-65lb-uncoated_4-0_ver',
    name: '12×16" Poster',
    type: 'poster',
    size_label: '12×16"',
    width_in: 12,
    height_in: 16,
    aspect_ratio: 12 / 16,
    price_cents: 3999,
    recommended_px_w: 3600,
    recommended_px_h: 4800,
  },
  {
    product_uid: 'flat_457x610-mm-18x24-inch_170-gsm-65lb-uncoated_4-0_ver',
    name: '18×24" Poster',
    type: 'poster',
    size_label: '18×24"',
    width_in: 18,
    height_in: 24,
    aspect_ratio: 18 / 24,
    price_cents: 5499,
    recommended_px_w: 5400,
    recommended_px_h: 7200,
  },
  {
    product_uid: 'flat_610x914-mm-24x36-inch_170-gsm-65lb-uncoated_4-0_ver',
    name: '24×36" Poster',
    type: 'poster',
    size_label: '24×36"',
    width_in: 24,
    height_in: 36,
    aspect_ratio: 24 / 36,
    price_cents: 7499,
    recommended_px_w: 7200,
    recommended_px_h: 10800,
  },

  // ─── Framed Prints (200 gsm / 80 lb satin, black frame) ───────────────────
  {
    product_uid: 'framed_203x254-mm-8x10-inch_200-gsm-80lb-satin_4-0_ver',
    name: '8×10" Framed Print',
    type: 'framed',
    size_label: '8×10"',
    width_in: 8,
    height_in: 10,
    aspect_ratio: 8 / 10,
    price_cents: 5999,
    recommended_px_w: 2400,
    recommended_px_h: 3000,
  },
  {
    product_uid: 'framed_300x400-mm-12x16-inch_200-gsm-80lb-satin_4-0_ver',
    name: '12×16" Framed Print',
    type: 'framed',
    size_label: '12×16"',
    width_in: 12,
    height_in: 16,
    aspect_ratio: 12 / 16,
    price_cents: 7999,
    recommended_px_w: 3600,
    recommended_px_h: 4800,
  },
  {
    product_uid: 'framed_457x610-mm-18x24-inch_200-gsm-80lb-satin_4-0_ver',
    name: '18×24" Framed Print',
    type: 'framed',
    size_label: '18×24"',
    width_in: 18,
    height_in: 24,
    aspect_ratio: 18 / 24,
    price_cents: 10999,
    recommended_px_w: 5400,
    recommended_px_h: 7200,
  },

  // ─── Stretched Canvas ───────────────────────────────────────────────────────
  {
    product_uid: 'canvas_203x254-mm-8x10-inch_4-0_ver',
    name: '8×10" Canvas',
    type: 'canvas',
    size_label: '8×10"',
    width_in: 8,
    height_in: 10,
    aspect_ratio: 8 / 10,
    price_cents: 6999,
    recommended_px_w: 2400,
    recommended_px_h: 3000,
  },
  {
    product_uid: 'canvas_406x508-mm-16x20-inch_4-0_ver',
    name: '16×20" Canvas',
    type: 'canvas',
    size_label: '16×20"',
    width_in: 16,
    height_in: 20,
    aspect_ratio: 16 / 20,
    price_cents: 9999,
    recommended_px_w: 4800,
    recommended_px_h: 6000,
  },
  {
    product_uid: 'canvas_610x914-mm-24x36-inch_4-0_ver',
    name: '24×36" Canvas',
    type: 'canvas',
    size_label: '24×36"',
    width_in: 24,
    height_in: 36,
    aspect_ratio: 24 / 36,
    price_cents: 14999,
    recommended_px_w: 7200,
    recommended_px_h: 10800,
  },

  // ─── Digital Download ───────────────────────────────────────────────────────
  {
    product_uid: 'digital',
    name: 'Digital Download',
    type: 'digital',
    size_label: 'Digital',
    width_in: 0,
    height_in: 0,
    aspect_ratio: 3 / 4, // Default aspect for digital (matches 18×24 poster)
    price_cents: 999,
    recommended_px_w: 7200,
    recommended_px_h: 10800,
  },
]

export function getProduct(uid: string): PrintProduct | undefined {
  return PRODUCTS.find(p => p.product_uid === uid)
}

export function getProductsByType(type: PrintProduct['type']): PrintProduct[] {
  return PRODUCTS.filter(p => p.type === type)
}

/**
 * Get all distinct aspect ratios available across all products.
 * Returns sorted set of { ratio, label } objects.
 */
export function getDistinctAspectRatios(): Array<{ ratio: number; label: string }> {
  const seen = new Map<string, { ratio: number; label: string }>()
  for (const p of PRODUCTS) {
    if (p.type === 'digital') continue
    const key = `${p.width_in}:${p.height_in}`
    if (!seen.has(key)) {
      seen.set(key, { ratio: p.width_in / p.height_in, label: key })
    }
  }
  return Array.from(seen.values()).sort((a, b) => a.ratio - b.ratio)
}

/**
 * Given a product, compute the render dimensions at 300 DPI including bleed.
 */
export function getRenderDimensions(product: PrintProduct): { width: number; height: number } {
  if (product.type === 'digital') {
    return { width: product.recommended_px_w, height: product.recommended_px_h }
  }
  return {
    width: product.recommended_px_w + (GELATO_BLEED_PX_AT_300DPI * 2),
    height: product.recommended_px_h + (GELATO_BLEED_PX_AT_300DPI * 2),
  }
}

export function formatPrice(cents: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(cents / 100)
}

/**
 * Gelato recommends a 3mm bleed on all sides for print products.
 * At 300 DPI, 3mm ≈ 35px per side.
 */
export const GELATO_BLEED_MM = 3
export const GELATO_BLEED_PX_AT_300DPI = 35
