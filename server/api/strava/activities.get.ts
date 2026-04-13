/**
 * GET /api/strava/activities?page=1&per_page=20
 * Returns the authenticated user's recent Strava activities.
 * Automatically refreshes the access token if it is within 5 minutes of expiry.
 * Enriches each activity with a thumbnail_url (from Strava's primary photo)
 * and a location string (reverse-geocoded from start_latlng via BigDataCloud).
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
  elapsed_time: number
  achievement_count: number
  pr_count: number
  total_photo_count: number
  photos?: {
    primary?: {
      urls?: Record<string, string>
    }
  }
}

interface BigDataCloudResponse {
  city?: string
  locality?: string
  principalSubdivision?: string
  countryCode?: string
  countryName?: string
}

async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    const geo = await $fetch<BigDataCloudResponse>(
      'https://api.bigdatacloud.net/data/reverse-geocode-client',
      { query: { latitude: lat, longitude: lng, localityLanguage: 'en' } },
    )
    const city = geo.city || geo.locality
    const region = geo.principalSubdivision
    if (city && region && city !== region) return `${city}, ${region}`
    if (city) return city
    if (region) return region
    if (geo.countryName) return geo.countryName
    return null
  } catch {
    return null
  }
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

  // Reverse-geocode all activities that have coordinates — run in parallel
  const locationResults = await Promise.allSettled(
    activities.map((a) => {
      const ll = a.start_latlng
      if (Array.isArray(ll) && ll.length === 2) {
        return reverseGeocode(ll[0], ll[1])
      }
      return Promise.resolve(null)
    }),
  )

  const mapped = activities.map((a, i) => {
    const primaryUrls = a.photos?.primary?.urls ?? {}
    const thumbnail_url =
      primaryUrls['100'] ?? primaryUrls['600'] ?? primaryUrls[Object.keys(primaryUrls)[0]] ?? null

    const locationResult = locationResults[i]
    const location = locationResult.status === 'fulfilled' ? locationResult.value : null

    return {
      id: a.id,
      name: a.name,
      sport_type: a.sport_type,
      distance: a.distance,
      total_elevation_gain: a.total_elevation_gain,
      start_date: a.start_date,
      start_latlng: a.start_latlng,
      map: { summary_polyline: a.map?.summary_polyline ?? '' },
      moving_time: a.moving_time,
      elapsed_time: a.elapsed_time ?? 0,
      achievement_count: a.achievement_count ?? 0,
      pr_count: a.pr_count ?? 0,
      total_photo_count: a.total_photo_count ?? 0,
      thumbnail_url,
      location,
    }
  })

  return { connected: true, activities: mapped }
})
