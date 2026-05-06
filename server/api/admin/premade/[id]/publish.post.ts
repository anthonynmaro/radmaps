import { serverSupabaseServiceRole } from '#supabase/server'
import { requireStaff } from '~/server/utils/adminAuth'
import { premadeRowToMap } from '~/server/utils/premadeCatalog'
import { missingPublishFields } from '~/utils/premadeCatalog'

export default defineEventHandler(async (event) => {
  const session = await requireStaff(event, 'premade:publish')
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'Premade ID required' })

  const supabase = await serverSupabaseServiceRole(event)
  const { data: current, error: fetchError } = await supabase
    .from('premade_maps')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (fetchError) throw createError({ statusCode: 500, message: fetchError.message })
  if (!current) throw createError({ statusCode: 404, message: 'Premade map not found' })

  const missing = missingPublishFields(premadeRowToMap(current))
  if (missing.length > 0) {
    throw createError({
      statusCode: 422,
      message: `Cannot publish until these fields are present: ${missing.join(', ')}`,
    })
  }

  const { data, error } = await supabase
    .from('premade_maps')
    .update({
      status: 'published',
      needs_preview: false,
      updated_by: session.user!.id,
    })
    .eq('id', id)
    .select('*')
    .single()

  if (error) throw createError({ statusCode: 500, message: error.message })
  return premadeRowToMap(data)
})
