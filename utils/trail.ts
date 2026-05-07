import type { TrailSegment, DeletedRange } from '~/types'

export const DEFAULT_COORD_GAP_THRESHOLD_METERS = 50

const SEGMENT_COLORS = [
  '#2D6A4F', '#3A7CA5', '#C1121F', '#E87722',
  '#F4B942', '#7B3F8D', '#4ECDC4', '#C8A97E',
]

export function distanceMeters(a: number[], b: number[]): number {
  const [lng1, lat1] = a
  const [lng2, lat2] = b
  const dlat = (lat2 - lat1) * 111320
  const dlng = (lng2 - lng1) * 111320 * Math.cos((lat1 * Math.PI) / 180)
  return Math.sqrt(dlat * dlat + dlng * dlng)
}

function splitCoordsOnGaps(coords: number[][], gapThresholdMeters = DEFAULT_COORD_GAP_THRESHOLD_METERS): number[][][] {
  if (coords.length < 2) return []

  const lines: number[][][] = []
  let current: number[][] = [coords[0]]

  for (let i = 1; i < coords.length; i++) {
    if (distanceMeters(coords[i - 1], coords[i]) > gapThresholdMeters) {
      if (current.length >= 2) lines.push(current)
      current = [coords[i]]
    } else {
      current.push(coords[i])
    }
  }

  if (current.length >= 2) lines.push(current)
  return lines
}

function pctToIndexRange(total: number, startPct: number, endPct: number): [number, number] {
  const start = Math.floor(total * Math.max(0, startPct) / 100)
  const end = Math.ceil(total * Math.min(100, endPct) / 100)
  return [Math.max(0, Math.min(total, start)), Math.max(0, Math.min(total, end))]
}

function rangeToIndexRange(total: number, range: DeletedRange, minIndex = 0, maxIndex = total): [number, number] {
  if (
    typeof range.start_index === 'number' &&
    typeof range.end_index === 'number' &&
    Number.isFinite(range.start_index) &&
    Number.isFinite(range.end_index)
  ) {
    const start = Math.floor(Math.min(range.start_index, range.end_index))
    const end = Math.ceil(Math.max(range.start_index, range.end_index))
    return [Math.max(minIndex, Math.min(total, start)), Math.min(maxIndex, Math.max(0, end))]
  }
  const [rawStart, rawEnd] = pctToIndexRange(total, range.start, range.end)
  return [Math.max(minIndex, rawStart), Math.min(maxIndex, rawEnd)]
}

export function mergeDeletedRanges(ranges: DeletedRange[]): DeletedRange[] {
  const sorted = ranges
    .map(r => ({
      start: Math.max(0, Math.min(100, Math.min(r.start, r.end))),
      end: Math.max(0, Math.min(100, Math.max(r.start, r.end))),
    }))
    .filter(r => r.end > r.start)
    .sort((a, b) => a.start - b.start)

  const merged: DeletedRange[] = []
  for (const range of sorted) {
    const prev = merged[merged.length - 1]
    if (prev && range.start <= prev.end) {
      prev.end = Math.max(prev.end, range.end)
    } else {
      merged.push({ ...range })
    }
  }
  return merged
}

export function deletedRangesFromIndexes(
  indexes: Iterable<number>,
  totalCoords: number,
  paddingIndexes = 2,
  maxIndexGap = 0,
): DeletedRange[] {
  if (totalCoords <= 1) return []

  const sorted = Array.from(new Set(indexes))
    .filter(i => Number.isFinite(i))
    .map(i => Math.round(i))
    .filter(i => i >= 0 && i < totalCoords)
    .sort((a, b) => a - b)

  if (!sorted.length) return []

  const ranges: DeletedRange[] = []
  let start = sorted[0]
  let end = sorted[0]

  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] <= end + 1 + maxIndexGap) {
      end = sorted[i]
    } else {
      ranges.push(indexRangeToDeletedRange(start, end, totalCoords, paddingIndexes))
      start = sorted[i]
      end = sorted[i]
    }
  }
  ranges.push(indexRangeToDeletedRange(start, end, totalCoords, paddingIndexes))

  return mergeDeletedRanges(ranges)
}

