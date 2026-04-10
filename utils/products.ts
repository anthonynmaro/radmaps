import type { PrintProduct } from '~/types'

/**
 * Gelato product catalogue.
 *
 * productUids encode the full product spec (type, size, paper, color mode).
 * These are fetched from GET https://order.gelatoapis.com/v4/products at build
 * time and should be cached. The UIDs below are illustrative — verify exact
 * strings from your Gelato dashboard or the products API before going live.
 *
 * Pricing: your retail price. Gelato's wholesale cost varies by country.
 * Use POST /v4/orders/quote to get real-time cost for a given recipient country.
 *
 * Gelato docs: https://dashboard.gelato.com/docs/
 */
export const PRODUCTS: PrintProduct[] = [
  // ─── Matte Posters ─────────────────────────────────────────────────────────
  {
    product_uid: 'flat_product_pf_5x7_pt_170-gsm-uncoated_cl_4-0_ver',
    name: '5×7" Poster',
    type: 'poster',
    size_label: '5×7"',
    width_in: 5,
    height_in: 7,
    price_cents: 1999,
    recommended_px_w: 1500,   // 5in × 300 DPI
    recommended_px_h: 2100,   // 7in × 300 DPI
  },
  {
    product_uid: 'flat_product_pf_8x10_pt_170-gsm-uncoated_cl_4-0_ver',
    name: '8×10" Poster',
    type: 'poster',
    size_label: '8×10"',
    width_in: 8,
    height_in: 10,
    price_cents: 2999,
    recommended_px_w: 2400,
    recommended_px_h: 3000,
  },
  {
    product_uid: 'flat_product_pf_12x16_pt_170-gsm-uncoated_cl_4-0_ver',
    name: '12×16" Poster',
    type: 'poster',
    size_label: '12×16"',
    width_in: 12,
    height_in: 16,
    price_cents: 3999,
    recommended_px_w: 3600,
    recommended_px_h: 4800,
  },
  {
    product_uid: 'flat_product_pf_18x24_pt_170-gsm-uncoated_cl_4-0_ver',
    name: '18×24" Poster',
    type: 'poster',
    size_label: '18×24"',
    width_in: 18,
    height_in: 24,
    price_cents: 5499,
    recommended_px_w: 5400,   // 18in × 300 DPI
    recommended_px_h: 7200,   // 24in × 300 DPI
  },
  {
    product_uid: 'flat_product_pf_24x36_pt_170-gsm-uncoated_cl_4-0_ver',
    name: '24×36" Poster',
    type: 'poster',
    size_label: '24×36"',
    width_in: 24,
    height_in: 36,
    price_cents: 7499,
    recommended_px_w: 7200,   // 24in × 300 DPI
    recommended_px_h: 10800,  // 36in × 300 DPI
  },
  // ─── Framed Prints ─────────────────────────────────────────────────────────
  {
    product_uid: 'framed_product_pf_8x10_pt_200-gsm-satin_cl_4-0_ver',
    name: '8×10" Framed Print',
    type: 'framed',
    size_label: '8×10"',
    width_in: 8,
    height_in: 10,
    price_cents: 5999,
    recommended_px_w: 2400,
    recommended_px_h: 3000,
  },
  {
    product_uid: 'framed_product_pf_12x16_pt_200-gsm-satin_cl_4-0_ver',
    name: '12×16" Framed Print',
    type: 'framed',
    size_label: '12×16"',
    width_in: 12,
    height_in: 16,
    price_cents: 7999,
    recommended_px_w: 3600,
    recommended_px_h: 4800,
  },
  {
    product_uid: 'framed_product_pf_18x24_pt_200-gsm-satin_cl_4-0_ver',
    name: '18×24" Framed Print',
    type: 'framed',
    size_label: '18×24"',
    width_in: 18,
    height_in: 24,
    price_cents: 10999,
    recommended_px_w: 5400,
    recommended_px_h: 7200,
  },
  // ─── Stretched Canvas ───────────────────────────────────────────────────────
  {
    product_uid: 'canvas_product_pf_8x10_cl_4-0_ver',
    name: '8×10" Canvas',
    type: 'canvas',
    size_label: '8×10"',
    width_in: 8,
    height_in: 10,
    price_cents: 6999,
    recommended_px_w: 2400,
    recommended_px_h: 3000,
  },
  {
    product_uid: 'canvas_product_pf_16x20_cl_4-0_ver',
    name: '16×20" Canvas',
    type: 'canvas',
    size_label: '16×20"',
    width_in: 16,
    height_in: 20,
    price_cents: 9999,
    recommended_px_w: 4800,
    recommended_px_h: 6000,
  },
  {
    product_uid: 'canvas_product_pf_24x36_cl_4-0_ver',
    name: '24×36" Canvas',
    type: 'canvas',
    size_label: '24×36"',
    width_in: 24,
    height_in: 36,
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
