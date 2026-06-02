import { z } from 'zod'
import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'
import { DEFAULT_STYLE_CONFIG, DEFAULT_TRAIL_SEGMENT_WIDTH, type StyleConfig, type TrailSegment } from '~/types'
import { GPX_MAX_BYTES, parseGpxServer } from '~/utils/gpx'
import { validateRouteGeojson } from '~/server/utils/routeValidation'
import { defaultTrailSegmentColor } from '~/utils/trail'

const MapIdSchema = z.string().uuid()

const SEGMENT_COLORS = ['#2D6A4F', '#3A7CA5', '#C1121F', '#E87722', '#F4B942', '#7B3F8D', '#4ECDC4', '#C8A97E', '#555555', '#FFFFFF']

function nextSegmentColor(styleConfig: StyleConfig, segments: TrailSegment[]): string {
  if (styleConfig.color_theme === 'dark-sky') return defaultTrailSegmentColor(styleConfig, segments)

  const used = new Set(segments.map(segment => segment.color))
  return SEGMENT_COLORS.find(color => !used.has(color)) ?? SEGMENT_COLORS[0]
}

function segmentName(trackName: string | undefined, filename: string | undefined, count: number): string {
  if (trackName) return trackName
  if (filename) return filename.replace(/\.(gpx)$/i, '').replace(/[-_]/g, ' ').trim() || `Track ${count + 1}`
  return `Track ${count + 1}`
}

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const parsedMapId = MapIdSchema.safeParse(getRouterParam(event, 'id'))
  if (!parsedMapId.success) throw createError({ statusCode: 400, message: 'Invalid map ID' })
  const mapId = parsedMapId.data

  const supabase = await serverSupabaseClient(event)
  const { data: mapRow, error: mapError } = await supabase
    .from('maps')
    .select('id, style_config')
    .eq('id', mapId)
    .eq('user_id', user.id)
    .single()

  if (mapError || !mapRow) throw createError({ statusCode: 404, message: 'Map not found' })

  const form = await readFormData(event)
  const gpxFile = form.get('gpx') as File | null
  if (!gpxFile || typeof gpxFile === 'string') {
    throw createError({ statusCode: 400, message: 'No GPX file provided' })
  }
  if (gpxFile.size > GPX_MAX_BYTES) {
    throw createError({ statusCode: 413, message: 'GPX file too large (max 5 MB)' })
  }

  let parsed: ReturnType<typeof parseGpxServer>
  try {
    parsed = parseGpxServer(await gpxFile.text())
    validateRouteGeojson(parsed.geojson)
  } catch (err) {
    throw createError({ statusCode: 422, message: `Invalid GPX file: ${(err as Error).message}` })
  }

  const styleConfig = {
    ...DEFAULT_STYLE_CONFIG,
    ...((mapRow.style_config ?? {}) as StyleConfig),
  }
  const existingSegments = styleConfig.trail_segments ?? []
  const segment: TrailSegment = {
    id: crypto.randomUUID(),
    name: segmentName(parsed.trackName, gpxFile.name, existingSegments.length),
    color: nextSegmentColor(styleConfig, existingSegments),
    visible: true,
    source: 'uploaded-track',
    geojson: parsed.geojson,
    bbox: parsed.bbox,
    stats: parsed.stats,
    source_filename: gpxFile.name,
    section_start: 0,
    section_end: 100,
    width: DEFAULT_TRAIL_SEGMENT_WIDTH,
    opacity: 0.9,
    smooth: 0,
    bend: 0,
    dash: false,
  }
  const nextStyleConfig: StyleConfig = {
    ...styleConfig,
    trail_segments: [...existingSegments, segment],
  }

  const { error: updateError } = await supabase
    .from('maps')
    .update({
      style_config: nextStyleConfig,
      updated_at: new Date().toISOString(),
    })
    .eq('id', mapId)
    .eq('user_id', user.id)

  if (updateError) throw createError({ statusCode: 500, message: updateError.message })

  return {
    style_config: nextStyleConfig,
    segment,
    outside_current_frame_hint_data: {
      bbox: parsed.bbox,
    },
  }
})
