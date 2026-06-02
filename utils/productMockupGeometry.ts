export type ProductMockupFinishKey = 'paper' | 'framed' | 'wall_hanging' | 'metallic' | 'acrylic'

export interface ProductMockupEdgeBleed {
  left: number
  top: number
  right: number
  bottom: number
}

export const PRODUCT_MOCKUP_TEMPLATE_BASE_PX = 3000

const ZERO_BLEED: ProductMockupEdgeBleed = { left: 0, top: 0, right: 0, bottom: 0 }

export function getProductMockupArtworkBleedPx(
  finish: ProductMockupFinishKey | string | undefined,
  sceneFile?: string,
): ProductMockupEdgeBleed {
  if (finish === 'paper') {
    return { left: 14, top: 14, right: 14, bottom: 14 }
  }

  if (finish === 'framed') {
    return { left: 24, top: 24, right: 24, bottom: 24 }
  }

  if (finish === 'wall_hanging') {
    return ZERO_BLEED
  }

  if (finish === 'metallic') {
    return { left: 4, top: 12, right: 14, bottom: 4 }
  }

  if (finish === 'acrylic') {
    return { left: 3, top: 8, right: 10, bottom: 3 }
  }

  return ZERO_BLEED
}

export function getProductMockupArtworkBleedUnit(
  finish: ProductMockupFinishKey | string | undefined,
  sceneFile?: string,
): ProductMockupEdgeBleed {
  const bleed = getProductMockupArtworkBleedPx(finish, sceneFile)
  return {
    left: bleed.left / PRODUCT_MOCKUP_TEMPLATE_BASE_PX,
    top: bleed.top / PRODUCT_MOCKUP_TEMPLATE_BASE_PX,
    right: bleed.right / PRODUCT_MOCKUP_TEMPLATE_BASE_PX,
    bottom: bleed.bottom / PRODUCT_MOCKUP_TEMPLATE_BASE_PX,
  }
}
