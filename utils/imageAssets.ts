import type { MapAsset, MapAssetKind, MapAssetQualityStatus, PrintSize } from '~/types'

const PRINT_DIMENSIONS_IN: Record<PrintSize, { width: number; height: number }> = {
  '8x12': { width: 8, height: 12 },
  '12x18': { width: 12, height: 18 },
  '16x24': { width: 16, height: 24 },
  '20x30': { width: 20, height: 30 },
  '24x36': { width: 24, height: 36 },
  '32x48': { width: 32, height: 48 },
}

export const IMAGE_UPLOAD_ACCEPT = 'image/png,image/jpeg,image/webp'

export function classifyAssetQuality(effectiveDpi: number): MapAssetQualityStatus {
  if (effectiveDpi >= 300) return 'excellent'
  if (effectiveDpi >= 150) return 'good'
  if (effectiveDpi >= 100) return 'warning'
  return 'poor'
}

export function qualityLabel(status: MapAssetQualityStatus): string {
  switch (status) {
    case 'excellent':
      return 'Print ready'
    case 'good':
      return 'Good'
    case 'warning':
      return 'Low resolution'
    case 'poor':
      return 'Very low resolution'
  }
}

export function defaultAssetWidth(kind: MapAssetKind): number {
  return kind === 'logo' ? 16 : 36
}

export function heightPercentForAsset(widthPercent: number, widthPx: number, heightPx: number, printSize: PrintSize): number {
  const print = PRINT_DIMENSIONS_IN[printSize]
  const imageAspect = widthPx / Math.max(1, heightPx)
  const posterAspect = print.width / print.height
  return Math.max(1, Number(((widthPercent * posterAspect) / imageAspect).toFixed(2)))
}

export function computeEffectiveDpi(asset: Pick<MapAsset, 'width_px' | 'height_px' | 'width' | 'height'>, printSize: PrintSize): number {
  const print = PRINT_DIMENSIONS_IN[printSize]
  const placedWidthIn = print.width * (asset.width / 100)
  const placedHeightIn = print.height * (asset.height / 100)
  if (placedWidthIn <= 0 || placedHeightIn <= 0) return 0
  return Math.floor(Math.min(asset.width_px / placedWidthIn, asset.height_px / placedHeightIn))
}

export function withAssetQuality<T extends MapAsset>(asset: T, printSize: PrintSize): T {
  const effectiveDpi = computeEffectiveDpi(asset, printSize)
  return { ...asset, quality_status: classifyAssetQuality(effectiveDpi) }
}

export function defaultAssetPlacement(kind: MapAssetKind, widthPx: number, heightPx: number, printSize: PrintSize): Pick<MapAsset, 'x' | 'y' | 'width' | 'height' | 'rotation' | 'opacity' | 'z_index'> {
  const width = defaultAssetWidth(kind)
  const height = heightPercentForAsset(width, widthPx, heightPx, printSize)
  if (kind === 'logo') {
    return {
      x: 8,
      y: Math.max(4, Number((92 - height).toFixed(2))),
      width,
      height,
      rotation: 0,
      opacity: 1,
      z_index: 40,
    }
  }
  return {
    x: Number(((100 - width) / 2).toFixed(2)),
    y: Number(((100 - height) / 2).toFixed(2)),
    width,
    height,
    rotation: 0,
    opacity: 1,
    z_index: 30,
  }
}
