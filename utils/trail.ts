import { DEFAULT_TRAIL_SEGMENT_WIDTH, type TrailSegment, type DeletedRange, type RouteStats, type StyleConfig } from '~/types'

export const DEFAULT_COORD_GAP_THRESHOLD_METERS = 50

const SEGMENT_COLORS = [
  '#2D6A4F', '#3A7CA5', '#C1121F', '#E87722',
  '#F4B942', '#7B3F8D', '#4ECDC4', '#C8A97E',
]

export function defaultTrailSegmentColor(
  config: Pick<StyleConfig, 'color_theme' | 'route_color'>,
  segments: Array<Pick<TrailSegment, 'color'>> = [],
): string {
  if (config.color_theme === 'dark-sky') return config.route_color || '#F4B942'

  const usedColors = new Set(segments.map(segment => segment.color))
  return SEGMENT_COLORS.find(color => !usedColors.has(color)) ?? SEGMENT_COLORS[0]
}

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

function getRouteLineCoords(geojson: GeoJSON.FeatureCollection): number[][][] {
  const lines: number[][][] = []
  for (const feature of geojson.features) {
    const geometry = feature.geometry
    if (geometry.type === 'LineString') {
      lines.push(geometry.coordinates)
    } else if (geometry.type === 'MultiLineString') {
      lines.push(...geometry.coordinates)
    }
  }
  return lines
}

function sliceGeometryBackedSegmentGeojson(
  geojson: GeoJSON.FeatureCollection,
  startPct: number,
  endPct: number,
): GeoJSON.FeatureCollection {
  const lines = getRouteLineCoords(geojson).filter(line => line.length >= 2)
  const totalCoords = lines.reduce((sum, line) => sum + line.length, 0)

  if (!totalCoords) {
    return { type: 'FeatureCollection', features: [] }
  }

  const [start, rawEnd] = pctToIndexRange(totalCoords, startPct, endPct)
  const end = Math.max(rawEnd, start + 2)
  const slicedLines: number[][][] = []
  let offset = 0

  for (const line of lines) {
    const lineStart = offset
    const lineEnd = offset + line.length
    offset = lineEnd

    const sliceStart = Math.max(start, lineStart)
    const sliceEnd = Math.min(end, lineEnd)
    if (sliceEnd - sliceStart < 2) continue

    slicedLines.push(line.slice(sliceStart - lineStart, sliceEnd - lineStart))
  }

  if (!slicedLines.length) {
    return { type: 'FeatureCollection', features: [] }
  }

  return featureCollectionFromLines(slicedLines)
}

export function routeStatsForCoords(coords: number[][]): RouteStats {
  let distanceKm = 0
  let elevationGainM = 0
  let elevationLossM = 0
  let maxElevationM = -Infinity
  let minElevationM = Infinity
  let hasElevation = false
  for (let i = 1; i < coords.length; i++) {
    distanceKm += distanceMeters(coords[i - 1], coords[i]) / 1000

    const prev = coords[i - 1][2]
    const next = coords[i][2]
    if (Number.isFinite(prev) && Number.isFinite(next)) {
      const delta = next - prev
      if (delta > 0) elevationGainM += delta
      else elevationLossM += Math.abs(delta)
    }
  }

  for (const coord of coords) {
    const elevation = coord[2]
    if (!Number.isFinite(elevation)) continue
    hasElevation = true
    if (elevation > maxElevationM) maxElevationM = elevation
    if (elevation < minElevationM) minElevationM = elevation
  }

  return {
    distance_km: Math.round(distanceKm * 100) / 100,
    elevation_gain_m: hasElevation ? Math.round(elevationGainM) : 0,
    elevation_loss_m: hasElevation ? Math.round(elevationLossM) : 0,
    max_elevation_m: hasElevation ? Math.round(maxElevationM) : 0,
    min_elevation_m: hasElevation ? Math.round(minElevationM) : 0,
    activity_type: 'drawn',
  }
}

