import { PRODUCTS } from '~/utils/products'
import type { LocationMetadata, PremadeCategory, PremadeMap, RouteStats, StyleConfig } from '~/types'

export const PREMADE_CATEGORIES: { id: PremadeCategory; label: string }[] = [
  { id: 'national-park', label: 'National Parks' },
  { id: 'long-distance', label: 'Long-distance' },
  { id: 'marathon', label: 'Marathons' },
  { id: 'peak', label: 'Peaks' },
  { id: 'pilgrimage', label: 'Pilgrimage' },
  { id: 'adventure', label: 'Adventure' },
]

export interface SourceMapForPremade extends LocationMetadata {
  id: string
  title: string
  subtitle?: string | null
  geojson: GeoJSON.FeatureCollection
  bbox: [number, number, number, number]
  stats: RouteStats
  style_config: StyleConfig
  proof_render_url?: string | null
  thumbnail_url?: string | null
  render_url?: string | null
}

export function slugifyPremadeTitle(title: string): string {
  const slug = title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72)

  return slug || 'premade-map'
}

export function previewUrlForSourceMap(map: Pick<SourceMapForPremade, 'proof_render_url' | 'thumbnail_url' | 'render_url'>): string | null {
  return map.proof_render_url || map.thumbnail_url || map.render_url || null
}

export function defaultPremadeBasePriceCents(): number {
  const lowest = PRODUCTS
    .filter((product) => product.type === 'poster')
    .reduce((lowest, product) => Math.min(lowest, product.price_cents), Infinity) || 0
  return Number.isFinite(lowest) ? lowest : 0
}

export function bboxCenter(bbox?: [number, number, number, number] | null): [number, number] | null {
  if (!Array.isArray(bbox) || bbox.length !== 4) return null
  const [minLng, minLat, maxLng, maxLat] = bbox
  if (![minLng, minLat, maxLng, maxLat].every(Number.isFinite)) return null
  if (minLng < -180 || maxLng > 180 || minLat < -90 || maxLat > 90) return null
  if (minLng > maxLng || minLat > maxLat) return null
  return [(minLng + maxLng) / 2, (minLat + maxLat) / 2]
}

function visitGeojsonCoordinates(value: unknown, visit: (lng: number, lat: number) => void) {
  if (!Array.isArray(value)) return
  if (
    value.length >= 2 &&
    typeof value[0] === 'number' &&
    typeof value[1] === 'number'
  ) {
    visit(value[0], value[1])
    return
  }
  for (const child of value) visitGeojsonCoordinates(child, visit)
}

export function geojsonCenter(geojson?: GeoJSON.FeatureCollection | null): [number, number] | null {
  if (!geojson?.features?.length) return null

  let minLng = Infinity
  let minLat = Infinity
  let maxLng = -Infinity
  let maxLat = -Infinity

  const visitGeometry = (geometry?: GeoJSON.Geometry | null) => {
    if (!geometry) return
    if (geometry.type === 'GeometryCollection') {
      for (const child of geometry.geometries) visitGeometry(child)
      return
    }
    visitGeojsonCoordinates(geometry.coordinates, (lng, lat) => {
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) return
      if (lng < -180 || lng > 180 || lat < -90 || lat > 90) return
      minLng = Math.min(minLng, lng)
      minLat = Math.min(minLat, lat)
      maxLng = Math.max(maxLng, lng)
      maxLat = Math.max(maxLat, lat)
    })
  }

  for (const feature of geojson.features) {
    visitGeometry(feature.geometry)
  }

  if (![minLng, minLat, maxLng, maxLat].every(Number.isFinite)) return null
  return [(minLng + maxLng) / 2, (minLat + maxLat) / 2]
}

export function hasValidLocationCoordinates(map: Pick<LocationMetadata, 'location_lng' | 'location_lat'>): boolean {
  const lng = map.location_lng
  const lat = map.location_lat
  return (
    typeof lng === 'number' &&
    typeof lat === 'number' &&
    Number.isFinite(lng) &&
    Number.isFinite(lat) &&
    lng >= -180 &&
    lng <= 180 &&
    lat >= -90 &&
    lat <= 90
  )
}

export function publishableLocationCoordinates(
  map: Pick<LocationMetadata, 'location_lng' | 'location_lat'> & {
    bbox?: [number, number, number, number] | null
    geojson?: GeoJSON.FeatureCollection | null
  },
): [number, number] | null {
  if (hasValidLocationCoordinates(map)) return [map.location_lng!, map.location_lat!]
  return bboxCenter(map.bbox) || geojsonCenter(map.geojson)
}

export function draftPremadeFromMap(map: SourceMapForPremade, slug: string): Omit<PremadeMap, 'id'> {
  const preview = previewUrlForSourceMap(map)
  const location = (map.stats?.location || '').trim()
  const center = bboxCenter(map.bbox)
  const locationLng = typeof map.location_lng === 'number' ? map.location_lng : center?.[0] ?? null
  const locationLat = typeof map.location_lat === 'number' ? map.location_lat : center?.[1] ?? null

  return {
    source_map_id: map.id,
    slug,
    title: map.title,
    subtitle: map.subtitle || map.style_config?.occasion_text || '',
    region: location || 'Region TBD',
    country: 'United States',
    location_label: map.location_label || location || map.style_config?.location_text || null,
    location_city: map.location_city || null,
    location_region: map.location_region || location || null,
    location_country: map.location_country || 'United States',
    location_lng: locationLng,
    location_lat: locationLat,
    category: 'adventure',
    tagline: map.subtitle || map.style_config?.location_text || 'A curated RadMaps route.',
    description: '',
    badges: [],
    stats: map.stats,
    bbox: map.bbox,
    geojson: map.geojson,
    style_config: map.style_config,
    featured: false,
    status: 'draft',
    homepage_visible: false,
    homepage_sort_order: 1000,
    needs_preview: !preview,
    base_price_cents: defaultPremadeBasePriceCents(),
    preview_image_url: preview || undefined,
    render_url: undefined,
  }
}

export function missingPublishFields(map: Partial<PremadeMap>): string[] {
  const missing: string[] = []
  if (!map.slug?.trim()) missing.push('slug')
  if (!map.title?.trim()) missing.push('title')
  if (!map.category) missing.push('category')
  if (!map.stats || Object.keys(map.stats).length === 0) missing.push('stats')
  if (!Array.isArray(map.bbox) || map.bbox.length !== 4) missing.push('bbox')
  if (!publishableLocationCoordinates(map)) missing.push('location_coordinates')
  if (!map.geojson?.features?.length) missing.push('geojson')
  if (!map.style_config) missing.push('style_config')
  if (!map.preview_image_url?.trim()) missing.push('preview_image_url')
  if (map.needs_preview) missing.push('fresh_preview')
  return missing
}
