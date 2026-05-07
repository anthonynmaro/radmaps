import { serverSupabaseServiceRole } from '#supabase/server'
import { requireStaff } from '~/server/utils/adminAuth'
import { premadeRowToMap } from '~/server/utils/premadeCatalog'
import { renderPremadeThumbnail } from '~/server/utils/premadeThumbnail'

export default defineEventHandler(async (event) => {
  const session = await requireStaff(event, 'premade:edit')
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'Premade ID required' })

  const supabase = await serverSupabaseServiceRole(event)
  const { data: premade, error: premadeError } = await supabase
    .from('premade_maps')
    .select('id')
    .eq('id', id)
    .maybeSingle()

  if (premadeError) throw createError({ statusCode: 500, message: premadeError.message })
  if (!premade) throw createError({ statusCode: 404, message: 'Premade map not found' })

  await renderPremadeThumbnail({
    event,
    premadeId: id,
    updatedBy: session.user!.id,
    force: true,
  })

  const { data, error } = await supabase
    .from('premade_maps')
    .select('*')
    .eq('id', id)
    .single()
  if (error) throw createError({ statusCode: 500, message: error.message })
  return premadeRowToMap(data)
})
