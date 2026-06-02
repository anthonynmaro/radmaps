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

export const DEFAULT_PHYSICAL_PRODUCT_SELECTION: ProductSelection = {
  type: 'poster',
  sizeLabel: '16×24"',
  materialKey: 'poster_archival_250',
}

// RadMaps sells a single portrait aspect family. The 12×16 template asset is
// intentionally not exposed because it would require a separate editor/render
// aspect path.
export const SIZES: SizeOption[] = [
  { label: '8×12"', width_in: 8, height_in: 12, aspect_ratio: 2 / 3 },
  { label: '12×18"', width_in: 12, height_in: 18, aspect_ratio: 2 / 3 },
  { label: '16×24"', width_in: 16, height_in: 24, aspect_ratio: 2 / 3 },
  { label: '20×30"', width_in: 20, height_in: 30, aspect_ratio: 2 / 3 },
  { label: '24×36"', width_in: 24, height_in: 36, aspect_ratio: 2 / 3 },
  { label: '32×48"', width_in: 32, height_in: 48, aspect_ratio: 2 / 3 },
]

export const PRODUCT_FORMAT_ORDER: ProductFormat[] = [
  'poster',
  'framed',
  'wall_hanging',
  'aluminum',
  'acrylic',
  'digital',
]

export const PRODUCT_FORMAT_META: Record<ProductFormat, { label: string; description: string; icon: string }> = {
  poster: {
    label: 'Poster',
    description: 'Archival matte paper',
    icon: 'i-heroicons-document-text',
  },
  framed: {
    label: 'Framed',
    description: 'Premium wood frame',
    icon: 'i-heroicons-photo',
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
  acrylic: {
    label: 'Acrylic',
    description: '4 mm glossy wall art',
    icon: 'i-heroicons-swatch',
  },
  digital: {
    label: 'Digital',
    description: 'High-res download',
    icon: 'i-heroicons-arrow-down-tray',
  },
}

const MATERIAL_CHOICE_FORMATS = new Set<ProductFormat>([
  'poster',
  'framed',
  'wall_hanging',
  'aluminum',
])

const MATERIAL_SORT_ORDER: Record<string, number> = {
  poster_archival_250: 10,
  framed_black_wood: 10,
  framed_white_wood: 20,
  framed_natural_wood: 30,
  wall_hanging_archival_black_wood: 10,
  wall_hanging_archival_white_wood: 20,
  wall_hanging_archival_natural_wood: 30,
  wall_hanging_archival_dark_wood: 40,
  wall_hanging_silk_black_wood: 50,
  wall_hanging_silk_white_wood: 60,
  wall_hanging_silk_natural_wood: 70,
  wall_hanging_silk_dark_wood: 80,
  aluminum_matte: 10,
}

const SIZE_DEFINITIONS: Record<string, Pick<PrintProduct, 'size_label' | 'width_in' | 'height_in' | 'aspect_ratio' | 'recommended_px_w' | 'recommended_px_h'>> = {
  '8×12"': {
    size_label: '8×12"',
    width_in: 8,
    height_in: 12,
    aspect_ratio: 2 / 3,
    recommended_px_w: 2400,
    recommended_px_h: 3600,
  },
  '12×18"': {
    size_label: '12×18"',
    width_in: 12,
    height_in: 18,
    aspect_ratio: 2 / 3,
    recommended_px_w: 3600,
    recommended_px_h: 5400,
  },
  '16×24"': {
    size_label: '16×24"',
    width_in: 16,
    height_in: 24,
    aspect_ratio: 2 / 3,
    recommended_px_w: 4800,
    recommended_px_h: 7200,
  },
  '20×30"': {
    size_label: '20×30"',
    width_in: 20,
    height_in: 30,
    aspect_ratio: 2 / 3,
    recommended_px_w: 6000,
    recommended_px_h: 9000,
  },
  '24×36"': {
    size_label: '24×36"',
    width_in: 24,
    height_in: 36,
    aspect_ratio: 2 / 3,
    recommended_px_w: 7200,
    recommended_px_h: 10800,
  },
  '32×48"': {
    size_label: '32×48"',
    width_in: 32,
    height_in: 48,
    aspect_ratio: 2 / 3,
    recommended_px_w: 6400,
    recommended_px_h: 9600,
  },
}

const POSTER_ARCHIVAL = {
  format_label: 'Poster',
  material_key: 'poster_archival_250',
  material_label: 'Archival Matte 250 gsm',
  material_description: 'Uncoated off-white archival paper with a quiet matte finish.',
  catalog_uid: 'posters',
}

const ALUMINUM_MATTE = {
  format_label: 'Aluminum',
  material_key: 'aluminum_matte',
  material_label: 'Matte Aluminum',
  material_description: '3 mm aluminum wall art with a clean satin-matte face.',
  catalog_uid: 'metallic',
}

const ACRYLIC = {
  format_label: 'Acrylic',
  material_key: 'acrylic_gloss_4mm',
  material_label: 'Gloss Acrylic',
  material_description: '4 mm glossy acrylic with polished edge depth and metal stand-offs.',
  catalog_uid: 'acrylic',
}

const DIGITAL = {
  format_label: 'Digital',
  material_key: 'digital_download',
  material_label: 'Digital Download',
  material_description: 'High-resolution file ready for sharing or local printing.',
}

type ProductSeed = {
  product_uid: string
  type: Exclude<ProductFormat, 'digital'>
  size_label: keyof typeof SIZE_DEFINITIONS
  price_cents: number
  name: string
  material: Record<string, string | undefined>
}

function product(seed: ProductSeed): PrintProduct {
  return {
    product_uid: seed.product_uid,
    name: seed.name,
    type: seed.type,
    price_cents: seed.price_cents,
    ...SIZE_DEFINITIONS[seed.size_label],
    ...seed.material,
  }
}

function poster(uid: string, sizeLabel: ProductSeed['size_label'], priceCents: number): PrintProduct {
  return product({
    product_uid: uid,
    type: 'poster',
    size_label: sizeLabel,
    price_cents: priceCents,
    name: `${sizeLabel} Poster, Archival Matte 250 gsm`,
    material: POSTER_ARCHIVAL,
  })
}

function framed(uid: string, sizeLabel: ProductSeed['size_label'], frameKey: string, frameLabel: string, priceCents: number): PrintProduct {
  return product({
    product_uid: uid,
    type: 'framed',
    size_label: sizeLabel,
    price_cents: priceCents,
    name: `${sizeLabel} Framed Poster, ${frameLabel}`,
    material: {
      format_label: 'Framed',
      material_key: frameKey,
      material_label: frameLabel,
      material_description: `Premium wooden frame with plexiglass glazing in ${frameLabel.toLowerCase()}.`,
      catalog_uid: 'framed-posters',
    },
  })
}

function wallHanging(
  uid: string,
  sizeLabel: ProductSeed['size_label'],
  railKey: string,
  railLabel: string,
  paperKey: 'archival' | 'silk',
  priceCents: number,
): PrintProduct {
  const paperLabel = paperKey === 'archival' ? 'Archival Matte 250 gsm' : 'Silk 170 gsm'
  const paperDescription = paperKey === 'archival'
    ? 'uncoated off-white archival paper'
    : 'coated silk paper'
  return product({
    product_uid: uid,
    type: 'wall_hanging',
    size_label: sizeLabel,
    price_cents: priceCents,
    name: `${sizeLabel} Wall Hanging, ${railLabel}, ${paperLabel}`,
    material: {
      format_label: 'Wall Hanging',
      material_key: `wall_hanging_${paperKey}_${railKey}`,
      material_label: `${paperLabel}, ${railLabel}`,
      material_description: `${paperDescription} held between ${railLabel.toLowerCase()} magnetic rails.`,
      catalog_uid: 'posters',
    },
  })
}

function aluminum(uid: string, sizeLabel: ProductSeed['size_label'], priceCents: number): PrintProduct {
  return product({
    product_uid: uid,
    type: 'aluminum',
    size_label: sizeLabel,
    price_cents: priceCents,
    name: `${sizeLabel} Aluminum Print`,
    material: ALUMINUM_MATTE,
  })
}

function acrylic(uid: string, sizeLabel: ProductSeed['size_label'], priceCents: number): PrintProduct {
  return product({
    product_uid: uid,
    type: 'acrylic',
    size_label: sizeLabel,
    price_cents: priceCents,
    name: `${sizeLabel} Acrylic Print`,
    material: ACRYLIC,
  })
}

const framedSizes = [
  ['210x297mm-8x12-inch', 'a4-8x12-inch', '8×12"', 3800],
  ['300x450-mm-12x18-inch', '300x450-mm-12x18-inch', '12×18"', 5600],
  ['600x900-mm-24x36-inch', '600x900-mm-24x36-inch', '24×36"', 12900],
] as const

const frameFinishes = [
  ['black_wood', 'framed_black_wood', 'Black Wood Frame'],
  ['white_wood', 'framed_white_wood', 'White Wood Frame'],
  ['natural-wood_wood', 'framed_natural_wood', 'Natural Wood Frame'],
] as const

const wallHangingSizes = [
  ['229-mm', 'a4-8x12-inch', '8×12"', 2500],
  ['310-mm', '300x450-mm-12x18-inch', '12×18"', 3100],
  ['410-mm', '400x600-mm-16x24-inch', '16×24"', 3800],
  ['635-mm', '600x900-mm-24x36-inch', '24×36"', 5200],
] as const

const railFinishes = [
  ['black_wood', 'black_wood', 'Black Wood Rails'],
  ['white_wood', 'white_wood', 'White Wood Rails'],
  ['natural-wood_wood', 'natural_wood', 'Natural Wood Rails'],
  ['dark-wood_wood', 'dark_wood', 'Dark Wood Rails'],
] as const

export const PRODUCTS: PrintProduct[] = [
  // Flat posters backed by the current saved Gelato mockup-template set.
  poster('flat_a4-8x12-inch_250-gsm-100lb-uncoated-offwhite-archival_4-0_ver', '8×12"', 1400),
  poster('flat_400x600-mm-16x24-inch_250-gsm-100lb-uncoated-offwhite-archival_4-0_ver', '16×24"', 2100),
  poster('flat_600x900-mm-24x36-inch_250-gsm-100lb-uncoated-offwhite-archival_4-0_ver', '24×36"', 3100),

  ...framedSizes.flatMap(([outerSize, innerSize, sizeLabel, basePrice]) =>
    frameFinishes.map(([uidFinish, materialKey, materialLabel]) =>
      framed(
        `framed_poster_mounted_premium_${outerSize}_${uidFinish}_w20xt20-mm_plexiglass_${innerSize}_200-gsm-80lb-coated-silk_4-0_ver`,
        sizeLabel,
        materialKey,
        materialLabel,
        basePrice,
      ),
    ),
  ),

  ...wallHangingSizes.flatMap(([rodSize, printSize, sizeLabel, basePrice]) =>
    railFinishes.flatMap(([uidFinish, materialRailKey, railLabel]) => [
      wallHanging(
        `wall_hanging_poster_${rodSize}_${uidFinish}_w14xt20-mm_${printSize}_250-gsm-100lb-uncoated-offwhite-archival_4-0_ver`,
        sizeLabel,
        materialRailKey,
        railLabel,
        'archival',
        basePrice,
      ),
      wallHanging(
        `wall_hanging_poster_${rodSize}_${uidFinish}_w14xt20-mm_${printSize}_170-gsm-65lb-coated-silk_4-0_ver`,
        sizeLabel,
        materialRailKey,
        railLabel,
        'silk',
        basePrice - 200,
      ),
    ]),
  ),

  aluminum('metallic_200x300-mm-8x12-inch_3-mm_4-0_ver', '8×12"', 2500),
  aluminum('metallic_300x450-mm-12x18-inch_3-mm_4-0_ver', '12×18"', 3700),
  aluminum('metallic_400x600-mm-16x24-inch_3-mm_4-0_ver', '16×24"', 4200),
  aluminum('metallic_500x750-mm-20x30-inch_3-mm_4-0_ver', '20×30"', 5800),
  aluminum('metallic_600x900-mm-24x36-inch_3-mm_4-0_ver', '24×36"', 7500),

  acrylic('acrylic_300x450-mm-12x18-inch_4-mm_4-0_ver', '12×18"', 4200),
  acrylic('acrylic_400x600-mm-16x24-inch_4-mm_4-0_ver', '16×24"', 5200),
  acrylic('acrylic_500x750-mm-20x30-inch_4-mm_4-0_ver', '20×30"', 7200),
  acrylic('acrylic_600x900-mm-24x36-inch_4-mm_4-0_ver', '24×36"', 9400),

  {
    product_uid: 'digital',
    name: 'Digital Download',
    type: 'digital',
    size_label: 'Digital',
    width_in: 0,
    height_in: 0,
    aspect_ratio: 2 / 3,
    price_cents: 999,
    recommended_px_w: 7200,
    recommended_px_h: 10800,
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

export function getDefaultPhysicalProduct(): PrintProduct | undefined {
  return getProductForSelection(DEFAULT_PHYSICAL_PRODUCT_SELECTION)
    ?? PRODUCTS.find(product => product.type !== 'digital')
}

export function productPriceCents(product: PrintProduct, pricesByProductUid?: Record<string, number>): number {
  const price = pricesByProductUid?.[product.product_uid]
  return typeof price === 'number' && Number.isInteger(price) && price > 0 ? price : product.price_cents
}

export function withRetailPrice(product: PrintProduct, pricesByProductUid?: Record<string, number>): PrintProduct {
  const price = productPriceCents(product, pricesByProductUid)
  return price !== product.price_cents ? { ...product, price_cents: price } : product
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
