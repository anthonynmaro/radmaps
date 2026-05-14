import { serverSupabaseServiceRole } from '#supabase/server'
import { requireStaff } from '~/server/utils/adminAuth'
import { premadeRowToMap } from '~/server/utils/premadeCatalog'
import { missingPublishFields, publishableLocationCoordinates } from '~/utils/premadeCatalog'
import { renderPremadeThumbnail } from '~/server/utils/premadeThumbnail'

export default defineEventHandler(async (event) => {
  const session = await requireStaff(event, 'premade:publish')
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'Premade ID required' })

  const supabase = await serverSupabaseServiceRole(event)
  const { data: fetched, error: fetchError } = await supabase
    .from('premade_maps')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (fetchError) throw createError({ statusCode: 500, message: fetchError.message })
  if (!fetched) throw createError({ statusCode: 404, message: 'Premade map not found' })
  let current = fetched

  const derivedLocation = publishableLocationCoordinates(premadeRowToMap(current))
  const patch: Record<string, unknown> = {}
  if (derivedLocation && (current.location_lng == null || current.location_lat == null)) {
    patch.location_lng = derivedLocation[0]
    patch.location_lat = derivedLocation[1]
  }
  if (!current.preview_image_url && current.render_url) {
    patch.preview_image_url = current.render_url
    patch.needs_preview = false
  }

  if (Object.keys(patch).length > 0) {
    const { data: patched, error: patchError } = await supabase
      .from('premade_maps')
      .update({
        ...patch,
        updated_by: session.user!.id,
      })
      .eq('id', id)
      .select('*')
      .single()
    if (patchError) throw createError({ statusCode: 500, message: patchError.message })
    current = patched
  }

  const canRenderPreview = Boolean(current.geojson?.features?.length && current.bbox && current.style_config)
  if ((current.needs_preview || !current.preview_image_url) && canRenderPreview) {
    await renderPremadeThumbnail({
      event,
      premadeId: id,
      updatedBy: session.user!.id,
      force: Boolean(current.needs_preview),
    })
    const { data: refreshed, error: refreshError } = await supabase
      .from('premade_maps')
      .select('*')
      .eq('id', id)
      .single()
    if (refreshError) throw createError({ statusCode: 500, message: refreshError.message })
    current = refreshed
  }

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
