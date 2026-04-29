import type { PrintProduct } from '~/types'

export interface SizeOption {
  label: string
  width_in: number
  height_in: number
  aspect_ratio: number
  available_types: Array<PrintProduct['type']>
}

// All six sizes share a 2:3 aspect ratio so the map never reframes when
// switching sizes. 20×30 is canvas-only (no flat poster/wall hanging/framed
// at that size in Gelato's catalog). 32×48 is poster + framed only.
export const SIZES: SizeOption[] = [
  { label: '8×12"',  width_in: 8,  height_in: 12, aspect_ratio: 2 / 3, available_types: ['poster', 'wall_hanging', 'canvas', 'framed', 'digital'] },
  { label: '12×18"', width_in: 12, height_in: 18, aspect_ratio: 2 / 3, available_types: ['poster', 'wall_hanging', 'canvas', 'framed', 'digital'] },
  { label: '16×24"', width_in: 16, height_in: 24, aspect_ratio: 2 / 3, available_types: ['poster', 'wall_hanging', 'canvas', 'framed', 'digital'] },
  { label: '20×30"', width_in: 20, height_in: 30, aspect_ratio: 2 / 3, available_types: ['canvas', 'digital'] },
  { label: '24×36"', width_in: 24, height_in: 36, aspect_ratio: 2 / 3, available_types: ['poster', 'wall_hanging', 'canvas', 'framed', 'digital'] },
  { label: '32×48"', width_in: 32, height_in: 48, aspect_ratio: 2 / 3, available_types: ['poster', 'framed', 'digital'] },
]

/**
 * Full product catalog.
 *
 * Confirmed UIDs (verified against template PDFs in /assets/print_templates/):
 *   flat_400x600-mm-16x24-inch_*   flat_600x900-mm-24x36-inch_*
 *   wall_hanging_poster_410-mm_*   wall_hanging_poster_635-mm_*
 *   flat_a4-8x12-inch_* (A4 = 210×297 mm ≈ 8×12")
 *
 * All others are pattern-inferred from Gelato's API — run GET /api/gelato/catalog
 * to confirm before enabling in production.
 */
