import { gpx } from '@tmcw/togeojson'
import type { RouteStats } from '~/types'

/**
 * Parse a GPX string into GeoJSON and compute basic route stats.
 */
export function parseGpx(gpxString: string): {
  geojson: GeoJSON.FeatureCollection
  bbox: [number, number, number, number]
  stats: RouteStats
} {
  const parser = new DOMParser()
  const dom = parser.parseFromString(gpxString, 'text/xml')
  const geojson = gpx(dom)

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

  return {
    geojson,
    bbox: [minLng, minLat, maxLng, maxLat],
    stats,
  }
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
 * Server-side GPX parsing using the Node.js DOMParser polyfill.
 * Use in server API routes. Client should call parseGpx() above.
 */
export function parseGpxServer(gpxString: string) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { DOMParser } = require('xmldom') as typeof import('xmldom')
  const parser = new DOMParser()
  const dom = parser.parseFromString(gpxString, 'text/xml')
  const geojson = gpx(dom as unknown as Document)

  // Same logic as parseGpx — kept server-safe (no browser APIs)
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

  if (coords.length === 0) throw new Error('No track coordinates found in GPX file')

  let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity
  for (const [lng, lat] of coords) {
    if (lng < minLng) minLng = lng; if (lat < minLat) minLat = lat
    if (lng > maxLng) maxLng = lng; if (lat > maxLat) maxLat = lat
  }

  let distanceKm = 0
  for (let i = 1; i < coords.length; i++) distanceKm += haversineKm(coords[i - 1], coords[i])

  const elevations = coords.map(c => c[2] ?? 0).filter(e => e !== 0)
  let elevationGain = 0, elevationLoss = 0
  for (let i = 1; i < elevations.length; i++) {
    const diff = elevations[i] - elevations[i - 1]
    if (diff > 0) elevationGain += diff; else elevationLoss += Math.abs(diff)
  }

  return {
    geojson,
    bbox: [minLng, minLat, maxLng, maxLat] as [number, number, number, number],
    stats: {
      distance_km: Math.round(distanceKm * 100) / 100,
      elevation_gain_m: Math.round(elevationGain),
      elevation_loss_m: Math.round(elevationLoss),
      max_elevation_m: elevations.length ? Math.round(Math.max(...elevations)) : 0,
      min_elevation_m: elevations.length ? Math.round(Math.min(...elevations)) : 0,
    } as RouteStats,
  }
}
