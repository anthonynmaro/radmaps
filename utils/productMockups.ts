import { createHash } from 'node:crypto'
import type { PrintProduct } from '~/types'
import { PRODUCTS } from '~/utils/products'
import { stableStringify } from '~/utils/render/hash'

export type ProductMockupSourceType = 'map' | 'premade'
export type ProductMockupFinish = 'paper' | 'framed' | 'wall_hanging' | 'metallic' | 'acrylic'

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
  sceneFile: string
  relativePath: string
  finish: ProductMockupFinish
  artworkBox: ProductMockupBox
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
export const PRODUCT_MOCKUP_RENDERER_VERSION = 'template-asset-compositor-v3'
export const PRODUCT_MOCKUP_TEMPLATE_VERSION = 'gelato-saved-template-room-scenes-v2'

export const PRODUCT_MOCKUP_TEMPLATE_ROOT = 'assets/product_mockup_templates'

export const PRODUCT_MOCKUP_SCENE_FILES = {
  bedroomWhite: 'Close-Up-Bed-Room-White-0.jpeg',
  lobbyDarkEmerald: 'Close-Up-Lobby-Dark-Emerald-0.jpeg',
} as const

const TEMPLATE_SET_IDS = {
  flatArchival: '70ce9534-2f69-459c-8b40-6f51cb3d6a92',
  framedPremium: 'b3d55eb2-408f-4fb1-9a67-3b2519e774bc',
  wallHangingSilk: '60945e5d-6da1-4b3e-bb99-4f6b8b43f6b7',
  wallHangingArchival: 'eea4b2c3-e7e9-401e-95bc-513f0d3e4c86',
  metallic: 'a768a6e9-6e9f-4efc-90ca-e62f1bbfe026',
  acrylic: 'd8315dd7-f2d3-4a7f-9f5c-3a0460734c2d',
} as const

interface ScenePlacementProfile {
  sceneFile: string
  centerXPx: number
  centerYPx: number
  pxPerPrintIn: number
}

const SCENE_PLACEMENTS: Record<ProductMockupFinish, ScenePlacementProfile> = {
  paper: {
    sceneFile: PRODUCT_MOCKUP_SCENE_FILES.bedroomWhite,
    centerXPx: 1506,
    centerYPx: 1305,
    pxPerPrintIn: 47.8,
  },
  framed: {
    sceneFile: PRODUCT_MOCKUP_SCENE_FILES.lobbyDarkEmerald,
    centerXPx: 1456,
    centerYPx: 1498,
    pxPerPrintIn: 50.0,
  },
  wall_hanging: {
    sceneFile: PRODUCT_MOCKUP_SCENE_FILES.bedroomWhite,
    centerXPx: 1510,
    centerYPx: 1356,
    pxPerPrintIn: 47.5,
  },
  metallic: {
    sceneFile: PRODUCT_MOCKUP_SCENE_FILES.bedroomWhite,
    centerXPx: 1506,
    centerYPx: 1305,
    pxPerPrintIn: 47.8,
  },
  acrylic: {
    sceneFile: PRODUCT_MOCKUP_SCENE_FILES.bedroomWhite,
    centerXPx: 1506,
    centerYPx: 1305,
    pxPerPrintIn: 47.8,
  },
}

function templateSetForProduct(product: PrintProduct): { setId: string; finish: ProductMockupFinish } | null {
  if (product.type === 'poster') return { setId: TEMPLATE_SET_IDS.flatArchival, finish: 'paper' }
  if (product.type === 'framed') return { setId: TEMPLATE_SET_IDS.framedPremium, finish: 'framed' }
  if (product.type === 'aluminum') return { setId: TEMPLATE_SET_IDS.metallic, finish: 'metallic' }
  if (product.type === 'acrylic') return { setId: TEMPLATE_SET_IDS.acrylic, finish: 'acrylic' }
  if (product.type === 'wall_hanging') {
    return {
      setId: product.product_uid.includes('_170-gsm-65lb-coated-silk_')
        ? TEMPLATE_SET_IDS.wallHangingSilk
        : TEMPLATE_SET_IDS.wallHangingArchival,
      finish: 'wall_hanging',
    }
  }
  return null
}

export function getProductMockupTemplate(product: PrintProduct | null | undefined): ProductMockupTemplate | null {
  if (!product || product.type === 'digital') return null
  const templateSet = templateSetForProduct(product)
  if (!templateSet) return null
  const placement = SCENE_PLACEMENTS[templateSet.finish]
  const artworkBox = scaledArtworkBox(product, placement)

  const relativePath = [
    PRODUCT_MOCKUP_TEMPLATE_ROOT,
    templateSet.setId,
    product.product_uid,
    placement.sceneFile,
  ].join('/')

  return {
    id: `${templateSet.setId}/${product.product_uid}/${placement.sceneFile.replace(/\.[^.]+$/, '')}`,
    setId: templateSet.setId,
    productUid: product.product_uid,
    sceneFile: placement.sceneFile,
    relativePath,
    finish: templateSet.finish,
    artworkBox,
  }
}

function scaledArtworkBox(product: PrintProduct, placement: ScenePlacementProfile): ProductMockupBox {
  const widthPx = product.width_in * placement.pxPerPrintIn
  const heightPx = widthPx * (product.height_in / product.width_in)
  return {
    x: (placement.centerXPx - widthPx / 2) / 3000,
    y: (placement.centerYPx - heightPx / 2) / 3000,
    w: widthPx / 3000,
    h: heightPx / 3000,
  }
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
