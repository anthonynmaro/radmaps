import type { PrintProduct } from '~/types'

export type ProductFormat = PrintProduct['type']

export interface SizeOption {
  label: string
  width_in: number
  height_in: number
  aspect_ratio: number
}

export interface ProductFormatOption {
  type: ProductFormat
  label: string
  description: string
  icon: string
  starting_price_cents: number
}

export interface ProductMaterialOption {
  key: string
  label: string
  description?: string
  warning?: string
  format: ProductFormat
  product_count: number
}

export interface ProductSelection {
  type: ProductFormat
  sizeLabel?: string
  materialKey?: string
}

export interface ProductSizeAvailability {
  available: boolean
  product?: PrintProduct
  reason?: string
}

// All six sizes share a 2:3 aspect ratio so the map never reframes when
// switching sizes. Individual product availability is derived from PRODUCTS.
export const SIZES: SizeOption[] = [
  { label: '8×12"',  width_in: 8,  height_in: 12, aspect_ratio: 2 / 3 },
  { label: '12×18"', width_in: 12, height_in: 18, aspect_ratio: 2 / 3 },
  { label: '16×24"', width_in: 16, height_in: 24, aspect_ratio: 2 / 3 },
  { label: '20×30"', width_in: 20, height_in: 30, aspect_ratio: 2 / 3 },
  { label: '24×36"', width_in: 24, height_in: 36, aspect_ratio: 2 / 3 },
  { label: '32×48"', width_in: 32, height_in: 48, aspect_ratio: 2 / 3 },
]

export const PRODUCT_FORMAT_ORDER: ProductFormat[] = [
  'poster',
  'framed',
  'canvas',
  'wall_hanging',
  'aluminum',
  'digital',
]

export const PRODUCT_FORMAT_META: Record<ProductFormat, { label: string; description: string; icon: string }> = {
  poster: {
    label: 'Poster',
    description: 'Classic paper print',
    icon: 'i-heroicons-document-text',
  },
  framed: {
    label: 'Framed',
    description: 'Black aluminum frame',
    icon: 'i-heroicons-photo',
  },
  canvas: {
    label: 'Canvas',
    description: 'Slim stretched canvas',
    icon: 'i-heroicons-squares-2x2',
  },
  wall_hanging: {
    label: 'Wall Hanging',
    description: 'Wood magnetic rails',
    icon: 'i-heroicons-bars-2',
  },
  aluminum: {
    label: 'Aluminum',
    description: '3 mm metal wall art',
    icon: 'i-heroicons-sparkles',
  },
  digital: {
    label: 'Digital',
    description: 'High-res download',
    icon: 'i-heroicons-arrow-down-tray',
  },
}

const MATERIAL_CHOICE_FORMATS = new Set<ProductFormat>(['poster', 'aluminum'])

const MATERIAL_SORT_ORDER: Record<string, number> = {
  poster_archival_250: 10,
  poster_silk_200: 20,
  aluminum_white_matte: 10,
  aluminum_brushed: 20,
}

const POSTER_SILK = {
  format_label: 'Poster',
  material_key: 'poster_silk_200',
  material_label: 'Silk 200 gsm',
  material_description: 'Smooth coated poster paper with a soft satin finish.',
  catalog_uid: 'posters',
}

const POSTER_ARCHIVAL = {
  format_label: 'Poster',
  material_key: 'poster_archival_250',
  material_label: 'Archival Matte 250 gsm',
  material_description: 'Uncoated off-white archival paper with a quieter matte feel.',
  catalog_uid: 'posters',
}

const WALL_HANGING = {
  format_label: 'Wall Hanging',
  material_key: 'wall_hanging_black_wood',
  material_label: 'Black Wood Rails',
  material_description: 'Poster print held between black wooden hanging rails.',
  catalog_uid: 'posters',
}

const CANVAS = {
  format_label: 'Canvas',
  material_key: 'canvas_slim',
  material_label: 'Slim Stretched Canvas',
  material_description: 'Canvas wrapped over a slim FSC wood frame.',
  catalog_uid: 'canvas',
}

const FRAMED = {
  format_label: 'Framed',
  material_key: 'framed_black_aluminum',
  material_label: 'Black Aluminum Frame',
  material_description: 'Black aluminum frame with plexiglass glazing.',
  catalog_uid: 'framed-posters',
}

