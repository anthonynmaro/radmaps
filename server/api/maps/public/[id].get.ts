/**
 * GET /api/maps/public/:id
 * Returns a publicly shareable subset of a map record.
 * Only maps with is_public = true are accessible — maps in 'draft' or 'rendering'
 * status are never exposed here regardless of who requests them.
 */
import { z } from 'zod'
import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'

const MapIdSchema = z.string().uuid()

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'Missing map ID' })
  if (!MapIdSchema.safeParse(id).success) throw createError({ statusCode: 400, message: 'Invalid map ID' })

  const user = await serverSupabaseUser(event).catch(() => null)
  const supabase = await serverSupabaseClient(event)

  const { data: map, error } = await supabase
    .from('maps')
    .select('id, user_id, title, subtitle, stats, render_url, thumbnail_url, proof_render_url, proof_render_hash, status, updated_at')
    .eq('id', id)
    .eq('is_public', true)
    .single()

  if (error || !map) {
    throw createError({ statusCode: 404, message: 'Map not found' })
  }

  const { user_id: userId, ...publicMap } = map
  return {
    ...publicMap,
    owned_by_viewer: Boolean(user?.id && user.id === userId),
  }
})