export function coordsHaveElevation(coords: number[][]): boolean {
  return coords.some(coord => Number.isFinite(coord[2]))
}

export function bboxForCoords(coords: number[][]): [number, number, number, number] | null {
  if (!coords.length) return null
  let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity
  for (const [lng, lat] of coords) {
    if (lng < minLng) minLng = lng
    if (lat < minLat) minLat = lat
    if (lng > maxLng) maxLng = lng
    if (lat > maxLat) maxLat = lat
  }
  if (![minLng, minLat, maxLng, maxLat].every(Number.isFinite)) return null
  return [minLng, minLat, maxLng, maxLat]
}

export function lineStringFeatureCollection(coords: number[][]): GeoJSON.FeatureCollection {
  return coords.length >= 2
    ? featureCollectionFromLines([coords])
    : { type: 'FeatureCollection', features: [] }
}

function normalizeSegmentBend(bend: number | undefined): number {
  if (!Number.isFinite(bend)) return 0
  return Math.max(-1, Math.min(1, bend ?? 0))
}

export function sanitizeSegmentBends(bends: number[] | undefined, edgeCount: number): number[] {
  if (edgeCount <= 0) return []
  const values = Array.from({ length: edgeCount }, (_, index) => {
    const value = normalizeSegmentBend(bends?.[index])
    return Math.abs(value) < 0.08 ? 0 : value
  })
  const nonzeroCount = values.filter(Boolean).length
  const maxExpectedManualBends = Math.max(6, Math.ceil(edgeCount * 0.15))
  return nonzeroCount > maxExpectedManualBends ? Array(edgeCount).fill(0) : values
}

export function bendLineCoords(coords: number[][], bend: number | number[] | undefined, strength = 0.24): number[][] {
  if (coords.length < 2) return coords.map(coord => coord.slice())
  const segmentBends = Array.isArray(bend)
    ? sanitizeSegmentBends(bend, coords.length - 1)
    : Array(Math.max(0, coords.length - 1)).fill(normalizeSegmentBend(bend))
  if (!segmentBends.some(Boolean)) return coords.map(coord => coord.slice())

  const out: number[][] = []
  for (let i = 0; i < coords.length - 1; i++) {
    const direction = segmentBends[i] ?? 0
    const a = coords[i]
    const b = coords[i + 1]
    if (!direction) {
      if (i === 0) out.push(a.slice())
      out.push(b.slice())
      continue
    }
    const midLat = (a[1] + b[1]) / 2
    const lonScale = Math.max(0.2, Math.cos((midLat * Math.PI) / 180))
    const dx = (b[0] - a[0]) * lonScale
    const dy = b[1] - a[1]
    const len = Math.sqrt(dx * dx + dy * dy)
    if (!len) {
      if (i === 0) out.push(a.slice())
      continue
    }

    const offset = len * strength * direction
    const controlLng = (a[0] + b[0]) / 2 + ((-dy / len) * offset) / lonScale
    const controlLat = (a[1] + b[1]) / 2 + (dx / len) * offset
    const steps = 12

    for (let step = 0; step <= steps; step++) {
      if (i > 0 && step === 0) continue
      const t = step / steps
      const inv = 1 - t
      const lng = inv * inv * a[0] + 2 * inv * t * controlLng + t * t * b[0]
      const lat = inv * inv * a[1] + 2 * inv * t * controlLat + t * t * b[1]
      const coord = [lng, lat]
      if (a[2] != null || b[2] != null) {
        coord.push((a[2] ?? b[2] ?? 0) * inv + (b[2] ?? a[2] ?? 0) * t)
      }
      out.push(coord)
    }
  }

  return out
}

