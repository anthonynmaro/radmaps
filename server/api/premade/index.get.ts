import { serverSupabaseServiceRole } from '#supabase/server'
import { listNearbyPublishedPremadeMaps, listPublishedPremadeCardMaps, listPublishedPremadeMaps } from '~/server/utils/premadeCatalog'
import {
  DEFAULT_PREMADE_SEARCH_RADIUS_KM,
  geocodePremadeSearchText,
  parseNearbyPremadeQuery,
  parsePremadeSearchText,
  sortPremadeMapsByDistance,
} from '~/server/utils/premadeSearch'

export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'public, max-age=60, s-maxage=300')
  const supabase = await serverSupabaseServiceRole(event)
  const fallbackOptions = {
    staticFallbackWhenNoPublished: process.env.NODE_ENV !== 'production',
  }
  const query = getQuery(event)
  if (query.view === 'cards') {
    const limit = Math.max(1, Math.min(Number(query.limit) || 4, 24))
    return await listPublishedPremadeCardMaps(supabase, {
      ...fallbackOptions,
      limit,
    })
  }
  const textSearch = parsePremadeSearchText(query)
  const directNearby = parseNearbyPremadeQuery(query)
  const textNearby = textSearch && !directNearby ? await geocodePremadeSearchText(textSearch) : null
  const nearby = directNearby || (textNearby
    ? { lat: textNearby.lat, lng: textNearby.lng, radiusKm: DEFAULT_PREMADE_SEARCH_RADIUS_KM }
    : null)

  if (!nearby) {
    return await listPublishedPremadeMaps(supabase, fallbackOptions)
  }

  if (textSearch && !textNearby && !directNearby) {
    return await listPublishedPremadeMaps(supabase, fallbackOptions)
  }

  const maps = await listNearbyPublishedPremadeMaps(supabase, {
    ...nearby,
    ...fallbackOptions,
  })

  if (maps.length > 0 || process.env.NODE_ENV === 'production') return maps

  const fallbackMaps = await listPublishedPremadeMaps(supabase, fallbackOptions)
  return sortPremadeMapsByDistance(fallbackMaps, nearby)
})
