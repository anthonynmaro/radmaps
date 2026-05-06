import { PRODUCTS } from '~/utils/products'
import type { PremadeCategory, PremadeMap, RouteStats, StyleConfig } from '~/types'

export const PREMADE_CATEGORIES: { id: PremadeCategory; label: string }[] = [
  { id: 'national-park', label: 'National Parks' },
  { id: 'long-distance', label: 'Long-distance' },
  { id: 'marathon', label: 'Marathons' },
  { id: 'peak', label: 'Peaks' },
  { id: 'pilgrimage', label: 'Pilgrimage' },
  { id: 'adventure', label: 'Adventure' },
]

export interface SourceMapForPremade {
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

export function draftPremadeFromMap(map: SourceMapForPremade, slug: string): Omit<PremadeMap, 'id'> {
  const preview = previewUrlForSourceMap(map)
  const location = (map.stats?.location || '').trim()

  return {
    source_map_id: map.id,
    slug,
    title: map.title,
    subtitle: map.subtitle || map.style_config?.occasion_text || '',
    region: location || 'Region TBD',
    country: 'United States',
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
    render_url: map.render_url || preview || undefined,
  }
}

export function missingPublishFields(map: Partial<PremadeMap>): string[] {
  const missing: string[] = []
  if (!map.slug?.trim()) missing.push('slug')
  if (!map.title?.trim()) missing.push('title')
  if (!map.category) missing.push('category')
  if (!map.stats || Object.keys(map.stats).length === 0) missing.push('stats')
  if (!Array.isArray(map.bbox) || map.bbox.length !== 4) missing.push('bbox')
  if (!map.geojson?.features?.length) missing.push('geojson')
  if (!map.style_config) missing.push('style_config')
  if (!map.preview_image_url?.trim()) missing.push('preview_image_url')
  if (!map.render_url?.trim()) missing.push('render_url')
  return missing
}