const ALUMINUM_WHITE_MATTE = {
  format_label: 'Aluminum',
  material_key: 'aluminum_white_matte',
  material_label: 'White Matte Aluminum',
  material_description: '3 mm aluminum dibond with a white matte base. Hanging hardware included.',
  catalog_uid: 'metallic',
}

const ALUMINUM_BRUSHED = {
  format_label: 'Aluminum',
  material_key: 'aluminum_brushed',
  material_label: 'Brushed Aluminum',
  material_description: '3 mm metallic silver base with horizontal grain. Hanging hardware included.',
  material_warning: 'White or transparent artwork areas show the metallic base.',
  catalog_uid: 'metallic',
}

const DIGITAL = {
  format_label: 'Digital',
  material_key: 'digital_download',
  material_label: 'Digital Download',
  material_description: 'High-resolution file ready for sharing or local printing.',
}

/**
 * Full product catalog.
 *
 * Confirmed UIDs (verified against Gelato template PDFs or Product API):
 *   flat_400x600-mm-16x24-inch_*   flat_600x900-mm-24x36-inch_*
 *   wall_hanging_poster_410-mm_*   wall_hanging_poster_635-mm_*
 *   flat_a4-8x12-inch_* (A4 = 210×297 mm ≈ 8×12")
 *   metallic_*_3-mm_4-0_ver       metallic_*_3-mm-silver-brushed_hor-grain_4-0_ver
 *
 * Pattern-inferred UIDs should be verified with GET /api/gelato/catalog before
 * production fulfillment.
 */
