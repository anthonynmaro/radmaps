/**
 * POST /api/strava/activities/:id/import
 * Body: { title?: string }
 * Fetches GPS stream from a Strava activity, converts it to GeoJSON, and
 * creates a map record so the user can immediately start styling.
 */
import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'
import { DEFAULT_STYLE_CONFIG } from '~/types'
import { getValidStravaAccessToken } from '~/server/utils/stravaTokens'
import { validateRouteGeojson } from '~/server/utils/routeValidation'
import { assertRateLimit } from '~/server/utils/rateLimit'
import { buildStravaImportRoute } from '~/server/utils/stravaImportRoute'
import type { StravaImportActivity, StravaImportStreams } from '~/server/utils/stravaImportRoute'

const importLocks = new Map<string, number>()
const IMPORT_LOCK_TTL_MS = 5 * 60_000

// ─── Handler ──────────────────────────────────────────────────────────────────

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user) throw createError({ statusCode: 401, message: 'Unauthorized' })
  assertRateLimit(event, { key: 'strava-import', userId: user.id, limit: 20, windowMs: 60 * 60_000 })

  const activityId = getRouterParam(event, 'id')
  if (!activityId) throw createError({ statusCode: 400, message: 'Activity ID required' })
  if (!/^\d+$/.test(activityId)) throw createError({ statusCode: 400, message: 'Invalid activity ID' })
  const lockKey = `${user.id}:${activityId}`
  const existingLock = importLocks.get(lockKey)
  if (existingLock && existingLock > Date.now()) {
    throw createError({ statusCode: 409, message: 'This activity import is already in progress' })
  }
  importLocks.set(lockKey, Date.now() + IMPORT_LOCK_TTL_MS)

  try {
    const body = await readBody(event).catch(() => ({}))
    const customTitle = body?.title as string | undefined

    const supabase = await serverSupabaseClient(event)
    const config = useRuntimeConfig()

    // Get a valid (possibly refreshed) access token
    const accessToken = await getValidStravaAccessToken(user.id, supabase, config)

    const authHeaders = { Authorization: `Bearer ${accessToken}` }

    // 1. Fetch activity details
    const activity = await $fetch<StravaImportActivity>(
      `https://www.strava.com/api/v3/activities/${activityId}`,
      { headers: authHeaders },
    ).catch(() => {
      throw createError({ statusCode: 502, message: 'Failed to fetch activity from Strava' })
    })

    // 2. Fetch GPS streams
    const streams = await $fetch<StravaImportStreams>(
      `https://www.strava.com/api/v3/activities/${activityId}/streams`,
      {
        headers: authHeaders,
        query: { keys: 'latlng,altitude', key_by_type: 'true' },
      },
    ).catch(() => {
      throw createError({ statusCode: 502, message: 'Failed to fetch activity streams from Strava' })
    })

    if (!streams.latlng?.data?.length) {
      throw createError({
        statusCode: 422,
        message: 'This activity has no GPS data and cannot be imported as a map',
      })
    }

    const { geojson, bbox, stats } = buildStravaImportRoute(activity, streams)
    validateRouteGeojson(geojson)

    // Avoid reverse-geocoding exact Strava start coordinates here. Location labels
    // should come from a coarse, cached geocoding path rather than disclosing every
    // import to a third party.

    const { data: map, error: insertError } = await supabase
      .from('maps')
      .insert({
        user_id: user.id,
        title: customTitle?.trim() || activity.name,
        geojson,
        bbox,
        stats,
        style_config: DEFAULT_STYLE_CONFIG,
        status: 'draft',
      })
      .select('id')
      .single()

    if (insertError || !map) {
      throw createError({ statusCode: 500, message: insertError?.message ?? 'Failed to create map' })
    }

    return { id: map.id }
  } finally {
    importLocks.delete(lockKey)
  }
})
