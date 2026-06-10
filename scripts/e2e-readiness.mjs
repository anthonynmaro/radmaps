#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs'

function readEnv(path) {
  if (!existsSync(path)) return null
  const out = {}
  for (const raw of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
    if (!match) continue
    let value = match[2].trim()
    value = value.replace(/\s+#.*$/, '')
    value = value.replace(/^['"]|['"]$/g, '')
    out[match[1]] = value
  }
  return out
}

const mainFile = readEnv('.env') ?? {}
const workerFile = readEnv('render-worker-v4/.env') ?? {}
const main = {
  ...mainFile,
  ...process.env,
}
const effectiveWorker = {
  ...mainFile,
  ...workerFile,
  ...process.env,
}
effectiveWorker.APP_URL ||= main.NUXT_PUBLIC_SITE_URL
const allowLive = process.env.ALLOW_LIVE_E2E === 'true' || main.ALLOW_LIVE_E2E === 'true'

const checks = []
function check(label, ok, detail, severity = 'error') {
  checks.push({ label, ok: Boolean(ok), detail, severity })
}
function present(value) {
  return typeof value === 'string' && value.length > 0
}
function parseUrl(value) {
  try {
    return present(value) ? new URL(value) : null
  } catch {
    return null
  }
}
function isLocalHost(hostname) {
  return ['localhost', '127.0.0.1', '::1'].includes(hostname)
}
async function probeRenderPayload(siteUrl) {
  const probeUrl = new URL('/api/render/payload', siteUrl)
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 5_000)
  try {
    const res = await fetch(probeUrl, {
      signal: controller.signal,
      headers: siteUrl.hostname.endsWith('.ngrok-free.dev')
        ? { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' }
        : undefined,
    })
    const text = await res.text().catch(() => '')
    const ngrokMessage = text.match(/<noscript>(.*?)<\/noscript>/i)?.[1]
    return {
      ok: res.status === 400 && /Render ticket required/i.test(text),
      detail: `${probeUrl.toString()} returned ${res.status}${ngrokMessage ? ` (${ngrokMessage})` : ''}`,
    }
  } catch (err) {
    return {
      ok: false,
      detail: `${probeUrl.toString()} failed: ${(err instanceof Error ? err.message : String(err))}`,
    }
  } finally {
    clearTimeout(timeout)
  }
}

async function probeScreenshotEndpoint(endpointUrl) {
  const probeUrl = new URL('/health', endpointUrl)
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 5_000)
  try {
    const res = await fetch(probeUrl, { signal: controller.signal })
    return {
      ok: res.ok,
      detail: `${probeUrl.toString()} returned ${res.status}`,
    }
  } catch (err) {
    return {
      ok: false,
      detail: `${probeUrl.toString()} failed: ${(err instanceof Error ? err.message : String(err))}`,
    }
  } finally {
    clearTimeout(timeout)
  }
}

const siteUrl = parseUrl(main.NUXT_PUBLIC_SITE_URL)
const screenshotEndpoint = parseUrl(main.PROOF_RENDER_ENDPOINT)
const siteUrlIsLocal = siteUrl ? isLocalHost(siteUrl.hostname) : false
const screenshotEndpointIsLocal = screenshotEndpoint ? isLocalHost(screenshotEndpoint.hostname) : false
const screenshotEndpointIsAws = Boolean(screenshotEndpoint?.hostname.endsWith('.awsapprunner.com'))
const workerRenderBackend = effectiveWorker.RENDER_BACKEND || main.RENDER_BACKEND || 'local-chromium'
const usesRemoteScreenshotBackend = workerRenderBackend === 'remote-renderer'

check('main .env exists', existsSync('.env'), 'create .env from .env.example')
check('worker .env exists', existsSync('render-worker-v4/.env'), 'optional locally; create render-worker-v4/.env only for worker-specific overrides', 'warn')

check('Stripe secret key is test mode', main.STRIPE_SECRET_KEY?.startsWith('sk_test_') || allowLive, 'use sk_test_ for faux Stripe runs, or set ALLOW_LIVE_E2E=true intentionally')
check('Stripe publishable key is test mode', main.STRIPE_PUBLISHABLE_KEY?.startsWith('pk_test_') || allowLive, 'use pk_test_ for faux Stripe runs, or set ALLOW_LIVE_E2E=true intentionally')
check('Stripe webhook secret present', main.STRIPE_WEBHOOK_SECRET?.startsWith('whsec_'), 'set the whsec_ value from `stripe listen` or the configured endpoint')
check('Gelato order type is draft', main.GELATO_ORDER_TYPE === 'draft' || allowLive, 'set GELATO_ORDER_TYPE=draft for full faux E2E, or set ALLOW_LIVE_E2E=true intentionally')

check('render ticket secret present', present(main.RENDER_TICKET_SECRET) && main.RENDER_TICKET_SECRET.length >= 32, 'set a long RENDER_TICKET_SECRET')
check('public site URL valid', !!siteUrl, 'set NUXT_PUBLIC_SITE_URL to a valid public tunnel or deployed URL the browser backend can reach')
check(
  'public site URL reachable by screenshot backend',
  !!siteUrl && (!siteUrlIsLocal || screenshotEndpointIsLocal),
  'set NUXT_PUBLIC_SITE_URL to localhost only when PROOF_RENDER_ENDPOINT is the local proof server; remote AWS proof endpoints need a deployed URL or live tunnel',
)

check('Supabase URL present', present(main.SUPABASE_URL), 'set SUPABASE_URL')
check('Supabase service key present', present(main.SUPABASE_SERVICE_KEY), 'set SUPABASE_SERVICE_KEY')
check('render backend valid', ['remote-renderer', 'local-chromium'].includes(workerRenderBackend), 'set RENDER_BACKEND=local-chromium for AWS final renders, or remote-renderer for HTTP proof-style capture')
check('screenshot endpoint valid', !!screenshotEndpoint, 'set PROOF_RENDER_ENDPOINT to the AWS proof renderer URL')
check('screenshot token present', present(main.PROOF_RENDER_TOKEN), 'set PROOF_RENDER_TOKEN for the AWS proof renderer /screenshot token')
check('Gelato API key present', present(main.GELATO_API_KEY), 'set GELATO_API_KEY; use a sandbox/no-payment account for safe test orders')
check('Resend API key present', present(main.RESEND_API_KEY), 'set RESEND_API_KEY or expect confirmation email send to fail', 'warn')

check('worker DATABASE_URL present', present(effectiveWorker.DATABASE_URL), 'set Supabase pooler DATABASE_URL in .env or render-worker-v4/.env for the print queue consumer')
for (const key of ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY', 'RENDER_TICKET_SECRET', 'GELATO_API_KEY']) {
  check(`worker ${key} effective`, present(effectiveWorker[key]), `set ${key} in .env or render-worker-v4/.env`)
}
check('worker PROOF_RENDER_TOKEN effective', !usesRemoteScreenshotBackend || present(effectiveWorker.PROOF_RENDER_TOKEN), 'set PROOF_RENDER_TOKEN in .env or render-worker-v4/.env, or use RENDER_BACKEND=local-chromium')
check('worker APP_URL matches public site URL', present(effectiveWorker.APP_URL) && effectiveWorker.APP_URL === main.NUXT_PUBLIC_SITE_URL, 'set APP_URL or NUXT_PUBLIC_SITE_URL to the public URL the browser backend should load')

if (siteUrl && (!siteUrlIsLocal || screenshotEndpointIsLocal)) {
  const probe = await probeRenderPayload(siteUrl)
  check('public site URL serves RadMaps app', probe.ok, `${probe.detail}; start Nuxt and point NUXT_PUBLIC_SITE_URL at the active tunnel`)
}
if (screenshotEndpointIsAws || screenshotEndpointIsLocal) {
  const probe = await probeScreenshotEndpoint(screenshotEndpoint)
  check(
    screenshotEndpointIsAws ? 'AWS proof renderer healthy' : 'local proof renderer healthy',
    probe.ok,
    `${probe.detail}; check the proof renderer service health and logs`,
  )
}

const failures = checks.filter((item) => !item.ok && item.severity === 'error')
const warnings = checks.filter((item) => !item.ok && item.severity === 'warn')

for (const item of checks) {
  const icon = item.ok ? 'ok' : item.severity === 'warn' ? 'warn' : 'fail'
  console.log(`${icon.padEnd(4)} ${item.label}${item.ok ? '' : ` - ${item.detail}`}`)
}

if (warnings.length) {
  console.log(`\n${warnings.length} warning${warnings.length === 1 ? '' : 's'} found.`)
}
if (failures.length) {
  console.error(`\nE2E readiness failed: ${failures.length} blocking issue${failures.length === 1 ? '' : 's'}.`)
  process.exit(1)
}

console.log('\nE2E readiness passed.')
