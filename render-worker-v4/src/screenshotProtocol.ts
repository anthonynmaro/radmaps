export interface BrowserScreenshotOptions {
  url: string
  widthPx: number
  heightPx: number
  deviceScaleFactor: number
  format: 'jpeg' | 'png'
  quality?: number
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle'
  waitForFunction?: string
  timeoutMs?: number
  userAgent?: string
}

export interface BrowserScreenshotResult {
  buffer: Buffer
  contentType: string
  renderMs: number
}

const NGROK_BYPASS_USER_AGENT = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'

export function getLocalTunnelUserAgent(url: string): string | undefined {
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

export function toPlaywrightWaitFunction(expression: string): string {
  const trimmed = expression.trim()
  if (
    trimmed.startsWith('() =>')
    || trimmed.startsWith('async () =>')
    || trimmed.startsWith('function')
    || trimmed.startsWith('(function')
    || trimmed.startsWith('async function')
  ) {
    return `(${trimmed})()`
  }
  return trimmed
}