export const PRODUCTS: PrintProduct[] = [

  // ─── Flat Posters ────────────────────────────────────────────────────────────
  {
    product_uid: 'flat_a4-8x12-inch_200-gsm-80lb-coated-silk_4-0_ver',
    name: '8×12" Poster, Silk 200 gsm',
    type: 'poster',
    size_label: '8×12"',
    width_in: 8, height_in: 12, aspect_ratio: 2 / 3,
    price_cents: 1000,
    recommended_px_w: 2400, recommended_px_h: 3600,
    ...POSTER_SILK,
  },
  {
    product_uid: 'flat_300x450-mm-12x18-inch_250-gsm-100lb-uncoated-offwhite-archival_4-0_ver',
    name: '12×18" Poster, Archival Matte 250 gsm',
    type: 'poster',
    size_label: '12×18"',
    width_in: 12, height_in: 18, aspect_ratio: 2 / 3,
    price_cents: 1700,
    recommended_px_w: 3600, recommended_px_h: 5400,
    ...POSTER_ARCHIVAL,
  },
  {
    product_uid: 'flat_400x600-mm-16x24-inch_250-gsm-100lb-uncoated-offwhite-archival_4-0_ver',
    name: '16×24" Poster, Archival Matte 250 gsm',
    type: 'poster',
    size_label: '16×24"',
    width_in: 16, height_in: 24, aspect_ratio: 2 / 3,
    price_cents: 2100,
    recommended_px_w: 4800, recommended_px_h: 7200,
    ...POSTER_ARCHIVAL,
  },
  {
    product_uid: 'flat_600x900-mm-24x36-inch_250-gsm-100lb-uncoated-offwhite-archival_4-0_ver',
    name: '24×36" Poster, Archival Matte 250 gsm',
    type: 'poster',
    size_label: '24×36"',
    width_in: 24, height_in: 36, aspect_ratio: 2 / 3,
    price_cents: 3100,
    recommended_px_w: 7200, recommended_px_h: 10800,
    ...POSTER_ARCHIVAL,
  },
  {
    product_uid: 'flat_800x1200-mm-32x48-inch_250-gsm-100lb-uncoated-offwhite-archival_4-0_ver',
    name: '32×48" Poster, Archival Matte 250 gsm',
    type: 'poster',
    size_label: '32×48"',
    width_in: 32, height_in: 48, aspect_ratio: 2 / 3,
    price_cents: 5000,
    // 200 DPI — 300 DPI would OOM the render worker at this scale.
    recommended_px_w: 6400, recommended_px_h: 9600,
    ...POSTER_ARCHIVAL,
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
    price_cents: 2300,
    recommended_px_w: 2400, recommended_px_h: 3600,
    ...WALL_HANGING,
  },
  {
    product_uid: 'wall_hanging_poster_310-mm_black_wood_w14xt20-mm_300x450-mm-12x18-inch_200-gsm-80lb-uncoated_4-0_ver',
    name: '12×18" Wall Hanging',
    type: 'wall_hanging',
    size_label: '12×18"',
    width_in: 12, height_in: 18, aspect_ratio: 2 / 3,
    price_cents: 2800,
    recommended_px_w: 3600, recommended_px_h: 5400,
    ...WALL_HANGING,
  },
  {
    product_uid: 'wall_hanging_poster_410-mm_black_wood_w14xt20-mm_400x600-mm-16x24-inch_200-gsm-80lb-uncoated_4-0_ver',
    name: '16×24" Wall Hanging',
    type: 'wall_hanging',
    size_label: '16×24"',
    width_in: 16, height_in: 24, aspect_ratio: 2 / 3,
    price_cents: 3300,
    recommended_px_w: 4800, recommended_px_h: 7200,
    ...WALL_HANGING,
  },
  {
    product_uid: 'wall_hanging_poster_635-mm_black_wood_w14xt20-mm_600x900-mm-24x36-inch_200-gsm-80lb-uncoated_4-0_ver',
    name: '24×36" Wall Hanging',
    type: 'wall_hanging',
    size_label: '24×36"',
    width_in: 24, height_in: 36, aspect_ratio: 2 / 3,
    price_cents: 4600,
    recommended_px_w: 7200, recommended_px_h: 10800,
    ...WALL_HANGING,
  },

  // ─── Stretched Canvas ─────────────────────────────────────────────────────────
  {
    product_uid: 'canvas_8x12-inch-200x300-mm_canvas_wood-fsc-slim_4-0_ver',
    name: '8×12" Canvas',
    type: 'canvas',
    size_label: '8×12"',
    width_in: 8, height_in: 12, aspect_ratio: 2 / 3,
    price_cents: 2400,
    recommended_px_w: 2400, recommended_px_h: 3600,
    ...CANVAS,
  },
  {
    product_uid: 'canvas_12x18-inch-300x450-mm_canvas_wood-fsc-slim_4-0_ver',
    name: '12×18" Canvas',
    type: 'canvas',
    size_label: '12×18"',
    width_in: 12, height_in: 18, aspect_ratio: 2 / 3,
    price_cents: 3800,
    recommended_px_w: 3600, recommended_px_h: 5400,
    ...CANVAS,
  },
  {
    product_uid: 'canvas_16x24-inch-400x600-mm_canvas_wood-fsc-slim_4-0_ver',
    name: '16×24" Canvas',
    type: 'canvas',
    size_label: '16×24"',
    width_in: 16, height_in: 24, aspect_ratio: 2 / 3,
    price_cents: 4300,
    recommended_px_w: 4800, recommended_px_h: 7200,
    ...CANVAS,
  },
  {
    product_uid: 'canvas_20x30-inch-500x750-mm_canvas_wood-fsc-slim_4-0_ver',
    name: '20×30" Canvas',
    type: 'canvas',
    size_label: '20×30"',
    width_in: 20, height_in: 30, aspect_ratio: 2 / 3,
    price_cents: 7800,
    recommended_px_w: 6000, recommended_px_h: 9000,
    ...CANVAS,
  },
  {
    product_uid: 'canvas_24x36-inch-600x900-mm_canvas_wood-fsc-slim_4-0_ver',
    name: '24×36" Canvas',
    type: 'canvas',
    size_label: '24×36"',
    width_in: 24, height_in: 36, aspect_ratio: 2 / 3,
    price_cents: 9400,
    recommended_px_w: 7200, recommended_px_h: 10800,
    ...CANVAS,
  },

  // ─── Framed Prints ────────────────────────────────────────────────────────────
  {
    product_uid: 'frame_and_poster_product_frs_8x12-inch_frc_black_frm_aluminum_frp_w10xt22-mm_gt_plexiglass__pf_8x12-inch_pt_80-lb-cover-coated-silk_cl_4-0_ct_none_prt_none_ver',
    name: '8×12" Framed Print',
    type: 'framed',
    size_label: '8×12"',
    width_in: 8, height_in: 12, aspect_ratio: 2 / 3,
    price_cents: 3200,
    recommended_px_w: 2400, recommended_px_h: 3600,
    ...FRAMED,
  },
  {
    product_uid: 'frame_and_poster_product_frs_12x18-inch_frc_black_frm_aluminum_frp_w10xt22-mm_gt_plexiglass__pf_12x18-inch_pt_80-lb-cover-coated-silk_cl_4-0_ct_none_prt_none_ver',
    name: '12×18" Framed Print',
    type: 'framed',
    size_label: '12×18"',
    width_in: 12, height_in: 18, aspect_ratio: 2 / 3,
    price_cents: 5000,
    recommended_px_w: 3600, recommended_px_h: 5400,
    ...FRAMED,
  },
  {
    product_uid: 'frame_and_poster_product_frs_16x24-inch_frc_black_frm_aluminum_frp_w12xt22-mm_gt_plexiglass__pf_16x24-inch_pt_100-lb-cover-uncoated_cl_4-0_ct_none_prt_none_ver',
    name: '16×24" Framed Print',
    type: 'framed',
    size_label: '16×24"',
    width_in: 16, height_in: 24, aspect_ratio: 2 / 3,
    price_cents: 11999,
    recommended_px_w: 4800, recommended_px_h: 7200,
    ...FRAMED,
  },
  {
    product_uid: 'frame_and_poster_product_frs_24x36-inch_frc_black_frm_aluminum_frp_w10xt22-mm_gt_plexiglass__pf_24x36-inch_pt_80-lb-cover-coated-silk_cl_4-0_ct_none_prt_none_ver',
    name: '24×36" Framed Print',
    type: 'framed',
    size_label: '24×36"',
    width_in: 24, height_in: 36, aspect_ratio: 2 / 3,
    price_cents: 12100,
    recommended_px_w: 7200, recommended_px_h: 10800,
    ...FRAMED,
  },
  {
    product_uid: 'frame_and_poster_product_frs_32x48-inch_frc_black_frm_aluminum_frp_w10xt22-mm_gt_plexiglass__pf_32x48-inch_pt_80-lb-cover-coated-silk_cl_4-0_ct_none_prt_none_ver',
    name: '32×48" Framed Print',
    type: 'framed',
    size_label: '32×48"',
    width_in: 32, height_in: 48, aspect_ratio: 2 / 3,
    price_cents: 19999,
    recommended_px_w: 6400, recommended_px_h: 9600,
    ...FRAMED,
  },

  // ─── Aluminum Prints (Gelato metallic catalog) ───────────────────────────────
  {
    product_uid: 'metallic_8x12-inch-200x300-mm_3-mm_4-0_ver',
    name: '8×12" White Matte Aluminum Print',
    type: 'aluminum',
    size_label: '8×12"',
    width_in: 8, height_in: 12, aspect_ratio: 2 / 3,
    price_cents: 2500,
    recommended_px_w: 2400, recommended_px_h: 3600,
    ...ALUMINUM_WHITE_MATTE,
  },
  {
    product_uid: 'metallic_8x12-inch-200x300-mm_3-mm-silver-brushed_hor-grain_4-0_ver',
    name: '8×12" Brushed Aluminum Print',
    type: 'aluminum',
    size_label: '8×12"',
    width_in: 8, height_in: 12, aspect_ratio: 2 / 3,
    price_cents: 4000,
    recommended_px_w: 2400, recommended_px_h: 3600,
    ...ALUMINUM_BRUSHED,
  },
  {
    product_uid: 'metallic_12x18-inch-300x450-mm_3-mm_4-0_ver',
    name: '12×18" White Matte Aluminum Print',
    type: 'aluminum',
    size_label: '12×18"',
    width_in: 12, height_in: 18, aspect_ratio: 2 / 3,
    price_cents: 3700,
    recommended_px_w: 3600, recommended_px_h: 5400,
    ...ALUMINUM_WHITE_MATTE,
  },
  {
    product_uid: 'metallic_12x18-inch-300x450-mm_3-mm-silver-brushed_hor-grain_4-0_ver',
    name: '12×18" Brushed Aluminum Print',
    type: 'aluminum',
    size_label: '12×18"',
    width_in: 12, height_in: 18, aspect_ratio: 2 / 3,
    price_cents: 6000,
    recommended_px_w: 3600, recommended_px_h: 5400,
    ...ALUMINUM_BRUSHED,
  },
  {
    product_uid: 'metallic_16x24-inch-400x600-mm_3-mm_4-0_ver',
    name: '16×24" White Matte Aluminum Print',
    type: 'aluminum',
    size_label: '16×24"',
    width_in: 16, height_in: 24, aspect_ratio: 2 / 3,
    price_cents: 4200,
    recommended_px_w: 4800, recommended_px_h: 7200,
    ...ALUMINUM_WHITE_MATTE,
  },
  {
    product_uid: 'metallic_16x24-inch-400x600-mm_3-mm-silver-brushed_hor-grain_4-0_ver',
    name: '16×24" Brushed Aluminum Print',
    type: 'aluminum',
    size_label: '16×24"',
    width_in: 16, height_in: 24, aspect_ratio: 2 / 3,
    price_cents: 6700,
    recommended_px_w: 4800, recommended_px_h: 7200,
    ...ALUMINUM_BRUSHED,
  },
  {
    product_uid: 'metallic_20x30-inch-500x750-mm_3-mm_4-0_ver',
    name: '20×30" White Matte Aluminum Print',
    type: 'aluminum',
    size_label: '20×30"',
    width_in: 20, height_in: 30, aspect_ratio: 2 / 3,
    price_cents: 5800,
    recommended_px_w: 6000, recommended_px_h: 9000,
    ...ALUMINUM_WHITE_MATTE,
  },
  {
    product_uid: 'metallic_20x30-inch-500x750-mm_3-mm-silver-brushed_hor-grain_4-0_ver',
    name: '20×30" Brushed Aluminum Print',
    type: 'aluminum',
    size_label: '20×30"',
    width_in: 20, height_in: 30, aspect_ratio: 2 / 3,
    price_cents: 9300,
    recommended_px_w: 6000, recommended_px_h: 9000,
    ...ALUMINUM_BRUSHED,
  },
  {
    product_uid: 'metallic_24x36-inch-600x900-mm_3-mm_4-0_ver',
    name: '24×36" White Matte Aluminum Print',
    type: 'aluminum',
    size_label: '24×36"',
    width_in: 24, height_in: 36, aspect_ratio: 2 / 3,
    price_cents: 7500,
    recommended_px_w: 7200, recommended_px_h: 10800,
    ...ALUMINUM_WHITE_MATTE,
  },
  {
    product_uid: 'metallic_24x36-inch-600x900-mm_3-mm-silver-brushed_hor-grain_4-0_ver',
    name: '24×36" Brushed Aluminum Print',
    type: 'aluminum',
    size_label: '24×36"',
    width_in: 24, height_in: 36, aspect_ratio: 2 / 3,
    price_cents: 12000,
    recommended_px_w: 7200, recommended_px_h: 10800,
    ...ALUMINUM_BRUSHED,
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
    ...DIGITAL,
  },
]

