/**
 * POST /api/strava/activities/:id/import
 * Body: { title?: string }
 * Fetches GPS stream from a Strava activity, converts it to GeoJSON, and
 * creates a map record so the user can immediately start styling.
 */
import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'
import { createClient } from '@supabase/supabase-js'
import { DEFAULT_STYLE_CONFIG } from '~/types'
import type { RouteStats } from '~/types'

// ─── Strava types ─────────────────────────────────────────────────────────────

interface StravaTokenRow {
  access_token: string
  refresh_token: string
  expires_at: number
}

interface StravaRefreshResponse {
  access_token: string
  refresh_token: string
  expires_at: number
}

interface StravaActivity {
  name: string
  sport_type: string
  distance: number
  total_elevation_gain: number
  elapsed_time: number
  start_date: string
  start_latlng: [number, number] | []
}

interface StravaStreams {
  latlng?: { data: [number, number][] }
  altitude?: { data: number[] }
  time?: { data: number[] }
}

// ─── Token helper ─────────────────────────────────────────────────────────────

async function getValidAccessToken(
  userId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  config: ReturnType<typeof useRuntimeConfig>,
): Promise<string> {
  const { data: tokenRow, error } = await supabase
    .from('strava_tokens')
    .select('access_token, refresh_token, expires_at')
    .eq('user_id', userId)
    .single()

  if (error || !tokenRow) {
    throw createError({ statusCode: 403, message: 'Strava account not connected' })
  }

  let { access_token, refresh_token, expires_at } = tokenRow as StravaTokenRow

  const nowSec = Math.floor(Date.now() / 1000)
  if (expires_at < nowSec + 300) {
    const refreshed = await $fetch<StravaRefreshResponse>('https://www.strava.com/oauth/token', {
      method: 'POST',
      body: {
        client_id: config.stravaClientId,
        client_secret: config.stravaClientSecret,
        grant_type: 'refresh_token',
        refresh_token,
      },
    })

    access_token = refreshed.access_token
    refresh_token = refreshed.refresh_token
    expires_at = refreshed.expires_at

    await supabase
      .from('strava_tokens')
      .update({ access_token, refresh_token, expires_at })
      .eq('user_id', userId)
  }

  return access_token
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const activityId = getRouterParam(event, 'id')
  if (!activityId) throw createError({ statusCode: 400, message: 'Activity ID required' })

  const body = await readBody(event).catch(() => ({}))
  const customTitle = body?.title as string | undefined

  const supabase = await serverSupabaseClient(event)
  const config = useRuntimeConfig()

  // Get a valid (possibly refreshed) access token
  const accessToken = await getValidAccessToken(user.id, supabase, config)

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

  // Reverse geocode start position → human-readable location for the poster
  if (Array.isArray(activity.start_latlng) && activity.start_latlng.length === 2) {
    const [lat, lng] = activity.start_latlng as [number, number]
    try {
      const geo = await $fetch<{
        address?: { city?: string; town?: string; village?: string; state?: string; country?: string }
      }>('https://nominatim.openstreetmap.org/reverse', {
        query: { lat, lon: lng, format: 'json', zoom: 10 },
        headers: { 'User-Agent': 'RadMaps/1.0 (radmaps.studio)' },
      })
      const city = geo.address?.city ?? geo.address?.town ?? geo.address?.village
      const state = geo.address?.state
      if (city && state) stats.location = `${city}, ${state}`
      else if (city) stats.location = city
      else if (state) stats.location = state
    } catch {
      // non-critical — poster will just omit the location line
    }
  }

  // 6. Insert map record using service-key client (bypasses RLS for server-side inserts)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adminSupabase = createClient(
    config.public.supabaseUrl as string,
    config.supabaseServiceKey as string,
  ) as any

  const { data: map, error: insertError } = await adminSupabase
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
})
