/**
 * POST /api/maps/public/:id/clone
 *
 * Copies an explicitly shared public map into the authenticated user's
 * workspace so checkout and the editor can use the normal owned-map flows.
 */
import { z } from 'zod'
import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'

const MapIdSchema = z.string().uuid()

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'Missing map ID' })
  if (!MapIdSchema.safeParse(id).success) throw createError({ statusCode: 400, message: 'Invalid map ID' })

  const user = await serverSupabaseUser(event)
  if (!user) throw createError({ statusCode: 401, message: 'Sign in to customize this map' })

  const supabase = await serverSupabaseClient(event)
  const { data: source, error: sourceError } = await supabase
    .from('maps')
    .select(`
      id,
      user_id,
      title,
      subtitle,
      geojson,
      bbox,
      stats,
      style_config,
      render_url,
      thumbnail_url,
      proof_render_url,
      proof_render_hash,
      map_content_hash,
      chrome_hash,
      status,
      location_label,
      location_city,
      location_region,
      location_country,
      location_lng,
      location_lat,
      location_elevation_m,
      location_metadata_source,
      location_metadata_enriched_at
    `)
    .eq('id', id)
    .eq('is_public', true)
    .single()

  if (sourceError || !source) {
    throw createError({ statusCode: 404, message: 'Map not found' })
  }

  if (source.user_id === user.id) {
    return {
      map_id: source.id,
      redirect: `/create/${source.id}/style`,
      checkout_redirect: `/create/${source.id}/checkout`,
      cloned: false,
    }
  }

  const hasProof = typeof source.proof_render_url === 'string' && !source.proof_render_url.startsWith('error:')
  const { data: inserted, error: insertError } = await supabase
    .from('maps')
    .insert({
      user_id: user.id,
      title: source.title,
      subtitle: source.subtitle,
      geojson: source.geojson,
      bbox: source.bbox,
      stats: source.stats,
      style_config: source.style_config,
      render_url: hasProof ? source.proof_render_url : source.render_url,
      thumbnail_url: hasProof ? source.proof_render_url : source.thumbnail_url,
      proof_render_url: hasProof ? source.proof_render_url : null,
      proof_render_hash: hasProof ? source.proof_render_hash : null,
      map_content_hash: hasProof ? source.map_content_hash : null,
      chrome_hash: hasProof ? source.chrome_hash : null,
      status: hasProof ? 'rendered' : 'draft',
      location_label: source.location_label,
      location_city: source.location_city,
      location_region: source.location_region,
      location_country: source.location_country,
      location_lng: source.location_lng,
      location_lat: source.location_lat,
      location_elevation_m: source.location_elevation_m,
      location_metadata_source: source.location_metadata_source,
      location_metadata_enriched_at: source.location_metadata_enriched_at,
    })
    .select('id')
    .single()

  if (insertError || !inserted) {
    console.error('Failed to clone shared map:', insertError)
    throw createError({ statusCode: 500, message: 'Failed to open this map' })
  }

  return {
    map_id: inserted.id,
    redirect: `/create/${inserted.id}/style`,
    checkout_redirect: `/create/${inserted.id}/checkout`,
    cloned: true,
  }
})
