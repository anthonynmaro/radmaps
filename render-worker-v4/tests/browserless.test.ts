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
})
