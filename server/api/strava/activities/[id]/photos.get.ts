/**
 * GET /api/strava/activities/:id/photos
 * Returns photo thumbnails for a Strava activity.
 */
import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'

interface StravaPhoto {
  unique_id: string
  urls: Record<string, string>
}

interface TokenRow {
  access_token: string
  refresh_token: string
  expires_at: number
}

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const activityId = getRouterParam(event, 'id')
  if (!activityId) throw createError({ statusCode: 400, message: 'Activity ID required' })

  const supabase = await serverSupabaseClient(event)
  const config = useRuntimeConfig()

  const { data: tokenRow, error: tokenError } = await supabase
    .from('strava_tokens')
    .select('access_token, refresh_token, expires_at')
    .eq('user_id', user.id)
    .single()

  if (tokenError || !tokenRow) throw createError({ statusCode: 403, message: 'Strava not connected' })

  let { access_token, refresh_token, expires_at } = tokenRow as TokenRow

  const nowSec = Math.floor(Date.now() / 1000)
  if (expires_at < nowSec + 300) {
    const refreshed = await $fetch<TokenRow>('https://www.strava.com/oauth/token', {
      method: 'POST',
      body: { client_id: config.stravaClientId, client_secret: config.stravaClientSecret, grant_type: 'refresh_token', refresh_token },
    })
    access_token = refreshed.access_token
    refresh_token = refreshed.refresh_token
    expires_at = refreshed.expires_at
    await supabase.from('strava_tokens').update({ access_token, refresh_token, expires_at }).eq('user_id', user.id)
  }

  const photos = await $fetch<StravaPhoto[]>(
    `https://www.strava.com/api/v3/activities/${activityId}/photos`,
    {
      headers: { Authorization: `Bearer ${access_token}` },
      query: { size: 256, photo_sources: true },
    },
  ).catch(() => [] as StravaPhoto[])

  return {
    photos: photos
      .map(p => ({ id: p.unique_id, url: p.urls?.['256'] ?? p.urls?.[Object.keys(p.urls ?? {})[0]] ?? null }))
      .filter(p => p.url),
  }
})
