import { PRODUCT_MOCKUP_SCENE_FILES, type ProductMockupBox, type ProductMockupTemplate } from '~/utils/productMockups'

export interface ProductMockupChromeBox {
  id: string
  box: ProductMockupBox
}

export function getProductMockupChromeBoxes(template: ProductMockupTemplate): ProductMockupChromeBox[] {
  if (template.finish !== 'wall_hanging') return []

  const box = template.artworkBox
  const railHeight = Math.max(16 / 3000, box.w * 0.11)
  const sideBleed = Math.max(6 / 3000, box.w * 0.045)
  const left = clamp(box.x - sideBleed, 0, 1)
  const width = Math.min(1 - left, box.w + sideBleed * 2)

  return [
    {
      id: 'top_rail',
      box: wallHangingTopChromeBox(template, { left, width }, box, railHeight),
    },
    {
      id: 'bottom_rail',
      box: wallHangingBottomChromeBox(template, { left, width }, box, railHeight),
    },
  ]
}

function wallHangingTopChromeBox(
  template: ProductMockupTemplate,
  strip: { left: number; width: number },
  box: ProductMockupBox,
  railHeight: number,
): ProductMockupBox {
  if (template.sceneFile === PRODUCT_MOCKUP_SCENE_FILES.plainGray) {
    return clampBox({
      x: strip.left,
      y: box.y - railHeight,
      w: strip.width,
      h: railHeight * 0.92,
    })
  }

  if (template.sceneFile === PRODUCT_MOCKUP_SCENE_FILES.lobbyDarkEmerald) {
    return clampBox({
      x: strip.left,
      y: box.y - railHeight * 1.85,
      w: strip.width,
      h: railHeight * 2.55,
    })
  }

  if (template.sceneFile === PRODUCT_MOCKUP_SCENE_FILES.bedroomWhite) {
    const topChromeHeight = railHeight * 1.5
    const hiddenRailOverlap = railHeight * 0.16
    return clampBox({
      x: strip.left,
      y: box.y - topChromeHeight,
      w: strip.width,
      h: topChromeHeight - hiddenRailOverlap,
    })
  }

  const topChromeHeight = railHeight * 1.5
  return clampBox({
    x: strip.left,
    y: box.y - topChromeHeight,
    w: strip.width,
    h: topChromeHeight,
  })
}

function wallHangingBottomChromeBox(
  template: ProductMockupTemplate,
  strip: { left: number; width: number },
  box: ProductMockupBox,
  railHeight: number,
): ProductMockupBox {
  if (template.sceneFile === PRODUCT_MOCKUP_SCENE_FILES.plainGray) {
    return clampBox({
      x: strip.left,
      y: box.y + box.h - railHeight * 0.38,
      w: strip.width,
      h: railHeight * 0.45,
    })
  }

  if (template.sceneFile === PRODUCT_MOCKUP_SCENE_FILES.lobbyDarkEmerald) {
    return clampBox({
      x: strip.left,
      y: box.y + box.h - railHeight * 0.12,
      w: strip.width,
      h: railHeight * 1.08,
    })
  }

  return clampBox({
    x: strip.left,
    y: box.y + box.h - railHeight * 0.7,
    w: strip.width,
    h: railHeight * 1.18,
  })
}

function clampBox(box: ProductMockupBox): ProductMockupBox {
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
