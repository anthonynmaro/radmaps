import type { ProductMockupUnitBox } from '~/utils/productMockupGeometry'

export interface ProductMockupCleanupBox {
  id: string
  box: ProductMockupUnitBox
  fill: string
}

function slot(leftPx: number, topPx: number, widthPx: number, heightPx: number): ProductMockupUnitBox {
  return {
    x: leftPx / 3000,
    y: topPx / 3000,
    w: widthPx / 3000,
    h: heightPx / 3000,
  }
}

export function getProductMockupCleanupBoxes(
  finish: string | undefined,
  sceneFile?: string,
): ProductMockupCleanupBox[] {
  if (finish !== 'wall_hanging') return []

  if (sceneFile === 'Close-Up-Plain-Gray-0.jpeg') {
    return [
      { id: 'left_side_scene_cleanup', box: slot(575, 305, 120, 2410), fill: '#f8f8f5' },
      { id: 'right_side_scene_cleanup', box: slot(2305, 305, 120, 2410), fill: '#f8f8f5' },
    ]
  }

  if (sceneFile === 'Close-Up-Lobby-Dark-Emerald-0.jpeg') {
    return [
      { id: 'left_side_scene_cleanup', box: slot(820, 656, 88, 1716), fill: '#1f4945' },
      { id: 'right_side_scene_cleanup', box: slot(2000, 656, 88, 1716), fill: '#1f4945' },
    ]
  }

  if (sceneFile === 'Close-Up-Bed-Room-White-0.jpeg') {
    return [
      { id: 'left_side_scene_cleanup', box: slot(900, 525, 72, 1615), fill: '#f2f6f7' },
      { id: 'right_side_scene_cleanup', box: slot(2058, 525, 72, 1615), fill: '#f2f6f7' },
    ]
  }

  return []
}
