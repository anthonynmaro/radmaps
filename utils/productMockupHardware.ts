import {
  getOverprintedProductMockupArtworkBox,
  type ProductMockupFinishKey,
  type ProductMockupUnitBox,
} from '~/utils/productMockupGeometry'

export interface ProductMockupHardwareBox {
  id: string
  box: ProductMockupUnitBox
}

export function getProductMockupAcrylicRivetBoxes(
  artworkBox: ProductMockupUnitBox,
  finish: ProductMockupFinishKey | string | undefined,
  sceneFile?: string,
): ProductMockupHardwareBox[] {
  if (finish !== 'acrylic') return []

  const box = getOverprintedProductMockupArtworkBox(artworkBox, finish, sceneFile)
  const diameter = Math.min(box.w, box.h) * 0.06
  const horizontalInset = 0
  const verticalInset = -diameter * 0.04
  const left = box.x + horizontalInset
  const right = box.x + box.w - horizontalInset - diameter * 0.72
  const top = box.y + verticalInset
  const bottom = box.y + box.h - diameter * 0.52

  return [
    { id: 'top_left', box: { x: left, y: top, w: diameter, h: diameter } },
    { id: 'top_right', box: { x: right, y: top, w: diameter, h: diameter } },
    { id: 'bottom_left', box: { x: left, y: bottom, w: diameter, h: diameter } },
    { id: 'bottom_right', box: { x: right, y: bottom, w: diameter, h: diameter } },
  ]
}
