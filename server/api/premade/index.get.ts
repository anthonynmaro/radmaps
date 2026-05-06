import { serverSupabaseServiceRole } from '#supabase/server'
import { listPublishedPremadeMaps } from '~/server/utils/premadeCatalog'

export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'public, max-age=60, s-maxage=300')
  const supabase = await serverSupabaseServiceRole(event)
  return await listPublishedPremadeMaps(supabase)
})
