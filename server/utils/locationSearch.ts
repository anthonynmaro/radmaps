import { createError } from 'h3'

export type LocationFeatureType = 'poi' | 'place' | 'locality' | 'region' | 'district' | 'address'

export interface LocationSearchContext {
  country?: string
  region?: string
  place?: string
  locality?: string
  neighborhood?: string
  postcode?: string
}

export interface LocationSuggestion {
  id: string
  name: string
  label: string
  featureType: LocationFeatureType
  categories: string[]
  context: LocationSearchContext
}

export interface LocationSearchResult extends LocationSuggestion {
  lng: number
  lat: number
  bbox?: [number, number, number, number]
  suggestedZoom: number
}

export interface GeocodedLocation {
  lat: number
  lng: number
  label?: string
}

const LOCATION_SEARCH_TYPES = 'poi,place,locality,region,district,address'
const PREMADE_GEOCODING_TYPES = 'place,locality,region,district,address,postcode'
const OUTDOOR_TERMS = ['trailhead', 'trail', 'mountain bike', 'mtb', 'park', 'outdoors', 'parking']
const SUPPORTED_LOCATION_TYPES = new Set<LocationFeatureType>(['poi', 'place', 'locality', 'region', 'district', 'address'])

function firstValue(value: unknown): string | undefined {
  if (Array.isArray(value)) return typeof value[0] === 'string' ? value[0] : undefined
  return typeof value === 'string' ? value : undefined
}

export function parseLocationSearchText(value: unknown, maxLength = 160): string | null {
  const q = firstValue(value)?.trim()
  return q ? q.slice(0, maxLength) : null
}

export function parseMapboxSessionToken(value: unknown): string {
  const token = firstValue(value)?.trim()
  if (!token || token.length > 120) {
    throw createError({ statusCode: 400, message: 'Invalid location search session' })
  }
  return token
}

export function parseLocationCountry(value: unknown): string {
  const country = firstValue(value)?.trim().toUpperCase()
  if (!country) return 'US'
  if (!/^[A-Z]{2}(,[A-Z]{2})*$/.test(country)) {
    throw createError({ statusCode: 400, message: 'Invalid location search country' })
  }
  return country
}

export function parseLngLatParam(value: unknown): [number, number] | null {
  const raw = firstValue(value)
  if (!raw) return null
  const parts = raw.split(',')
  if (parts.length !== 2) {
    throw createError({ statusCode: 400, message: 'Invalid location search proximity' })
  }
  const [lngRaw, latRaw] = parts
  const lng = Number(lngRaw)
  const lat = Number(latRaw)
  if (!Number.isFinite(lng) || !Number.isFinite(lat) || lng < -180 || lng > 180 || lat < -90 || lat > 90) {
    throw createError({ statusCode: 400, message: 'Invalid location search proximity' })
  }
  return [lng, lat]
}

export function parseBboxParam(value: unknown): [number, number, number, number] | null {
  const raw = firstValue(value)
  if (!raw) return null
  const parts = raw.split(',').map(Number)
  if (parts.length !== 4) {
    throw createError({ statusCode: 400, message: 'Invalid location search bbox' })
  }
  const bbox = parts as [number, number, number, number]
  if (!validBbox(bbox)) {
    throw createError({ statusCode: 400, message: 'Invalid location search bbox' })
  }
  return bbox
}

export function normalizeLocationSuggestion(raw: any): LocationSuggestion | null {
  const id = typeof raw?.mapbox_id === 'string' ? raw.mapbox_id : ''
  const name = typeof raw?.name === 'string' ? raw.name : ''
  const featureType = normalizeFeatureType(raw?.feature_type)
  if (!id || !name || !featureType) return null

  return {
    id,
    name,
    label: displayLabel(raw),
    featureType,
    categories: normalizeCategories(raw?.poi_category ?? raw?.poi_category_ids),
    context: normalizeContext(raw?.context),
  }
}

export function normalizeLocationFeature(raw: any): LocationSearchResult | null {
  const properties = raw?.properties ?? {}
  const base = normalizeLocationSuggestion({
    ...properties,
    mapbox_id: properties.mapbox_id ?? raw?.id,
  })
  if (!base) return null

  const coordinates = properties.coordinates
  const lng = Number(coordinates?.longitude ?? raw?.geometry?.coordinates?.[0])
  const lat = Number(coordinates?.latitude ?? raw?.geometry?.coordinates?.[1])
  if (!Number.isFinite(lng) || !Number.isFinite(lat) || lng < -180 || lng > 180 || lat < -90 || lat > 90) {
    return null
  }

  const bbox = normalizeBbox(raw?.bbox)
  return {
    ...base,
    lng,
    lat,
    ...(bbox ? { bbox } : {}),
    suggestedZoom: suggestedZoomForFeature(base.featureType),
  }
}

export function rankLocationSuggestions(query: string, suggestions: LocationSuggestion[]): LocationSuggestion[] {
  const normalizedQuery = query.toLowerCase()
  const queryTokens = normalizedQuery.split(/[^a-z0-9]+/).filter(Boolean)

  return suggestions
    .map((suggestion, index) => ({
      suggestion,
      score: locationSuggestionScore(normalizedQuery, queryTokens, suggestion, index),
    }))
    .sort((a, b) => b.score - a.score)
    .map(({ suggestion }) => suggestion)
}

