import type { SupabaseClient } from '@supabase/supabase-js'
import { PRODUCTS, getProduct } from '~/utils/products'
import type { PrintProduct } from '~/types'

type AnyClient = SupabaseClient | any

export const GELATO_PRICING_MARKUP_BPS = 5000
export const GELATO_PRICING_MULTIPLIER_BPS = 10_000 + GELATO_PRICING_MARKUP_BPS
export const GELATO_PRICING_ROUNDING_RULE = 'nearest_dollar'
export const GELATO_PRICING_CURRENCY = 'usd'
export const GELATO_PRICING_DEFAULT_COUNTRY = 'US'
export const DIGITAL_PRICE_CENTS = 999
export const GELATO_PRICING_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

export const GELATO_PRICING_COUNTRIES = [
  'US', 'CA', 'GB', 'AU', 'DE', 'FR', 'NL', 'SE', 'NO',
  'ES', 'IT', 'IE', 'DK', 'FI', 'NZ', 'JP',
] as const

export interface GelatoProductPriceSnapshot {
  id: string
  product_uid: string
  country_code: string
  currency: string
  quantity: number
  gelato_cost_cents: number
  retail_price_cents: number
  markup_bps: number
  rounding_rule: string
  raw_payload?: Record<string, unknown>
  synced_at: string
}

export interface ResolvedProductPricing {
  product_uid: string
  country_code: string
  currency: string
  pricing_snapshot_id: string | null
  gelato_product_cost_cents: number | null
  retail_unit_price_cents: number
  pricing_markup_bps: number
  pricing_rounding_rule: string
  pricing_synced_at: string | null
  source: 'snapshot' | 'static'
}

export function normalizePricingCountry(country: string | null | undefined): string {
  const normalized = String(country || GELATO_PRICING_DEFAULT_COUNTRY).trim().toUpperCase()
  return /^[A-Z]{2}$/.test(normalized) ? normalized : GELATO_PRICING_DEFAULT_COUNTRY
}

export function normalizePricingCurrency(currency: string | null | undefined): string {
  const normalized = String(currency || GELATO_PRICING_CURRENCY).trim().toLowerCase()
  return /^[a-z]{3}$/.test(normalized) ? normalized : GELATO_PRICING_CURRENCY
}

export function moneyToCents(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Number.isInteger(value) && value > 1000 ? value : Math.round(value * 100)
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return moneyToCents(parsed)
  }
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>
    const centValue = obj.centAmount ?? obj.amount_cents ?? obj.amountCents ?? obj.cents
    if (typeof centValue === 'number' && Number.isFinite(centValue)) return Math.round(centValue)
    if (typeof centValue === 'string' && centValue.trim() && Number.isFinite(Number(centValue))) {
      return Math.round(Number(centValue))
    }
    return moneyToCents(obj.amount ?? obj.value ?? obj.price)
  }
  return null
}

export function computeGelatoRetailPriceCents(gelatoCostCents: number): number {
  if (!Number.isInteger(gelatoCostCents) || gelatoCostCents <= 0) {
    throw new Error('Gelato cost must be a positive integer cent amount')
  }
  const markedUpCents = (gelatoCostCents * GELATO_PRICING_MULTIPLIER_BPS) / 10_000
  return Math.round(markedUpCents / 100) * 100
}

function candidatePriceRows(payload: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(payload)) return payload.filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
  if (!payload || typeof payload !== 'object') return []
  const obj = payload as Record<string, unknown>
  if (Array.isArray(obj.prices)) return obj.prices.filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
  if (Array.isArray(obj.data)) return obj.data.filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
  if (Array.isArray(obj.items)) return obj.items.filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
  return [obj]
}

