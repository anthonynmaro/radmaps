import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { PrintProduct } from '~/types'
import type { ProductMockupFinishKey } from '~/utils/productMockupGeometry'
import { PRODUCTS } from '~/utils/products'
import { stableStringify } from '~/utils/render/hash'

export type ProductMockupSourceType = 'map' | 'premade'
export type ProductMockupFinish = ProductMockupFinishKey

export interface ProductMockupBox {
  x: number
  y: number
  w: number
  h: number
}

export interface ProductMockupTemplate {
  id: string
  setId: string
  productUid: string
  assetProductUid: string
  sceneFile: string
  sceneLabel: string
  relativePath: string
  finish: ProductMockupFinish
  artworkBox: ProductMockupBox
  isDefault: boolean
}

export interface ProductMockupHashInput {
  sourceType: ProductMockupSourceType
  sourceId: string
  sourceRenderHash: string
  productUid: string
  templateId: string
  templateVersion: string
  rendererVersion?: string
}

export const PRODUCT_MOCKUP_PROVIDER = 'gelato_template_asset'
export const PRODUCT_MOCKUP_RENDERER_VERSION = 'template-asset-compositor-v17'
export const PRODUCT_MOCKUP_TEMPLATE_VERSION = 'gelato-saved-template-traced-slots-v4'

export const PRODUCT_MOCKUP_TEMPLATE_ROOT = 'assets/product_mockup_templates'

export const PRODUCT_MOCKUP_SCENE_FILES = {
  bedroomWhite: 'Close-Up-Bed-Room-White-0.jpeg',
  lobbyDarkEmerald: 'Close-Up-Lobby-Dark-Emerald-0.jpeg',
  plainGray: 'Close-Up-Plain-Gray-0.jpeg',
  simple: 'Simple.jpeg',
} as const

export type ProductMockupSceneFile = typeof PRODUCT_MOCKUP_SCENE_FILES[keyof typeof PRODUCT_MOCKUP_SCENE_FILES]

const PRODUCT_MOCKUP_SCENE_LABELS: Record<ProductMockupSceneFile, string> = {
  [PRODUCT_MOCKUP_SCENE_FILES.bedroomWhite]: 'Room',
  [PRODUCT_MOCKUP_SCENE_FILES.lobbyDarkEmerald]: 'Emerald wall',
  [PRODUCT_MOCKUP_SCENE_FILES.plainGray]: 'Close-up',
  [PRODUCT_MOCKUP_SCENE_FILES.simple]: 'Product',
}

const TEMPLATE_SET_IDS = {
  flatArchival: '70ce9534-2f69-459c-8b40-6f51cb3d6a92',
  framedPremium: 'b3d55eb2-408f-4fb1-9a67-3b2519e774bc',
  wallHangingSilk: '60945e5d-6da1-4b3e-bb99-4f6b8b43f6b7',
  wallHangingArchival: 'eea4b2c3-e7e9-401e-95bc-513f0d3e4c86',
  metallic: 'a768a6e9-6e9f-4efc-90ca-e62f1bbfe026',
  acrylic: 'd8315dd7-f2d3-4a7f-9f5c-3a0460734c2d',
} as const

const CANONICAL_POSTER_PRODUCT_UID = 'flat_600x900-mm-24x36-inch_250-gsm-100lb-uncoated-offwhite-archival_4-0_ver'
const CANONICAL_ALUMINUM_PRODUCT_UID = 'metallic_600x900-mm-24x36-inch_3-mm_4-0_ver'
const CANONICAL_ACRYLIC_PRODUCT_UID = 'acrylic_600x900-mm-24x36-inch_4-mm_4-0_ver'

function slot(leftPx: number, topPx: number, widthPx: number, heightPx: number): ProductMockupBox {
  return {
    x: leftPx / 3000,
    y: topPx / 3000,
    w: widthPx / 3000,
    h: heightPx / 3000,
  }
}

const RIGID_SURFACE_SLOTS: Record<ProductMockupSceneFile, ProductMockupBox> = {
  [PRODUCT_MOCKUP_SCENE_FILES.bedroomWhite]: slot(938, 440, 1160, 1740),
  [PRODUCT_MOCKUP_SCENE_FILES.lobbyDarkEmerald]: slot(852, 594, 1205, 1808),
  [PRODUCT_MOCKUP_SCENE_FILES.plainGray]: slot(620, 178, 1760, 2640),
  [PRODUCT_MOCKUP_SCENE_FILES.simple]: slot(0, 0, 3000, 3000),
}

const FRAMED_SURFACE_SLOTS: Partial<Record<ProductMockupSceneFile, ProductMockupBox>> = {
  [PRODUCT_MOCKUP_SCENE_FILES.lobbyDarkEmerald]: slot(850, 590, 1210, 1815),
  [PRODUCT_MOCKUP_SCENE_FILES.plainGray]: slot(660, 245, 1688, 2532),
}

