/**
 * GET /api/strava/connect
 * Initiates Strava OAuth — redirects the user to Strava's authorization page.
 * Scope: activity:read_all (needed to read GPS data from activities)
 */
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()

  const params = new URLSearchParams({
    client_id: config.stravaClientId as string,
    redirect_uri: config.stravaRedirectUri as string,
    response_type: 'code',
    approval_prompt: 'auto',
    scope: 'activity:read_all',
  })

  const authUrl = `https://www.strava.com/oauth/authorize?${params.toString()}`

  return sendRedirect(event, authUrl)
})
