/**
 * GET /api/strava/connect
 * Initiates Strava OAuth — redirects the user to Strava's authorization page.
 * Scope: activity:read_all (needed to read GPS data from activities)
 *
 * The redirect_uri is derived dynamically from the incoming request so that
 * it works correctly on localhost in dev and on the production domain without
 * needing a STRAVA_REDIRECT_URI env var (which was the source of the old
 * localhost:3000/auth/strava-callback mismatch on Vercel).
 *
 * If the logged-in user already has Strava tokens stored, skip OAuth entirely
 * and redirect straight to the create page.
 */
import { serverSupabaseUser, serverSupabaseClient } from '#supabase/server'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()

  // Short-circuit: if the user is already logged in and has tokens, skip OAuth.
  try {
    const user = await serverSupabaseUser(event)
    if (user) {
      const client = await serverSupabaseClient(event)
      const { data: token } = await client
        .from('strava_tokens')
        .select('athlete_id')
        .eq('user_id', user.id)
        .maybeSingle()
      if (token?.athlete_id) {
        return sendRedirect(event, '/create?strava_connected=1')
      }
    }
  } catch {
    // No session or DB error — fall through to normal OAuth flow
  }

  // Build the redirect URI from the actual request origin.
  // x-forwarded-proto / x-forwarded-host are set by Vercel's edge proxy,
  // so this resolves to https://radmaps.studio in production and
  // http://localhost:3000 in local dev automatically.
  const proto = getRequestHeader(event, 'x-forwarded-proto') ?? 'http'
  const host = getRequestHeader(event, 'x-forwarded-host') ?? getRequestHeader(event, 'host') ?? 'localhost:3000'
  const redirectUri = `${proto}://${host}/api/strava/callback`

  const params = new URLSearchParams({
    client_id: config.stravaClientId as string,
    redirect_uri: redirectUri,
    response_type: 'code',
    approval_prompt: 'auto',
    scope: 'activity:read_all',
  })

  const authUrl = `https://www.strava.com/oauth/authorize?${params.toString()}`

  return sendRedirect(event, authUrl)
})
