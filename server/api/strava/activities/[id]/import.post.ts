/**
 * POST /api/strava/activities/:id/import
 * Body: { title?: string }
 * Fetches GPS stream from a Strava activity, converts it to GeoJSON, and
 * creates a map record so the user can immediately start styling.
 */
import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'
import { DEFAULT_STYLE_CONFIG } from '~/types'
import type { RouteStats } from '~/types'
import { getValidStravaAccessToken } from '~/server/utils/stravaTokens'
import { validateRouteGeojson } from '~/server/utils/routeValidation'
import { assertRateLimit } from '~/server/utils/rateLimit'

// ─── Strava types ─────────────────────────────────────────────────────────────

interface StravaActivity {
  name: string
  sport_type: string
  distance: number
  total_elevation_gain: number
  elapsed_time: number
  start_date: string
}

interface StravaStreams {
  latlng?: { data: [number, number][] }
  altitude?: { data: number[] }
  time?: { data: number[] }
}

const importLocks = new Map<string, number>()
const IMPORT_LOCK_TTL_MS = 5 * 60_000

// ─── Handler ──────────────────────────────────────────────────────────────────

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user) throw createError({ statusCode: 401, message: 'Unauthorized' })
  assertRateLimit(event, { key: 'strava-import', userId: user.id, limit: 20, windowMs: 60 * 60_000 })

  const activityId = getRouterParam(event, 'id')
  if (!activityId) throw createError({ statusCode: 400, message: 'Activity ID required' })
  if (!/^\d+$/.test(activityId)) throw createError({ statusCode: 400, message: 'Invalid activity ID' })
  const lockKey = `${user.id}:${activityId}`
  const existingLock = importLocks.get(lockKey)
  if (existingLock && existingLock > Date.now()) {
    throw createError({ statusCode: 409, message: 'This activity import is already in progress' })
  }
  importLocks.set(lockKey, Date.now() + IMPORT_LOCK_TTL_MS)

  try {
    const body = await readBody(event).catch(() => ({}))
    const customTitle = body?.title as string | undefined

    const supabase = await serverSupabaseClient(event)
    const config = useRuntimeConfig()

  // Get a valid (possibly refreshed) access token
  const accessToken = await getValidStravaAccessToken(user.id, supabase, config)

  const authHeaders = { Authorization: `Bearer ${accessToken}` }

  // 1. Fetch activity details
  const activity = await $fetch<StravaActivity>(
    `https://www.strava.com/api/v3/activities/${activityId}`,
    { headers: authHeaders },
  ).catch(() => {
    throw createError({ statusCode: 502, message: 'Failed to fetch activity from Strava' })
  })

  // 2. Fetch GPS streams
  const streams = await $fetch<StravaStreams>(
    `https://www.strava.com/api/v3/activities/${activityId}/streams`,
    {
      headers: authHeaders,
      query: { keys: 'latlng,altitude,time', key_by_type: 'true' },
    },
  ).catch(() => {
    throw createError({ statusCode: 502, message: 'Failed to fetch activity streams from Strava' })
  })

  if (!streams.latlng?.data?.length) {
    throw createError({
      statusCode: 422,
      message: 'This activity has no GPS data and cannot be imported as a map',
    })
  }

  const latlngData = streams.latlng.data           // [lat, lng]
  const altitudeData = streams.altitude?.data ?? []

  // 3. Build GeoJSON coordinates — Strava: [lat, lng], GeoJSON: [lng, lat, alt?]
  const coordinates = latlngData.map(([lat, lng], i) => {
    const alt = altitudeData[i]
    return (alt !== undefined ? [lng, lat, alt] : [lng, lat]) as [number, number, number]
  })

  const geojson: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {
          name: activity.name,
          source: 'strava',
        },
        geometry: {
          type: 'LineString',
          coordinates,
        },
      },
    ],
  }
  validateRouteGeojson(geojson)

  // 4. Compute bounding box [minLng, minLat, maxLng, maxLat]
  let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity
  for (const coord of coordinates) {
    const [lng, lat] = coord
    if (lng < minLng) minLng = lng
    if (lat < minLat) minLat = lat
    if (lng > maxLng) maxLng = lng
    if (lat > maxLat) maxLat = lat
  }
  const bbox: [number, number, number, number] = [minLng, minLat, maxLng, maxLat]

  // 5. Compute elevation stats from altitude stream
  const elevations = altitudeData.filter((e) => e !== undefined)
  let elevationLoss = 0
  for (let i = 1; i < elevations.length; i++) {
    const diff = elevations[i] - elevations[i - 1]
    if (diff < 0) elevationLoss += Math.abs(diff)
  }

  const stats: RouteStats = {
    distance_km: Math.round((activity.distance / 1000) * 100) / 100,
    elevation_gain_m: Math.round(activity.total_elevation_gain),
    elevation_loss_m: Math.round(elevationLoss),
    max_elevation_m: elevations.length ? Math.round(Math.max(...elevations)) : 0,
    min_elevation_m: elevations.length ? Math.round(Math.min(...elevations)) : 0,
    duration_seconds: activity.elapsed_time,
    date: activity.start_date,
    activity_type: activity.sport_type,
  }

  // Avoid reverse-geocoding exact Strava start coordinates here. Location labels
  // should come from a coarse, cached geocoding path rather than disclosing every
  // import to a third party.

  const { data: map, error: insertError } = await supabase
    .from('maps')
    .insert({
      user_id: user.id,
      title: customTitle?.trim() || activity.name,
      geojson,
      bbox,
      stats,
      style_config: DEFAULT_STYLE_CONFIG,
      status: 'draft',
    })
    .select('id')
    .single()

  if (insertError || !map) {
    throw createError({ statusCode: 500, message: insertError?.message ?? 'Failed to create map' })
  }

    return { id: map.id }
  } finally {
    importLocks.delete(lockKey)
  }
})