export async function suggestLocations(options: {
  q: string
  sessionToken: string
  country?: string
  proximity?: [number, number] | null
  bbox?: [number, number, number, number] | null
}): Promise<LocationSuggestion[]> {
  const url = mapboxUrl('https://api.mapbox.com/search/searchbox/v1/suggest', {
    q: options.q,
    session_token: options.sessionToken,
    limit: '6',
    language: 'en',
    country: options.country ?? 'US',
    types: LOCATION_SEARCH_TYPES,
    ...(options.proximity ? { proximity: options.proximity.join(',') } : {}),
    ...(options.bbox ? { bbox: options.bbox.join(',') } : {}),
  })

  const response = await $fetch<any>(url.toString())
  const suggestions = Array.isArray(response?.suggestions)
    ? response.suggestions.map(normalizeLocationSuggestion).filter(Boolean) as LocationSuggestion[]
    : []
  return rankLocationSuggestions(options.q, suggestions)
}

export async function retrieveLocation(options: {
  id: string
  sessionToken: string
}): Promise<LocationSearchResult | null> {
  const encodedId = encodeURIComponent(options.id)
  const url = mapboxUrl(`https://api.mapbox.com/search/searchbox/v1/retrieve/${encodedId}`, {
    session_token: options.sessionToken,
    language: 'en',
  })
  const response = await $fetch<any>(url.toString())
  const features = Array.isArray(response?.features) ? response.features : []
  return features.map(normalizeLocationFeature).find(Boolean) ?? null
}

export async function geocodeTextToLocation(q: string): Promise<GeocodedLocation | null> {
  if (!mapboxToken()) return null

  const url = mapboxUrl('https://api.mapbox.com/search/geocode/v6/forward', {
    q,
    limit: '1',
    types: PREMADE_GEOCODING_TYPES,
  })

  try {
    const response = await $fetch<any>(url.toString())
    const feature = response?.features?.[0]
    const coords = feature?.properties?.coordinates
    const lng = Number(coords?.longitude ?? feature?.geometry?.coordinates?.[0])
    const lat = Number(coords?.latitude ?? feature?.geometry?.coordinates?.[1])
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
    return {
      lat,
      lng,
      label: feature?.properties?.full_address || feature?.properties?.name || q,
    }
  } catch {
    return null
  }
}

function mapboxUrl(endpoint: string, params: Record<string, string>): URL {
  const token = mapboxToken()
  if (!token) {
    throw createError({ statusCode: 503, message: 'Location search is not configured' })
  }
  const url = new URL(endpoint)
  for (const [key, value] of Object.entries(params)) {
    if (value) url.searchParams.set(key, value)
  }
  url.searchParams.set('access_token', token)
  return url
}

function mapboxToken(): string | null {
  const token = process.env.MAPBOX_TOKEN?.trim()
  return token || null
}

function normalizeFeatureType(value: unknown): LocationFeatureType | null {
  return typeof value === 'string' && SUPPORTED_LOCATION_TYPES.has(value as LocationFeatureType)
    ? value as LocationFeatureType
    : null
}

function displayLabel(raw: any): string {
  const label = raw?.full_address || raw?.place_formatted || raw?.address
  if (typeof label === 'string' && label.trim()) return label.trim()
  const context = normalizeContext(raw?.context)
  return [context.place ?? context.locality, context.region, context.country].filter(Boolean).join(', ')
}

function normalizeCategories(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((category): category is string => typeof category === 'string' && category.trim().length > 0)
    : []
}

function normalizeContext(value: any): LocationSearchContext {
  return {
    country: contextName(value?.country),
    region: contextName(value?.region),
    place: contextName(value?.place),
    locality: contextName(value?.locality),
    neighborhood: contextName(value?.neighborhood),
    postcode: contextName(value?.postcode),
  }
}

function contextName(value: any): string | undefined {
  return typeof value?.name === 'string' && value.name.trim() ? value.name.trim() : undefined
}

function normalizeBbox(value: unknown): [number, number, number, number] | null {
  if (!Array.isArray(value) || value.length !== 4) return null
  const bbox = value.map(Number) as [number, number, number, number]
  return validBbox(bbox) ? bbox : null
}

function validBbox(bbox: [number, number, number, number]): boolean {
  const [west, south, east, north] = bbox
  return (
    Number.isFinite(west) && Number.isFinite(south) && Number.isFinite(east) && Number.isFinite(north) &&
    west >= -180 && east <= 180 && south >= -90 && north <= 90 && west < east && south < north
  )
}

function suggestedZoomForFeature(featureType: LocationFeatureType): number {
  if (featureType === 'poi' || featureType === 'address') return 15
  if (featureType === 'place' || featureType === 'locality') return 11
  return 7
}

function locationSuggestionScore(
  normalizedQuery: string,
  queryTokens: string[],
  suggestion: LocationSuggestion,
  index: number,
): number {
  const haystack = [
    suggestion.name,
    suggestion.label,
    suggestion.featureType,
    ...suggestion.categories,
  ].join(' ').toLowerCase()

  let score = 100 - index
  if (suggestion.featureType === 'poi') score += 12
  for (const term of OUTDOOR_TERMS) {
    if (normalizedQuery.includes(term) && haystack.includes(term)) score += 35
  }
  for (const token of queryTokens) {
    if (token.length > 2 && haystack.includes(token)) score += 4
  }
  if (suggestion.name.toLowerCase().includes(normalizedQuery)) score += 20
  return score
}
