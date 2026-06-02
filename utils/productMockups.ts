import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
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
export const PRODUCT_MOCKUP_RENDERER_VERSION = 'template-asset-compositor-v14'
export const PRODUCT_MOCKUP_TEMPLATE_VERSION = 'gelato-saved-template-room-scenes-v2'

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

interface ScenePlacementProfile {
  centerXPx?: number
  centerYPx?: number
  pxPerPrintIn?: number
  artworkBox?: ProductMockupBox
}

const BEDROOM_PLACEMENTS: Record<Exclude<ProductMockupFinish, 'framed'>, ScenePlacementProfile> = {
  paper: {
    centerXPx: 1506,
    centerYPx: 1305,
    pxPerPrintIn: 47.8,
  },
  wall_hanging: {
    centerXPx: 1510,
    centerYPx: 1356,
    pxPerPrintIn: 47.5,
  },
  metallic: {
    centerXPx: 1506,
    centerYPx: 1305,
    pxPerPrintIn: 47.8,
  },
  acrylic: {
    centerXPx: 1506,
    centerYPx: 1305,
    pxPerPrintIn: 47.8,
  },
}

const LOBBY_PLACEMENT: ScenePlacementProfile = {
  centerXPx: 1456,
  centerYPx: 1498,
  pxPerPrintIn: 50.0,
}

const CLOSE_UP_PLACEMENT: ScenePlacementProfile = {
  centerXPx: 1500,
  centerYPx: 1518,
  pxPerPrintIn: 111.5,
}

const WALL_HANGING_CLOSE_UP_PLACEMENT: ScenePlacementProfile = {
  artworkBox: {
    x: 665 / 3000,
    y: 383 / 3000,
    w: 1660 / 3000,
    h: 2407 / 3000,
  },
}

const SIMPLE_PLACEMENT: ScenePlacementProfile = {
  artworkBox: { x: 0, y: 0, w: 1, h: 1 },
}

const SCENE_PLACEMENTS: Record<ProductMockupFinish, Partial<Record<ProductMockupSceneFile, ScenePlacementProfile>>> = {
  paper: {
    [PRODUCT_MOCKUP_SCENE_FILES.bedroomWhite]: BEDROOM_PLACEMENTS.paper,
    [PRODUCT_MOCKUP_SCENE_FILES.lobbyDarkEmerald]: LOBBY_PLACEMENT,
    [PRODUCT_MOCKUP_SCENE_FILES.plainGray]: CLOSE_UP_PLACEMENT,
  },
  framed: {
    [PRODUCT_MOCKUP_SCENE_FILES.lobbyDarkEmerald]: LOBBY_PLACEMENT,
    [PRODUCT_MOCKUP_SCENE_FILES.plainGray]: CLOSE_UP_PLACEMENT,
  },
  wall_hanging: {
    [PRODUCT_MOCKUP_SCENE_FILES.bedroomWhite]: BEDROOM_PLACEMENTS.wall_hanging,
    [PRODUCT_MOCKUP_SCENE_FILES.lobbyDarkEmerald]: LOBBY_PLACEMENT,
    [PRODUCT_MOCKUP_SCENE_FILES.plainGray]: WALL_HANGING_CLOSE_UP_PLACEMENT,
  },
  metallic: {
    [PRODUCT_MOCKUP_SCENE_FILES.bedroomWhite]: BEDROOM_PLACEMENTS.metallic,
    [PRODUCT_MOCKUP_SCENE_FILES.lobbyDarkEmerald]: LOBBY_PLACEMENT,
    [PRODUCT_MOCKUP_SCENE_FILES.plainGray]: CLOSE_UP_PLACEMENT,
    [PRODUCT_MOCKUP_SCENE_FILES.simple]: SIMPLE_PLACEMENT,
  },
  acrylic: {
    [PRODUCT_MOCKUP_SCENE_FILES.bedroomWhite]: BEDROOM_PLACEMENTS.acrylic,
    [PRODUCT_MOCKUP_SCENE_FILES.lobbyDarkEmerald]: LOBBY_PLACEMENT,
    [PRODUCT_MOCKUP_SCENE_FILES.plainGray]: CLOSE_UP_PLACEMENT,
  },
}

const DEFAULT_SCENE_BY_FINISH: Record<ProductMockupFinish, ProductMockupSceneFile> = {
  paper: PRODUCT_MOCKUP_SCENE_FILES.bedroomWhite,
  framed: PRODUCT_MOCKUP_SCENE_FILES.lobbyDarkEmerald,
  wall_hanging: PRODUCT_MOCKUP_SCENE_FILES.bedroomWhite,
  metallic: PRODUCT_MOCKUP_SCENE_FILES.bedroomWhite,
  acrylic: PRODUCT_MOCKUP_SCENE_FILES.bedroomWhite,
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

export function getProductMockupTemplates(product: PrintProduct | null | undefined): ProductMockupTemplate[] {
  if (!product || product.type === 'digital') return []
  const templateSet = templateSetForProduct(product)
  if (!templateSet) return []
  const placements = SCENE_PLACEMENTS[templateSet.finish]
  const defaultScene = DEFAULT_SCENE_BY_FINISH[templateSet.finish]

  return Object.entries(placements)
    .map(([sceneFile, placement]) => {
      const template = buildProductMockupTemplate(
        product,
        templateSet.setId,
        templateSet.finish,
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
  sceneFile: ProductMockupSceneFile,
  placement: ScenePlacementProfile,
  isDefault: boolean,
): ProductMockupTemplate {
  const artworkBox = scaledArtworkBox(product, placement)
  const relativePath = [
    PRODUCT_MOCKUP_TEMPLATE_ROOT,
    setId,
    product.product_uid,
    sceneFile,
  ].join('/')
  return {
    id: `${setId}/${product.product_uid}/${sceneFile.replace(/\.[^.]+$/, '')}`,
    setId,
    productUid: product.product_uid,
    sceneFile,
    sceneLabel: PRODUCT_MOCKUP_SCENE_LABELS[sceneFile],
    relativePath,
    finish,
    artworkBox,
    isDefault,
  }
}

function scaledArtworkBox(product: PrintProduct, placement: ScenePlacementProfile): ProductMockupBox {
  if (placement.artworkBox) return placement.artworkBox
  if (!placement.centerXPx || !placement.centerYPx || !placement.pxPerPrintIn) {
    throw new Error('Mockup scene placement is missing geometry')
  }
  const widthPx = product.width_in * placement.pxPerPrintIn
  const heightPx = widthPx * (product.height_in / product.width_in)
  return {
    x: (placement.centerXPx - widthPx / 2) / 3000,
    y: (placement.centerYPx - heightPx / 2) / 3000,
    w: widthPx / 3000,
    h: heightPx / 3000,
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
