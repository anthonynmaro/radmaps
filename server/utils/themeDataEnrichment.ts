import sharp from 'sharp'

import type { RouteStats } from '~/types'
import { bboxCenter } from '~/utils/premadeCatalog'

export interface CachedLocationMetadata {
  location_label: string | null
  location_city: string | null
  location_region: string | null
  location_country: string | null
  location_lng: number | null
  location_lat: number | null
  location_elevation_m: number | null
  location_metadata_source: string | null
  location_metadata_enriched_at: string | null
}

export interface EnrichThemeLocationInput {
  title?: string | null
  stats?: Partial<RouteStats> | null
  bbox?: [number, number, number, number] | number[] | null
  location_label?: string | null
  location_city?: string | null
  location_region?: string | null
  location_country?: string | null
  location_lng?: number | null
  location_lat?: number | null
}

type ReverseGeocodeResult = Pick<CachedLocationMetadata, 'location_label' | 'location_city' | 'location_region' | 'location_country'>

const TERRARIUM_ZOOM = 12
const TILE_SIZE = 256

function cleanText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function finiteLngLat(lng: unknown, lat: unknown): { lng: number, lat: number } | null {
  const parsedLng = typeof lng === 'number' ? lng : Number(lng)
  const parsedLat = typeof lat === 'number' ? lat : Number(lat)
  if (!Number.isFinite(parsedLng) || !Number.isFinite(parsedLat)) return null
  if (parsedLng < -180 || parsedLng > 180 || parsedLat < -90 || parsedLat > 90) return null
  return { lng: parsedLng, lat: parsedLat }
}

function normalizeBbox(value: EnrichThemeLocationInput['bbox']): [number, number, number, number] | null {
  if (!Array.isArray(value) || value.length !== 4) return null
  const bbox = value.map(Number) as [number, number, number, number]
  const [minLng, minLat, maxLng, maxLat] = bbox
  if (![minLng, minLat, maxLng, maxLat].every(Number.isFinite)) return null
  if (minLng >= maxLng || minLat >= maxLat) return null
  if (minLng < -180 || maxLng > 180 || minLat < -90 || maxLat > 90) return null
  return bbox
}

function baseLocationMetadata(input: EnrichThemeLocationInput): CachedLocationMetadata {
  const bbox = normalizeBbox(input.bbox)
  const center = bbox ? bboxCenter(bbox) : null
  const coords = finiteLngLat(input.location_lng, input.location_lat)
    ?? finiteLngLat(center?.[0], center?.[1])

  return {
    location_label: cleanText(input.location_label) ?? cleanText(input.stats?.location) ?? null,
    location_city: cleanText(input.location_city),
    location_region: cleanText(input.location_region),
    location_country: cleanText(input.location_country),
    location_lng: coords?.lng ?? null,
    location_lat: coords?.lat ?? null,
    location_elevation_m: null,
    location_metadata_source: null,
    location_metadata_enriched_at: null,
  }
}

function mapboxToken(): string | null {
  return process.env.MAPBOX_TOKEN?.trim() || null
}

function mapboxReverseUrl(lng: number, lat: number): URL | null {
  const token = mapboxToken()
  if (!token) return null
  const url = new URL('https://api.mapbox.com/search/geocode/v6/reverse')
  url.searchParams.set('longitude', String(lng))
  url.searchParams.set('latitude', String(lat))
  url.searchParams.set('language', 'en')
  url.searchParams.set('permanent', 'true')
  url.searchParams.set('access_token', token)
  return url
}

function contextName(value: any): string | null {
  return typeof value?.name === 'string' && value.name.trim() ? value.name.trim() : null
}

export function normalizeReverseGeocodeResponse(response: any): ReverseGeocodeResult | null {
  const features = Array.isArray(response?.features) ? response.features : []
  if (!features.length) return null

  let label: string | null = null
  let city: string | null = null
  let region: string | null = null
  let country: string | null = null

  for (const feature of features) {
    const properties = feature?.properties ?? {}
    const context = properties.context ?? {}
    label ??= cleanText(properties.full_address) ?? cleanText(properties.name)
    city ??= contextName(context.place) ?? contextName(context.locality)
    region ??= contextName(context.region)
    country ??= contextName(context.country)

    const featureType = cleanText(properties.feature_type)
    if (featureType === 'place' || featureType === 'locality') city ??= cleanText(properties.name)
    if (featureType === 'region') region ??= cleanText(properties.name)
    if (featureType === 'country') country ??= cleanText(properties.name)
  }

  return { location_label: label, location_city: city, location_region: region, location_country: country }
}

