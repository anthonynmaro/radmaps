/**
 * GET /api/strava/connect
 * Initiates Strava OAuth — redirects the user to Strava's authorization page.
 * Scope: activity:read by default. Add ?private=1 for an explicit private
 * activity import consent flow, which requests activity:read_all.
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
import { randomBytes } from 'node:crypto'
import type { H3Event } from 'h3'

const STATE_COOKIE = 'radmaps_strava_oauth_state'

function requestOrigin(event: H3Event) {
  const config = useRuntimeConfig()
  const configuredSiteUrl = String(config.public.siteUrl || '')
  if (process.env.NODE_ENV === 'production' && configuredSiteUrl) {
    return configuredSiteUrl.replace(/\/$/, '')
  }
  const proto = getRequestHeader(event, 'x-forwarded-proto') ?? 'http'
  const host = getRequestHeader(event, 'x-forwarded-host') ?? getRequestHeader(event, 'host') ?? 'localhost:3000'
  return `${proto}://${host}`
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const query = getQuery(event)
  const includePrivate = query.private === '1' || query.scope === 'private'

  // Short-circuit: if the user is already logged in and has tokens, skip OAuth.
  try {
    const user = await serverSupabaseUser(event)
    if (user && !includePrivate) {
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

  const origin = requestOrigin(event)
  const redirectUri = `${origin}/api/strava/callback`
  const state = randomBytes(24).toString('base64url')
  setCookie(event, STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 10 * 60,
  })

  const params = new URLSearchParams({
    client_id: config.stravaClientId as string,
    redirect_uri: redirectUri,
    response_type: 'code',
    approval_prompt: 'auto',
    scope: includePrivate ? 'activity:read_all' : 'activity:read',
    state,
  })

  const authUrl = `https://www.strava.com/oauth/authorize?${params.toString()}`

  return sendRedirect(event, authUrl)
})
