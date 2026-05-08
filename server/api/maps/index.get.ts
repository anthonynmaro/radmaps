import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'

const DASHBOARD_MAP_SELECT = [
  'id',
  'user_id',
  'title',
  'subtitle',
  'stats',
  'style_config',
  'thumbnail_url',
  'render_url',
  'proof_render_url',
  'status',
  'created_at',
  'updated_at',
].join(',')

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  setHeader(event, 'Cache-Control', 'private, max-age=15')
  const supabase = await serverSupabaseClient(event)
  const { data, error } = await supabase
    .from('maps')
    .select(DASHBOARD_MAP_SELECT)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) throw createError({ statusCode: 500, message: error.message })
  return data || []
})
