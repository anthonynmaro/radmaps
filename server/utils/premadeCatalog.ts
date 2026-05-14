import type { SupabaseClient } from '@supabase/supabase-js'
import { PREMADE_MAPS } from '~/data/premade-maps'
import type { PremadeMap } from '~/types'
import { normalizePremadeCategories } from '~/utils/premadeCatalog'
import { sortPremadeMapsByDistance } from '~/server/utils/premadeSearch'

type AnyClient = SupabaseClient | any
interface PremadeCatalogReadOptions {
  staticFallbackWhenNoPublished?: boolean
}

const PREMADE_CARD_SELECT = [
  'id',
  'slug',
  'title',
  'subtitle',
  'region',
  'country',
  'category',
  'categories',
  'tagline',
  'stats',
  'style_config',
  'homepage_visible',
  'homepage_sort_order',
  'base_price_cents',
  'cover_gradient',
  'preview_image_url',
].join(',')

export function premadeRowToMap(row: Record<string, any>): PremadeMap {
  const distance = row.distance_meters ?? row.dist_meters
  const categories = normalizePremadeCategories(row.categories, row.category)
  const category = categories[0]

  return {
    id: row.id,
    source_map_id: row.source_map_id,
    slug: row.slug,
    title: row.title,
    subtitle: row.subtitle || '',
    region: row.region || 'Region TBD',
    country: row.country || 'United States',
    location_label: row.location_label || row.stats?.location || row.region || null,
    location_city: row.location_city || null,
    location_region: row.location_region || row.region || null,
    location_country: row.location_country || row.country || null,
    location_lng: row.location_lng ?? null,
    location_lat: row.location_lat ?? null,
    category: category,
    categories,
    tagline: row.tagline || '',
    description: row.description || '',
    badges: row.badges || [],
    stats: row.stats || {},
    bbox: row.bbox,
    geojson: row.geojson,
    style_config: row.style_config,
    featured: Boolean(row.homepage_visible),
    status: row.status,
    homepage_visible: Boolean(row.homepage_visible),
    homepage_sort_order: row.homepage_sort_order ?? 1000,
    needs_preview: Boolean(row.needs_preview),
    base_price_cents: row.base_price_cents ?? 2499,
    cover_gradient: row.cover_gradient,
    preview_image_url: row.preview_image_url || undefined,
    render_url: row.render_url || undefined,
    distance_meters: typeof distance === 'number' ? distance : undefined,
  }
}

function shouldUseStaticFallback(error: any): boolean {
  return error?.code === '42P01' || /premade_maps|nearby_published_premade_maps/i.test(error?.message || '')
}

async function premadeTableIsEmpty(client: AnyClient): Promise<boolean> {
  const { count, error } = await client
    .from('premade_maps')
    .select('id', { count: 'exact', head: true })

  if (error) {
    if (shouldUseStaticFallback(error)) return true
    throw createError({ statusCode: 500, message: error.message })
  }

  return count === 0
}

export async function listPublishedPremadeMaps(
  client: AnyClient,
  options: PremadeCatalogReadOptions = {},
): Promise<PremadeMap[]> {
  const { data, error } = await client
    .from('premade_maps')
    .select('*')
    .eq('status', 'published')
    .order('homepage_visible', { ascending: false })
    .order('homepage_sort_order', { ascending: true })
    .order('title', { ascending: true })

  if (error) {
    if (shouldUseStaticFallback(error)) return PREMADE_MAPS
    throw createError({ statusCode: 500, message: error.message })
  }

  if (!data || data.length === 0) {
    if (await premadeTableIsEmpty(client)) return options.staticFallbackWhenNoPublished ? PREMADE_MAPS : []
    return options.staticFallbackWhenNoPublished ? PREMADE_MAPS : []
  }
  return data.map(premadeRowToMap)
}

export async function listPublishedPremadeCardMaps(
  client: AnyClient,
  options: PremadeCatalogReadOptions & { limit?: number } = {},
): Promise<PremadeMap[]> {
  const limit = options.limit ?? 4
  const { data, error } = await client
    .from('premade_maps')
    .select(PREMADE_CARD_SELECT)
    .eq('status', 'published')
    .order('homepage_visible', { ascending: false })
    .order('homepage_sort_order', { ascending: true })
    .order('title', { ascending: true })
    .limit(limit)

  if (error) {
    if (shouldUseStaticFallback(error)) return PREMADE_MAPS.slice(0, limit)
    throw createError({ statusCode: 500, message: error.message })
  }

  if (!data || data.length === 0) {
    if (await premadeTableIsEmpty(client)) {
      return options.staticFallbackWhenNoPublished ? PREMADE_MAPS.slice(0, limit) : []
    }
    return options.staticFallbackWhenNoPublished ? PREMADE_MAPS.slice(0, limit) : []
  }
  return data.map(premadeRowToMap)
}

export interface NearbyPremadeSearchOptions extends PremadeCatalogReadOptions {
  lat: number
  lng: number
  radiusKm?: number
  limit?: number
}

export async function listNearbyPublishedPremadeMaps(
  client: AnyClient,
  options: NearbyPremadeSearchOptions,
): Promise<PremadeMap[]> {
  const radiusKm = options.radiusKm ?? 250
  const limit = options.limit ?? 48
  const { data, error } = await client.rpc('nearby_published_premade_maps', {
    p_lat: options.lat,
    p_lng: options.lng,
    p_radius_meters: radiusKm * 1000,
    p_limit: limit,
  })

  if (error) {
    if (shouldUseStaticFallback(error)) {
      const maps = await listPublishedPremadeMaps(client, options)
      return sortPremadeMapsByDistance(maps, {
        lat: options.lat,
        lng: options.lng,
        radiusKm,
      })
    }
    throw createError({ statusCode: 500, message: error.message })
  }

  return (data || []).map(premadeRowToMap)
}

export async function getPublishedPremadeBySlug(
  client: AnyClient,
  slug: string,
  options: PremadeCatalogReadOptions = {},
): Promise<PremadeMap | undefined> {
  const { data, error } = await client
    .from('premade_maps')
    .select('*')
    .eq('slug', slug)
    .eq('status', 'published')
    .maybeSingle()

  if (error) {
    if (shouldUseStaticFallback(error)) return PREMADE_MAPS.find((map) => map.slug === slug)
    throw createError({ statusCode: 500, message: error.message })
  }

  if (data) return premadeRowToMap(data)

  if (await premadeTableIsEmpty(client)) {
    return options.staticFallbackWhenNoPublished ? PREMADE_MAPS.find((map) => map.slug === slug) : undefined
  }
  return options.staticFallbackWhenNoPublished ? PREMADE_MAPS.find((map) => map.slug === slug) : undefined
}
