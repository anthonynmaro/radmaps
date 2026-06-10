export const PRINT_MAPLIBRE_MAX_CANVAS_SIZE_PX = 16_384

interface MapLibrePrintCanvasOptions {
  isPrintRender: boolean
  deviceScaleFactor?: number | null
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

  return {
    pixelRatio: clamp(finitePositiveNumber(options.deviceScaleFactor) ?? 1, 1, 4),
    maxCanvasSize: [
      PRINT_MAPLIBRE_MAX_CANVAS_SIZE_PX,
      PRINT_MAPLIBRE_MAX_CANVAS_SIZE_PX,
    ],
  }
}
