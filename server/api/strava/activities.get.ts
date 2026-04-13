/**
 * GET /api/strava/activities?page=1&per_page=20
 * Returns the authenticated user's recent Strava activities.
 * Automatically refreshes the access token if it is within 5 minutes of expiry.
 */
import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'

interface StravaTokenRow {
  access_token: string
  refresh_token: string
  expires_at: number
  athlete_id: number
}

interface StravaRefreshResponse {
  access_token: string
  refresh_token: string
  expires_at: number
}

interface StravaActivity {
  id: number
  name: string
  sport_type: string
  distance: number
  total_elevation_gain: number
  start_date: string
  start_latlng: [number, number] | []
  map: { summary_polyline: string }
  moving_time: number
}

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const supabase = await serverSupabaseClient(event)

  // Fetch stored tokens
  const { data: tokenRow, error: tokenError } = await supabase
    .from('strava_tokens')
    .select('access_token, refresh_token, expires_at, athlete_id')
    .eq('user_id', user.id)
    .single()

  if (tokenError || !tokenRow) {
    return { connected: false }
  }

  const config = useRuntimeConfig()
  let { access_token, refresh_token, expires_at } = tokenRow as StravaTokenRow

  // Refresh token if expiring within 5 minutes
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
      .eq('user_id', user.id)
  }

  // Parse query params
  const query = getQuery(event)
  const per_page = Number(query.per_page) || 20
  const page = Number(query.page) || 1

  let activities: StravaActivity[]
  try {
    activities = await $fetch<StravaActivity[]>(
      'https://www.strava.com/api/v3/athlete/activities',
      {
        headers: { Authorization: `Bearer ${access_token}` },
        query: { per_page, page },
      },
    )
  } catch (err: unknown) {
    // 401 means user revoked access in Strava — treat as disconnected
    const status = (err as { response?: { status?: number } })?.response?.status
    if (status === 401) {
      return { connected: false }
    }
    throw createError({ statusCode: 502, message: 'Failed to fetch activities from Strava' })
  }

  const mapped = activities.map((a) => ({
    id: a.id,
    name: a.name,
    sport_type: a.sport_type,
    distance: a.distance,
    total_elevation_gain: a.total_elevation_gain,
    start_date: a.start_date,
    start_latlng: a.start_latlng,
    map: { summary_polyline: a.map?.summary_polyline ?? '' },
    moving_time: a.moving_time,
  }))

  return { connected: true, activities: mapped }
})