export async function reverseGeocodeCachedLocation(lng: number, lat: number): Promise<ReverseGeocodeResult | null> {
  const url = mapboxReverseUrl(lng, lat)
  if (!url) return null

  try {
    const response = await $fetch<any>(url.toString())
    return normalizeReverseGeocodeResponse(response)
  } catch {
    return null
  }
}

export function terrariumTileForLngLat(lng: number, lat: number, zoom = TERRARIUM_ZOOM) {
  const clampedLat = Math.max(-85.05112878, Math.min(85.05112878, lat))
  const n = 2 ** zoom
  const xFloat = ((lng + 180) / 360) * n
  const latRad = (clampedLat * Math.PI) / 180
  const yFloat = ((1 - Math.log(Math.tan(latRad) + (1 / Math.cos(latRad))) / Math.PI) / 2) * n
  const x = Math.max(0, Math.min(n - 1, Math.floor(xFloat)))
  const y = Math.max(0, Math.min(n - 1, Math.floor(yFloat)))
  const pixelX = Math.max(0, Math.min(TILE_SIZE - 1, Math.floor((xFloat - x) * TILE_SIZE)))
  const pixelY = Math.max(0, Math.min(TILE_SIZE - 1, Math.floor((yFloat - y) * TILE_SIZE)))
  return { z: zoom, x, y, pixelX, pixelY }
}

export function decodeTerrariumElevationMeters(r: number, g: number, b: number): number {
  return (r * 256 + g + b / 256) - 32768
}

export async function lookupTerrariumElevation(lng: number, lat: number): Promise<number | null> {
  const tile = terrariumTileForLngLat(lng, lat)
  const url = `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${tile.z}/${tile.x}/${tile.y}.png`

  try {
    const response = await fetch(url)
    if (!response.ok) return null
    const buffer = Buffer.from(await response.arrayBuffer())
    const image = sharp(buffer)
    const metadata = await image.metadata()
    if (!metadata.width || !metadata.height) return null
    const pixelX = Math.min(metadata.width - 1, tile.pixelX)
    const pixelY = Math.min(metadata.height - 1, tile.pixelY)
    const raw = await image.ensureAlpha().raw().toBuffer()
    const offset = ((pixelY * metadata.width) + pixelX) * 4
    const elevation = decodeTerrariumElevationMeters(raw[offset], raw[offset + 1], raw[offset + 2])
    return Number.isFinite(elevation) ? Math.round(elevation) : null
  } catch {
    return null
  }
}

export async function enrichThemeLocationMetadata(input: EnrichThemeLocationInput): Promise<CachedLocationMetadata> {
  const base = baseLocationMetadata(input)
  if (base.location_lng == null || base.location_lat == null) return base

  const [reverse, elevation] = await Promise.all([
    reverseGeocodeCachedLocation(base.location_lng, base.location_lat),
    lookupTerrariumElevation(base.location_lng, base.location_lat),
  ])
  const enriched = {
    ...base,
    location_label: base.location_label ?? reverse?.location_label ?? null,
    location_city: base.location_city ?? reverse?.location_city ?? null,
    location_region: base.location_region ?? reverse?.location_region ?? null,
    location_country: base.location_country ?? reverse?.location_country ?? null,
    location_elevation_m: elevation,
  }
  const changed = Boolean(reverse || elevation != null)
  return {
    ...enriched,
    location_metadata_source: changed ? [
      reverse ? 'mapbox-geocoding-v6-reverse' : '',
      elevation != null ? 'terrarium-dem-z12' : '',
    ].filter(Boolean).join('+') : null,
    location_metadata_enriched_at: changed ? new Date().toISOString() : null,
  }
}
