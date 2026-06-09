import type { MapAsset, PrintSize, StyleConfig, TextOverlay } from '~/types'
import { contrastRatio } from '~/utils/colorContrast'
import { computeEffectiveDpi } from '~/utils/imageAssets'
import { resolveFreeOverlayBox } from '~/utils/posterEditorElements'

export type PosterPrintGuardCode =
  | 'text-min-font'
  | 'text-contrast'
  | 'text-safe-area'
  | 'image-min-dpi'
  | 'image-safe-area'

export interface PosterPrintGuardViolation {
  code: PosterPrintGuardCode
  elementId: string
  severity: 'warning' | 'error'
  message: string
}

const SAFE_AREA_PERCENT = 4
const MIN_TEXT_PT = 6
const MIN_IMAGE_DPI = 150

function printSizeInches(printSize: PrintSize): { width: number; height: number } {
  const [width, height] = printSize.split('x').map(value => Number(value))
  return { width: width || 24, height: height || 36 }
}

function cqhToPt(cqh: number, printSize: PrintSize) {
  return (printSizeInches(printSize).height * 72 * cqh) / 100
}

function boxForText(config: StyleConfig, overlay: TextOverlay) {
  const anchor = resolveFreeOverlayBox(config, `text:${overlay.id}`)
  return {
    x: anchor.x ?? overlay.x,
    y: anchor.y ?? overlay.y,
  }
}

function boxForAsset(config: StyleConfig, asset: MapAsset) {
  const anchor = resolveFreeOverlayBox(config, `asset:${asset.id}`)
  return {
    x: anchor.x ?? asset.x,
    y: anchor.y ?? asset.y,
    width: anchor.width ?? asset.width,
    height: anchor.height ?? asset.height,
  }
}

function outsideSafePoint(x: number, y: number) {
  return x < SAFE_AREA_PERCENT || y < SAFE_AREA_PERCENT || x > 100 - SAFE_AREA_PERCENT || y > 100 - SAFE_AREA_PERCENT
}

function outsideSafeBox(box: { x: number; y: number; width: number; height: number }) {
  return (
    box.x < SAFE_AREA_PERCENT ||
    box.y < SAFE_AREA_PERCENT ||
    box.x + box.width > 100 - SAFE_AREA_PERCENT ||
    box.y + box.height > 100 - SAFE_AREA_PERCENT
  )
}

export function computePosterPrintGuardViolations(config: StyleConfig): PosterPrintGuardViolation[] {
  const printSize = config.print_size ?? '24x36'
  const violations: PosterPrintGuardViolation[] = []

  for (const overlay of config.text_overlays ?? []) {
    if (overlay.hidden) continue
    const elementId = `text:${overlay.id}`
    const fontPt = cqhToPt(overlay.font_size, printSize)
    if (fontPt < MIN_TEXT_PT) {
      violations.push({
        code: 'text-min-font',
        elementId,
        severity: 'error',
        message: `Text is ${fontPt.toFixed(1)}pt; minimum print size is ${MIN_TEXT_PT}pt.`,
      })
    }

    const background = overlay.bg_color ?? config.label_bg_color
    if (background && contrastRatio(overlay.color, background) < 4.5) {
      violations.push({
        code: 'text-contrast',
        elementId,
        severity: 'error',
        message: 'Text contrast must be at least 4.5:1 for print.',
      })
    }

    const box = boxForText(config, overlay)
    if (overlay.constrain_to_safe_area !== false && outsideSafePoint(box.x, box.y)) {
      violations.push({
        code: 'text-safe-area',
        elementId,
        severity: 'error',
        message: 'Text is outside the print safe area.',
      })
    }
  }

  for (const asset of config.image_overlays ?? []) {
    if (asset.hidden) continue
    const elementId = `asset:${asset.id}`
    const box = boxForAsset(config, asset)
    const dpi = computeEffectiveDpi({ ...asset, width: box.width, height: box.height }, printSize)
    if (dpi < MIN_IMAGE_DPI) {
      violations.push({
        code: 'image-min-dpi',
        elementId,
        severity: 'error',
        message: `Image resolves to ${dpi} DPI; minimum print DPI is ${MIN_IMAGE_DPI}.`,
      })
    }
    if (asset.allow_bleed !== true && outsideSafeBox(box)) {
      violations.push({
        code: 'image-safe-area',
        elementId,
        severity: 'error',
        message: 'Image is outside the print safe area.',
      })
    }
  }

  return violations
}
