import { afterEach, describe, expect, it, vi } from 'vitest'

describe('takeBrowserlessScreenshot', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('sends the ngrok bypass user agent as a string', async () => {
    vi.resetModules()
    vi.stubEnv('BROWSERLESS_TOKEN', 'browserless-test-token')
    vi.stubEnv('BROWSERLESS_ENDPOINT', 'https://browserless.example.test')
    vi.stubEnv('SUPABASE_URL', 'https://example.supabase.co')
    vi.stubEnv('SUPABASE_SERVICE_KEY', 'test-service-key')
    vi.stubEnv('RENDER_TICKET_SECRET', 'test-render-ticket-secret')

    const fetchMock = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => new Response(new Uint8Array([1, 2, 3]), {
      status: 200,
      headers: { 'content-type': 'image/jpeg' },
    }))
    vi.stubGlobal('fetch', fetchMock)

    const { takeBrowserlessScreenshot } = await import('../src/browserless.js')
    await takeBrowserlessScreenshot({
      url: 'https://example.ngrok-free.dev/render/session/cs_test',
      widthPx: 100,
      heightPx: 150,
      deviceScaleFactor: 2,
      format: 'jpeg',
      quality: 90,
      waitForFunction: 'window.__RENDER_READY === true',
      timeoutMs: 5000,
    })

    const calls = fetchMock.mock.calls as Array<[unknown, RequestInit?]>
    const init = calls[0]?.[1]
    const body = JSON.parse(String(init?.body)) as { userAgent?: unknown }
    expect(typeof body.userAgent).toBe('string')
    expect(body.userAgent).toContain('Googlebot')
  })

  it('uses the Browserless-compatible protocol for the AWS proof renderer', async () => {
    vi.resetModules()
    vi.stubEnv('BROWSERLESS_TOKEN', 'aws-proof-token')
    vi.stubEnv('BROWSERLESS_ENDPOINT', 'https://zfwtsxbyy2.us-east-2.awsapprunner.com')
    vi.stubEnv('BROWSERLESS_TIMEOUT_MS', '120000')
    vi.stubEnv('SUPABASE_URL', 'https://example.supabase.co')
    vi.stubEnv('SUPABASE_SERVICE_KEY', 'test-service-key')
    vi.stubEnv('RENDER_TICKET_SECRET', 'test-render-ticket-secret')

    const fetchMock = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => new Response(new Uint8Array([4, 5, 6]), {
      status: 200,
      headers: { 'content-type': 'image/jpeg' },
    }))
    vi.stubGlobal('fetch', fetchMock)

    const { takeBrowserlessScreenshot } = await import('../src/browserless.js')
    await takeBrowserlessScreenshot({
      url: 'https://radmaps.studio/render/map/map-id?ticket=test-ticket',
      widthPx: 1235,
      heightPx: 1835,
      deviceScaleFactor: 1,
      format: 'jpeg',
      quality: 95,
      waitForFunction: 'window.__RENDER_READY === true && window.__RADMAPS_RENDER_STATUS?.routeContentPresent === true',
    })

    const calls = fetchMock.mock.calls as Array<[unknown, RequestInit?]>
    const requestUrl = new URL(String(calls[0]?.[0]))
    const body = JSON.parse(String(calls[0]?.[1]?.body)) as {
      url?: string
      viewport?: { width?: number, height?: number, deviceScaleFactor?: number }
      waitForFunction?: { fn?: string, timeout?: number }
    }

    expect(requestUrl.origin).toBe('https://zfwtsxbyy2.us-east-2.awsapprunner.com')
    expect(requestUrl.pathname).toBe('/screenshot')
    expect(requestUrl.searchParams.get('token')).toBe('aws-proof-token')
    expect(requestUrl.searchParams.get('timeout')).toBe('120000')
    expect(body.url).toContain('https://radmaps.studio/render/map/map-id')
    expect(body.viewport).toEqual({ width: 1235, height: 1835, deviceScaleFactor: 1 })
    expect(body.waitForFunction?.timeout).toBe(120000)
    expect(body.waitForFunction?.fn).toContain('window.__RENDER_READY === true')
  })
})