export function deletedRangesFromRouteIndexes(
  indexes: Iterable<number>,
  coords: number[][],
  paddingIndexes = 0,
  maxIndexGap = 0,
  gapThresholdMeters = DEFAULT_COORD_GAP_THRESHOLD_METERS,
): DeletedRange[] {
  if (coords.length <= 1) return []

  const sorted = Array.from(new Set(indexes))
    .filter(i => Number.isFinite(i))
    .map(i => Math.round(i))
    .filter(i => i >= 0 && i < coords.length)
    .sort((a, b) => a - b)

  if (!sorted.length) return []

  const ranges: DeletedRange[] = []
  let start = sorted[0]
  let end = sorted[0]

  for (let i = 1; i < sorted.length; i++) {
    const next = sorted[i]
    const closeEnoughByIndex = next <= end + 1 + maxIndexGap
    const hasGapBetween = routeHasGapBetween(coords, end, next, gapThresholdMeters)

    if (closeEnoughByIndex && !hasGapBetween) {
      end = next
    } else {
      ranges.push(indexRangeToDeletedRange(start, end, coords, paddingIndexes, gapThresholdMeters))
      start = next
      end = next
    }
  }
  ranges.push(indexRangeToDeletedRange(start, end, coords, paddingIndexes, gapThresholdMeters))

  return mergeOverlappingDeletedRanges(ranges).filter(range => {
    const [startIndex, endIndex] = rangeToIndexRange(coords.length, range)
    return endIndex - startIndex >= 2 && !routeHasGapBetween(coords, startIndex, endIndex - 1, gapThresholdMeters)
  })
}

export function mergeDeletedRangesForRoute(
  geojson: GeoJSON.FeatureCollection,
  ranges: DeletedRange[],
  gapThresholdMeters = DEFAULT_COORD_GAP_THRESHOLD_METERS,
): DeletedRange[] {
  const coords = getAllRouteCoords(geojson)
  if (coords.length <= 1) return []

  return mergeIndexRangesForRoute(
    ranges.map(range => rangeToIndexRange(coords.length, range)).filter(([start, end]) => end > start),
    coords,
    gapThresholdMeters,
  ).map(([start, end]) => indexRangeToExactDeletedRange(start, end, coords.length))
}

function mergeOverlappingDeletedRanges(ranges: DeletedRange[]): DeletedRange[] {
  const sorted = ranges
    .map(r => {
      const start = Math.max(0, Math.min(100, Math.min(r.start, r.end)))
      const end = Math.max(0, Math.min(100, Math.max(r.start, r.end)))
      const startIndex = typeof r.start_index === 'number' && Number.isFinite(r.start_index) ? Math.floor(r.start_index) : undefined
      const endIndex = typeof r.end_index === 'number' && Number.isFinite(r.end_index) ? Math.ceil(r.end_index) : undefined
      return {
        start,
        end,
        ...(startIndex !== undefined && endIndex !== undefined
          ? {
              start_index: Math.min(startIndex, endIndex),
              end_index: Math.max(startIndex, endIndex),
            }
          : {}),
      }
    })
    .filter(r => r.end > r.start)
    .sort((a, b) => a.start - b.start)

  const merged: DeletedRange[] = []
  for (const range of sorted) {
    const prev = merged[merged.length - 1]
    if (prev && range.start < prev.end) {
      prev.end = Math.max(prev.end, range.end)
      if (prev.start_index !== undefined && prev.end_index !== undefined && range.start_index !== undefined && range.end_index !== undefined) {
        prev.start_index = Math.min(prev.start_index, range.start_index)
        prev.end_index = Math.max(prev.end_index, range.end_index)
      } else {
        delete prev.start_index
        delete prev.end_index
      }
    } else {
      merged.push({ ...range })
    }
  }
  return merged
}