export function parseGelatoProductPricePayload(
  payload: unknown,
  countryCode: string,
  currency = GELATO_PRICING_CURRENCY,
): { gelato_cost_cents: number; raw_price: Record<string, unknown> } | null {
  const country = normalizePricingCountry(countryCode)
  const targetCurrency = normalizePricingCurrency(currency)
  const rootCurrency = payload && typeof payload === 'object'
    ? normalizePricingCurrency((payload as Record<string, unknown>).currency as string | undefined)
    : targetCurrency

  const rows = candidatePriceRows(payload)
  const matchingRows = rows.filter((row) => {
    const rowCountry = typeof row.country === 'string' ? normalizePricingCountry(row.country) : country
    const rowCurrency = typeof row.currency === 'string' ? normalizePricingCurrency(row.currency) : rootCurrency
    const quantity = Number(row.quantity ?? 1)
    return rowCountry === country && rowCurrency === targetCurrency && (!Number.isFinite(quantity) || quantity === 1)
  })

  for (const row of matchingRows.length ? matchingRows : rows) {
    const cents = moneyToCents(row.price ?? row.productPrice ?? row.amount ?? row.value ?? row.total)
    if (cents != null && cents > 0) {
      return { gelato_cost_cents: cents, raw_price: row }
    }
  }

  return null
}

export function isPricingSnapshotFresh(
  syncedAt: string | null | undefined,
  now = Date.now(),
  maxAgeMs = GELATO_PRICING_MAX_AGE_MS,
): boolean {
  if (!syncedAt) return false
  const timestamp = new Date(syncedAt).getTime()
  return Number.isFinite(timestamp) && now - timestamp <= maxAgeMs
}

export function pricingDbColumns(pricing: ResolvedProductPricing) {
  return {
    pricing_snapshot_id: pricing.pricing_snapshot_id,
    pricing_country_code: pricing.country_code,
    gelato_product_cost_cents: pricing.gelato_product_cost_cents,
    retail_unit_price_cents: pricing.retail_unit_price_cents,
    pricing_markup_bps: pricing.pricing_markup_bps,
    pricing_rounding_rule: pricing.pricing_rounding_rule,
    pricing_synced_at: pricing.pricing_synced_at,
  }
}

export function pricingMetadata(pricing: ResolvedProductPricing): Record<string, string> {
  return {
    pricing_snapshot_id: pricing.pricing_snapshot_id || '',
    pricing_country_code: pricing.country_code,
    gelato_product_cost_cents: pricing.gelato_product_cost_cents == null ? '' : String(pricing.gelato_product_cost_cents),
    retail_unit_price_cents: String(pricing.retail_unit_price_cents),
    pricing_markup_bps: String(pricing.pricing_markup_bps),
    pricing_rounding_rule: pricing.pricing_rounding_rule,
    pricing_synced_at: pricing.pricing_synced_at || '',
  }
}

function nullablePositiveInteger(value: unknown): number | null {
  if (value == null || value === '') return null
  const numeric = Number(value)
  return Number.isInteger(numeric) && numeric > 0 ? numeric : null
}

export function pricingFromRecord(record: Record<string, unknown> | null | undefined, productUid: string): ResolvedProductPricing | null {
  const retail = Number(record?.retail_unit_price_cents)
  if (!record || !Number.isInteger(retail) || retail <= 0) return null
  return {
    product_uid: productUid,
    country_code: normalizePricingCountry(record.pricing_country_code as string | undefined),
    currency: GELATO_PRICING_CURRENCY,
    pricing_snapshot_id: typeof record.pricing_snapshot_id === 'string' ? record.pricing_snapshot_id : null,
    gelato_product_cost_cents: nullablePositiveInteger(record.gelato_product_cost_cents),
    retail_unit_price_cents: retail,
    pricing_markup_bps: Number(record.pricing_markup_bps || GELATO_PRICING_MARKUP_BPS),
    pricing_rounding_rule: String(record.pricing_rounding_rule || GELATO_PRICING_ROUNDING_RULE),
    pricing_synced_at: typeof record.pricing_synced_at === 'string' ? record.pricing_synced_at : null,
    source: record.pricing_snapshot_id ? 'snapshot' : 'static',
  }
}

