/**
 * DELETE /api/maps/:id
 * Deletes an authenticated user's map from their collection.
 */
import { z } from 'zod'
import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'

const MapIdSchema = z.string().uuid()

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const parsedId = MapIdSchema.safeParse(getRouterParam(event, 'id'))
  if (!parsedId.success) {
    throw createError({ statusCode: 400, message: 'Invalid map id' })
  }

  const mapId = parsedId.data
  const supabase = await serverSupabaseClient(event)

  const { data: map, error: mapError } = await supabase
    .from('maps')
    .select('id, status')
    .eq('id', mapId)
    .eq('user_id', user.id)
    .single()

  if (mapError || !map) {
    throw createError({ statusCode: 404, message: 'Map not found' })
  }

  if (map.status === 'ordered') {
    throw createError({
      statusCode: 409,
      message: 'Ordered maps are kept with your order history and cannot be deleted from the collection yet.',
    })
  }

  const { data: orders, error: ordersError } = await supabase
    .from('orders')
    .select('id')
    .eq('map_id', mapId)
    .eq('user_id', user.id)
    .limit(1)

  if (ordersError) {
    throw createError({ statusCode: 500, message: 'Could not check map order history' })
  }

  if ((orders?.length ?? 0) > 0) {
    throw createError({
      statusCode: 409,
      message: 'Maps with order history are kept with your order records and cannot be deleted from the collection yet.',
    })
  }

  const { error: deleteError } = await supabase
    .from('maps')
    .delete()
    .eq('id', mapId)
    .eq('user_id', user.id)

  if (deleteError) {
    throw createError({ statusCode: 500, message: deleteError.message })
  }

  return { ok: true, id: mapId }
})
