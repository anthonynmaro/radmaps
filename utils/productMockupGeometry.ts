export type ProductMockupFinishKey = 'paper' | 'framed' | 'wall_hanging' | 'metallic' | 'acrylic'

export interface ProductMockupEdgeBleed {
  left: number
  top: number
  right: number
  bottom: number
}

export interface ProductMockupUnitBox {
  x: number
  y: number
  w: number
  h: number
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
    if (sceneFile === 'Close-Up-Plain-Gray-0.jpeg') {
      return { left: 6, top: 6, right: 0, bottom: 0 }
    }
    return { left: 24, top: 24, right: 24, bottom: 24 }
  }

  if (finish === 'wall_hanging') {
    if (sceneFile === 'Close-Up-Plain-Gray-0.jpeg') {
      return { left: 160, top: 0, right: 160, bottom: 0 }
    }
    if (sceneFile === 'Close-Up-Lobby-Dark-Emerald-0.jpeg') {
      return { left: 60, top: 0, right: 60, bottom: 0 }
    }
    if (sceneFile === 'Close-Up-Bed-Room-White-0.jpeg') {
      return { left: 34, top: 0, right: 48, bottom: 0 }
    }
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

export function getOverprintedProductMockupArtworkBox(
  box: ProductMockupUnitBox,
  finish: ProductMockupFinishKey | string | undefined,
  sceneFile?: string,
): ProductMockupUnitBox {
  const bleed = getProductMockupArtworkBleedUnit(finish, sceneFile)

  return clampProductMockupBox({
    x: box.x - bleed.left,
    y: box.y - bleed.top,
    w: box.w + bleed.left + bleed.right,
    h: box.h + bleed.top + bleed.bottom,
  })
}

export function clampProductMockupBox(box: ProductMockupUnitBox): ProductMockupUnitBox {
  const x = clamp(box.x, 0, 1)
  const y = clamp(box.y, 0, 1)

  return {
    x,
    y,
    w: clamp(box.w, 0.001, 1 - x),
    h: clamp(box.h, 0.001, 1 - y),
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