export function pricingFromMetadata(meta: Record<string, string | undefined>, productUid: string): ResolvedProductPricing | null {
  const retail = Number(meta.retail_unit_price_cents)
  if (!Number.isInteger(retail) || retail <= 0) return null
  return {
    product_uid: productUid,
    country_code: normalizePricingCountry(meta.pricing_country_code),
    currency: GELATO_PRICING_CURRENCY,
    pricing_snapshot_id: meta.pricing_snapshot_id || null,
    gelato_product_cost_cents: nullablePositiveInteger(meta.gelato_product_cost_cents),
    retail_unit_price_cents: retail,
    pricing_markup_bps: Number(meta.pricing_markup_bps || GELATO_PRICING_MARKUP_BPS),
    pricing_rounding_rule: meta.pricing_rounding_rule || GELATO_PRICING_ROUNDING_RULE,
    pricing_synced_at: meta.pricing_synced_at || null,
    source: meta.pricing_snapshot_id ? 'snapshot' : 'static',
  }
}

function staticProductPricing(product: PrintProduct, countryCode: string): ResolvedProductPricing {
  const price = product.type === 'digital' ? DIGITAL_PRICE_CENTS : product.price_cents
  return {
    product_uid: product.product_uid,
    country_code: normalizePricingCountry(countryCode),
    currency: GELATO_PRICING_CURRENCY,
    pricing_snapshot_id: null,
    gelato_product_cost_cents: null,
    retail_unit_price_cents: price,
    pricing_markup_bps: GELATO_PRICING_MARKUP_BPS,
    pricing_rounding_rule: GELATO_PRICING_ROUNDING_RULE,
    pricing_synced_at: null,
    source: 'static',
  }
}

function canUseStaticPricingFallback(): boolean {
  return process.env.NODE_ENV !== 'production'
}

export async function resolveProductPricing(
  supabase: AnyClient,
  input: {
    productUid: string
    countryCode?: string | null
    currency?: string | null
    allowStaticFallback?: boolean
  },
): Promise<ResolvedProductPricing> {
  const product = getProduct(input.productUid)
  if (!product) throw createError({ statusCode: 400, message: 'Invalid product UID' })

  const countryCode = product.type === 'digital'
    ? GELATO_PRICING_DEFAULT_COUNTRY
    : normalizePricingCountry(input.countryCode)
  const currency = normalizePricingCurrency(input.currency)

  if (product.type === 'digital') return staticProductPricing(product, countryCode)

  const { data, error } = await supabase
    .from('gelato_product_prices')
    .select('*')
    .eq('product_uid', product.product_uid)
    .eq('country_code', countryCode)
    .eq('currency', currency)
    .eq('quantity', 1)
    .maybeSingle()

  if (!error && data && isPricingSnapshotFresh(data.synced_at)) {
    return {
      product_uid: product.product_uid,
      country_code: data.country_code,
      currency: data.currency,
      pricing_snapshot_id: data.id,
      gelato_product_cost_cents: data.gelato_cost_cents,
      retail_unit_price_cents: data.retail_price_cents,
      pricing_markup_bps: data.markup_bps,
      pricing_rounding_rule: data.rounding_rule,
      pricing_synced_at: data.synced_at,
      source: 'snapshot',
    }
  }

  if (input.allowStaticFallback ?? canUseStaticPricingFallback()) {
    return staticProductPricing(product, countryCode)
  }

  const message = error
    ? `Product pricing is unavailable: ${error.message}`
    : 'Product pricing is stale or missing. Please refresh pricing before checkout.'
  throw createError({ statusCode: 503, message })
}

