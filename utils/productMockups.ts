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
export const PRODUCT_MOCKUP_RENDERER_VERSION = 'template-asset-compositor-v1'
export const PRODUCT_MOCKUP_TEMPLATE_VERSION = 'gelato-saved-template-assets-v1'

export const PRODUCT_MOCKUP_TEMPLATE_ROOT = 'assets/product_mockup_templates'
export const PRODUCT_MOCKUP_SCENE_FILE = 'Close-Up-Plain-Gray-0.jpeg'

const TEMPLATE_SET_IDS = {
  flatArchival: '70ce9534-2f69-459c-8b40-6f51cb3d6a92',
  framedPremium: 'b3d55eb2-408f-4fb1-9a67-3b2519e774bc',
  wallHangingSilk: '60945e5d-6da1-4b3e-bb99-4f6b8b43f6b7',
  wallHangingArchival: 'eea4b2c3-e7e9-401e-95bc-513f0d3e4c86',
  metallic: 'a768a6e9-6e9f-4efc-90ca-e62f1bbfe026',
  acrylic: 'd8315dd7-f2d3-4a7f-9f5c-3a0460734c2d',
} as const

const ARTWORK_BOXES: Record<ProductMockupFinish, ProductMockupBox> = {
  paper: { x: 0.207, y: 0.058, w: 0.596, h: 0.884 },
  framed: { x: 0.225, y: 0.079, w: 0.554, h: 0.836 },
  wall_hanging: { x: 0.217, y: 0.100, w: 0.562, h: 0.808 },
  metallic: { x: 0.207, y: 0.058, w: 0.596, h: 0.884 },
  acrylic: { x: 0.207, y: 0.058, w: 0.596, h: 0.884 },
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

  const relativePath = [
    PRODUCT_MOCKUP_TEMPLATE_ROOT,
    templateSet.setId,
    product.product_uid,
    PRODUCT_MOCKUP_SCENE_FILE,
  ].join('/')

  return {
    id: `${templateSet.setId}/${product.product_uid}/${PRODUCT_MOCKUP_SCENE_FILE.replace(/\.[^.]+$/, '')}`,
    setId: templateSet.setId,
    productUid: product.product_uid,
    sceneFile: PRODUCT_MOCKUP_SCENE_FILE,
    relativePath,
    finish: templateSet.finish,
    artworkBox: ARTWORK_BOXES[templateSet.finish],
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
