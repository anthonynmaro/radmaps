import type { TrailSegment } from '~/types'

const SEGMENT_COLORS = [
  '#2D6A4F', '#3A7CA5', '#C1121F', '#E87722',
  '#F4B942', '#7B3F8D', '#4ECDC4', '#C8A97E',
]

/**
 * Extract named tracks from a multi-track GeoJSON (produced by @tmcw/togeojson).
 * Each <trk> with a <name> becomes a TrailSegment with section_start/end
 * computed from its coordinate share of the full flattened route.
 *
 * Returns [] when there is only one (or zero) named tracks — no auto-segmentation needed.
 */
export function extractNamedTrackSegments(geojson: GeoJSON.FeatureCollection): TrailSegment[] {
  const namedFeatures = geojson.features.filter(
    f => f.properties?.name && (f.geometry.type === 'LineString' || f.geometry.type === 'MultiLineString'),
  )
  if (namedFeatures.length <= 1) return []

  // Count coordinates per feature and total
  const counts = namedFeatures.map(f => {
    const g = f.geometry as GeoJSON.LineString | GeoJSON.MultiLineString
    if (g.type === 'LineString') return g.coordinates.length
    return g.coordinates.reduce((sum, line) => sum + line.length, 0)
  })
  const total = counts.reduce((s, c) => s + c, 0)
  if (total === 0) return []

  let cumulative = 0
  return namedFeatures.map((f, i) => {
    const start = Math.round((cumulative / total) * 100)
    cumulative += counts[i]
    const end = Math.round((cumulative / total) * 100)
    return {
      id: Math.random().toString(36).slice(2, 10),
      name: String(f.properties!.name),
      color: SEGMENT_COLORS[i % SEGMENT_COLORS.length],
      visible: true,
      section_start: start,
      section_end: end,
      width: 3,
      opacity: 0.9,
      dash: false,
    } satisfies TrailSegment
  })
}

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