function mergeIndexRangesForRoute(
  ranges: Array<[number, number]>,
  coords: number[][],
  gapThresholdMeters: number,
): Array<[number, number]> {
  const sorted = ranges
    .map(([start, end]) => [
      Math.max(0, Math.min(coords.length, Math.min(start, end))),
      Math.max(0, Math.min(coords.length, Math.max(start, end))),
    ] as [number, number])
    .filter(([start, end]) => end > start)
    .sort((a, b) => a[0] - b[0])

  const merged: Array<[number, number]> = []
  for (const [start, end] of sorted) {
    const prev = merged[merged.length - 1]
    if (!prev) {
      merged.push([start, end])
      continue
    }

    const overlaps = start < prev[1]
    const touchesWithoutRouteGap = start === prev[1] && !routeHasGapBetween(coords, prev[1] - 1, start, gapThresholdMeters)
    if (overlaps || touchesWithoutRouteGap) {
      prev[1] = Math.max(prev[1], end)
    } else {
      merged.push([start, end])
    }
  }
  return merged
}

function routeHasGapBetween(coords: number[][], startIndex: number, endIndex: number, gapThresholdMeters: number): boolean {
  const start = Math.max(0, Math.min(coords.length - 1, Math.min(startIndex, endIndex)))
  const end = Math.max(0, Math.min(coords.length - 1, Math.max(startIndex, endIndex)))
  for (let i = start; i < end; i++) {
    if (distanceMeters(coords[i], coords[i + 1]) > gapThresholdMeters) return true
  }
  return false
}

function paddedRouteStartIndex(coords: number[][], start: number, paddingIndexes: number, gapThresholdMeters: number): number {
  let padded = start
  for (let i = 0; i < paddingIndexes && padded > 0; i++) {
    if (distanceMeters(coords[padded - 1], coords[padded]) > gapThresholdMeters) break
    padded--
  }
  return padded
}

function paddedRouteEndIndex(coords: number[][], end: number, paddingIndexes: number, gapThresholdMeters: number): number {
  let padded = end
  for (let i = 0; i < paddingIndexes && padded < coords.length - 1; i++) {
    if (distanceMeters(coords[padded], coords[padded + 1]) > gapThresholdMeters) break
    padded++
  }
  return padded
}

function indexRangeToDeletedRange(start: number, end: number, totalCoordsOrCoords: number | number[][], paddingIndexes: number, gapThresholdMeters = DEFAULT_COORD_GAP_THRESHOLD_METERS): DeletedRange {
  const totalCoords = Array.isArray(totalCoordsOrCoords) ? totalCoordsOrCoords.length : totalCoordsOrCoords
  const paddedStart = Array.isArray(totalCoordsOrCoords)
    ? paddedRouteStartIndex(totalCoordsOrCoords, start, paddingIndexes, gapThresholdMeters)
    : Math.max(0, start - paddingIndexes)
  const paddedEnd = Array.isArray(totalCoordsOrCoords)
    ? paddedRouteEndIndex(totalCoordsOrCoords, end, paddingIndexes, gapThresholdMeters)
    : Math.min(totalCoords - 1, end + paddingIndexes)
  return {
    start: (paddedStart / totalCoords) * 100,
    end: ((paddedEnd + 1) / totalCoords) * 100,
    ...(Array.isArray(totalCoordsOrCoords)
      ? { start_index: paddedStart, end_index: paddedEnd + 1 }
      : {}),
  }
}

function indexRangeToExactDeletedRange(start: number, end: number, totalCoords: number): DeletedRange {
  const startIndex = Math.max(0, Math.min(totalCoords, Math.floor(start)))
  const endIndex = Math.max(0, Math.min(totalCoords, Math.ceil(end)))
  return {
    start: (startIndex / totalCoords) * 100,
    end: (endIndex / totalCoords) * 100,
    start_index: startIndex,
    end_index: endIndex,
  }
}

function featureCollectionFromLines(lineCoords: number[][][]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: lineCoords.map(coords => ({
      type: 'Feature',
      properties: {},
      geometry: { type: 'LineString', coordinates: coords },
    })),
  }
}

