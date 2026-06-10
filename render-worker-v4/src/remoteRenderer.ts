import { CONFIG } from './config.js'
import {
  getLocalTunnelUserAgent,
  type BrowserScreenshotOptions,
  type BrowserScreenshotResult,
} from './screenshotProtocol.js'

export type RemoteRendererScreenshotOptions = BrowserScreenshotOptions
export type RemoteRendererScreenshotResult = BrowserScreenshotResult

export async function takeRemoteRendererScreenshot(opts: RemoteRendererScreenshotOptions): Promise<RemoteRendererScreenshotResult> {
  if (!CONFIG.proofRendererToken) {
    throw new Error('PROOF_RENDER_TOKEN is not configured')
  }
  if (!CONFIG.proofRendererEndpoint) {
    throw new Error('Proof screenshot endpoint is not configured')
  }

  const started = Date.now()
  const timeoutMs = opts.timeoutMs ?? CONFIG.proofRendererTimeoutMs
  const endpoint = CONFIG.proofRendererEndpoint.replace(/\/$/, '')
  const query = new URLSearchParams({
    token: CONFIG.proofRendererToken,
    timeout: String(timeoutMs),
  })
  const res = await fetch(`${endpoint}/screenshot?${query.toString()}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: opts.url,
      userAgent: opts.userAgent ?? getLocalTunnelUserAgent(opts.url),
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
        waitUntil: opts.waitUntil ?? 'domcontentloaded',
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
    throw new Error(`Proof renderer screenshot failed (${res.status}): ${body.slice(0, 1000)}`)
  }

  return {
    buffer: Buffer.from(await res.arrayBuffer()),
    contentType: opts.format === 'jpeg' ? 'image/jpeg' : 'image/png',
    renderMs: Date.now() - started,
  }
}