const WALL_HANGING_SURFACE_SLOTS: Partial<Record<ProductMockupSceneFile, ProductMockupBox>> = {
  [PRODUCT_MOCKUP_SCENE_FILES.bedroomWhite]: slot(935, 500, 1148, 1660),
  [PRODUCT_MOCKUP_SCENE_FILES.lobbyDarkEmerald]: slot(858, 620, 1195, 1760),
  [PRODUCT_MOCKUP_SCENE_FILES.plainGray]: slot(654, 298, 1688, 2420),
}

const SCENE_PLACEMENTS: Record<ProductMockupFinish, Partial<Record<ProductMockupSceneFile, ProductMockupBox>>> = {
  paper: {
    [PRODUCT_MOCKUP_SCENE_FILES.bedroomWhite]: RIGID_SURFACE_SLOTS[PRODUCT_MOCKUP_SCENE_FILES.bedroomWhite],
    [PRODUCT_MOCKUP_SCENE_FILES.lobbyDarkEmerald]: RIGID_SURFACE_SLOTS[PRODUCT_MOCKUP_SCENE_FILES.lobbyDarkEmerald],
    [PRODUCT_MOCKUP_SCENE_FILES.plainGray]: RIGID_SURFACE_SLOTS[PRODUCT_MOCKUP_SCENE_FILES.plainGray],
  },
  framed: FRAMED_SURFACE_SLOTS,
  wall_hanging: {
    [PRODUCT_MOCKUP_SCENE_FILES.bedroomWhite]: WALL_HANGING_SURFACE_SLOTS[PRODUCT_MOCKUP_SCENE_FILES.bedroomWhite],
    [PRODUCT_MOCKUP_SCENE_FILES.lobbyDarkEmerald]: WALL_HANGING_SURFACE_SLOTS[PRODUCT_MOCKUP_SCENE_FILES.lobbyDarkEmerald],
    [PRODUCT_MOCKUP_SCENE_FILES.plainGray]: WALL_HANGING_SURFACE_SLOTS[PRODUCT_MOCKUP_SCENE_FILES.plainGray],
  },
  metallic: {
    [PRODUCT_MOCKUP_SCENE_FILES.bedroomWhite]: RIGID_SURFACE_SLOTS[PRODUCT_MOCKUP_SCENE_FILES.bedroomWhite],
    [PRODUCT_MOCKUP_SCENE_FILES.lobbyDarkEmerald]: RIGID_SURFACE_SLOTS[PRODUCT_MOCKUP_SCENE_FILES.lobbyDarkEmerald],
    [PRODUCT_MOCKUP_SCENE_FILES.plainGray]: RIGID_SURFACE_SLOTS[PRODUCT_MOCKUP_SCENE_FILES.plainGray],
    [PRODUCT_MOCKUP_SCENE_FILES.simple]: RIGID_SURFACE_SLOTS[PRODUCT_MOCKUP_SCENE_FILES.simple],
  },
  acrylic: {
    [PRODUCT_MOCKUP_SCENE_FILES.bedroomWhite]: RIGID_SURFACE_SLOTS[PRODUCT_MOCKUP_SCENE_FILES.bedroomWhite],
    [PRODUCT_MOCKUP_SCENE_FILES.lobbyDarkEmerald]: RIGID_SURFACE_SLOTS[PRODUCT_MOCKUP_SCENE_FILES.lobbyDarkEmerald],
    [PRODUCT_MOCKUP_SCENE_FILES.plainGray]: RIGID_SURFACE_SLOTS[PRODUCT_MOCKUP_SCENE_FILES.plainGray],
  },
}

const DEFAULT_SCENE_BY_FINISH: Record<ProductMockupFinish, ProductMockupSceneFile> = {
  paper: PRODUCT_MOCKUP_SCENE_FILES.bedroomWhite,
  framed: PRODUCT_MOCKUP_SCENE_FILES.lobbyDarkEmerald,
  wall_hanging: PRODUCT_MOCKUP_SCENE_FILES.bedroomWhite,
  metallic: PRODUCT_MOCKUP_SCENE_FILES.bedroomWhite,
  acrylic: PRODUCT_MOCKUP_SCENE_FILES.bedroomWhite,
}

function templateSetForProduct(product: PrintProduct): { setId: string; finish: ProductMockupFinish; assetProductUid: string } | null {
  if (product.type === 'poster') {
    return { setId: TEMPLATE_SET_IDS.flatArchival, finish: 'paper', assetProductUid: CANONICAL_POSTER_PRODUCT_UID }
  }
  if (product.type === 'framed') {
    return { setId: TEMPLATE_SET_IDS.framedPremium, finish: 'framed', assetProductUid: canonicalFramedProductUid(product.product_uid) }
  }
  if (product.type === 'aluminum') {
    return { setId: TEMPLATE_SET_IDS.metallic, finish: 'metallic', assetProductUid: CANONICAL_ALUMINUM_PRODUCT_UID }
  }
  if (product.type === 'acrylic') {
    return { setId: TEMPLATE_SET_IDS.acrylic, finish: 'acrylic', assetProductUid: CANONICAL_ACRYLIC_PRODUCT_UID }
  }
  if (product.type === 'wall_hanging') {
    const isSilk = product.product_uid.includes('_170-gsm-65lb-coated-silk_')
    return {
      setId: isSilk
        ? TEMPLATE_SET_IDS.wallHangingSilk
        : TEMPLATE_SET_IDS.wallHangingArchival,
      finish: 'wall_hanging',
      assetProductUid: canonicalWallHangingProductUid(product.product_uid, isSilk),
    }
  }
  return null
}

