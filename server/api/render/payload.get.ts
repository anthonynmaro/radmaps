import { serverSupabaseServiceRole } from '#supabase/server'
import { DEFAULT_STYLE_CONFIG, type TrailMap } from '~/types'
import { buildAtlasPrintQaPayload } from '~/utils/atlasPrintQa'
import { getPrintFraming } from '~/utils/print/printFraming'
import { verifyRenderTicket } from '~/utils/render/renderTicket'
import { getPremadeThumbnailFraming } from '~/utils/render/thumbnailFraming'

export default defineEventHandler(async (event) => {
  setHeader(event, 'X-Robots-Tag', 'noindex, nofollow')

  const { ticket } = getQuery(event)
  if (typeof ticket !== 'string' || !ticket) {
    throw createError({ statusCode: 400, message: 'Render ticket required' })
  }

  const config = useRuntimeConfig()
  const payload = verifyRenderTicket(ticket, config.renderTicketSecret)
  const framing = payload.renderClass === 'thumbnail'
    ? getPremadeThumbnailFraming()
    : getPrintFraming(payload.productUid, payload.renderClass)

  if (payload.kind === 'atlas-qa') {
    try {
      const qaPayload = buildAtlasPrintQaPayload(payload.subject)
      return {
        ticket: payload,
        framing,
        map: qaPayload.map,
        styleConfig: qaPayload.styleConfig,
        fixture: qaPayload.fixture,
      }
    } catch (error) {
      throw createError({
        statusCode: 404,
        message: error instanceof Error ? error.message : 'Atlas print QA fixture not found',
      })
    }
  }

  const supabase = await serverSupabaseServiceRole(event)

  if (payload.kind === 'map') {
    const { data: map, error } = await supabase
      .from('maps')
      .select('id, title, subtitle, geojson, bbox, stats, style_config, user_id, status, created_at, updated_at, render_url, thumbnail_url, location_label, location_city, location_region, location_country, location_lng, location_lat, location_elevation_m, location_metadata_source, location_metadata_enriched_at')
      .eq('id', payload.subject)
      .single()
    if (error || !map) {
      throw createError({ statusCode: 404, message: 'Map not found' })
    }

    const trailMap = {
      ...map,
      style_config: map.style_config ?? DEFAULT_STYLE_CONFIG,
    } as TrailMap

    return {
      ticket: payload,
      framing,
      map: trailMap,
      styleConfig: trailMap.style_config,
    }
  }

  if (payload.kind === 'premade') {
    const { data: premade, error } = await supabase
      .from('premade_maps')
      .select('id, title, subtitle, geojson, bbox, stats, style_config, status, created_at, updated_at, preview_image_url, location_label, location_city, location_region, location_country, location_lng, location_lat, location_elevation_m, location_metadata_source, location_metadata_enriched_at')
      .eq('id', payload.subject)
      .single()
    if (error || !premade) {
      throw createError({ statusCode: 404, message: 'Premade map not found' })
    }

    const trailMap = {
      id: premade.id,
      user_id: 'premade',
      title: premade.title,
      subtitle: premade.subtitle ?? '',
      geojson: premade.geojson,
      bbox: premade.bbox,
      stats: premade.stats ?? {},
      style_config: { ...DEFAULT_STYLE_CONFIG, ...(premade.style_config ?? {}) },
      status: 'draft',
      thumbnail_url: premade.preview_image_url ?? undefined,
      render_url: undefined,
      proof_render_url: premade.preview_image_url ?? undefined,
      location_label: premade.location_label ?? undefined,
      location_city: premade.location_city ?? undefined,
      location_region: premade.location_region ?? undefined,
      location_country: premade.location_country ?? undefined,
      location_lng: premade.location_lng ?? undefined,
      location_lat: premade.location_lat ?? undefined,
      location_elevation_m: premade.location_elevation_m ?? undefined,
      location_metadata_source: premade.location_metadata_source ?? undefined,
      location_metadata_enriched_at: premade.location_metadata_enriched_at ?? undefined,
      created_at: premade.created_at,
      updated_at: premade.updated_at,
    } as TrailMap

    return {
      ticket: payload,
      framing,
      map: trailMap,
      styleConfig: trailMap.style_config,
    }
  }

  const { data: snapshot, error } = await supabase
    .from('order_snapshots')
    .select('*')
    .eq('stripe_session_id', payload.subject)
    .single()
  if (error || !snapshot) {
    throw createError({ statusCode: 404, message: 'Order snapshot not found' })
  }

  const trailMap = {
    id: snapshot.map_id ?? `session-${snapshot.stripe_session_id}`,
    user_id: snapshot.user_id,
    title: snapshot.style_config?.trail_name ?? 'RadMaps Print',
    subtitle: '',
    geojson: snapshot.geojson,
    bbox: snapshot.bbox,
    stats: snapshot.stats,
    style_config: snapshot.style_config ?? DEFAULT_STYLE_CONFIG,
    status: 'rendering',
    location_label: snapshot.location_label ?? undefined,
    location_city: snapshot.location_city ?? undefined,
    location_region: snapshot.location_region ?? undefined,
    location_country: snapshot.location_country ?? undefined,
    location_lng: snapshot.location_lng ?? undefined,
    location_lat: snapshot.location_lat ?? undefined,
    location_elevation_m: snapshot.location_elevation_m ?? undefined,
    location_metadata_source: snapshot.location_metadata_source ?? undefined,
    location_metadata_enriched_at: snapshot.location_metadata_enriched_at ?? undefined,
    created_at: snapshot.frozen_at,
    updated_at: snapshot.frozen_at,
  } as TrailMap

  return {
    ticket: payload,
    framing,
    map: trailMap,
    styleConfig: trailMap.style_config,
  }
})
