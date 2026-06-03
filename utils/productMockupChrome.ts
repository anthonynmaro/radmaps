import { PRODUCT_MOCKUP_SCENE_FILES, type ProductMockupBox, type ProductMockupTemplate } from '~/utils/productMockups'

export interface ProductMockupChromeBox {
  id: string
  box: ProductMockupBox
}

export function getProductMockupChromeBoxes(template: ProductMockupTemplate): ProductMockupChromeBox[] {
  if (template.finish === 'framed') {
    return framedPosterChromeBoxes(template.artworkBox)
  }

  if (template.finish === 'wall_hanging') {
    return wallHangingChromeBoxes(template)
  }

  return []
}

function framedPosterChromeBoxes(box: ProductMockupBox): ProductMockupChromeBox[] {
  const frameBleed = 42 / 3000
  const left = clamp(box.x - frameBleed, 0, 1)
  const top = clamp(box.y - frameBleed, 0, 1)
  const right = clamp(box.x + box.w, 0, 1)
  const bottom = clamp(box.y + box.h, 0, 1)
  const width = Math.min(1 - left, box.w + frameBleed * 2)
  const height = Math.min(1 - top, box.h + frameBleed * 2)

  return [
    {
      id: 'frame_top',
      box: clampBox({ x: left, y: top, w: width, h: frameBleed }),
    },
    {
      id: 'frame_bottom',
      box: clampBox({ x: left, y: bottom, w: width, h: frameBleed }),
    },
    {
      id: 'frame_left',
      box: clampBox({ x: left, y: top, w: frameBleed, h: height }),
    },
    {
      id: 'frame_right',
      box: clampBox({ x: right, y: top, w: frameBleed, h: height }),
    },
  ]
}

function wallHangingChromeBoxes(template: ProductMockupTemplate): ProductMockupChromeBox[] {
  if (template.sceneFile === PRODUCT_MOCKUP_SCENE_FILES.plainGray) {
    return [
      { id: 'top_rail', box: slot(635, 235, 1725, 70) },
      { id: 'bottom_rail', box: slot(635, 2718, 1725, 70) },
    ]
  }

  if (template.sceneFile === PRODUCT_MOCKUP_SCENE_FILES.lobbyDarkEmerald) {
    return [
      { id: 'top_rail', box: slot(853, 614, 1199, 42) },
      { id: 'bottom_rail', box: slot(853, 2372, 1199, 42) },
    ]
  }

  return [
    { id: 'top_rail', box: slot(940, 455, 1160, 70) },
    { id: 'bottom_rail', box: slot(940, 2140, 1160, 70) },
  ]
}

function slot(leftPx: number, topPx: number, widthPx: number, heightPx: number): ProductMockupBox {
  return clampBox({
    x: leftPx / 3000,
    y: topPx / 3000,
    w: widthPx / 3000,
    h: heightPx / 3000,
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
