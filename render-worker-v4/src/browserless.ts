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
