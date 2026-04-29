import type { TrailSegment, DeletedRange } from '~/types'

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
 * Produce a route FeatureCollection with crop + mid-route deleted ranges applied.
 * Returns a FeatureCollection with a single LineString (one gap) or MultiLineString
 * (multiple surviving sections). A single feature is critical — MapLibre sources with
 * lineMetrics:true draw connector segments between separate FeatureCollection features,
 * producing unwanted straight lines through the map.
 * Used by MapPreview.vue (browser) — render-worker has a JS port.
 */
export function excludeRangesFromRoute(
  geojson: GeoJSON.FeatureCollection,
  cropStart: number,
  cropEnd: number,
  deletedRanges: DeletedRange[],
): GeoJSON.FeatureCollection {
  const allCoords: number[][] = []
  for (const f of geojson.features) {
    const g = f.geometry
    if (g.type === 'LineString') allCoords.push(...g.coordinates)
    else if (g.type === 'MultiLineString') for (const line of g.coordinates) allCoords.push(...line)
  }
  if (allCoords.length === 0) return { type: 'FeatureCollection', features: [] }

  const total = allCoords.length
  const cropStartIdx = Math.floor(total * Math.max(0, cropStart) / 100)
  const cropEndIdx = Math.ceil(total * Math.min(100, cropEnd) / 100)

  // Convert % ranges to index pairs, clamp to crop window, drop zero-width ranges
  let blocked = deletedRanges.map(r => [
    Math.max(cropStartIdx, Math.floor(total * r.start / 100)),
    Math.min(cropEndIdx, Math.ceil(total * r.end / 100)),
  ] as [number, number]).filter(([s, e]) => e > s)
  blocked.sort((a, b) => a[0] - b[0])

  // Merge overlapping blocked ranges
  const merged: [number, number][] = []
  for (const [s, e] of blocked) {
    if (merged.length && s <= merged[merged.length - 1][1]) {
      merged[merged.length - 1][1] = Math.max(merged[merged.length - 1][1], e)
    } else {
      merged.push([s, e])
    }
  }

  // Collect surviving coordinate arrays
  const lineCoords: number[][][] = []
  let cursor = cropStartIdx
  for (const [blockStart, blockEnd] of merged) {
    if (blockStart > cursor) {
      const coords = allCoords.slice(cursor, blockStart)
      if (coords.length >= 2) lineCoords.push(coords)
    }
    cursor = blockEnd
  }
  if (cursor < cropEndIdx) {
    const coords = allCoords.slice(cursor, cropEndIdx)
    if (coords.length >= 2) lineCoords.push(coords)
  }

  if (lineCoords.length === 0) return { type: 'FeatureCollection', features: [] }

  return {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      properties: {},
      geometry: lineCoords.length === 1
        ? { type: 'LineString', coordinates: lineCoords[0] }
        : { type: 'MultiLineString', coordinates: lineCoords },
    }],
  }
}

/**
 * Detect coordinate gaps in a GeoJSON route exceeding the given threshold (default 50m).
 * Returns a DeletedRange[] marking each gap — useful for auto-hiding GPS dropouts.
 */
export function detectDisconnectedRanges(
  geojson: GeoJSON.FeatureCollection,
  gapThresholdMeters = 50,
): DeletedRange[] {
  const allCoords: number[][] = []
  for (const f of geojson.features) {
    const g = f.geometry
    if (g.type === 'LineString') allCoords.push(...g.coordinates)
    else if (g.type === 'MultiLineString') for (const line of g.coordinates) allCoords.push(...line)
  }
  if (allCoords.length < 2) return []

  const total = allCoords.length
  const ranges: DeletedRange[] = []

  for (let i = 0; i < total - 1; i++) {
    const [lng1, lat1] = allCoords[i]
    const [lng2, lat2] = allCoords[i + 1]
    const dlat = (lat2 - lat1) * 111320
    const dlng = (lng2 - lng1) * 111320 * Math.cos((lat1 * Math.PI) / 180)
    const dist = Math.sqrt(dlat * dlat + dlng * dlng)
    if (dist > gapThresholdMeters) {
      ranges.push({
        start: (i / (total - 1)) * 100,
        end: ((i + 1) / (total - 1)) * 100,
      })
    }
  }

  return ranges
}

