import type { LocationMetadata, PremadeMap } from '~/types'
import { geocodeTextToLocation, type GeocodedLocation } from '~/server/utils/locationSearch'

export const DEFAULT_PREMADE_SEARCH_RADIUS_KM = 250
export const MAX_PREMADE_SEARCH_RADIUS_KM = 20000

export interface NearbyPremadeQuery {
  lat: number
  lng: number
  radiusKm: number
}

function firstQueryValue(value: unknown): string | undefined {
  if (Array.isArray(value)) return typeof value[0] === 'string' ? value[0] : undefined
  return typeof value === 'string' ? value : undefined
}

function finiteNumber(value: unknown): number | null {
  const raw = firstQueryValue(value)
  if (!raw?.trim()) return null
  const num = Number(raw)
  return Number.isFinite(num) ? num : null
}

export function parseNearbyPremadeQuery(query: Record<string, unknown>): NearbyPremadeQuery | null {
  const lat = finiteNumber(query.lat)
  const lng = finiteNumber(query.lng)
  if (lat == null && lng == null) return null
  if (lat == null || lng == null || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    throw createError({ statusCode: 400, message: 'Invalid nearby search coordinates' })
  }

  const requestedRadius = finiteNumber(query.radius_km)
  const radiusKm = Math.min(
    Math.max(requestedRadius ?? DEFAULT_PREMADE_SEARCH_RADIUS_KM, 1),
    MAX_PREMADE_SEARCH_RADIUS_KM,
  )
  return { lat, lng, radiusKm }
}

export function parsePremadeSearchText(query: Record<string, unknown>): string | null {
  const q = firstQueryValue(query.q)?.trim()
  return q ? q.slice(0, 160) : null
}

export async function geocodePremadeSearchText(q: string): Promise<GeocodedLocation | null> {
  return await geocodeTextToLocation(q)
}

export function distanceMetersBetween(a: Pick<LocationMetadata, 'location_lat' | 'location_lng'>, b: { lat: number; lng: number }): number | null {
  if (typeof a.location_lat !== 'number' || typeof a.location_lng !== 'number') return null
  const lat1 = toRadians(a.location_lat)
  const lat2 = toRadians(b.lat)
  const dLat = toRadians(b.lat - a.location_lat)
  const dLng = toRadians(b.lng - a.location_lng)
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2)
  return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
}

export function sortPremadeMapsByDistance(maps: PremadeMap[], near: NearbyPremadeQuery): PremadeMap[] {
  const radiusMeters = near.radiusKm * 1000
  return maps
    .map((map) => {
      const distance = distanceMetersBetween(map, near)
      return distance == null ? map : { ...map, distance_meters: distance }
    })
    .filter((map) => typeof map.distance_meters === 'number' && map.distance_meters <= radiusMeters)
    .sort((a, b) => (a.distance_meters ?? Number.POSITIVE_INFINITY) - (b.distance_meters ?? Number.POSITIVE_INFINITY))
}

function toRadians(value: number): number {
  return value * Math.PI / 180
}