export const PRODUCTS: PrintProduct[] = [

  // ─── Flat Posters ────────────────────────────────────────────────────────────
  {
    product_uid: 'flat_a4-8x12-inch_200-gsm-80lb-coated-silk_4-0_ver',
    name: '8×12" Poster',
    type: 'poster',
    size_label: '8×12"',
    width_in: 8, height_in: 12, aspect_ratio: 2 / 3,
    price_cents: 2499,
    recommended_px_w: 2400, recommended_px_h: 3600,
  },
  {
    product_uid: 'flat_300x450-mm-12x18-inch_250-gsm-100lb-uncoated-offwhite-archival_4-0_ver',
    name: '12×18" Poster',
    type: 'poster',
    size_label: '12×18"',
    width_in: 12, height_in: 18, aspect_ratio: 2 / 3,
    price_cents: 3499,
    recommended_px_w: 3600, recommended_px_h: 5400,
  },
  {
    product_uid: 'flat_400x600-mm-16x24-inch_250-gsm-100lb-uncoated-offwhite-archival_4-0_ver',
    name: '16×24" Poster',
    type: 'poster',
    size_label: '16×24"',
    width_in: 16, height_in: 24, aspect_ratio: 2 / 3,
    price_cents: 4999,
    recommended_px_w: 4800, recommended_px_h: 7200,
  },
  {
    product_uid: 'flat_600x900-mm-24x36-inch_250-gsm-100lb-uncoated-offwhite-archival_4-0_ver',
    name: '24×36" Poster',
    type: 'poster',
    size_label: '24×36"',
    width_in: 24, height_in: 36, aspect_ratio: 2 / 3,
    price_cents: 6999,
    recommended_px_w: 7200, recommended_px_h: 10800,
  },
  {
    product_uid: 'flat_800x1200-mm-32x48-inch_250-gsm-100lb-uncoated-offwhite-archival_4-0_ver',
    name: '32×48" Poster',
    type: 'poster',
    size_label: '32×48"',
    width_in: 32, height_in: 48, aspect_ratio: 2 / 3,
    price_cents: 8999,
    // 200 DPI — 300 DPI would OOM the render worker at this scale
    recommended_px_w: 6400, recommended_px_h: 9600,
  },

  // ─── Wall Hangings (black wood rod) ──────────────────────────────────────────
  // 16×24 and 24×36 UIDs confirmed via template PDFs.
  // 8×12 (229 mm rod) and 12×18 (310 mm rod) are pattern-inferred.
  {
    product_uid: 'wall_hanging_poster_229-mm_black_wood_w14xt20-mm_a4-8x12-inch_200-gsm-80lb-uncoated_4-0_ver',
    name: '8×12" Wall Hanging',
    type: 'wall_hanging',
    size_label: '8×12"',
    width_in: 8, height_in: 12, aspect_ratio: 2 / 3,
    price_cents: 4999,
    recommended_px_w: 2400, recommended_px_h: 3600,
  },
  {
    product_uid: 'wall_hanging_poster_310-mm_black_wood_w14xt20-mm_300x450-mm-12x18-inch_200-gsm-80lb-uncoated_4-0_ver',
    name: '12×18" Wall Hanging',
    type: 'wall_hanging',
    size_label: '12×18"',
    width_in: 12, height_in: 18, aspect_ratio: 2 / 3,
    price_cents: 6499,
    recommended_px_w: 3600, recommended_px_h: 5400,
  },
  {
    product_uid: 'wall_hanging_poster_410-mm_black_wood_w14xt20-mm_400x600-mm-16x24-inch_200-gsm-80lb-uncoated_4-0_ver',
    name: '16×24" Wall Hanging',
    type: 'wall_hanging',
    size_label: '16×24"',
    width_in: 16, height_in: 24, aspect_ratio: 2 / 3,
    price_cents: 8499,
    recommended_px_w: 4800, recommended_px_h: 7200,
  },
  {
    product_uid: 'wall_hanging_poster_635-mm_black_wood_w14xt20-mm_600x900-mm-24x36-inch_200-gsm-80lb-uncoated_4-0_ver',
    name: '24×36" Wall Hanging',
    type: 'wall_hanging',
    size_label: '24×36"',
    width_in: 24, height_in: 36, aspect_ratio: 2 / 3,
    price_cents: 12499,
    recommended_px_w: 7200, recommended_px_h: 10800,
  },

  // ─── Stretched Canvas ─────────────────────────────────────────────────────────
  // UIDs from Gelato API research: canvas_{size}_canvas_wood-fsc-slim_4-0_ver
  // 20×30 is the only size available for canvas but not flat poster.
  // Verify all against GET /api/gelato/catalog before production use.
  {
    product_uid: 'canvas_8x12-inch-200x300-mm_canvas_wood-fsc-slim_4-0_ver',
    name: '8×12" Canvas',
    type: 'canvas',
    size_label: '8×12"',
    width_in: 8, height_in: 12, aspect_ratio: 2 / 3,
    price_cents: 6499,
    recommended_px_w: 2400, recommended_px_h: 3600,
  },
  {
    product_uid: 'canvas_12x18-inch-300x450-mm_canvas_wood-fsc-slim_4-0_ver',
    name: '12×18" Canvas',
    type: 'canvas',
    size_label: '12×18"',
    width_in: 12, height_in: 18, aspect_ratio: 2 / 3,
    price_cents: 8499,
    recommended_px_w: 3600, recommended_px_h: 5400,
  },
  {
    product_uid: 'canvas_16x24-inch-400x600-mm_canvas_wood-fsc-slim_4-0_ver',
    name: '16×24" Canvas',
    type: 'canvas',
    size_label: '16×24"',
    width_in: 16, height_in: 24, aspect_ratio: 2 / 3,
    price_cents: 10499,
    recommended_px_w: 4800, recommended_px_h: 7200,
  },
  {
    product_uid: 'canvas_20x30-inch-500x750-mm_canvas_wood-fsc-slim_4-0_ver',
    name: '20×30" Canvas',
    type: 'canvas',
    size_label: '20×30"',
    width_in: 20, height_in: 30, aspect_ratio: 2 / 3,
    price_cents: 12499,
    recommended_px_w: 6000, recommended_px_h: 9000,
  },
  {
    product_uid: 'canvas_24x36-inch-600x900-mm_canvas_wood-fsc-slim_4-0_ver',
    name: '24×36" Canvas',
    type: 'canvas',
    size_label: '24×36"',
    width_in: 24, height_in: 36, aspect_ratio: 2 / 3,
    price_cents: 15499,
    recommended_px_w: 7200, recommended_px_h: 10800,
  },

  // ─── Framed Prints ────────────────────────────────────────────────────────────
  // UIDs from Gelato API research: frame_and_poster_product_frs_{size}_frc_black_frm_aluminum_...
  // Verify all against GET /api/gelato/catalog before production use.
  {
    product_uid: 'frame_and_poster_product_frs_8x12-inch_frc_black_frm_aluminum_frp_w10xt22-mm_gt_plexiglass__pf_8x12-inch_pt_80-lb-cover-coated-silk_cl_4-0_ct_none_prt_none_ver',
    name: '8×12" Framed Print',
    type: 'framed',
    size_label: '8×12"',
    width_in: 8, height_in: 12, aspect_ratio: 2 / 3,
    price_cents: 7999,
    recommended_px_w: 2400, recommended_px_h: 3600,
  },
  {
    product_uid: 'frame_and_poster_product_frs_12x18-inch_frc_black_frm_aluminum_frp_w10xt22-mm_gt_plexiglass__pf_12x18-inch_pt_80-lb-cover-coated-silk_cl_4-0_ct_none_prt_none_ver',
    name: '12×18" Framed Print',
    type: 'framed',
    size_label: '12×18"',
    width_in: 12, height_in: 18, aspect_ratio: 2 / 3,
    price_cents: 9999,
    recommended_px_w: 3600, recommended_px_h: 5400,
  },
  {
    product_uid: 'frame_and_poster_product_frs_16x24-inch_frc_black_frm_aluminum_frp_w12xt22-mm_gt_plexiglass__pf_16x24-inch_pt_100-lb-cover-uncoated_cl_4-0_ct_none_prt_none_ver',
    name: '16×24" Framed Print',
    type: 'framed',
    size_label: '16×24"',
    width_in: 16, height_in: 24, aspect_ratio: 2 / 3,
    price_cents: 11999,
    recommended_px_w: 4800, recommended_px_h: 7200,
  },
  {
    product_uid: 'frame_and_poster_product_frs_24x36-inch_frc_black_frm_aluminum_frp_w10xt22-mm_gt_plexiglass__pf_24x36-inch_pt_80-lb-cover-coated-silk_cl_4-0_ct_none_prt_none_ver',
    name: '24×36" Framed Print',
    type: 'framed',
    size_label: '24×36"',
    width_in: 24, height_in: 36, aspect_ratio: 2 / 3,
    price_cents: 15499,
    recommended_px_w: 7200, recommended_px_h: 10800,
  },
  {
    product_uid: 'frame_and_poster_product_frs_32x48-inch_frc_black_frm_aluminum_frp_w10xt22-mm_gt_plexiglass__pf_32x48-inch_pt_80-lb-cover-coated-silk_cl_4-0_ct_none_prt_none_ver',
    name: '32×48" Framed Print',
    type: 'framed',
    size_label: '32×48"',
    width_in: 32, height_in: 48, aspect_ratio: 2 / 3,
    price_cents: 19999,
    recommended_px_w: 6400, recommended_px_h: 9600,
  },

  // ─── Digital Download ─────────────────────────────────────────────────────────
  {
    product_uid: 'digital',
    name: 'Digital Download',
    type: 'digital',
    size_label: 'Digital',
    width_in: 0, height_in: 0, aspect_ratio: 2 / 3,
    price_cents: 999,
    recommended_px_w: 7200, recommended_px_h: 10800,
  },
]

export function getProduct(uid: string): PrintProduct | undefined {
  return PRODUCTS.find(p => p.product_uid === uid)
}

export function getProductsByType(type: PrintProduct['type']): PrintProduct[] {
  return PRODUCTS.filter(p => p.type === type)
}

export function getMaterialsForSize(sizeLabel: string): Array<PrintProduct['type']> {
  return SIZES.find(s => s.label === sizeLabel)?.available_types ?? []
}

export function getProductBySize(sizeLabel: string, type: PrintProduct['type']): PrintProduct | undefined {
  if (type === 'digital') return PRODUCTS.find(p => p.type === 'digital')
  return PRODUCTS.find(p => p.size_label === sizeLabel && p.type === type)
}

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

export const GELATO_BLEED_MM = 3
export const GELATO_BLEED_PX_AT_300DPI = 35
