import { serverSupabaseServiceRole } from '#supabase/server'
import { syncGelatoProductPrices } from '~/server/utils/gelatoPricing'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const expected = config.cronSecret as string | undefined
  const authorization = getHeader(event, 'authorization')

  if (!expected || authorization !== `Bearer ${expected}`) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  const supabase = await serverSupabaseServiceRole(event)
  return await syncGelatoProductPrices(supabase, {
    gelatoApiKey: config.gelatoApiKey as string,
  })
})
