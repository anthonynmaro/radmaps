/**
 * GET /api/maps/public/:id
 * Returns a publicly shareable subset of a map record.
 * Uses the service key to bypass RLS — any map can be shared by UUID.
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
    .single()

  if (error || !map) {
    throw createError({ statusCode: 404, message: 'Map not found' })
  }

  return map
})
