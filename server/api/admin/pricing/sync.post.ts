import { z } from 'zod'
import { serverSupabaseServiceRole } from '#supabase/server'
import { requireStaff } from '~/server/utils/adminAuth'
import { GELATO_PRICING_COUNTRIES, syncGelatoProductPrices } from '~/server/utils/gelatoPricing'

const Body = z.object({
  countries: z.array(z.string().length(2)).max(GELATO_PRICING_COUNTRIES.length).optional(),
  product_uids: z.array(z.string().min(1)).max(50).optional(),
}).optional()

export default defineEventHandler(async (event) => {
  await requireStaff(event, 'pricing:manage')
  const parsed = Body.safeParse(await readBody(event).catch(() => undefined))
  if (!parsed.success) throw createError({ statusCode: 400, message: parsed.error.message })

  const config = useRuntimeConfig()
  const supabase = await serverSupabaseServiceRole(event)
  return await syncGelatoProductPrices(supabase, {
    gelatoApiKey: config.gelatoApiKey as string,
    countries: parsed.data?.countries,
    productUids: parsed.data?.product_uids,
  })
})
