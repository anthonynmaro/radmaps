import { serverSupabaseServiceRole } from '#supabase/server'
import { PRODUCTS } from '~/utils/products'
import {
  GELATO_PRICING_DEFAULT_COUNTRY,
  normalizePricingCountry,
  publicPricingPayload,
  resolveProductPricing,
} from '~/server/utils/gelatoPricing'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const countryCode = normalizePricingCountry(String(query.country || GELATO_PRICING_DEFAULT_COUNTRY))
  const supabase = await serverSupabaseServiceRole(event)

  const prices = await Promise.all(PRODUCTS.map(async (product) => {
    const pricing = await resolveProductPricing(supabase, {
      productUid: product.product_uid,
      countryCode,
    })
    return {
      ...publicPricingPayload(pricing),
      type: product.type,
    }
  }))

  return {
    country_code: countryCode,
    currency: 'usd',
    prices,
  }
})
