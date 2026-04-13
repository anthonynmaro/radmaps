import type { TrailSegment } from '~/types'

/**
 * Slice a primary route GeoJSON FeatureCollection by start/end percentage.
 * Flattens all LineString/MultiLineString coordinates into one array,
 * then returns a new FeatureCollection with a single LineString covering
 * the requested range.
 *
 * Used by MapPreview.vue (browser) and the render worker.
 */
export function sliceRouteByPercent(
  geojson: GeoJSON.FeatureCollection,
  startPct: number,
  endPct: number,
): GeoJSON.FeatureCollection {
  const allCoords: number[][] = []

  for (const f of geojson.features) {
    const g = f.geometry
    if (g.type === 'LineString') {
      allCoords.push(...g.coordinates)
    } else if (g.type === 'MultiLineString') {
      for (const line of g.coordinates) allCoords.push(...line)
    }
  }

  if (allCoords.length === 0) {
    return { type: 'FeatureCollection', features: [] }
  }

  const start = Math.floor(allCoords.length * Math.max(0, startPct) / 100)
  const end = Math.ceil(allCoords.length * Math.min(100, endPct) / 100)
  const sliced = allCoords.slice(start, Math.max(end, start + 2))

  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {},
        geometry: { type: 'LineString', coordinates: sliced },
      },
    ],
  }
}

/**
 * Get the source ID for a trail segment layer.
 */
export function trailSourceId(seg: TrailSegment): string {
  return `trail-seg-${seg.id}`
}
