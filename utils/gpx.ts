import { gpx } from '@tmcw/togeojson'
import { DOMParser as NodeDOMParser } from '@xmldom/xmldom'
import type { RouteStats } from '~/types'

export const GPX_MAX_BYTES = 5 * 1024 * 1024

function assertSafeGpxText(gpxString: string) {
  const bytes = new TextEncoder().encode(gpxString).byteLength
  if (bytes > GPX_MAX_BYTES) {
    throw new Error('GPX file too large (max 5 MB)')
  }
  if (/<!DOCTYPE|<!ENTITY/i.test(gpxString)) {
    throw new Error('GPX files with DOCTYPE or ENTITY declarations are not supported')
  }
}

function hasParserError(dom: Document): boolean {
  return dom.getElementsByTagName('parsererror').length > 0
}

function finishParsedGpx(geojson: GeoJSON.FeatureCollection): {
  geojson: GeoJSON.FeatureCollection
  bbox: [number, number, number, number]
  stats: RouteStats
  trackName?: string
} {
  const coords: [number, number, number][] = []

  for (const feature of geojson.features) {
    if (feature.geometry.type === 'LineString') {
      coords.push(...(feature.geometry.coordinates as [number, number, number][]))
    } else if (feature.geometry.type === 'MultiLineString') {
      for (const line of feature.geometry.coordinates) {
        coords.push(...(line as [number, number, number][]))
      }
    }
  }

  if (coords.length === 0) {
    throw new Error('No track coordinates found in GPX file')
  }

  // Compute bounding box
  let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity
  for (const [lng, lat] of coords) {
    if (lng < minLng) minLng = lng
    if (lat < minLat) minLat = lat
    if (lng > maxLng) maxLng = lng
    if (lat > maxLat) maxLat = lat
  }

  // Compute distance (Haversine)
  let distanceKm = 0
  for (let i = 1; i < coords.length; i++) {
    distanceKm += haversineKm(coords[i - 1], coords[i])
  }

  // Compute elevation stats
  const elevations = coords.map(c => c[2] ?? 0).filter(e => e !== 0)
  let elevationGain = 0
  let elevationLoss = 0
  for (let i = 1; i < elevations.length; i++) {
    const diff = elevations[i] - elevations[i - 1]
    if (diff > 0) elevationGain += diff
    else elevationLoss += Math.abs(diff)
  }

  const stats: RouteStats = {
    distance_km: Math.round(distanceKm * 100) / 100,
    elevation_gain_m: Math.round(elevationGain),
    elevation_loss_m: Math.round(elevationLoss),
    max_elevation_m: elevations.length ? Math.round(Math.max(...elevations)) : 0,
    min_elevation_m: elevations.length ? Math.round(Math.min(...elevations)) : 0,
  }

  const trackName = (geojson.features[0]?.properties?.name as string | undefined)?.trim() || undefined

  return {
    geojson,
    bbox: [minLng, minLat, maxLng, maxLat],
    stats,
    trackName,
  }
}

/**
 * Parse a GPX string into GeoJSON and compute basic route stats.
 */
export function parseGpx(gpxString: string): {
  geojson: GeoJSON.FeatureCollection
  bbox: [number, number, number, number]
  stats: RouteStats
  trackName?: string
} {
  assertSafeGpxText(gpxString)
  const parser = new DOMParser()
  const dom = parser.parseFromString(gpxString, 'text/xml')
  if (hasParserError(dom)) {
    throw new Error('Malformed GPX XML')
  }
  const geojson = gpx(dom)
  return finishParsedGpx(geojson)
}

function haversineKm(
  [lng1, lat1]: [number, number, number],
  [lng2, lat2]: [number, number, number],
): number {
  const R = 6371
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180
}

/**
 * Server-side GPX parsing using the maintained Node.js DOMParser polyfill.
 * Use in server API routes. Client should call parseGpx() above.
 */
export function parseGpxServer(gpxString: string) {
  assertSafeGpxText(gpxString)
  let parseError: string | null = null
  const parser = new NodeDOMParser({
    onError: (level, message) => {
      if (level !== 'warning') {
        parseError = message
      }
    },
  })
  let dom: Document
  try {
    dom = parser.parseFromString(gpxString, 'text/xml') as unknown as Document
  } catch (err) {
    throw new Error(`Malformed GPX XML: ${(err as Error).message}`)
  }
  if (parseError || hasParserError(dom)) {
    throw new Error(`Malformed GPX XML${parseError ? `: ${parseError}` : ''}`)
  }
  const geojson = gpx(dom as unknown as Document)
  return finishParsedGpx(geojson)
}
