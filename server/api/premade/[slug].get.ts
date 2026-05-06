import { serverSupabaseServiceRole } from '#supabase/server'
import { getPublishedPremadeBySlug } from '~/server/utils/premadeCatalog'

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug')
  if (!slug) throw createError({ statusCode: 400, message: 'Slug required' })

  setHeader(event, 'Cache-Control', 'public, max-age=60, s-maxage=300')
  const supabase = await serverSupabaseServiceRole(event)
  const premade = await getPublishedPremadeBySlug(supabase, slug)
  if (!premade) throw createError({ statusCode: 404, message: 'Premade map not found' })
  return premade
})
