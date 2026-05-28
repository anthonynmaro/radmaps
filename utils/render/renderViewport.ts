import type { StyleConfig } from '~/types'
import type { PrintFraming } from '~/utils/print/printFraming'

export interface BrowserRenderViewport {
  viewportWidthPx: number
  viewportHeightPx: number
  deviceScaleFactor: number
  targetCssWidthPx: number | null
}

interface BrowserRenderViewportOptions {
  fallbackDeviceScaleFactor: number
  minDeviceScaleFactor?: number
  maxDeviceScaleFactor?: number
}

const ESTIMATED_MAP_TO_POSTER_WIDTH_RATIO = 0.92
const MIN_TARGET_CSS_WIDTH_PX = 360
const MAX_TARGET_CSS_WIDTH_PX = 900
const MAX_DEVICE_SCALE_FACTOR = 4

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function finitePositive(value: unknown): number | null {
  const numberValue = Number(value)
  return Number.isFinite(numberValue) && numberValue > 0 ? numberValue : null
}

function chooseNearestDeviceScaleFactor(fullWidthPx: number, targetCssWidthPx: number, min: number, max: number): number {
  const desired = fullWidthPx / targetCssWidthPx
  const low = clamp(Math.floor(desired), min, max)
  const high = clamp(Math.ceil(desired), min, max)
  return [low, high].reduce((best, candidate) => {
    const bestDelta = Math.abs((fullWidthPx / best) - targetCssWidthPx)
    const candidateDelta = Math.abs((fullWidthPx / candidate) - targetCssWidthPx)
    return candidateDelta < bestDelta ? candidate : best
  }, low)
}

export function resolveBrowserRenderViewport(
  framing: PrintFraming,
  styleConfig: Pick<StyleConfig, 'map_editor_width'> | null | undefined,
  options: BrowserRenderViewportOptions,
): BrowserRenderViewport {
  const fallbackDeviceScaleFactor = Math.max(1, Math.round(options.fallbackDeviceScaleFactor))
  const minDeviceScaleFactor = options.minDeviceScaleFactor ?? 1
  const maxDeviceScaleFactor = options.maxDeviceScaleFactor ?? MAX_DEVICE_SCALE_FACTOR
  const savedMapWidth = finitePositive(styleConfig?.map_editor_width)

  const targetCssWidthPx = savedMapWidth
    ? clamp(
        Math.round(savedMapWidth / ESTIMATED_MAP_TO_POSTER_WIDTH_RATIO),
        MIN_TARGET_CSS_WIDTH_PX,
        MAX_TARGET_CSS_WIDTH_PX,
      )
    : null

  const deviceScaleFactor = targetCssWidthPx
    ? chooseNearestDeviceScaleFactor(framing.fullWidthPx, targetCssWidthPx, minDeviceScaleFactor, maxDeviceScaleFactor)
    : clamp(fallbackDeviceScaleFactor, minDeviceScaleFactor, maxDeviceScaleFactor)

  return {
    viewportWidthPx: Math.ceil(framing.fullWidthPx / deviceScaleFactor),
    viewportHeightPx: Math.ceil(framing.fullHeightPx / deviceScaleFactor),
    deviceScaleFactor,
    targetCssWidthPx,
  }
}
