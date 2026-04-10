/**
 * POST /api/maps
 * Create a new map from a GPX file upload or a raw GeoJSON payload.
 * Body: multipart/form-data with `gpx` file, OR JSON with `geojson` + `bbox` + `stats`
 */
import { z } from 'zod'
import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'
import { parseGpxServer } from '~/utils/gpx'
import { DEFAULT_STYLE_CONFIG } from '~/types'
import type { RouteStats } from '~/types'

const CreateMapBody = z.object({
  title: z.string().min(1).max(120),
  subtitle: z.string().max(120).optional(),
})

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const supabase = await serverSupabaseClient(event)
  const contentType = getHeader(event, 'content-type') ?? ''

  let title: string
  let subtitle: string | undefined
  let geojson: GeoJSON.FeatureCollection
  let bbox: [number, number, number, number]
  let stats: RouteStats

  if (contentType.includes('application/json')) {
    // Client parsed GPX in the browser and is sending pre-computed GeoJSON + stats
    const body = await readBody(event)
    const parsed = CreateMapBody.safeParse({ title: body.title, subtitle: body.subtitle })
    if (!parsed.success) throw createError({ statusCode: 400, message: parsed.error.message })

    if (!body.geojson || !body.bbox || !body.stats) {
      throw createError({ statusCode: 400, message: 'Missing required fields: geojson, bbox, stats' })
    }

    title = parsed.data.title
    subtitle = parsed.data.subtitle
    geojson = body.geojson
    bbox = body.bbox
    stats = body.stats
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

    const gpxText = await gpxFile.text()
    const { error: storageError } = await supabase.storage
      .from('gpx-uploads')
      .upload(`${user.id}/${Date.now()}.gpx`, gpxFile, { contentType: 'application/gpx+xml' })

    if (storageError) {
      throw createError({ statusCode: 500, message: `GPX storage error: ${storageError.message}` })
    }

    try {
      const result = parseGpxServer(gpxText)
      geojson = result.geojson
      bbox = result.bbox
      stats = result.stats
    } catch (e) {
      throw createError({ statusCode: 422, message: `Invalid GPX file: ${(e as Error).message}` })
    }
  }

  // Insert map record
  const { data: map, error } = await supabase
    .from('maps')
    .insert({
      user_id: user.id,
      title,
      subtitle,
      geojson,
      bbox,
      stats,
      style_config: DEFAULT_STYLE_CONFIG,
      status: 'draft',
    })
    .select()
    .single()

  if (error) {
    throw createError({ statusCode: 500, message: error.message })
  }

  return map
})
