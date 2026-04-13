/**
 * GET /api/strava/callback
 * OAuth 2.0 callback from Strava.
 *
 * Handles both cases:
 *   • New visitor  — creates a Supabase account (synthetic email), stores tokens,
 *                    then generates a magic link to establish the session.
 *   • Returning    — looks up the existing user by athlete_id, refreshes tokens,
 *                    then generates a magic link to log them back in.
 *
 * No prior Supabase session is required — this IS the sign-in step.
 */
import { serverSupabaseServiceRole } from '#supabase/server'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const code = query.code as string
  const error = query.error as string | undefined

  if (error) return sendRedirect(event, '/auth/login?strava_error=access_denied')
  if (!code) throw createError({ statusCode: 400, message: 'Missing authorization code' })

  const config = useRuntimeConfig()

  // Derive origin the same way connect.get.ts does
  const proto = getRequestHeader(event, 'x-forwarded-proto') ?? 'http'
  const host = getRequestHeader(event, 'x-forwarded-host') ?? getRequestHeader(event, 'host') ?? 'localhost:3000'
  const origin = `${proto}://${host}`

  // 1. Exchange code for Strava tokens + athlete info
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

  const athleteId = tokenResponse.athlete.id
  // Synthetic email: deterministic, unguessable as a login target
  const syntheticEmail = `strava-${athleteId}@auth.radmaps.studio`
  const adminClient = await serverSupabaseServiceRole(event)

  // 2. Find or create the Supabase user for this Strava athlete
  let userId: string

  const { data: existingToken } = await adminClient
    .from('strava_tokens')
    .select('user_id')
    .eq('athlete_id', athleteId)
    .maybeSingle()

  if (existingToken?.user_id) {
    userId = existingToken.user_id
  } else {
    // First time — create a Supabase account with email pre-confirmed (no inbox needed)
    const { data: newUser, error: createErr } = await adminClient.auth.admin.createUser({
      email: syntheticEmail,
      email_confirm: true,
      user_metadata: {
        full_name: `${tokenResponse.athlete.firstname} ${tokenResponse.athlete.lastname}`,
        provider: 'strava',
        strava_athlete_id: athleteId,
      },
    })

    if (createErr || !newUser.user) {
      throw createError({ statusCode: 500, message: createErr?.message ?? 'Failed to create user' })
    }
    userId = newUser.user.id
  }

  // 3. Store / refresh Strava tokens
  const { error: dbError } = await adminClient.from('strava_tokens').upsert({
    user_id: userId,
    access_token: tokenResponse.access_token,
    refresh_token: tokenResponse.refresh_token,
    expires_at: tokenResponse.expires_at,
    athlete_id: athleteId,
  })
  if (dbError) throw createError({ statusCode: 500, message: 'Failed to store Strava tokens' })

  // 4. Generate a one-time magic link so the browser can acquire a Supabase session.
  //    redirectTo → /auth/confirm, which handles the hash tokens and sends user to /dashboard.
  const { data: linkData, error: linkErr } = await adminClient.auth.admin.generateLink({
    type: 'magiclink',
    email: syntheticEmail,
    options: { redirectTo: `${origin}/auth/confirm` },
  })

  if (linkErr || !linkData?.properties?.action_link) {
    throw createError({ statusCode: 500, message: linkErr?.message ?? 'Failed to generate login link' })
  }

  return sendRedirect(event, linkData.properties.action_link)
})