/**
 * Get the source ID for a trail segment layer.
 */
export function trailSourceId(seg: TrailSegment): string {
  return `trail-seg-${seg.id}`
}

/**
 * Flatten all LineString/MultiLineString coordinates from a GeoJSON feature collection.
 */
export function getAllRouteCoords(geojson: GeoJSON.FeatureCollection): number[][] {
  const coords: number[][] = []
  for (const f of geojson.features) {
    const g = f.geometry
    if (g.type === 'LineString') coords.push(...g.coordinates)
    else if (g.type === 'MultiLineString') for (const line of g.coordinates) coords.push(...line)
  }
  return coords
}

/**
 * Build a normalised SVG elevation profile from a GeoJSON feature collection.
 * Coordinates are expected to carry elevation as the third value [lng, lat, elev].
 * Returns null when no usable elevation data is present (< 10 points with non-zero elevation).
 *
 * The returned svgPath is a closed filled-area shape in a 1000×100 viewBox:
 *   x=0…1000 spans the route from start to finish
 *   y=0 is the peak, y=100 is the baseline (bottom of chart)
 *   An 8% top margin keeps the stroke from clipping at the SVG edge
 *
 * Usage:
 *   <svg viewBox="0 0 1000 100" preserveAspectRatio="none">
 *     <path :d="profile.svgPath" />
 *   </svg>
 */
export function buildElevationProfile(
  geojson: GeoJSON.FeatureCollection,
  samples = 250,
): { svgPath: string; strokePath: string; minElev: number; maxElev: number } | null {
  const coords = getAllRouteCoords(geojson)
  const elevations = coords.map(c => c[2] ?? 0).filter(e => e !== 0)
  if (elevations.length < 10) return null

  const step = Math.max(1, Math.floor(elevations.length / samples))
  const sampled: number[] = []
  for (let i = 0; i < elevations.length; i += step) sampled.push(elevations[i])
  if (sampled[sampled.length - 1] !== elevations[elevations.length - 1]) {
    sampled.push(elevations[elevations.length - 1])
  }

  const minElev = Math.min(...sampled)
  const maxElev = Math.max(...sampled)
  const range = maxElev - minElev || 1
  const TOP_MARGIN = 8  // % of viewbox height reserved at top

  const n = sampled.length
  const pts = sampled.map((e, i) => {
    const x = parseFloat(((i / (n - 1)) * 1000).toFixed(1))
    const y = parseFloat((TOP_MARGIN + ((maxElev - e) / range) * (100 - TOP_MARGIN)).toFixed(2))
    return `${x},${y}`
  })

  const strokePath = `M ${pts.join(' L ')}`
  const svgPath = `M 0,100 L ${pts.join(' L ')} L 1000,100 Z`

  return { svgPath, strokePath, minElev, maxElev }
}

/**
 * Return the [lng, lat] of the first and last coordinate in a GeoJSON route.
 */
export function getRouteEndpoints(
  geojson: GeoJSON.FeatureCollection,
): { start: [number, number] | null; finish: [number, number] | null } {
  const coords = getAllRouteCoords(geojson)
  if (coords.length === 0) return { start: null, finish: null }
  const first = coords[0]
  const last = coords[coords.length - 1]
  return {
    start: [first[0], first[1]],
    finish: [last[0], last[1]],
  }
}

/**
 * Given a click [lng, lat], return the nearest point's position along the route as a
 * percentage (0–100) of the coordinate array length. Used for map-tap segment plotting.
 */
export function findRoutePercent(
  lngLat: [number, number],
  geojson: GeoJSON.FeatureCollection,
): number {
  const coords = getAllRouteCoords(geojson)
  if (coords.length === 0) return 0
  let bestIdx = 0, bestDist = Infinity
  for (let i = 0; i < coords.length; i++) {
    const dx = coords[i][0] - lngLat[0]
    const dy = coords[i][1] - lngLat[1]
    const d = dx * dx + dy * dy
    if (d < bestDist) { bestDist = d; bestIdx = i }
  }
  return (bestIdx / Math.max(coords.length - 1, 1)) * 100
}
