/**
 * GET /api/gelato/catalog
 * Fetch product catalogs from Gelato's Product API to verify UIDs,
 * check availability, and get pricing for a given destination country.
 *
 * Query params:
 *   ?catalog=posters|framed-posters|canvas  (default: all)
 *   ?country=US                             (for pricing, default: US)
 *
 * This endpoint caches Gelato responses for 1 hour to avoid rate limits.
 * Use it at build time or from an admin panel — not from the checkout flow.
 */

interface GelatoCatalogResponse {
  catalogUid: string
  title: string
  productAttributes: Array<{
    productAttributeUid: string
    title: string
    values: Array<{
      productAttributeValueUid: string
      title: string
    }>
  }>
}

interface GelatoProductResponse {
  productUid: string
  title: string
  productAttributes: Array<{
    productAttributeUid: string
    productAttributeValueUid: string
  }>
  printAreas: Array<{
    printAreaUid: string
    printAreaType: string
    printResolution: {
      dpi: number
    }
    dimensions: {
      width: number
      height: number
      unit: string
    }
  }>
}

interface GelatoPriceResponse {
  productUid: string
  currency: string
  prices: Array<{
    country: string
    quantity: number
    price: string
    shipmentPrice?: string
  }>
}

// Simple in-memory cache (1 hour TTL)
const cache = new Map<string, { data: unknown; expires: number }>()
const CACHE_TTL_MS = 60 * 60 * 1000

function getCached<T>(key: string): T | null {
  const entry = cache.get(key)
  if (entry && entry.expires > Date.now()) return entry.data as T
  return null
}

function setCache(key: string, data: unknown) {
  cache.set(key, { data, expires: Date.now() + CACHE_TTL_MS })
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const query = getQuery(event)

  const catalogTypes = query.catalog
    ? [query.catalog as string]
    : ['posters', 'framed-posters', 'canvas']
  const country = (query.country as string) || 'US'

  const apiKey = config.gelatoApiKey as string
  if (!apiKey) {
    throw createError({ statusCode: 500, message: 'GELATO_API_KEY is not configured' })
  }

  const headers = { 'X-API-KEY': apiKey }
  const results: Record<string, unknown> = {}

  for (const catalogUid of catalogTypes) {
    const cacheKey = `catalog:${catalogUid}:${country}`
    const cached = getCached<unknown>(cacheKey)
    if (cached) {
      results[catalogUid] = cached
      continue
    }

    try {
      // 1. Fetch catalog attributes (paper formats, orientations, etc.)
      const catalog = await $fetch<GelatoCatalogResponse>(
        `https://product.gelatoapis.com/v3/catalogs/${catalogUid}`,
        { headers }
      )

      // 2. Search for products in this catalog that match portrait orientation
      //    and the paper sizes we care about for trail map prints
      const searchResponse = await $fetch<{ products: GelatoProductResponse[] }>(
        `https://product.gelatoapis.com/v3/catalogs/${catalogUid}/products:search`,
        {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: {
            attributeFilters: {
              Orientation: ['ver'], // portrait only for trail maps
            },
          },
        }
      ).catch(() => ({ products: [] }))

      // 3. Get pricing for the products in the target country
      const productUids = searchResponse.products.map(p => p.productUid).slice(0, 50)
      const prices: Record<string, GelatoPriceResponse> = {}

      // Batch price lookups (Gelato supports individual product price calls)
      for (const uid of productUids.slice(0, 20)) {
        try {
          const priceData = await $fetch<GelatoPriceResponse>(
            `https://product.gelatoapis.com/v3/products/${uid}/prices`,
            {
              headers,
              query: { country, currency: 'USD' },
            }
          )
          prices[uid] = priceData
        } catch {
          // Some products may not have pricing for this country
        }
      }

      const catalogData = {
        catalog,
        products: searchResponse.products,
        prices,
        fetchedAt: new Date().toISOString(),
      }

      setCache(cacheKey, catalogData)
      results[catalogUid] = catalogData
    } catch (err) {
      results[catalogUid] = {
        error: `Failed to fetch catalog ${catalogUid}: ${(err as Error).message}`,
      }
    }
  }

  return results
})
