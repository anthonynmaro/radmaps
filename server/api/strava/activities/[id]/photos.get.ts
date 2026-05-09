/**
 * GET /api/strava/activities/:id/photos
 * Returns photo thumbnails for a Strava activity.
 */
import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'
import { getValidStravaAccessToken } from '~/server/utils/stravaTokens'
import { assertRateLimit } from '~/server/utils/rateLimit'

interface StravaPhoto {
  unique_id: string
  urls: Record<string, string>
}

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user) throw createError({ statusCode: 401, message: 'Unauthorized' })
  assertRateLimit(event, { key: 'strava-photos', userId: user.id, limit: 60, windowMs: 60 * 60_000 })

  const activityId = getRouterParam(event, 'id')
  if (!activityId) throw createError({ statusCode: 400, message: 'Activity ID required' })
  if (!/^\d+$/.test(activityId)) throw createError({ statusCode: 400, message: 'Invalid activity ID' })

  const supabase = await serverSupabaseClient(event)
  const config = useRuntimeConfig()
  const accessToken = await getValidStravaAccessToken(user.id, supabase, config)

  const photos = await $fetch<StravaPhoto[]>(
    `https://www.strava.com/api/v3/activities/${activityId}/photos`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      query: { size: 256, photo_sources: true },
    },
  ).catch(() => [] as StravaPhoto[])

  return {
    photos: photos
      .map(p => ({ id: p.unique_id, url: p.urls?.['256'] ?? p.urls?.[Object.keys(p.urls ?? {})[0]] ?? null }))
      .filter(p => p.url),
  }
})
