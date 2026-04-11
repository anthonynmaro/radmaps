/**
 * GET /api/strava/callback
 * OAuth 2.0 callback from Strava. Handles two flows:
 *
 * 1. Authenticated user (connecting Strava for activity import from /create):
 *    → stores tokens, redirects to /create?strava_connected=1
 *
 * 2. Unauthenticated user (signing in via Strava from /auth/login):
 *    → creates/finds a Supabase account tied to the Strava athlete,
 *      stores tokens, generates a one-time magic-link session, and
 *      redirects through Supabase auth → /auth/confirm → /dashboard
 */
import { serverSupabaseUser } from '#supabase/server'
import { createClient } from '@supabase/supabase-js'

interface StravaTokenResponse {
  access_token: string
  refresh_token: string
  expires_at: number
  athlete: {
    id: number
    firstname: string
    lastname: string
  }
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const code = query.code as string
  const errorParam = query.error as string | undefined

  if (errorParam) {
    return sendRedirect(event, '/auth/login?strava_error=access_denied')
  }

  if (!code) {
    throw createError({ statusCode: 400, message: 'Missing authorization code' })
  }

  const config = useRuntimeConfig()
  const siteUrl = (config.public.siteUrl as string) || 'https://radmaps.studio'

  // Exchange authorization code for access + refresh tokens
  const tokenResponse = await $fetch<StravaTokenResponse>('https://www.strava.com/oauth/token', {
    method: 'POST',
    body: {
      client_id: config.stravaClientId,
      client_secret: config.stravaClientSecret,
      code,
      grant_type: 'authorization_code',
    },
  }).catch(() => {
    throw createError({ statusCode: 502, message: 'Failed to exchange Strava authorization code' })
  })

  const { athlete } = tokenResponse

  // Admin client — needed for user creation and cross-user token lookups (bypasses RLS)
  const adminSupabase = createClient(
    config.public.supabaseUrl as string,
    config.supabaseServiceKey as string,
  )

  // ── Flow 1: Authenticated user connecting Strava to existing account ──────────
  const currentUser = await serverSupabaseUser(event)

  if (currentUser) {
    const { error: upsertError } = await adminSupabase
      .from('strava_tokens')
      .upsert({
        user_id: currentUser.id,
        access_token: tokenResponse.access_token,
        refresh_token: tokenResponse.refresh_token,
        expires_at: tokenResponse.expires_at,
        athlete_id: athlete.id,
      })

    if (upsertError) {
      throw createError({ statusCode: 500, message: 'Failed to store Strava tokens' })
    }

    return sendRedirect(event, '/create?strava_connected=1')
  }

  // ── Flow 2: Unauthenticated — sign in (or sign up) via Strava ────────────────
  //
  // Each Strava athlete gets a deterministic virtual email address that is
  // never used to receive mail — it simply anchors the Supabase account.
  const stravaEmail = `strava_${athlete.id}@strava.radmaps.studio`

  // Check whether this Strava athlete already has an account
  const { data: existingToken } = await adminSupabase
    .from('strava_tokens')
    .select('user_id')
    .eq('athlete_id', athlete.id)
    .maybeSingle()

  if (existingToken?.user_id) {
    // Returning user — refresh the stored tokens
    await adminSupabase
      .from('strava_tokens')
      .update({
        access_token: tokenResponse.access_token,
        refresh_token: tokenResponse.refresh_token,
        expires_at: tokenResponse.expires_at,
      })
      .eq('user_id', existingToken.user_id)
  } else {
    // First-time Strava user — create a confirmed Supabase account
    const { data: newUserData, error: createUserError } = await adminSupabase.auth.admin.createUser({
      email: stravaEmail,
      email_confirm: true,
      user_metadata: {
        full_name: `${athlete.firstname} ${athlete.lastname}`,
        strava_athlete_id: athlete.id,
        provider: 'strava',
      },
    })

    if (createUserError || !newUserData?.user) {
      throw createError({ statusCode: 500, message: 'Failed to create Strava user account' })
    }

    // Store tokens under the new user
    const { error: insertError } = await adminSupabase
      .from('strava_tokens')
      .insert({
        user_id: newUserData.user.id,
        access_token: tokenResponse.access_token,
        refresh_token: tokenResponse.refresh_token,
        expires_at: tokenResponse.expires_at,
        athlete_id: athlete.id,
      })

    if (insertError) {
      throw createError({ statusCode: 500, message: 'Failed to store Strava tokens' })
    }
  }

  // Generate a single-use magic link to establish a Supabase session.
  // Redirecting the user to action_link causes Supabase to verify the token
  // and then forward them to redirectTo with auth tokens in the URL fragment,
  // which the @nuxtjs/supabase plugin picks up on /auth/confirm.
  const { data: linkData, error: linkError } = await adminSupabase.auth.admin.generateLink({
    type: 'magiclink',
    email: stravaEmail,
    options: {
      redirectTo: `${siteUrl}/auth/confirm`,
    },
  })

  if (linkError || !linkData?.properties?.action_link) {
    throw createError({ statusCode: 500, message: 'Failed to generate sign-in session' })
  }

  return sendRedirect(event, linkData.properties.action_link)
})