function materialSortIndex(materialKey: string): number {
  return MATERIAL_SORT_ORDER[materialKey] ?? 100
}

function uniqueProductsByMaterial(products: PrintProduct[]): PrintProduct[] {
  const seen = new Set<string>()
  const result: PrintProduct[] = []
  for (const product of products) {
    const key = product.material_key ?? product.type
    if (seen.has(key)) continue
    seen.add(key)
    result.push(product)
  }
  return result
}

function productMatchesMaterial(product: PrintProduct, materialKey?: string): boolean {
  if (!formatHasMaterialChoice(product.type)) return true
  return !materialKey || product.material_key === materialKey
}

export function formatHasMaterialChoice(type: ProductFormat): boolean {
  return MATERIAL_CHOICE_FORMATS.has(type)
}

export function getProduct(uid: string): PrintProduct | undefined {
  return PRODUCTS.find(p => p.product_uid === uid)
}

export function getProductsByType(type: ProductFormat): PrintProduct[] {
  return PRODUCTS.filter(p => p.type === type)
}

export function getProductFormatOptions(): ProductFormatOption[] {
  return PRODUCT_FORMAT_ORDER
    .filter(type => PRODUCTS.some(product => product.type === type))
    .map((type) => {
      const products = getProductsByType(type)
      const startingPrice = products.reduce(
        (lowest, product) => Math.min(lowest, product.price_cents),
        Infinity,
      )
      return {
        type,
        ...PRODUCT_FORMAT_META[type],
        starting_price_cents: Number.isFinite(startingPrice) ? startingPrice : 0,
      }
    })
}

