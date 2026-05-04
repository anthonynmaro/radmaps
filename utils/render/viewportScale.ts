export interface ViewportVisualScaleOptions {
  currentWidth?: number | null
  savedEditorWidth?: number | null
}

type MapStyle = {
  layers?: Array<Record<string, unknown>>
  [key: string]: unknown
}

export const VIEWPORT_SCALED_PAINT_PROPERTIES = [
  'line-width',
  'line-dasharray',
  'circle-radius',
  'circle-stroke-width',
  'text-halo-width',
] as const

export const VIEWPORT_SCALED_LAYOUT_PROPERTIES = [
  'text-size',
] as const

export function getViewportVisualScale(opts: ViewportVisualScaleOptions): number {
  const currentWidth = Number(opts.currentWidth)
  const savedEditorWidth = Number(opts.savedEditorWidth)
  if (!Number.isFinite(currentWidth) || currentWidth <= 0) return 1
  if (!Number.isFinite(savedEditorWidth) || savedEditorWidth <= 0) return 1
  return currentWidth / savedEditorWidth
}

function cloneStyle<T>(style: T): T {
  return JSON.parse(JSON.stringify(style)) as T
}

function scaleInterpolatedExpression(value: unknown[], scale: number): unknown[] {
  const out = [...value]
  // ['interpolate', interpolation, input, stopKey0, output0, stopKey1, output1, ...]
  // Stop keys are zooms or line-progress values and must remain unchanged.
  for (let i = 4; i < out.length; i += 2) {
    out[i] = scaleNumericValue(out[i], scale)
  }
  return out
}

function scaleStepExpression(value: unknown[], scale: number): unknown[] {
  const out = [...value]
  // ['step', input, defaultOutput, stopKey0, output0, stopKey1, output1, ...]
  out[2] = scaleNumericValue(out[2], scale)
  for (let i = 4; i < out.length; i += 2) {
    out[i] = scaleNumericValue(out[i], scale)
  }
  return out
}

function scaleNumericValue(value: unknown, scale: number): unknown {
  if (typeof value === 'number') return value * scale
  if (!Array.isArray(value)) return value
  if (value[0] === 'interpolate' || value[0] === 'interpolate-lab' || value[0] === 'interpolate-hcl') {
    return scaleInterpolatedExpression(value, scale)
  }
  if (value[0] === 'step') return scaleStepExpression(value, scale)
  return value
}

function scaleNumericArray(value: unknown, scale: number): unknown {
  if (!Array.isArray(value)) return scaleNumericValue(value, scale)
  if (value.every(item => typeof item === 'number')) {
    return value.map(item => item * scale)
  }
  return scaleNumericValue(value, scale)
}

function shouldScaleLineLayer(id: string): boolean {
  return id === 'route-line'
    || id === 'route-line-casing'
    || id.startsWith('trail-seg-')
    || id.startsWith('contours')
    || id.startsWith('roads-')
    || id.startsWith('rn-')
    || /road/i.test(id)
}

function shouldScaleCircleLayer(id: string): boolean {
  return id.startsWith('segment-handle')
}

function shouldScaleSymbolLayer(id: string): boolean {
  return /contour|road|place|poi|label/i.test(id)
}

export function applyViewportScaleToStyle<T extends MapStyle>(style: T, visualScale: number): T {
  const out = cloneStyle(style)
  if (!Number.isFinite(visualScale) || visualScale <= 0 || visualScale === 1) return out
  if (!Array.isArray(out.layers)) return out

  for (const layer of out.layers) {
    const id = String(layer.id ?? '')
    const type = String(layer.type ?? '')
    const paint = layer.paint as Record<string, unknown> | undefined
    const layout = layer.layout as Record<string, unknown> | undefined

    if (type === 'line' && shouldScaleLineLayer(id) && paint) {
      if (paint['line-width'] != null) {
        paint['line-width'] = scaleNumericValue(paint['line-width'], visualScale)
      }
      if (paint['line-dasharray'] != null) {
        paint['line-dasharray'] = scaleNumericArray(paint['line-dasharray'], visualScale)
      }
    }

    if (type === 'circle' && shouldScaleCircleLayer(id) && paint) {
      if (paint['circle-radius'] != null) {
        paint['circle-radius'] = scaleNumericValue(paint['circle-radius'], visualScale)
      }
      if (paint['circle-stroke-width'] != null) {
        paint['circle-stroke-width'] = scaleNumericValue(paint['circle-stroke-width'], visualScale)
      }
    }

    if (type === 'symbol' && shouldScaleSymbolLayer(id)) {
      if (layout?.['text-size'] != null) {
        layout['text-size'] = scaleNumericValue(layout['text-size'], visualScale)
      }
      if (paint?.['text-halo-width'] != null) {
        paint['text-halo-width'] = scaleNumericValue(paint['text-halo-width'], visualScale)
      }
    }
  }

  return out
}
