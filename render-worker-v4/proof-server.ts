import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { Buffer } from 'node:buffer'

import { takeLocalChromiumScreenshot } from './src/localChromium.js'

const MAX_BODY_BYTES = 2 * 1024 * 1024
const MAX_VIEWPORT_DIMENSION = 8_192

interface BrowserlessScreenshotPayload {
  url?: unknown
  userAgent?: unknown
  options?: {
    type?: unknown
    quality?: unknown
  }
  viewport?: {
    width?: unknown
    height?: unknown
    deviceScaleFactor?: unknown
  }
  gotoOptions?: {
    waitUntil?: unknown
    timeout?: unknown
  }
  waitForFunction?: unknown
}

function jsonResponse(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(body))
}

function configuredToken(): string {
  const raw = process.env.PROOF_RENDER_TOKEN || process.env.BROWSERLESS_TOKEN || ''
  if (!raw.trim()) return ''
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const token = parsed.PROOF_RENDER_TOKEN ?? parsed.BROWSERLESS_TOKEN
    return typeof token === 'string' ? token : raw
  } catch {
    return raw
  }
}

function readBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let total = 0
    req.on('data', (chunk: Buffer) => {
      total += chunk.byteLength
      if (total > MAX_BODY_BYTES) {
        reject(new Error('Request body too large'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

function numberInRange(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(max, Math.max(min, Math.round(parsed)))
}

function waitForExpression(input: unknown): string | undefined {
  if (typeof input === 'string') return input
  if (input && typeof input === 'object' && typeof (input as { fn?: unknown }).fn === 'string') {
    const fn = (input as { fn: string }).fn.trim()
    if (fn.startsWith('() =>')) {
      return fn.replace(/^(\(\)\s*=>\s*)/, '').trim()
    }
    return fn
  }
  return undefined
}

function waitUntilFrom(input: unknown): 'load' | 'domcontentloaded' | 'networkidle' | undefined {
  return input === 'load' || input === 'domcontentloaded' || input === 'networkidle'
    ? input
    : undefined
}

function configuredAllowedOrigins(): Set<string> {
  const raw = process.env.PROOF_RENDER_ALLOWED_ORIGINS || process.env.APP_URL || process.env.NUXT_PUBLIC_SITE_URL || ''
  const origins = new Set<string>()
  for (const value of raw.split(',')) {
    const trimmed = value.trim()
    if (!trimmed) continue
    try {
      origins.add(new URL(trimmed).origin)
    } catch {
      origins.add(trimmed.replace(/\/$/, ''))
    }
  }
  return origins
}

function isAllowedScreenshotUrl(rawUrl: string): boolean {
  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    return false
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return false
  }
  const allowedOrigins = configuredAllowedOrigins()
  return allowedOrigins.size === 0 || allowedOrigins.has(parsed.origin)
}

function requestedUserAgent(input: unknown): string | undefined {
  if (typeof input === 'string') return input
  if (input && typeof input === 'object' && typeof (input as { userAgent?: unknown }).userAgent === 'string') {
    return (input as { userAgent: string }).userAgent
  }
  return undefined
}

function timeoutFrom(url: URL, payload: BrowserlessScreenshotPayload): number {
  const queryTimeout = url.searchParams.get('timeout')
  const fromQuery = queryTimeout === null ? Number.NaN : Number(queryTimeout)
  const fromGoto = Number(payload.gotoOptions?.timeout)
  const fallback = Number(process.env.PROOF_RENDER_TIMEOUT_MS || 60_000)
  const raw = Number.isFinite(fromQuery)
    ? fromQuery
    : Number.isFinite(fromGoto)
      ? fromGoto
      : fallback
  return Math.min(300_000, Math.max(1_000, raw))
}

const server = createServer(async (req, res) => {
  const requestUrl = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`)

  if (req.method === 'GET' && requestUrl.pathname === '/health') {
    jsonResponse(res, 200, { ok: true })
    return
  }

  if (req.method !== 'POST' || requestUrl.pathname !== '/screenshot') {
    jsonResponse(res, 404, { error: 'not_found' })
    return
  }

  const token = configuredToken()
  if (!token || requestUrl.searchParams.get('token') !== token) {
    jsonResponse(res, 401, { error: 'unauthorized' })
    return
  }

  try {
    const body = await readBody(req)
    const payload = JSON.parse(body.toString('utf8')) as BrowserlessScreenshotPayload
    if (typeof payload.url !== 'string' || !/^https?:\/\//i.test(payload.url)) {
      jsonResponse(res, 400, { error: 'invalid_url' })
      return
    }
    if (!isAllowedScreenshotUrl(payload.url)) {
      jsonResponse(res, 403, { error: 'disallowed_url' })
      return
    }

    const format = payload.options?.type === 'png' ? 'png' : 'jpeg'
    const screenshot = await takeLocalChromiumScreenshot({
      url: payload.url,
      widthPx: numberInRange(payload.viewport?.width, 1200, 64, MAX_VIEWPORT_DIMENSION),
      heightPx: numberInRange(payload.viewport?.height, 1800, 64, MAX_VIEWPORT_DIMENSION),
      deviceScaleFactor: numberInRange(payload.viewport?.deviceScaleFactor, 1, 1, 4),
      format,
      quality: numberInRange(payload.options?.quality, 95, 1, 100),
      waitUntil: waitUntilFrom(payload.gotoOptions?.waitUntil),
      waitForFunction: waitForExpression(payload.waitForFunction),
      timeoutMs: timeoutFrom(requestUrl, payload),
      userAgent: requestedUserAgent(payload.userAgent),
    })

    res.writeHead(200, {
      'Content-Type': screenshot.contentType,
      'Cache-Control': 'no-store',
      'X-Render-Ms': String(screenshot.renderMs),
    })
    res.end(screenshot.buffer)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(JSON.stringify({ level: 'error', event: 'proof_screenshot_failed', error: message }))
    jsonResponse(res, 500, { error: 'screenshot_failed', message })
  }
})

const port = Number(process.env.PORT || 3000)
server.listen(port, '0.0.0.0', () => {
  console.log(JSON.stringify({ level: 'info', event: 'proof_server_listening', port }))
})