export function getProductMaterialOptions(type: ProductFormat): ProductMaterialOption[] {
  const products = uniqueProductsByMaterial(getProductsByType(type))
    .sort((a, b) => {
      const materialDelta = materialSortIndex(a.material_key ?? a.type) - materialSortIndex(b.material_key ?? b.type)
      if (materialDelta !== 0) return materialDelta
      return a.price_cents - b.price_cents
    })

  return products.map((product) => {
    const key = product.material_key ?? product.type
    return {
      key,
      label: product.material_label ?? PRODUCT_FORMAT_META[type].label,
      description: product.material_description,
      warning: product.material_warning,
      format: type,
      product_count: PRODUCTS.filter(candidate =>
        candidate.type === type && (candidate.material_key ?? candidate.type) === key,
      ).length,
    }
  })
}

export function getVisibleProductMaterialOptions(type: ProductFormat): ProductMaterialOption[] {
  return formatHasMaterialChoice(type) ? getProductMaterialOptions(type) : []
}

export function getDefaultMaterialKeyForFormat(type: ProductFormat, preferredSizeLabel?: string): string | undefined {
  const options = getProductMaterialOptions(type)
  if (!options.length) return undefined

  if (preferredSizeLabel) {
    const matchingPreferredSize = PRODUCTS
      .filter(product => product.type === type && product.size_label === preferredSizeLabel)
      .sort((a, b) => materialSortIndex(a.material_key ?? a.type) - materialSortIndex(b.material_key ?? b.type))
      .find(product => options.some(option => option.key === (product.material_key ?? product.type)))
    if (matchingPreferredSize) return matchingPreferredSize.material_key ?? matchingPreferredSize.type
  }

  return options[0].key
}

