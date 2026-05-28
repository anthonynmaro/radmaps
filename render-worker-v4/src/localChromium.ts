import { chromium } from 'playwright'

import {
  getLocalTunnelUserAgent,
  toPlaywrightWaitFunction,
  type BrowserScreenshotOptions,
  type BrowserScreenshotResult,
} from './screenshotProtocol.js'

export async function takeLocalChromiumScreenshot(opts: BrowserScreenshotOptions): Promise<BrowserScreenshotResult> {
  const started = Date.now()
  const timeoutMs = opts.timeoutMs ?? 60_000
  const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || process.env.CHROMIUM_EXECUTABLE_PATH || undefined
  const browser = await chromium.launch({
    headless: true,
    executablePath,
    args: [
      '--disable-dev-shm-usage',
      '--no-sandbox',
    ],
  })

  try {
    const page = await browser.newPage({
      viewport: {
        width: opts.widthPx,
        height: opts.heightPx,
      },
      deviceScaleFactor: opts.deviceScaleFactor,
      userAgent: opts.userAgent ?? getLocalTunnelUserAgent(opts.url),
    })
    page.setDefaultNavigationTimeout(timeoutMs)
    page.setDefaultTimeout(timeoutMs)

    await page.goto(opts.url, {
      waitUntil: opts.waitUntil ?? 'domcontentloaded',
      timeout: timeoutMs,
    })
    if (opts.waitForFunction) {
      await page.waitForFunction(toPlaywrightWaitFunction(opts.waitForFunction), undefined, {
        timeout: timeoutMs,
      })
    }
    await page.evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))')
    await page.waitForTimeout(250)

    const buffer = await page.screenshot({
      type: opts.format,
      quality: opts.format === 'jpeg' ? (opts.quality ?? 95) : undefined,
      fullPage: false,
    })

    return {
      buffer,
      contentType: opts.format === 'jpeg' ? 'image/jpeg' : 'image/png',
      renderMs: Date.now() - started,
    }
  } finally {
    await browser.close()
  }
}