export function bendSegmentGeojson(
  geojson: GeoJSON.FeatureCollection,
  bend: number | undefined,
  bends?: number[],
): GeoJSON.FeatureCollection {
  const hasBend = bends?.some(value => normalizeSegmentBend(value) !== 0) || normalizeSegmentBend(bend) !== 0
  if (!hasBend) return geojson
  return {
    ...geojson,
    features: geojson.features.map(feature => {
      const g = feature.geometry
      if (g.type === 'LineString') {
        return { ...feature, geometry: { ...g, coordinates: bendLineCoords(g.coordinates, bends ?? bend) } }
      }
      if (g.type === 'MultiLineString') {
        return { ...feature, geometry: { ...g, coordinates: g.coordinates.map(line => bendLineCoords(line, bends ?? bend)) } }
      }
      return feature
    }),
  }
}

export function normalizeLineCoords(geojson: GeoJSON.FeatureCollection): number[][] {
  return getAllRouteCoords(geojson).map(coord => [coord[0], coord[1], ...(coord[2] != null ? [coord[2]] : [])])
}

export function buildGeometryBackedSegmentPatch(coords: number[][]): Pick<TrailSegment, 'geojson' | 'bbox' | 'stats' | 'section_start' | 'section_end'> {
  const bbox = bboxForCoords(coords)
  return {
    geojson: lineStringFeatureCollection(coords),
    ...(bbox ? { bbox } : {}),
    stats: routeStatsForCoords(coords),
    section_start: 0,
    section_end: 100,
  }
}

