import { CONFIG } from './config.js'

export interface BrowserlessScreenshotOptions {
  url: string
  widthPx: number
  heightPx: number
  deviceScaleFactor: number
  format: 'jpeg' | 'png'
  quality?: number
  waitForFunction?: string
  timeoutMs?: number
}

export interface BrowserlessScreenshotResult {
  buffer: Buffer
  contentType: string
  renderMs: number
}

const NGROK_BYPASS_USER_AGENT = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'

function getLocalTunnelUserAgent(url: string): string | undefined {
  try {
    const hostname = new URL(url).hostname
    // Free ngrok tunnels show a browser warning to ordinary headless browsers.
    // A bot-style UA bypasses that warning without adding custom request
    // headers, which would trigger CORS preflight failures for Google Fonts.
    return hostname.endsWith('.ngrok-free.dev')
      ? NGROK_BYPASS_USER_AGENT
      : undefined
  } catch {
    return undefined
  }
}

export async function takeBrowserlessScreenshot(opts: BrowserlessScreenshotOptions): Promise<BrowserlessScreenshotResult> {
  if (!CONFIG.browserlessToken) {
    throw new Error('BROWSERLESS_TOKEN is not configured')
  }

  const started = Date.now()
  const timeoutMs = opts.timeoutMs ?? CONFIG.browserlessTimeoutMs
  const endpoint = CONFIG.browserlessEndpoint.replace(/\/$/, '')
  const query = new URLSearchParams({
    token: CONFIG.browserlessToken,
    timeout: String(timeoutMs),
  })
  const res = await fetch(`${endpoint}/screenshot?${query.toString()}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: opts.url,
      userAgent: getLocalTunnelUserAgent(opts.url),
      options: {
        type: opts.format === 'jpeg' ? 'jpeg' : 'png',
        quality: opts.format === 'jpeg' ? (opts.quality ?? 95) : undefined,
        fullPage: false,
        captureBeyondViewport: false,
      },
      viewport: {
        width: opts.widthPx,
        height: opts.heightPx,
        deviceScaleFactor: opts.deviceScaleFactor,
      },
      gotoOptions: {
        waitUntil: 'load',
        timeout: timeoutMs,
      },
      waitForFunction: opts.waitForFunction
        ? {
            fn: `() => ${opts.waitForFunction}`,
            timeout: timeoutMs,
          }
        : undefined,
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Browserless screenshot failed (${res.status}): ${body.slice(0, 1000)}`)
  }

  return {
    buffer: Buffer.from(await res.arrayBuffer()),
    contentType: opts.format === 'jpeg' ? 'image/jpeg' : 'image/png',
    renderMs: Date.now() - started,
  }
}
