/**
 * GET /api/maps/public/:id
 * Returns a publicly shareable subset of a map record.
 * Only maps with is_public = true are accessible — maps in 'draft' or 'rendering'
 * status are never exposed here regardless of who requests them.
 */
import { createClient } from '@supabase/supabase-js'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'Missing map ID' })

  const config = useRuntimeConfig()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient(
    config.public.supabaseUrl as string,
    config.supabaseServiceKey as string,
  ) as any

  const { data: map, error } = await supabase
    .from('maps')
    .select('id, title, subtitle, geojson, bbox, stats, style_config, render_url, thumbnail_url, status')
    .eq('id', id)
    .eq('is_public', true)
    .single()

  if (error || !map) {
    throw createError({ statusCode: 404, message: 'Map not found' })
  }

  return map
})