export function extendSegmentCoordinates(
  segment: TrailSegment,
  points: number[][],
  end: 'start' | 'end',
): number[][] {
  const existing = segment.geojson ? normalizeLineCoords(segment.geojson) : []
  const cleanPoints = points.map(coord => [coord[0], coord[1], ...(coord[2] != null ? [coord[2]] : [])])
  if (!existing.length) return cleanPoints
  if (!cleanPoints.length) return existing

  return end === 'start'
    ? [...cleanPoints.slice().reverse(), ...existing]
    : [...existing, ...cleanPoints]
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

function routeStatsForLineGroups(lines: number[][][]): RouteStats {
  let distanceKm = 0
  let elevationGainM = 0
  let elevationLossM = 0
  let maxElevationM = -Infinity
  let minElevationM = Infinity
  let hasElevation = false

  for (const line of lines) {
    for (let i = 1; i < line.length; i++) {
      distanceKm += distanceMeters(line[i - 1], line[i]) / 1000

      const prev = line[i - 1][2]
      const next = line[i][2]
      if (Number.isFinite(prev) && Number.isFinite(next)) {
        const delta = next - prev
        if (delta > 0) elevationGainM += delta
        else elevationLossM += Math.abs(delta)
      }
    }

    for (const coord of line) {
      const elevation = coord[2]
      if (!Number.isFinite(elevation)) continue
      hasElevation = true
      if (elevation > maxElevationM) maxElevationM = elevation
      if (elevation < minElevationM) minElevationM = elevation
    }
  }

  return {
    distance_km: Math.round(distanceKm * 100) / 100,
    elevation_gain_m: hasElevation ? Math.round(elevationGainM) : 0,
    elevation_loss_m: hasElevation ? Math.round(elevationLossM) : 0,
    max_elevation_m: hasElevation ? Math.round(maxElevationM) : 0,
    min_elevation_m: hasElevation ? Math.round(minElevationM) : 0,
    activity_type: 'drawn',
  }
}

function lineGroupsForFeature(feature: GeoJSON.Feature): number[][][] {
  const geometry = feature.geometry
  if (!geometry) return []
  if (geometry.type === 'LineString') return geometry.coordinates.length >= 2 ? [geometry.coordinates] : []
  if (geometry.type === 'MultiLineString') return geometry.coordinates.filter(line => line.length >= 2)
  return []
}

/**
 * Extract named tracks from a multi-track GeoJSON (produced by @tmcw/togeojson).
 * Each <trk> with a <name> becomes a geometry-backed TrailSegment using that
 * feature's exact coordinates. This keeps imported Trailforks-style trail
 * networks from being reconstructed later as inaccurate route-percentage slices.
 *
 * Returns [] when there is only one (or zero) named tracks — no auto-segmentation needed.
 */
export function extractNamedTrackSegments(geojson: GeoJSON.FeatureCollection): TrailSegment[] {
  const namedFeatures = geojson.features
    .map(feature => ({ feature, lines: lineGroupsForFeature(feature) }))
    .filter(({ feature, lines }) => feature.properties?.name && lines.length > 0)
  if (namedFeatures.length <= 1) return []

  return namedFeatures.map(({ feature, lines }, i) => {
    const coords = lines.flat()
    const bbox = bboxForCoords(coords)
    return {
      id: Math.random().toString(36).slice(2, 10),
      name: String(feature.properties!.name).trim(),
      color: SEGMENT_COLORS[i % SEGMENT_COLORS.length],
      visible: true,
      source: 'uploaded-track',
      geojson: featureCollectionFromLines(lines),
      ...(bbox ? { bbox } : {}),
      stats: routeStatsForLineGroups(lines),
      section_start: 0,
      section_end: 100,
      width: DEFAULT_TRAIL_SEGMENT_WIDTH,
      opacity: 0.9,
      smooth: 0,
      bend: 0,
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
  gapThresholdMeters = DEFAULT_COORD_GAP_THRESHOLD_METERS,
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
    gapThresholdMeters,
  )

  const lines: number[][][] = []
  let cursor = start
  for (const [blockStart, blockEnd] of blocked) {
    if (blockStart > cursor) {
      lines.push(...splitCoordsOnGaps(allCoords.slice(cursor, blockStart), gapThresholdMeters))
    }
    cursor = Math.max(cursor, blockEnd)
  }
  if (cursor < end) {
    lines.push(...splitCoordsOnGaps(allCoords.slice(cursor, end), gapThresholdMeters))
  }

  if (lines.length === 0) {
    return { type: 'FeatureCollection', features: [] }
  }

  return featureCollectionFromLines(lines)
}

export function segmentSourceGeojson(
  primaryRoute: GeoJSON.FeatureCollection,
  segment: TrailSegment,
): GeoJSON.FeatureCollection {
  if ((segment.source === 'uploaded-track' || segment.source === 'drawn-track') && segment.geojson) {
    return segment.geojson
  }
  return primaryRoute
}

export function resolveTrailSegmentGeojson(
  primaryRoute: GeoJSON.FeatureCollection,
  segment: TrailSegment,
  deletedRanges: DeletedRange[] = [],
): GeoJSON.FeatureCollection {
  const source = segmentSourceGeojson(primaryRoute, segment)
  const isGeometryBacked = segment.source === 'uploaded-track' || segment.source === 'drawn-track'
  if (isGeometryBacked) {
    return sliceGeometryBackedSegmentGeojson(source, segment.section_start, segment.section_end)
  }

  return sliceRouteByPercent(
    source,
    segment.section_start,
    segment.section_end,
    deletedRanges,
    DEFAULT_COORD_GAP_THRESHOLD_METERS,
  )
}

export function isGeometryBackedSegment(segment: TrailSegment): boolean {
  return Boolean(segment.geojson && (segment.source === 'uploaded-track' || segment.source === 'drawn-track'))
}

export function trailSegmentEndpointFeatures(
  segmentGeojson: GeoJSON.FeatureCollection,
  color: string,
): GeoJSON.Feature[] {
  const coords = segmentGeojson.features.flatMap(feature => {
    const geometry = feature.geometry
    if (geometry.type === 'LineString') return geometry.coordinates
    if (geometry.type === 'MultiLineString') return geometry.coordinates.flat()
    return []
  })

  if (coords.length < 2) return []
  return [
    { type: 'Feature', geometry: { type: 'Point', coordinates: coords[0] }, properties: { color } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: coords[coords.length - 1] }, properties: { color } },
  ]
}

export function unionBboxes(
  bboxes: Array<[number, number, number, number] | null | undefined>,
): [number, number, number, number] | null {
  const valid = bboxes.filter((bbox): bbox is [number, number, number, number] => {
    if (!bbox || bbox.length !== 4) return false
    const [minLng, minLat, maxLng, maxLat] = bbox
    return [minLng, minLat, maxLng, maxLat].every(Number.isFinite) && minLng <= maxLng && minLat <= maxLat
  })
  if (!valid.length) return null

  return valid.reduce<[number, number, number, number]>((acc, bbox) => [
    Math.min(acc[0], bbox[0]),
    Math.min(acc[1], bbox[1]),
    Math.max(acc[2], bbox[2]),
    Math.max(acc[3], bbox[3]),
  ], [...valid[0]] as [number, number, number, number])
}

export function bboxContainsBbox(
  outer: [number, number, number, number],
  inner: [number, number, number, number],
): boolean {
  return outer[0] <= inner[0] && outer[1] <= inner[1] && outer[2] >= inner[2] && outer[3] >= inner[3]
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
  relief = 0.65,
  allowGeometryFallback = false,
): { svgPath: string; strokePath: string; minElev: number; maxElev: number; synthetic?: boolean } | null {
  const coords = getAllRouteCoords(geojson)
  const elevations = coords.map(c => c[2] ?? 0).filter(e => e !== 0)
  const sourceValues = elevations.length >= 10
    ? elevations
    : allowGeometryFallback
      ? routeGeometryProfileValues(coords)
      : []
  if (sourceValues.length < 10) return null

  const step = Math.max(1, Math.floor(sourceValues.length / samples))
  const sampled: number[] = []
  for (let i = 0; i < sourceValues.length; i += step) sampled.push(sourceValues[i])
  if (sampled[sampled.length - 1] !== sourceValues[sourceValues.length - 1]) {
    sampled.push(sourceValues[sourceValues.length - 1])
  }

  const minElev = Math.min(...sampled)
  const maxElev = Math.max(...sampled)
  const range = maxElev - minElev || 1
  const TOP_MARGIN = 8  // % of viewbox height reserved at top
  const reliefScale = Math.min(1, Math.max(0.35, Number.isFinite(relief) ? relief : 0.65))

  const n = sampled.length
  const pts = sampled.map((e, i) => {
    const x = parseFloat(((i / (n - 1)) * 1000).toFixed(1))
    const fullHeightY = TOP_MARGIN + ((maxElev - e) / range) * (100 - TOP_MARGIN)
    const y = parseFloat((100 - ((100 - fullHeightY) * reliefScale)).toFixed(2))
    return `${x},${y}`
  })

  const strokePath = `M ${pts.join(' L ')}`
  const svgPath = `M 0,100 L ${pts.join(' L ')} L 1000,100 Z`

  return { svgPath, strokePath, minElev, maxElev, synthetic: elevations.length < 10 }
}

function routeGeometryProfileValues(coords: number[][]): number[] {
  if (coords.length < 2) return []
  const source = coords.length >= 10
    ? coords
    : Array.from({ length: 24 }, (_, index) => coords[Math.round((index / 23) * (coords.length - 1))])
  const lngs = source.map(coord => coord[0])
  const lats = source.map(coord => coord[1])
  const minLng = Math.min(...lngs)
  const maxLng = Math.max(...lngs)
  const minLat = Math.min(...lats)
  const maxLat = Math.max(...lats)
  const lngSpan = Math.max(0.000001, maxLng - minLng)
  const latSpan = Math.max(0.000001, maxLat - minLat)
  return source.map((coord, index) => {
    const x = (coord[0] - minLng) / lngSpan
    const y = (coord[1] - minLat) / latSpan
    const turn = index > 0 && index < source.length - 1
      ? Math.abs((source[index + 1][0] - coord[0]) * (coord[1] - source[index - 1][1]) - (source[index + 1][1] - coord[1]) * (coord[0] - source[index - 1][0]))
      : 0
    return 100 + (y * 56) + (x * 22) + Math.min(18, turn * 800000)
  })
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