export function routeRangesToGeojson(
  geojson: GeoJSON.FeatureCollection,
  ranges: DeletedRange[],
  cropStart = 0,
  cropEnd = 100,
): GeoJSON.FeatureCollection {
  const allCoords = getAllRouteCoords(geojson)
  if (!allCoords.length) return { type: 'FeatureCollection', features: [] }

  const [cropStartIdx, cropEndIdx] = pctToIndexRange(allCoords.length, cropStart, cropEnd)
  const lineCoords: number[][][] = []

  const blocked = mergeIndexRangesForRoute(
    ranges.map(range => rangeToIndexRange(allCoords.length, range, cropStartIdx, cropEndIdx)),
    allCoords,
    DEFAULT_COORD_GAP_THRESHOLD_METERS,
  )

  for (const [start, end] of blocked) {
    if (end - start < 2) continue
    lineCoords.push(...splitCoordsOnGaps(allCoords.slice(start, end)))
  }

  if (!lineCoords.length) return { type: 'FeatureCollection', features: [] }

  return featureCollectionFromLines(lineCoords)
}

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
 * slices the requested range, then splits large coordinate gaps back into
 * MultiLineString parts so GPS dropouts do not render as straight chords.
 *
 * Used by MapPreview.vue (browser) and the render worker.
 */
export function sliceRouteByPercent(
  geojson: GeoJSON.FeatureCollection,
  startPct: number,
  endPct: number,
  deletedRanges: DeletedRange[] = [],
): GeoJSON.FeatureCollection {
  const allCoords = getAllRouteCoords(geojson)

  if (allCoords.length === 0) {
    return { type: 'FeatureCollection', features: [] }
  }

  const [start, rawEnd] = pctToIndexRange(allCoords.length, startPct, endPct)
  const end = Math.max(rawEnd, start + 2)
  const blocked = mergeIndexRangesForRoute(
    deletedRanges.map(range => rangeToIndexRange(allCoords.length, range, start, end)),
    allCoords,
    DEFAULT_COORD_GAP_THRESHOLD_METERS,
  )

  const lines: number[][][] = []
  let cursor = start
  for (const [blockStart, blockEnd] of blocked) {
    if (blockStart > cursor) {
      lines.push(...splitCoordsOnGaps(allCoords.slice(cursor, blockStart)))
    }
    cursor = Math.max(cursor, blockEnd)
  }
  if (cursor < end) {
    lines.push(...splitCoordsOnGaps(allCoords.slice(cursor, end)))
  }

  if (lines.length === 0) {
    return { type: 'FeatureCollection', features: [] }
  }

  return featureCollectionFromLines(lines)
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
  const allCoords = getAllRouteCoords(geojson)
  if (allCoords.length === 0) return { type: 'FeatureCollection', features: [] }

  const total = allCoords.length
  const [cropStartIdx, cropEndIdx] = pctToIndexRange(total, cropStart, cropEnd)

  const blocked = mergeIndexRangesForRoute(
    deletedRanges.map(range => rangeToIndexRange(total, range, cropStartIdx, cropEndIdx)),
    allCoords,
    DEFAULT_COORD_GAP_THRESHOLD_METERS,
  )

  // Collect surviving coordinate arrays
  const lineCoords: number[][][] = []
  let cursor = cropStartIdx
  for (const [blockStart, blockEnd] of blocked) {
    if (blockStart > cursor) {
      const coords = allCoords.slice(cursor, blockStart)
      lineCoords.push(...splitCoordsOnGaps(coords))
    }
    cursor = blockEnd
  }
  if (cursor < cropEndIdx) {
    const coords = allCoords.slice(cursor, cropEndIdx)
    lineCoords.push(...splitCoordsOnGaps(coords))
  }

  if (lineCoords.length === 0) return { type: 'FeatureCollection', features: [] }

  return featureCollectionFromLines(lineCoords)
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
    if (distanceMeters([lng1, lat1], [lng2, lat2]) > gapThresholdMeters) {
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