export function getProductForSelection(selection: ProductSelection): PrintProduct | undefined {
  if (selection.type === 'digital') return PRODUCTS.find(p => p.type === 'digital')
  if (!selection.sizeLabel) return undefined
  return PRODUCTS.find(product =>
    product.type === selection.type &&
    product.size_label === selection.sizeLabel &&
    productMatchesMaterial(product, selection.materialKey),
  )
}

export function getProductSizeAvailability(selection: Required<Pick<ProductSelection, 'type' | 'sizeLabel'>> & Pick<ProductSelection, 'materialKey'>): ProductSizeAvailability {
  if (selection.type === 'digital') {
    return { available: false, reason: 'Digital download has no print size' }
  }

  const product = getProductForSelection(selection)
  if (product) return { available: true, product }

  const formatLabel = PRODUCT_FORMAT_META[selection.type]?.label ?? 'This format'
  const anyProductForFormatAndSize = PRODUCTS.some(candidate =>
    candidate.type === selection.type && candidate.size_label === selection.sizeLabel,
  )

  if (!anyProductForFormatAndSize) {
    return {
      available: false,
      reason: `${formatLabel} is not offered in ${selection.sizeLabel}`,
    }
  }

  const material = getProductMaterialOptions(selection.type).find(option => option.key === selection.materialKey)
  return {
    available: false,
    reason: material
      ? `${material.label} is not offered in ${selection.sizeLabel}`
      : `${formatLabel} is not available in ${selection.sizeLabel}`,
  }
}

export function getAvailableSizeLabelsForSelection(selection: Omit<ProductSelection, 'sizeLabel'>): string[] {
  if (selection.type === 'digital') return []
  return SIZES
    .filter(size => getProductSizeAvailability({ ...selection, sizeLabel: size.label }).available)
    .map(size => size.label)
}

export function getMaterialsForSize(sizeLabel: string): ProductFormat[] {
  return PRODUCT_FORMAT_ORDER.filter(type =>
    type === 'digital' || PRODUCTS.some(product => product.type === type && product.size_label === sizeLabel),
  )
}

export function getProductBySize(sizeLabel: string, type: ProductFormat): PrintProduct | undefined {
  const materialKey = getDefaultMaterialKeyForFormat(type, sizeLabel)
  return getProductForSelection({ type, sizeLabel, materialKey })
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
