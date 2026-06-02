#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

const GELATO_ECOMMERCE_BASE = 'https://ecommerce.gelatoapis.com/v1'
const GELATO_PRODUCT_BASE = 'https://product.gelatoapis.com/v3'

function readEnv(path) {
  if (!existsSync(path)) return {}
  const out = {}
  for (const raw of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
    if (!match) continue
    out[match[1]] = match[2].trim().replace(/\s+#.*$/, '').replace(/^['"]|['"]$/g, '')
  }
  return out
}

function parseArgs(argv) {
  const out = {
    productLimit: Infinity,
    skipProductApi: false,
    json: false,
  }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--product-limit') out.productLimit = Math.max(1, Number(argv[++i]) || 1)
    else if (arg === '--skip-product-api') out.skipProductApi = true
    else if (arg === '--json') out.json = true
    else throw new Error(`Unknown argument: ${arg}`)
  }
  return out
}

function enabledProductUids() {
  const enabled = new Set()
  enabled.add('flat_a4-8x12-inch_250-gsm-100lb-uncoated-offwhite-archival_4-0_ver')
  enabled.add('flat_400x600-mm-16x24-inch_250-gsm-100lb-uncoated-offwhite-archival_4-0_ver')
  enabled.add('flat_600x900-mm-24x36-inch_250-gsm-100lb-uncoated-offwhite-archival_4-0_ver')

  const framedSizes = [
    ['210x297mm-8x12-inch', 'a4-8x12-inch'],
    ['300x450-mm-12x18-inch', '300x450-mm-12x18-inch'],
    ['600x900-mm-24x36-inch', '600x900-mm-24x36-inch'],
  ]
  const frameFinishes = ['black_wood', 'white_wood', 'natural-wood_wood']
  for (const [outerSize, innerSize] of framedSizes) {
    for (const finish of frameFinishes) {
      enabled.add(`framed_poster_mounted_premium_${outerSize}_${finish}_w20xt20-mm_plexiglass_${innerSize}_200-gsm-80lb-coated-silk_4-0_ver`)
    }
  }

  const wallHangingSizes = [
    ['229-mm', 'a4-8x12-inch'],
    ['310-mm', '300x450-mm-12x18-inch'],
    ['410-mm', '400x600-mm-16x24-inch'],
    ['635-mm', '600x900-mm-24x36-inch'],
  ]
  const railFinishes = ['black_wood', 'white_wood', 'natural-wood_wood', 'dark-wood_wood']
  for (const [rodSize, printSize] of wallHangingSizes) {
    for (const finish of railFinishes) {
      enabled.add(`wall_hanging_poster_${rodSize}_${finish}_w14xt20-mm_${printSize}_250-gsm-100lb-uncoated-offwhite-archival_4-0_ver`)
      enabled.add(`wall_hanging_poster_${rodSize}_${finish}_w14xt20-mm_${printSize}_170-gsm-65lb-coated-silk_4-0_ver`)
    }
  }

  for (const uid of [
    'metallic_200x300-mm-8x12-inch_3-mm_4-0_ver',
    'metallic_300x450-mm-12x18-inch_3-mm_4-0_ver',
    'metallic_400x600-mm-16x24-inch_3-mm_4-0_ver',
    'metallic_500x750-mm-20x30-inch_3-mm_4-0_ver',
    'metallic_600x900-mm-24x36-inch_3-mm_4-0_ver',
    'acrylic_300x450-mm-12x18-inch_4-mm_4-0_ver',
    'acrylic_400x600-mm-16x24-inch_4-mm_4-0_ver',
    'acrylic_500x750-mm-20x30-inch_4-mm_4-0_ver',
    'acrylic_600x900-mm-24x36-inch_4-mm_4-0_ver',
  ]) {
    enabled.add(uid)
  }

  return enabled
}

function scanTemplateAssets(root) {
  const templateRoot = join(root, 'assets/product_mockup_templates')
  const setIds = readdirSync(templateRoot)
    .filter(name => /^[0-9a-f-]{36}$/i.test(name))
    .sort()
  const products = []
  for (const setId of setIds) {
    const setPath = join(templateRoot, setId)
    for (const productUid of readdirSync(setPath).filter(name => !name.startsWith('.')).sort()) {
      const productPath = join(setPath, productUid)
      if (!statSync(productPath).isDirectory()) continue
      const scenes = readdirSync(productPath).filter(name => /\.(jpe?g|png|webp)$/i.test(name)).sort()
      products.push({ setId, productUid, scenes })
    }
  }
  return { setIds, products }
}

async function fetchJson(url, apiKey) {
  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      'X-API-KEY': apiKey,
    },
  })
  const text = await res.text()
  let body = null
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = { raw: text.slice(0, 500) }
  }
  return { status: res.status, ok: res.ok, body }
}

