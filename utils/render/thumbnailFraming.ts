import type { PrintFraming } from '~/utils/print/printFraming'

export const PREMADE_THUMBNAIL_WIDTH_PX = 720
export const PREMADE_THUMBNAIL_HEIGHT_PX = 1080
export const PREMADE_THUMBNAIL_QUALITY = 82
export const PREMADE_THUMBNAIL_PRODUCT_UID = 'premade-thumbnail'
export const PREMADE_THUMBNAIL_HASH_VERSION = 'premade-thumbnail-v1'

export function getPremadeThumbnailFraming(): PrintFraming {
  const trimWidthIn = 2
  const trimHeightIn = 3
  const dpi = PREMADE_THUMBNAIL_WIDTH_PX / trimWidthIn
  const fullWidthPx = PREMADE_THUMBNAIL_WIDTH_PX
  const fullHeightPx = PREMADE_THUMBNAIL_HEIGHT_PX
  const fullBox = { x: 0, y: 0, w: fullWidthPx, h: fullHeightPx }

  return {
    trimWidthIn,
    trimHeightIn,
    bleedIn: 0,
    safeMarginIn: 0,
    dpi,
    fullWidthPx,
    fullHeightPx,
    bleedBox: fullBox,
    trimBox: fullBox,
    safeBox: fullBox,
    mapViewportPx: fullBox,
  }
}
