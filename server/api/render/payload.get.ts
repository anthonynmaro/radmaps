import { serverSupabaseServiceRole } from '#supabase/server'
import { DEFAULT_STYLE_CONFIG, type TrailMap } from '~/types'
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
  const supabase = await serverSupabaseServiceRole(event)
  const framing = payload.renderClass === 'thumbnail'
    ? getPremadeThumbnailFraming()
    : getPrintFraming(payload.productUid, payload.renderClass)

  if (payload.kind === 'map') {
    const { data: map, error } = await supabase
      .from('maps')
      .select('id, title, subtitle, geojson, bbox, stats, style_config, user_id, status, created_at, updated_at, render_url, thumbnail_url, location_label, location_city, location_region, location_country, location_lng, location_lat')
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
      .select('id, title, subtitle, geojson, bbox, stats, style_config, status, created_at, updated_at, preview_image_url, location_label, location_city, location_region, location_country, location_lng, location_lat')
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
