export const PRINT_MAPLIBRE_MAX_CANVAS_SIZE_PX = 8_192

interface MapLibrePrintCanvasOptions {
  isPrintRender: boolean
  deviceScaleFactor?: number | null
  mapCssWidth?: number | null
  mapCssHeight?: number | null
}

export interface MapLibreCanvasRenderOptions {
  pixelRatio: number
  maxCanvasSize: [number, number]
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function finitePositiveNumber(value: unknown): number | null {
  const numericValue = Number(value)
  return Number.isFinite(numericValue) && numericValue > 0 ? numericValue : null
}

export function resolveMapLibrePrintCanvasOptions(
  options: MapLibrePrintCanvasOptions,
): MapLibreCanvasRenderOptions | Record<string, never> {
  if (!options.isPrintRender) return {}
  const screenshotPixelRatio = clamp(finitePositiveNumber(options.deviceScaleFactor) ?? 1, 1, 4)
  const cssWidth = finitePositiveNumber(options.mapCssWidth) ?? 0
  const cssHeight = finitePositiveNumber(options.mapCssHeight) ?? 0
  const maxCssDimension = Math.max(cssWidth, cssHeight)
  const safePixelRatio = maxCssDimension > 0
    ? PRINT_MAPLIBRE_MAX_CANVAS_SIZE_PX / maxCssDimension
    : screenshotPixelRatio
  const pixelRatio = clamp(Math.min(screenshotPixelRatio, safePixelRatio), 1, 4)

  return {
    pixelRatio,
    maxCanvasSize: [
      PRINT_MAPLIBRE_MAX_CANVAS_SIZE_PX,
      PRINT_MAPLIBRE_MAX_CANVAS_SIZE_PX,
    ],
  }
}
