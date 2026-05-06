import { serverSupabaseServiceRole } from '#supabase/server'
import { requireStaff } from '~/server/utils/adminAuth'
import { premadeRowToMap } from '~/server/utils/premadeCatalog'

export default defineEventHandler(async (event) => {
  await requireStaff(event, 'premade:edit')
  const supabase = await serverSupabaseServiceRole(event)
  const { data, error } = await supabase
    .from('premade_maps')
    .select('*')
    .order('status', { ascending: true })
    .order('homepage_sort_order', { ascending: true })
    .order('updated_at', { ascending: false })

  if (error) throw createError({ statusCode: 500, message: error.message })
  return (data || []).map(premadeRowToMap)
})
