#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createJiti } from 'jiti'

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
    dryRun: false,
    limit: 50,
    concurrency: 2,
    ids: [],
    productUids: [],
    siteUrl: undefined,
  }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--dry-run') out.dryRun = true
    else if (arg === '--limit') out.limit = Number(argv[++i])
    else if (arg === '--concurrency') out.concurrency = Number(argv[++i])
    else if (arg === '--site-url') out.siteUrl = argv[++i]
    else if (arg === '--ids') out.ids = argv[++i].split(',').map(s => s.trim()).filter(Boolean)
    else if (arg === '--product-uids') out.productUids = argv[++i].split(',').map(s => s.trim()).filter(Boolean)
    else throw new Error(`Unknown argument: ${arg}`)
  }
  out.limit = Math.max(1, Math.min(500, out.limit || 50))
  out.concurrency = Math.max(1, Math.min(8, out.concurrency || 2))
  return out
}

function physicalProductUids(root, requested) {
  if (requested.length) return requested
  const jiti = createJiti(root)
  const { PRODUCTS } = jiti(resolve(root, 'utils/products.ts'))
  return PRODUCTS
    .filter((product) => product.type !== 'digital')
    .map((product) => product.product_uid)
}

async function fetchJson(url, init = {}) {
  const res = await fetch(url, {
    ...init,
    headers: {
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers ?? {}),
    },
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`${init.method ?? 'GET'} ${url} failed (${res.status}): ${text.slice(0, 600)}`)
  return text ? JSON.parse(text) : null
}

async function listPremades(siteUrl, args) {
  const maps = await fetchJson(new URL('/api/premade', siteUrl))
  const filtered = Array.isArray(maps)
    ? maps.filter((map) => {
        const sourceId = map.id || map.slug
        return sourceId && (!args.ids.length || args.ids.includes(sourceId))
      })
    : []
  return filtered.slice(0, args.limit)
}

async function renderOne(siteUrl, premade, productUid, dryRun) {
  if (dryRun) {
    return { status: 'dry-run', premade: premade.slug || premade.id, productUid }
  }
  const response = await fetchJson(new URL('/api/mockups/render', siteUrl), {
    method: 'POST',
    body: JSON.stringify({
      source: { type: 'premade', id: premade.id || premade.slug },
      product_uid: productUid,
    }),
  })
  return {
    status: response.cached ? 'cached' : 'rendered',
    premade: premade.slug || premade.id,
    productUid,
    url: response.mockup_url,
  }
}

async function main() {
  const root = resolve(import.meta.dirname, '..')
  const args = parseArgs(process.argv.slice(2))
  const env = { ...process.env, ...readEnv(resolve(root, '.env')) }
  const siteUrl = args.siteUrl || env.NUXT_PUBLIC_SITE_URL || env.APP_URL || 'http://localhost:3001'
  const productUids = physicalProductUids(root, args.productUids)
  const premades = await listPremades(siteUrl, args)
  const jobs = []

  for (const premade of premades) {
    for (const productUid of productUids) {
      jobs.push({ premade, productUid })
    }
  }

  console.log(`Preparing ${jobs.length} mockup job(s) for ${premades.length} premade map(s) and ${productUids.length} product(s).`)
  console.log(`Site: ${siteUrl}`)

  let cursor = 0
  let failed = 0
  async function worker() {
    while (cursor < jobs.length) {
      const job = jobs[cursor++]
      try {
        const result = await renderOne(siteUrl, job.premade, job.productUid, args.dryRun)
        console.log(`${result.status.padEnd(8)} ${result.premade} ${result.productUid}`)
      } catch (err) {
        failed++
        const message = err instanceof Error ? err.message : String(err)
        console.error(`failed   ${job.premade.slug || job.premade.id} ${job.productUid} - ${message}`)
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(args.concurrency, jobs.length || 1) }, () => worker()))
  if (failed > 0) process.exitCode = 1
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
