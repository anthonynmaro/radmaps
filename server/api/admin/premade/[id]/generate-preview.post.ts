import { serverSupabaseServiceRole } from '#supabase/server'
import { requireStaff } from '~/server/utils/adminAuth'
import { renderMapProof } from '~/server/api/maps/[id]/render.post'
import { previewUrlForSourceMap } from '~/utils/premadeCatalog'
import { premadeRowToMap } from '~/server/utils/premadeCatalog'

export default defineEventHandler(async (event) => {
  const session = await requireStaff(event, 'premade:edit')
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'Premade ID required' })

  const supabase = await serverSupabaseServiceRole(event)
  const { data: premade, error: premadeError } = await supabase
    .from('premade_maps')
    .select('id, source_map_id')
    .eq('id', id)
    .maybeSingle()

  if (premadeError) throw createError({ statusCode: 500, message: premadeError.message })
  if (!premade) throw createError({ statusCode: 404, message: 'Premade map not found' })
  if (!premade.source_map_id) {
    throw createError({ statusCode: 422, message: 'This premade map has no source map to render' })
  }

  const { data: source, error: sourceError } = await supabase
    .from('maps')
    .select('id, user_id, proof_render_url, thumbnail_url, render_url')
    .eq('id', premade.source_map_id)
    .maybeSingle()

  if (sourceError) throw createError({ statusCode: 500, message: sourceError.message })
  if (!source) throw createError({ statusCode: 404, message: 'Source map not found' })

  let previewUrl = previewUrlForSourceMap(source)
  if (!previewUrl) {
    const result = await renderMapProof({
      event,
      mapId: source.id,
      userId: source.user_id,
      config: useRuntimeConfig(),
      allowServiceRead: true,
    })
    previewUrl = result.render_url
  }

  const { data, error } = await supabase
    .from('premade_maps')
    .update({
      preview_image_url: previewUrl,
      render_url: previewUrl,
      needs_preview: false,
      updated_by: session.user!.id,
    })
    .eq('id', id)
    .select('*')
    .single()

  if (error) throw createError({ statusCode: 500, message: error.message })
  return premadeRowToMap(data)
})
