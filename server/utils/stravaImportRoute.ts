import type { RouteStats } from '~/types'

export interface StravaImportActivity {
  name: string
  sport_type: string
  distance: number
  total_elevation_gain: number
  elapsed_time: number
  start_date: string
}

export interface StravaImportStreams {
  latlng?: { data: [number, number][] }
  altitude?: { data: number[] }
}

export const STRAVA_IMPORT_TARGET_POINTS = 90_000
export const STRAVA_IMPORT_MAX_POINTS = 100_000
const STRAVA_IMPORT_MAX_RDP_INPUT_POINTS = 250_000

type RouteCoord = [number, number] | [number, number, number]
type ProjectedPoint = { x: number; y: number }

function projectCoords(coords: RouteCoord[]): ProjectedPoint[] {
  const meanLat = coords.reduce((sum, coord) => sum + coord[1], 0) / Math.max(coords.length, 1)
  const latScale = 111_320
  const lngScale = Math.cos((meanLat * Math.PI) / 180) * latScale
  return coords.map(([lng, lat]) => ({ x: lng * lngScale, y: lat * latScale }))
}

function perpendicularDistanceSq(point: ProjectedPoint, start: ProjectedPoint, end: ProjectedPoint): number {
  const dx = end.x - start.x
  const dy = end.y - start.y
  if (dx === 0 && dy === 0) {
    const px = point.x - start.x
    const py = point.y - start.y
    return px * px + py * py
  }

  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy)))
  const closestX = start.x + t * dx
  const closestY = start.y + t * dy
  const px = point.x - closestX
  const py = point.y - closestY
  return px * px + py * py
}

function simplifyRdp(coords: RouteCoord[], toleranceMeters: number): RouteCoord[] {
  if (coords.length <= 2) return coords

  const projected = projectCoords(coords)
  const keep = new Uint8Array(coords.length)
  keep[0] = 1
  keep[coords.length - 1] = 1

  const toleranceSq = toleranceMeters * toleranceMeters
  const stack: Array<[number, number]> = [[0, coords.length - 1]]

  while (stack.length) {
    const [start, end] = stack.pop()!
    let maxDistanceSq = -1
    let index = -1

    for (let i = start + 1; i < end; i++) {
      const distanceSq = perpendicularDistanceSq(projected[i], projected[start], projected[end])
      if (distanceSq > maxDistanceSq) {
        maxDistanceSq = distanceSq
        index = i
      }
    }

    if (index > -1 && maxDistanceSq > toleranceSq) {
      keep[index] = 1
      stack.push([start, index], [index, end])
    }
  }

  return coords.filter((_, index) => keep[index] === 1)
}

function sampleWithEndpoints(coords: RouteCoord[], targetPoints: number): RouteCoord[] {
  if (coords.length <= targetPoints) return coords
  if (targetPoints <= 2) return [coords[0], coords[coords.length - 1]]

  const sampled: RouteCoord[] = []
  const step = (coords.length - 1) / (targetPoints - 1)
  let previousIndex = -1

  for (let i = 0; i < targetPoints; i++) {
    const index = Math.min(coords.length - 1, Math.round(i * step))
    if (index !== previousIndex) {
      sampled.push(coords[index])
      previousIndex = index
    }
  }

  if (sampled.at(-1) !== coords.at(-1)) sampled.push(coords[coords.length - 1])
  return sampled
}

function removeConsecutiveDuplicateCoords(coords: RouteCoord[]): RouteCoord[] {
  return coords.filter((coord, index) => {
    if (index === 0) return true
    const previous = coords[index - 1]
    return coord[0] !== previous[0] || coord[1] !== previous[1]
  })
}

export function simplifyStravaCoordinates(coords: RouteCoord[]): RouteCoord[] {
  const deduped = removeConsecutiveDuplicateCoords(coords)
  if (deduped.length <= STRAVA_IMPORT_MAX_POINTS) return deduped

  const boundedInput = sampleWithEndpoints(deduped, STRAVA_IMPORT_MAX_RDP_INPUT_POINTS)
  let low = 0
  let high = 100
  let best = sampleWithEndpoints(boundedInput, STRAVA_IMPORT_TARGET_POINTS)

  for (let i = 0; i < 16; i++) {
    const tolerance = (low + high) / 2
    const simplified = simplifyRdp(boundedInput, tolerance)
    if (simplified.length > STRAVA_IMPORT_MAX_POINTS) {
      low = tolerance
    } else {
      high = tolerance
      best = simplified
    }
  }

  if (best.length > STRAVA_IMPORT_MAX_POINTS) {
    return sampleWithEndpoints(best, STRAVA_IMPORT_TARGET_POINTS)
  }

  return best
}

export function buildStravaImportRoute(activity: StravaImportActivity, streams: StravaImportStreams): {
  geojson: GeoJSON.FeatureCollection
  bbox: [number, number, number, number]
  stats: RouteStats
  sourcePointCount: number
  importedPointCount: number
} {
  const latlngData = streams.latlng?.data ?? []
  const altitudeData = streams.altitude?.data ?? []

  const sourceCoordinates = latlngData.map(([lat, lng], i) => {
    const alt = altitudeData[i]
    return (alt !== undefined ? [lng, lat, alt] : [lng, lat]) as RouteCoord
  })
  const coordinates = simplifyStravaCoordinates(sourceCoordinates)

  let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity
  for (const [lng, lat] of coordinates) {
    if (lng < minLng) minLng = lng
    if (lat < minLat) minLat = lat
    if (lng > maxLng) maxLng = lng
    if (lat > maxLat) maxLat = lat
  }

  const elevations = altitudeData.filter((e) => e !== undefined)
  let elevationLoss = 0
  let maxElevation = -Infinity
  let minElevation = Infinity
  for (const elevation of elevations) {
    if (elevation > maxElevation) maxElevation = elevation
    if (elevation < minElevation) minElevation = elevation
  }
  for (let i = 1; i < elevations.length; i++) {
    const diff = elevations[i] - elevations[i - 1]
    if (diff < 0) elevationLoss += Math.abs(diff)
  }

  return {
    geojson: {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {
            name: activity.name,
            source: 'strava',
            source_point_count: sourceCoordinates.length,
            imported_point_count: coordinates.length,
          },
          geometry: {
            type: 'LineString',
            coordinates,
          },
        },
      ],
    },
    bbox: [minLng, minLat, maxLng, maxLat],
    stats: {
      distance_km: Math.round((activity.distance / 1000) * 100) / 100,
      elevation_gain_m: Math.round(activity.total_elevation_gain),
      elevation_loss_m: Math.round(elevationLoss),
      max_elevation_m: elevations.length ? Math.round(maxElevation) : 0,
      min_elevation_m: elevations.length ? Math.round(minElevation) : 0,
      duration_seconds: activity.elapsed_time,
      date: activity.start_date,
      activity_type: activity.sport_type,
    },
    sourcePointCount: sourceCoordinates.length,
    importedPointCount: coordinates.length,
  }
}
