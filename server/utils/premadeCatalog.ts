import type { SupabaseClient } from '@supabase/supabase-js'
import { PREMADE_MAPS } from '~/data/premade-maps'
import type { PremadeMap } from '~/types'

type AnyClient = SupabaseClient | any

export function premadeRowToMap(row: Record<string, any>): PremadeMap {
  return {
    id: row.id,
    source_map_id: row.source_map_id,
    slug: row.slug,
    title: row.title,
    subtitle: row.subtitle || '',
    region: row.region || 'Region TBD',
    country: row.country || 'United States',
    category: row.category || 'adventure',
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
  }
}

function shouldUseStaticFallback(error: any): boolean {
  return error?.code === '42P01' || /premade_maps/i.test(error?.message || '')
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

export async function listPublishedPremadeMaps(client: AnyClient): Promise<PremadeMap[]> {
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
    return await premadeTableIsEmpty(client) ? PREMADE_MAPS : []
  }
  return data.map(premadeRowToMap)
}

export async function getPublishedPremadeBySlug(client: AnyClient, slug: string): Promise<PremadeMap | undefined> {
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

  return await premadeTableIsEmpty(client) ? PREMADE_MAPS.find((map) => map.slug === slug) : undefined
}
