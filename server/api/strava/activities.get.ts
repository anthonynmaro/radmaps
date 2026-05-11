/**
 * GET /api/strava/activities?page=1&per_page=20
 * Returns the authenticated user's recent Strava activities.
 * Automatically refreshes the access token if it is within 5 minutes of expiry.
 * Enriches each activity with a thumbnail_url (from Strava's primary photo).
 * Does not return exact start coordinates; selected imports fetch streams only
 * after the user chooses an activity.
 */
import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'
import { getValidStravaAccessToken } from '~/server/utils/stravaTokens'
import { assertRateLimit } from '~/server/utils/rateLimit'

interface StravaActivity {
  id: number
  name: string
  sport_type: string
  distance: number
  total_elevation_gain: number
  start_date: string
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

interface CachedActivityList {
  expiresAt: number
  activities: Array<Record<string, unknown>>
}

const ACTIVITY_CACHE_TTL_MS = 10 * 60_000
const activityListCache = new Map<string, CachedActivityList>()

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user) throw createError({ statusCode: 401, message: 'Unauthorized' })
  assertRateLimit(event, { key: 'strava-activities', userId: user.id, limit: 60, windowMs: 60 * 60_000 })

  const supabase = await serverSupabaseClient(event)

  const { data: tokenRow, error: tokenError } = await supabase
    .from('strava_tokens')
    .select('athlete_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (tokenError || !tokenRow) {
    return { connected: false }
  }

  const config = useRuntimeConfig()
  // Parse query params
  const query = getQuery(event)
  const per_page = Math.min(Math.max(Number(query.per_page) || 20, 1), 30)
  const page = Math.min(Math.max(Number(query.page) || 1, 1), 20)
  const athleteId = String((tokenRow as { athlete_id?: number }).athlete_id ?? 'unknown')
  const cacheKey = `${user.id}:${athleteId}:${page}:${per_page}`
  const cached = activityListCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) {
    return { connected: true, activities: cached.activities }
  }

  const accessToken = await getValidStravaAccessToken(user.id, supabase, config)

  let activities: StravaActivity[]
  try {
    activities = await $fetch<StravaActivity[]>(
      'https://www.strava.com/api/v3/athlete/activities',
      {
        headers: { Authorization: `Bearer ${accessToken}` },
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

  const mapped = activities.map((a) => {
    const primaryUrls = a.photos?.primary?.urls ?? {}
    const thumbnail_url =
      primaryUrls['100'] ?? primaryUrls['600'] ?? primaryUrls[Object.keys(primaryUrls)[0]] ?? null

    return {
      id: a.id,
      name: a.name,
      sport_type: a.sport_type,
      distance: a.distance,
      total_elevation_gain: a.total_elevation_gain,
      start_date: a.start_date,
      map: { summary_polyline: a.map?.summary_polyline ?? '' },
      moving_time: a.moving_time,
      elapsed_time: a.elapsed_time ?? 0,
      achievement_count: a.achievement_count ?? 0,
      pr_count: a.pr_count ?? 0,
      total_photo_count: a.total_photo_count ?? 0,
      thumbnail_url,
      location: null,
    }
  })

  activityListCache.set(cacheKey, {
    expiresAt: Date.now() + ACTIVITY_CACHE_TTL_MS,
    activities: mapped,
  })

  return { connected: true, activities: mapped }
})
