// utils/render/printScale.ts
//
// Plan v4 §10: layer-specific print-scale factors. Line widths, label
// sizes, and marker sizes that look right on a 72-DPI editor canvas
// render as hairlines on a 300-DPI print canvas — physical pixel counts
// scale 4×, but layer paint properties don't.
//
// This module computes per-layer scale factors from the target DPI and
// applies them to a built MapLibre style by walking layers and
// multiplying the relevant paint/layout properties.
//
// Factor philosophy (per the plan):
//   • Route is the primary visual — scales aggressively (×0.8 of dpi/72)
//   • Contours are subtle — scale gently (×0.5)
//   • Labels keep proportional size — ×0.6
//   • Pins and segments — ×0.7
//   • Roads stay thin — ×0.4
// Each is clamped to a min/max so 32×48 at 200 DPI doesn't go absurd.

export interface PrintScaleFactors {
  route: number
  contours: number
  labels: number
  pins: number
  casings: number
  roads: number
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

/**
 * Compute per-layer scale multipliers for a given render DPI.
 * baseDpiScale = dpi / 72 (the editor's screen-pixel reference DPI).
 *
 * Conservative ramps: each multiplier is < baseDpiScale so lines don't
 * look comically thick at 300 DPI; clamped above 1× so we never make
 * print thinner than screen.
 */
export function getPrintScale(opts: { dpi: number }): PrintScaleFactors {
  const baseDpiScale = opts.dpi / 72
  return {
    route: clamp(baseDpiScale * 0.8, 1.5, 8.0),
    contours: clamp(baseDpiScale * 0.5, 1.0, 4.0),
    labels: clamp(baseDpiScale * 0.6, 1.2, 5.0),
    pins: clamp(baseDpiScale * 0.7, 1.5, 6.0),
    casings: clamp(baseDpiScale * 0.5, 1.0, 4.0),
    roads: clamp(baseDpiScale * 0.4, 1.0, 3.0),
  }
}

// ─── Style mutation ────────────────────────────────────────────────────────

type AnyStyle = {
  layers?: Array<Record<string, any>>
  [k: string]: any
}

/**
 * Multiply a numeric or array-of-stops paint/layout value by `factor`.
 * MapLibre paint values come in three shapes:
 *
 *   1. Plain number:                 4.5  →  4.5 * factor
 *   2. Legacy stops object:          { stops: [[zoom, value], ...] }
 *   3. Expression form (current):    ['interpolate', ['linear'], ['zoom'],
 *                                     stop_key_0, stop_value_0,
 *                                     stop_key_1, stop_value_1, ...]
 *
 * Critical: in form (3), stop_keys are ZOOM LEVELS — never scale them.
 * Only the stop_values (output values at each zoom) get the factor.
 * Multiplying zoom keys produces invalid expressions (zoom 29 etc.) and
 * MapLibre stops rendering the layer.
 */
function scaleNumericValue(value: any, factor: number): any {
  if (typeof value === 'number') return value * factor
  if (value == null) return value

  if (Array.isArray(value)) {
    if (value[0] === 'interpolate' || value[0] === 'interpolate-lab' || value[0] === 'interpolate-hcl') {
      // ['interpolate', interpolation, input, k0, v0, k1, v1, ...]
      // Indices 0..2 are the head. From index 3 onward, even offsets
      // (3, 5, 7, ...) are stop keys; odd offsets (4, 6, 8, ...) are
      // stop values. Scale ONLY the stop values; recurse into them in
      // case they are themselves expressions.
      const out = [...value]
      for (let i = 4; i < out.length; i += 2) {
        out[i] = scaleNumericValue(out[i], factor)
      }
      return out
    }
    if (value[0] === 'step') {
      // ['step', input, default_output, k0, v0, k1, v1, ...]
      // index 2 is the default output value; index 4, 6, 8, ... are
      // values at the corresponding step keys.
      const out = [...value]
      if (typeof out[2] === 'number') out[2] = out[2] * factor
      for (let i = 4; i < out.length; i += 2) {
        out[i] = scaleNumericValue(out[i], factor)
      }
      return out
    }
    if (value[0] === 'match' || value[0] === 'case') {
      // These have varied shapes; conservative — leave alone.
      return value
    }
    if (value[0] === '*' || value[0] === '+') {
      // Arithmetic expression — multiply by wrapping in another '*'.
      return ['*', value, factor]
    }
    // Unknown expression form — leave it.
    return value
  }

  if (typeof value === 'object' && Array.isArray(value.stops)) {
    return {
      ...value,
      stops: value.stops.map(([z, v]: [number, number]) => [z, v * factor]),
    }
  }
  return value
}

/**
 * Apply per-layer scale factors to a built MapLibre style. Mutates a
 * deep-copy and returns it; the input style is untouched.
 */
export function applyPrintScaleToStyle(
  style: AnyStyle,
  factors: PrintScaleFactors,
): AnyStyle {
  const out = JSON.parse(JSON.stringify(style)) as AnyStyle
  if (!Array.isArray(out.layers)) return out

  for (const layer of out.layers) {
    const id = String(layer.id ?? '')
    const paint = (layer.paint ??= {})
    const layout = (layer.layout ??= {})

    // ─── Route (the customer's GPS track) ─────────────────────────────────
    if (id === 'route-line' || id === 'route-line-casing' || id.startsWith('route-')) {
      if (paint['line-width'] != null) {
        paint['line-width'] = scaleNumericValue(paint['line-width'], factors.route)
      }
      if (paint['line-gap-width'] != null) {
        paint['line-gap-width'] = scaleNumericValue(paint['line-gap-width'], factors.casings)
      }
    }

    // ─── Trail segments (named portions of the route) ─────────────────────
    if (id.startsWith('trail-seg-')) {
      if (paint['line-width'] != null) {
        paint['line-width'] = scaleNumericValue(paint['line-width'], factors.route)
      }
      if (paint['line-gap-width'] != null) {
        paint['line-gap-width'] = scaleNumericValue(paint['line-gap-width'], factors.casings)
      }
    }

    // ─── Segment handle dots ──────────────────────────────────────────────
    if (id.startsWith('segment-handle')) {
      if (paint['circle-radius'] != null) {
        paint['circle-radius'] = scaleNumericValue(paint['circle-radius'], factors.pins)
      }
      if (paint['circle-stroke-width'] != null) {
        paint['circle-stroke-width'] = scaleNumericValue(paint['circle-stroke-width'], factors.pins)
      }
    }

    // ─── Contours ─────────────────────────────────────────────────────────
    if (id.startsWith('contour')) {
      if (paint['line-width'] != null) {
        paint['line-width'] = scaleNumericValue(paint['line-width'], factors.contours)
      }
      if (layout['text-size'] != null) {
        layout['text-size'] = scaleNumericValue(layout['text-size'], factors.labels)
      }
    }

    // ─── Roads (when shown on a basemap-with-roads style) ─────────────────
    if (id === 'roads' || id === 'roads-line' || /road|highway/i.test(id)) {
      if (paint['line-width'] != null) {
        paint['line-width'] = scaleNumericValue(paint['line-width'], factors.roads)
      }
    }

    // ─── Place / POI labels ───────────────────────────────────────────────
    if (/place-?label|poi-?label|label/i.test(id)) {
      if (layout['text-size'] != null) {
        layout['text-size'] = scaleNumericValue(layout['text-size'], factors.labels)
      }
      if (layout['icon-size'] != null) {
        layout['icon-size'] = scaleNumericValue(layout['icon-size'], factors.pins)
      }
    }

    // ─── Hillshade (just intensity scaling, no widths) ───────────────────
    // No-op; the existing hillshade-intensity / hillshade-highlight params
    // are already in [0,1] and don't need DPI scaling.
  }
  return out
}