async function auditTemplateEndpoint(setIds, apiKey) {
  const out = []
  for (const setId of setIds) {
    const result = await fetchJson(`${GELATO_ECOMMERCE_BASE}/templates/${setId}`, apiKey)
    out.push({
      setId,
      status: result.status,
      templateName: result.body?.templateName ?? null,
      message: result.body?.message ?? null,
    })
  }
  return out
}

async function auditStores(apiKey) {
  const result = await fetchJson(`${GELATO_ECOMMERCE_BASE}/stores`, apiKey)
  return {
    status: result.status,
    storeCount: Array.isArray(result.body?.stores) ? result.body.stores.length : null,
    message: result.body?.message ?? null,
  }
}

async function auditProducts(products, apiKey, limit) {
  const out = []
  for (const product of products.slice(0, limit)) {
    const result = await fetchJson(`${GELATO_PRODUCT_BASE}/products/${encodeURIComponent(product.productUid)}`, apiKey)
    const data = result.body?.data ?? result.body
    out.push({
      setId: product.setId,
      productUid: product.productUid,
      status: result.status,
      productStatus: data?.attributes?.ProductStatus ?? null,
      state: data?.attributes?.State ?? null,
      orientation: data?.attributes?.Orientation ?? null,
      format: data?.attributes?.UnifiedPaperFormat ?? data?.attributes?.UnifiedFrameSize ?? null,
      message: data?.message ?? null,
    })
  }
  return out
}

function summarize({ assets, enabled, stores, templates, products }) {
  const enabledInAssets = assets.products.filter(product => enabled.has(product.productUid))
  const extraAssets = assets.products.filter(product => !enabled.has(product.productUid))
  const bySet = {}
  for (const product of assets.products) {
    bySet[product.setId] ??= { assets: 0, enabled: 0, extra: 0 }
    bySet[product.setId].assets++
    if (enabled.has(product.productUid)) bySet[product.setId].enabled++
    else bySet[product.setId].extra++
  }
  const productFailures = products.filter(product => product.status !== 200)
  return {
    assetSetCount: assets.setIds.length,
    assetProductCount: assets.products.length,
    enabledCatalogProductCount: enabled.size,
    enabledAssetProductCount: enabledInAssets.length,
    extraAssetProducts: extraAssets.map(product => ({ setId: product.setId, productUid: product.productUid })),
    bySet,
    ecommerceStores: stores,
    documentedTemplateEndpoint: templates,
    productApi: {
      checked: products.length,
      failures: productFailures,
      activated: products.filter(product => product.productStatus === 'activated' && product.state === 'published').length,
    },
  }
}

async function main() {
  const root = resolve(import.meta.dirname, '..')
  const args = parseArgs(process.argv.slice(2))
  const env = { ...process.env, ...readEnv(resolve(root, '.env')) }
  if (!env.GELATO_API_KEY) throw new Error('GELATO_API_KEY is not configured')

  const assets = scanTemplateAssets(root)
  const enabled = enabledProductUids()
  const [stores, templates, products] = await Promise.all([
    auditStores(env.GELATO_API_KEY),
    auditTemplateEndpoint(assets.setIds, env.GELATO_API_KEY),
    args.skipProductApi ? Promise.resolve([]) : auditProducts(assets.products, env.GELATO_API_KEY, args.productLimit),
  ])
  const report = summarize({ assets, enabled, stores, templates, products })

  if (args.json) {
    console.log(JSON.stringify(report, null, 2))
    return
  }

  console.log(`Template asset sets: ${report.assetSetCount}`)
  console.log(`Template asset products: ${report.assetProductCount}`)
  console.log(`Enabled catalog products represented in assets: ${report.enabledAssetProductCount}/${report.enabledCatalogProductCount}`)
  console.log(`Connected Gelato ecommerce stores: ${report.ecommerceStores.storeCount ?? 'unknown'} (status ${report.ecommerceStores.status})`)
  console.log(`Documented template API hits: ${report.documentedTemplateEndpoint.filter(item => item.status === 200).length}/${report.documentedTemplateEndpoint.length}`)
  console.log(`Product API checked: ${report.productApi.checked}; activated/published: ${report.productApi.activated}; failures: ${report.productApi.failures.length}`)
  if (report.extraAssetProducts.length) {
    console.log('\nExtra asset products not enabled in RadMaps:')
    for (const product of report.extraAssetProducts) console.log(`- ${product.productUid} (${product.setId})`)
  }
  if (report.productApi.failures.length) {
    console.log('\nProduct API failures:')
    for (const product of report.productApi.failures) console.log(`- ${product.productUid}: ${product.status} ${product.message ?? ''}`)
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
