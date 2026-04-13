/**
 * GET /api/strava/callback
 * OAuth 2.0 callback from Strava. Exchanges code for tokens and stores them.
 */
import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const query = getQuery(event)
  const code = query.code as string
  const error = query.error as string | undefined

  if (error) {
    return sendRedirect(event, '/create?strava_error=access_denied')
  }

  if (!code) {
    throw createError({ statusCode: 400, message: 'Missing authorization code' })
  }

  const config = useRuntimeConfig()

  // Exchange code for tokens
  const tokenResponse = await $fetch<{
    access_token: string
    refresh_token: string
    expires_at: number
    athlete: { id: number; firstname: string; lastname: string }
  }>('https://www.strava.com/oauth/token', {
    method: 'POST',
    body: {
      client_id: config.stravaClientId,
      client_secret: config.stravaClientSecret,
      code,
      grant_type: 'authorization_code',
    },
  })

  const supabase = await serverSupabaseClient(event)

  // Upsert tokens
  const { error: dbError } = await supabase
    .from('strava_tokens')
    .upsert({
      user_id: user.id,
      access_token: tokenResponse.access_token,
      refresh_token: tokenResponse.refresh_token,
      expires_at: tokenResponse.expires_at,
      athlete_id: tokenResponse.athlete.id,
    })

  if (dbError) {
    throw createError({ statusCode: 500, message: 'Failed to store Strava tokens' })
  }

  return sendRedirect(event, '/create?strava_connected=1')
})
