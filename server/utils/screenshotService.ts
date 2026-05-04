export interface ScreenshotOptions {
  url: string
  widthPx: number
  heightPx: number
  deviceScaleFactor?: number
  format: 'jpeg' | 'png'
  quality?: number
  waitForFunction?: string
  timeoutMs?: number
}

export interface ScreenshotResult {
  buffer: Buffer
  contentType: string
  widthPx: number
  heightPx: number
  renderMs: number
}

const NGROK_BYPASS_USER_AGENT = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'

function getLocalTunnelUserAgent(url: string): { userAgent: string } | undefined {
  try {
    const hostname = new URL(url).hostname
    // Free ngrok tunnels show a browser warning to ordinary headless browsers.
    // A bot-style UA bypasses that warning without adding custom request
    // headers, which would trigger CORS preflight failures for Google Fonts.
    return hostname.endsWith('.ngrok-free.dev')
      ? { userAgent: NGROK_BYPASS_USER_AGENT }
      : undefined
  } catch {
    return undefined
  }
}

export async function takeScreenshot(opts: ScreenshotOptions): Promise<ScreenshotResult> {
  const config = useRuntimeConfig()
  const token = config.browserlessToken
  if (!token) {
    throw new Error('BROWSERLESS_TOKEN is not configured')
  }

  const start = Date.now()
  const configuredTimeout = Number(config.browserlessTimeoutMs)
  const timeoutMs = opts.timeoutMs ?? (Number.isFinite(configuredTimeout) ? configuredTimeout : 60_000)
  const endpoint = (config.browserlessEndpoint || 'https://production-sfo.browserless.io').replace(/\/$/, '')
  const query = new URLSearchParams({
    token,
    timeout: String(timeoutMs),
  })
  const response = await fetch(`${endpoint}/screenshot?${query.toString()}`, {
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
        deviceScaleFactor: opts.deviceScaleFactor ?? 1,
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

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Browserless screenshot failed (${response.status}): ${body.slice(0, 1000)}`)
  }

  return {
    buffer: Buffer.from(await response.arrayBuffer()),
    contentType: opts.format === 'jpeg' ? 'image/jpeg' : 'image/png',
    widthPx: opts.widthPx * (opts.deviceScaleFactor ?? 1),
    heightPx: opts.heightPx * (opts.deviceScaleFactor ?? 1),
    renderMs: Date.now() - start,
  }
}
