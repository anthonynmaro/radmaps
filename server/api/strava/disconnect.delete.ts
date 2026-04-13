/**
 * DELETE /api/strava/disconnect
 * Removes stored Strava tokens for the authenticated user.
 */
import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const supabase = await serverSupabaseClient(event)

  const { error } = await supabase
    .from('strava_tokens')
    .delete()
    .eq('user_id', user.id)

  if (error) {
    throw createError({ statusCode: 500, message: 'Failed to disconnect Strava' })
  }

  return { ok: true }
})