function canonicalFramedProductUid(productUid: string): string {
  const finish = productUid.includes('_white_wood_')
    ? 'white_wood'
    : productUid.includes('_natural-wood_wood_')
      ? 'natural-wood_wood'
      : 'black_wood'
  return `framed_poster_mounted_premium_600x900-mm-24x36-inch_${finish}_w20xt20-mm_plexiglass_600x900-mm-24x36-inch_200-gsm-80lb-coated-silk_4-0_ver`
}

function canonicalWallHangingProductUid(productUid: string, isSilk: boolean): string {
  const rail = productUid.includes('_white_wood_')
    ? 'white_wood'
    : productUid.includes('_natural-wood_wood_')
      ? 'natural-wood_wood'
      : productUid.includes('_dark-wood_wood_')
        ? 'dark-wood_wood'
        : 'black_wood'
  const paper = isSilk
    ? '170-gsm-65lb-coated-silk'
    : '250-gsm-100lb-uncoated-offwhite-archival'
  return `wall_hanging_poster_635-mm_${rail}_w14xt20-mm_600x900-mm-24x36-inch_${paper}_4-0_ver`
}

export function getProductMockupTemplates(product: PrintProduct | null | undefined): ProductMockupTemplate[] {
  if (!product || product.type === 'digital') return []
  const templateSet = templateSetForProduct(product)
  if (!templateSet) return []
  const placements = SCENE_PLACEMENTS[templateSet.finish]
  const defaultScene = DEFAULT_SCENE_BY_FINISH[templateSet.finish]

  return Object.entries(placements)
    .map(([sceneFile, placement]) => {
      if (!placement) return null
      const template = buildProductMockupTemplate(
        product,
        templateSet.setId,
        templateSet.finish,
        templateSet.assetProductUid,
        sceneFile as ProductMockupSceneFile,
        placement,
        sceneFile === defaultScene,
      )
      return templateAssetExists(template.relativePath) ? template : null
    })
    .filter((template): template is ProductMockupTemplate => !!template)
    .sort((a, b) => Number(b.isDefault) - Number(a.isDefault))
}

export function getProductMockupTemplate(
  product: PrintProduct | null | undefined,
  templateIdOrSceneFile?: string | null,
): ProductMockupTemplate | null {
  const templates = getProductMockupTemplates(product)
  if (!templates.length) return null
  if (!templateIdOrSceneFile) return templates[0]
  return templates.find(template =>
    template.id === templateIdOrSceneFile
    || template.sceneFile === templateIdOrSceneFile,
  ) ?? null
}

function buildProductMockupTemplate(
  product: PrintProduct,
  setId: string,
  finish: ProductMockupFinish,
  assetProductUid: string,
  sceneFile: ProductMockupSceneFile,
  artworkBox: ProductMockupBox,
  isDefault: boolean,
): ProductMockupTemplate {
  const relativePath = [
    PRODUCT_MOCKUP_TEMPLATE_ROOT,
    setId,
    assetProductUid,
    sceneFile,
  ].join('/')
  return {
    id: `${setId}/${assetProductUid}/${sceneFile.replace(/\.[^.]+$/, '')}`,
    setId,
    productUid: product.product_uid,
    assetProductUid,
    sceneFile,
    sceneLabel: PRODUCT_MOCKUP_SCENE_LABELS[sceneFile],
    relativePath,
    finish,
    artworkBox,
    isDefault,
  }
}

function templateAssetExists(relativePath: string): boolean {
  return existsSync(join(process.cwd(), relativePath))
}

export function isMockupSupportedProduct(product: PrintProduct | null | undefined): product is PrintProduct {
  return !!getProductMockupTemplate(product)
}

export function getMockupSupportedProducts(): PrintProduct[] {
  return PRODUCTS.filter(isMockupSupportedProduct)
}

export function computeProductMockupHash(input: ProductMockupHashInput): string {
  return createHash('sha256')
    .update(stableStringify({
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      sourceRenderHash: input.sourceRenderHash,
      productUid: input.productUid,
      templateId: input.templateId,
      templateVersion: input.templateVersion,
      rendererVersion: input.rendererVersion ?? PRODUCT_MOCKUP_RENDERER_VERSION,
    }))
    .digest('hex')
}

export function hashString(input: string): string {
  return createHash('sha256').update(input).digest('hex')
}
