import { serverSupabaseServiceRole } from '#supabase/server'
import { requireStaff } from '~/server/utils/adminAuth'
import { premadeRowToMap } from '~/server/utils/premadeCatalog'

export default defineEventHandler(async (event) => {
  await requireStaff(event, 'premade:edit')
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'Premade ID required' })

  const supabase = await serverSupabaseServiceRole(event)
  const { data, error } = await supabase
    .from('premade_maps')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) throw createError({ statusCode: 500, message: error.message })
  if (!data) throw createError({ statusCode: 404, message: 'Premade map not found' })
  return premadeRowToMap(data)
})
