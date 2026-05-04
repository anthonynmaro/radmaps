// utils/render/routeSmoothing.ts
//
// Shared route-line smoothing. Extracted from MapPreview.vue:1414-1471
// (formerly private to <script setup>). Both the editor and the v4
// render worker MUST import from here so smoothed routes look the same
// at proof and print.
//
// Algorithm: moving-average smoothing of LineString coordinates with a
// per-strength radius and pass count. Start and finish points are always
// anchored to the original coordinates so the route doesn't visually
// shift away from start/finish pins.
//
// Strength is an integer 0-10 that maps to a (radius, passes) pair.
// 0 = off (returns input unchanged).
//
// Anti-drift rule (CLAUDE.md / CONTRIBUTING): new poster rendering
// behavior must be added to shared render utilities first, then consumed
// by both editor and worker. This module is the canonical source for
// route smoothing — do not duplicate the algorithm in MapPreview.vue
// or render-worker-v4.

export type SmoothPreset = { radius: number; passes: number } | null

export const SMOOTH_PRESETS: readonly SmoothPreset[] = [
  null, // 0 — off
  { radius: 2, passes: 1 }, // 1
  { radius: 3, passes: 2 }, // 2
  { radius: 4, passes: 2 }, // 3
  { radius: 6, passes: 3 }, // 4
  { radius: 8, passes: 3 }, // 5
  { radius: 10, passes: 4 }, // 6
  { radius: 13, passes: 4 }, // 7
  { radius: 16, passes: 5 }, // 8
  { radius: 20, passes: 5 }, // 9
  { radius: 25, passes: 6 }, // 10 — max
]

/**
 * Apply moving-average smoothing to an array of [lng, lat] (or higher-dim)
 * coordinate pairs. The first and last points are always preserved so the
 * route stays anchored at start and finish.
 */
export function smoothLine(coords: number[][], strength: number): number[][] {
  const preset = SMOOTH_PRESETS[strength]
  if (!preset || coords.length < 3) return coords

  const { radius, passes } = preset
  let pts = coords.map((c) => c.slice())

  for (let p = 0; p < passes; p++) {
    const out = pts.map((c) => c.slice())
    for (let i = 1; i < pts.length - 1; i++) {
      const lo = Math.max(0, i - radius)
      const hi = Math.min(pts.length - 1, i + radius)
      const n = hi - lo + 1
      out[i] = pts[i].map((_, dim) => {
        let sum = 0
        for (let j = lo; j <= hi; j++) sum += pts[j][dim]
        return sum / n
      })
    }
    pts = out
    // Anchor endpoints — moving average must never drift them.
    pts[0] = coords[0].slice()
    pts[pts.length - 1] = coords[coords.length - 1].slice()
  }

  return pts
}

/**
 * Smooth every LineString / MultiLineString feature in a FeatureCollection.
 * Other geometry types are returned untouched.
 */
export function smoothGeojson(
  geojson: GeoJSON.FeatureCollection,
  strength: number,
): GeoJSON.FeatureCollection {
  if (strength === 0) return geojson
  return {
    ...geojson,
    features: geojson.features.map((feature) => {
      const g = feature.geometry
      if (g.type === 'LineString') {
        return {
          ...feature,
          geometry: { ...g, coordinates: smoothLine(g.coordinates, strength) },
        }
      }
      if (g.type === 'MultiLineString') {
        return {
          ...feature,
          geometry: {
            ...g,
            coordinates: g.coordinates.map((line) => smoothLine(line, strength)),
          },
        }
      }
      return feature
    }),
  }
}