export async function fetchGelatoProductPrice(input: {
  gelatoApiKey: string
  productUid: string
  countryCode: string
  currency?: string
}): Promise<{ gelato_cost_cents: number; raw_payload: Record<string, unknown> }> {
  if (!input.gelatoApiKey) {
    throw createError({ statusCode: 500, message: 'GELATO_API_KEY is not configured' })
  }

  const countryCode = normalizePricingCountry(input.countryCode)
  const currency = normalizePricingCurrency(input.currency).toUpperCase()
  const payload = await $fetch<Record<string, unknown>>(
    `https://product.gelatoapis.com/v3/products/${input.productUid}/prices`,
    {
      headers: { 'X-API-KEY': input.gelatoApiKey },
      query: { country: countryCode, currency },
    },
  )

  const parsed = parseGelatoProductPricePayload(payload, countryCode, currency)
  if (!parsed) {
    throw createError({ statusCode: 422, message: `Gelato returned no ${currency} price for ${input.productUid} in ${countryCode}` })
  }

  return {
    gelato_cost_cents: parsed.gelato_cost_cents,
    raw_payload: payload,
  }
}

export async function upsertGelatoProductPrice(
  supabase: AnyClient,
  input: {
    productUid: string
    countryCode: string
    currency?: string
    gelatoCostCents: number
    rawPayload: Record<string, unknown>
  },
): Promise<GelatoProductPriceSnapshot> {
  const countryCode = normalizePricingCountry(input.countryCode)
  const currency = normalizePricingCurrency(input.currency)
  const retailPriceCents = computeGelatoRetailPriceCents(input.gelatoCostCents)
  const { data, error } = await supabase
    .from('gelato_product_prices')
    .upsert({
      product_uid: input.productUid,
      country_code: countryCode,
      currency,
      quantity: 1,
      gelato_cost_cents: input.gelatoCostCents,
      retail_price_cents: retailPriceCents,
      markup_bps: GELATO_PRICING_MARKUP_BPS,
      rounding_rule: GELATO_PRICING_ROUNDING_RULE,
      raw_payload: input.rawPayload,
      synced_at: new Date().toISOString(),
    }, { onConflict: 'product_uid,country_code,currency,quantity' })
    .select('*')
    .single()

  if (error) throw createError({ statusCode: 500, message: error.message })
  return data
}

export async function syncGelatoProductPrices(
  supabase: AnyClient,
  input: {
    gelatoApiKey: string
    countries?: readonly string[]
    productUids?: readonly string[]
  },
) {
  const countries = (input.countries?.length ? input.countries : GELATO_PRICING_COUNTRIES)
    .map(normalizePricingCountry)
  const products = PRODUCTS.filter((product) =>
    product.type !== 'digital' &&
    (!input.productUids?.length || input.productUids.includes(product.product_uid)),
  )

  const errors: Array<{ product_uid: string; country_code: string; message: string }> = []
  const synced: GelatoProductPriceSnapshot[] = []

  for (const product of products) {
    for (const countryCode of countries) {
      try {
        const fetched = await fetchGelatoProductPrice({
          gelatoApiKey: input.gelatoApiKey,
          productUid: product.product_uid,
          countryCode,
          currency: GELATO_PRICING_CURRENCY,
        })
        const row = await upsertGelatoProductPrice(supabase, {
          productUid: product.product_uid,
          countryCode,
          currency: GELATO_PRICING_CURRENCY,
          gelatoCostCents: fetched.gelato_cost_cents,
          rawPayload: fetched.raw_payload,
        })
        synced.push(row)
      } catch (err) {
        errors.push({
          product_uid: product.product_uid,
          country_code: countryCode,
          message: err instanceof Error ? err.message : String(err),
        })
      }
    }
  }

  return {
    product_count: products.length,
    country_count: countries.length,
    synced_count: synced.length,
    error_count: errors.length,
    errors,
  }
}

export function publicPricingPayload(pricing: ResolvedProductPricing) {
  return {
    product_uid: pricing.product_uid,
    country_code: pricing.country_code,
    currency: pricing.currency,
    retail_price_cents: pricing.retail_unit_price_cents,
    pricing_updated_at: pricing.pricing_synced_at,
    estimated: pricing.source !== 'snapshot',
  }
}
