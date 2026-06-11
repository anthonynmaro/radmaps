/**
 * POST /api/maps
 * Create a new map from a GPX file upload or a raw GeoJSON payload.
 * Body: multipart/form-data with `gpx` file, OR JSON with `geojson` + `bbox` + `stats`
 */
import { z } from 'zod'
import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'
import { parseGpxServer } from '~/utils/gpx'
import { DEFAULT_STYLE_CONFIG } from '~/types'
import type { RouteStats, TrailSegment } from '~/types'
import { extractNamedTrackSegments } from '~/utils/trail'
import { assertRouteGeojsonSize, validateRouteGeojson } from '~/server/utils/routeValidation'
import { assertRateLimit } from '~/server/utils/rateLimit'
import { enrichThemeLocationMetadata } from '~/server/utils/themeDataEnrichment'
import {
  THEME_LOCATION_METADATA_COLUMNS,
  isMissingPostgrestSchemaColumnError,
  omitColumns,
} from '~/server/utils/postgrestSchema'

const CreateMapBody = z.object({
  title: z.string().min(1).max(120),
  subtitle: z.string().max(120).optional(),
})

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user) throw createError({ statusCode: 401, message: 'Unauthorized' })
  assertRateLimit(event, { key: 'map-create', userId: user.id, limit: 20, windowMs: 60 * 60_000 })

  const supabase = await serverSupabaseClient(event)
  const contentType = getHeader(event, 'content-type') ?? ''

  let title: string
  let subtitle: string | undefined
  let geojson: GeoJSON.FeatureCollection
  let bbox: [number, number, number, number]
  let stats: RouteStats
  let trailSegments: TrailSegment[] = []
  let locationInput: {
    location_label?: string | null
    location_city?: string | null
    location_region?: string | null
    location_country?: string | null
    location_lng?: number | null
    location_lat?: number | null
  } = {}

  if (contentType.includes('application/json')) {
    // Client parsed GPX in the browser and is sending pre-computed GeoJSON + stats
    const body = await readBody(event)
    const parsed = CreateMapBody.safeParse({ title: body.title, subtitle: body.subtitle })
    if (!parsed.success) throw createError({ statusCode: 400, message: parsed.error.message })

    if (!body.geojson || !body.bbox || !body.stats) {
      throw createError({ statusCode: 400, message: 'Missing required fields: geojson, bbox, stats' })
    }

    // Prevent oversized GeoJSON from crashing the render worker OOM.
    assertRouteGeojsonSize(body.geojson)

    // Validate bbox values are finite and in legal ranges.
    if (Array.isArray(body.bbox) && body.bbox.length === 4) {
      const [minLng, minLat, maxLng, maxLat] = body.bbox as number[]
      if (
        !isFinite(minLng) || !isFinite(minLat) || !isFinite(maxLng) || !isFinite(maxLat) ||
        minLng >= maxLng || minLat >= maxLat ||
        minLng < -180 || maxLng > 180 || minLat < -90 || maxLat > 90
      ) {
        throw createError({ statusCode: 400, message: 'Invalid bounding box coordinates' })
      }
    }

    title = parsed.data.title
    subtitle = parsed.data.subtitle
    geojson = body.geojson
    validateRouteGeojson(geojson)
    bbox = body.bbox
    stats = body.stats
    locationInput = {
      location_label: typeof body.location_label === 'string' ? body.location_label : null,
      location_city: typeof body.location_city === 'string' ? body.location_city : null,
      location_region: typeof body.location_region === 'string' ? body.location_region : null,
      location_country: typeof body.location_country === 'string' ? body.location_country : null,
      location_lng: typeof body.location_lng === 'number' ? body.location_lng : null,
      location_lat: typeof body.location_lat === 'number' ? body.location_lat : null,
    }
    // Client-side parsed GPX may include auto-detected named track segments
    if (Array.isArray(body.trail_segments) && body.trail_segments.length > 0) {
      trailSegments = body.trail_segments
    }
  } else {
    // Raw GPX file upload via multipart/form-data
    const formData = await readFormData(event)
    const rawTitle = formData.get('title') as string ?? 'My Trail Map'
    const rawSubtitle = formData.get('subtitle') as string | undefined
    const gpxFile = formData.get('gpx') as File | null

    const parsed = CreateMapBody.safeParse({ title: rawTitle, subtitle: rawSubtitle })
    if (!parsed.success) throw createError({ statusCode: 400, message: parsed.error.message })
    title = parsed.data.title
    subtitle = parsed.data.subtitle

    if (!gpxFile) throw createError({ statusCode: 400, message: 'No GPX file provided' })

    // Guard against XML bomb (billion-laughs) attacks and accidental huge uploads.
    if (gpxFile.size > 5 * 1024 * 1024) {
      throw createError({ statusCode: 413, message: 'GPX file too large (max 5 MB)' })
    }

    const gpxText = await gpxFile.text()
    try {
      const result = parseGpxServer(gpxText)
      geojson = result.geojson
      assertRouteGeojsonSize(geojson)
      validateRouteGeojson(geojson)
      bbox = result.bbox
      stats = result.stats
      trailSegments = extractNamedTrackSegments(result.geojson)
    } catch (e) {
      throw createError({ statusCode: 422, message: `Invalid GPX file: ${(e as Error).message}` })
    }
  }

  // Insert map record
  const locationMetadata = await enrichThemeLocationMetadata({
    title,
    bbox,
    stats,
    ...locationInput,
  })
  const insertPayload = {
    user_id: user.id,
    title,
    subtitle,
    geojson,
    bbox,
    stats,
    ...locationMetadata,
    style_config: trailSegments.length > 0
      ? { ...DEFAULT_STYLE_CONFIG, trail_segments: trailSegments }
      : DEFAULT_STYLE_CONFIG,
    status: 'draft',
  }
  let { data: map, error } = await supabase
    .from('maps')
    .insert(insertPayload)
    .select()
    .single()

  if (error && isMissingPostgrestSchemaColumnError(error)) {
    console.warn('[maps:create] location metadata columns missing from PostgREST schema cache; retrying without cached enrichment', {
      code: error.code,
      message: error.message,
    })
    const retry = await supabase
      .from('maps')
      .insert(omitColumns(insertPayload, THEME_LOCATION_METADATA_COLUMNS))
      .select()
      .single()
    map = retry.data
    error = retry.error
  }

  if (error) {
    throw createError({ statusCode: 500, message: error.message })
  }

  return map
})
