/**
 * DELETE /api/strava/disconnect
 * Removes stored Strava tokens for the authenticated user.
 */
import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'
import { getValidStravaAccessToken } from '~/server/utils/stravaTokens'

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const supabase = await serverSupabaseClient(event)
  const config = useRuntimeConfig()

  try {
    const accessToken = await getValidStravaAccessToken(user.id, supabase, config)
    await $fetch('https://www.strava.com/oauth/deauthorize', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
    })
  } catch (err) {
    console.warn('[strava/disconnect] Strava deauthorization failed; deleting local token anyway:', (err as Error).message)
  }

  const { error } = await supabase
    .from('strava_tokens')
    .delete()
    .eq('user_id', user.id)

  if (error) {
    throw createError({ statusCode: 500, message: 'Failed to disconnect Strava' })
  }

  return { ok: true }
})
