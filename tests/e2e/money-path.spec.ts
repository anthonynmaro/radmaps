import { expect, test, type Page, type Route } from '@playwright/test'
import { DEFAULT_STYLE_CONFIG, type RouteStats, type StyleConfig, type TrailMap } from '../../types'

const USER_ID = '11111111-1111-4111-8111-111111111111'
const MAP_ID = '22222222-2222-4222-8222-222222222222'
const CHECKOUT_ATTEMPT_ID = '33333333-3333-4333-8333-333333333333'
const QUOTE_ID = '44444444-4444-4444-8444-444444444444'
const PROOF_HASH = 'e2e-proof-hash'
const PROOF_URL = 'https://assets.radmaps.test/proofs/e2e-proof.jpg'
const STRIPE_SESSION_ID = 'cs_test_radmaps_money_path'
const STRIPE_SESSION_URL = `https://checkout.stripe.com/c/pay/${STRIPE_SESSION_ID}`

const gpxFixture = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="radmaps-money-path" xmlns="http://www.topografix.com/GPX/1/1">
  <trk>
    <name>Money Path Ridge</name>
    <trkseg>
      <trkpt lat="42.3494" lon="-71.0841"><ele>8</ele><time>2026-04-20T12:00:00Z</time></trkpt>
      <trkpt lat="42.3502" lon="-71.0780"><ele>11</ele><time>2026-04-20T12:05:00Z</time></trkpt>
      <trkpt lat="42.3478" lon="-71.0712"><ele>14</ele><time>2026-04-20T12:10:00Z</time></trkpt>
      <trkpt lat="42.3439" lon="-71.0738"><ele>9</ele><time>2026-04-20T12:15:00Z</time></trkpt>
      <trkpt lat="42.3429" lon="-71.0814"><ele>7</ele><time>2026-04-20T12:20:00Z</time></trkpt>
      <trkpt lat="42.3494" lon="-71.0841"><ele>8</ele><time>2026-04-20T12:25:00Z</time></trkpt>
    </trkseg>
  </trk>
</gpx>`

function fakeUser() {
  return {
    id: USER_ID,
    aud: 'authenticated',
    role: 'authenticated',
    email: 'e2e-buyer@radmaps.test',
    app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: { full_name: 'E2E Buyer' },
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  }
}

function seedSupabaseSession(page: Page) {
  const user = fakeUser()
  const session = {
    access_token: 'e2e-access-token',
    refresh_token: 'e2e-refresh-token',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user,
  }

  return page.addInitScript((payload) => {
    window.localStorage.setItem('radmaps:e2e-auth', '1')
    window.localStorage.setItem('sb-127-auth-token', JSON.stringify(payload))
    window.localStorage.setItem('sb-localhost-auth-token', JSON.stringify(payload))
  }, session)
}

function routeJson(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    headers: {
      'access-control-allow-origin': '*',
      'access-control-allow-headers': '*',
      'access-control-allow-methods': 'GET,POST,PATCH,OPTIONS',
    },
    body: JSON.stringify(body),
  })
}

function routeCorsNoContent(route: Route) {
  return route.fulfill({
    status: 204,
    headers: {
      'access-control-allow-origin': '*',
      'access-control-allow-headers': '*',
      'access-control-allow-methods': 'GET,POST,PATCH,OPTIONS',
    },
  })
}

async function installMoneyPathRoutes(page: Page) {
  let mapRecord: TrailMap | null = null
  let proofRequested = false
  let quotePayload: any = null
  let sessionPayload: any = null

  await page.route('**/auth/v1/user**', route =>
    route.request().method() === 'OPTIONS' ? routeCorsNoContent(route) : routeJson(route, fakeUser()),
  )
  await page.route('**/auth/v1/token**', route =>
    route.request().method() === 'OPTIONS'
      ? routeCorsNoContent(route)
      : routeJson(route, {
    access_token: 'e2e-access-token',
    refresh_token: 'e2e-refresh-token',
    token_type: 'bearer',
    expires_in: 3600,
    user: fakeUser(),
  }),
  )

  await page.route('**/rest/v1/maps**', async (route) => {
    const request = route.request()
    if (request.method() === 'OPTIONS') return routeCorsNoContent(route)
    if (!mapRecord) return routeJson(route, { message: 'Map not found' }, 404)

    if (request.method() === 'PATCH') {
      const patch = request.postDataJSON() as Partial<TrailMap> & { style_config?: StyleConfig }
      mapRecord = {
        ...mapRecord,
        ...patch,
        style_config: patch.style_config ? { ...patch.style_config } : mapRecord.style_config,
      }
      return routeCorsNoContent(route)
    }

    if (request.method() === 'GET') {
      if (proofRequested) {
        mapRecord = {
          ...mapRecord,
          status: 'rendered',
          render_url: PROOF_URL,
          thumbnail_url: PROOF_URL,
          proof_render_url: PROOF_URL,
          proof_render_hash: PROOF_HASH,
        } as TrailMap
      }
      return routeJson(route, mapRecord)
    }

    return route.fallback()
  })

  await page.route('**/api/maps', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback()
    const body = route.request().postDataJSON() as {
      title: string
      geojson: GeoJSON.FeatureCollection
      bbox: [number, number, number, number]
      stats: RouteStats
    }
    mapRecord = {
      id: MAP_ID,
      user_id: USER_ID,
      title: body.title,
      geojson: body.geojson,
      bbox: body.bbox,
      stats: { ...body.stats, date: '2026-04-20', location: 'Boston, MA' },
      style_config: { ...DEFAULT_STYLE_CONFIG, trail_name: body.title },
      status: 'draft',
      created_at: '2026-04-20T12:00:00.000Z',
      updated_at: '2026-04-20T12:00:00.000Z',
    } as TrailMap
    return routeJson(route, mapRecord)
  })

  await page.route(`**/api/maps/${MAP_ID}/render`, async (route) => {
    proofRequested = true
    return routeJson(route, {
      status: 'queued',
      proof_render_hash: PROOF_HASH,
    })
  })

  await page.route('**/api/product-prices**', route => routeJson(route, { prices: [] }))
  await page.route('**/api/flags**', route => routeJson(route, {}))
  await page.route('**/api/mockups/templates**', route => routeJson(route, { templates: [] }))

  await page.route('**/api/checkout/quote', async (route) => {
    quotePayload = route.request().postDataJSON()
    return routeJson(route, {
      checkout_attempt_id: CHECKOUT_ATTEMPT_ID,
      quote_id: QUOTE_ID,
      selected: {
        shipment_method_uid: 'gelato-standard-e2e',
        shipment_method_name: 'Standard shipping',
        amount_cents: 799,
        currency: 'usd',
        min_delivery_date: '2026-06-15',
        max_delivery_date: '2026-06-20',
        expires_at: '2026-06-20T00:00:00.000Z',
        status: 'selected',
      },
      pricing: { retail_price_cents: 4900 },
    })
  })

  await page.route('**/api/checkout/session', async (route) => {
    sessionPayload = route.request().postDataJSON()
    return routeJson(route, {
      url: STRIPE_SESSION_URL,
      session_id: STRIPE_SESSION_ID,
    })
  })

  await page.route('https://checkout.stripe.com/**', route => route.fulfill({
    status: 200,
    contentType: 'text/html',
    body: '<!doctype html><title>Stripe test checkout</title><h1>Stripe test checkout</h1>',
  }))

  return {
    get mapRecord() { return mapRecord },
    get quotePayload() { return quotePayload },
    get sessionPayload() { return sessionPayload },
  }
}

test('GPX upload to Stripe checkout money path completes with a rendered proof', async ({ page }) => {
  await seedSupabaseSession(page)
  const state = await installMoneyPathRoutes(page)

  await page.goto('/create?e2eAuth=1')
  await page.waitForLoadState('networkidle')
  await page.getByRole('button', { name: /Upload a route From your watch or app/ }).click()
  await expect(page.getByRole('heading', { name: 'Bring a file from your watch or app' })).toBeVisible()
  await page.locator('input[type="file"]').setInputFiles({
    name: 'money-path-ridge.gpx',
    mimeType: 'application/gpx+xml',
    buffer: Buffer.from(gpxFixture),
  })

  await expect(page.getByText('Route loaded')).toBeVisible()
  await expect(page.getByPlaceholder('e.g., Mount Rainier Loop')).toHaveValue('Money Path Ridge')

  const createMapRequest = page.waitForRequest(request =>
    request.url().endsWith('/api/maps') && request.method() === 'POST',
  )
  await page.getByRole('button', { name: /Continue to styling/i }).click()
  await createMapRequest

  await expect(page).toHaveURL(new RegExp(`/create/${MAP_ID}/style\\?themePicker=1`))
  await expect(page.getByTestId('theme-lineup-step')).toBeVisible()
  await page.getByTestId('theme-picker-apply').click()
  await expect(page.getByTestId('map-editor-surface')).toBeVisible()

  const titleSlot = page.getByTestId('poster-header').getByRole('textbox', { name: 'Trail name' })
  await expect(titleSlot).toBeVisible()
  await titleSlot.click()
  const savedTitleOverride = page.waitForRequest(request =>
    request.url().includes('/rest/v1/maps')
    && request.method() === 'PATCH'
    && (request.postData() ?? '').includes('Money Path Checkout Proof'),
  )
  await page.getByRole('textbox', { name: 'Trail name text' }).fill('Money Path Checkout Proof')
  await expect(titleSlot).toContainText('Money Path Checkout Proof')
  await savedTitleOverride

  await page.getByRole('button', { name: 'Order' }).click()
  await expect(page).toHaveURL(new RegExp(`/create/${MAP_ID}/checkout`))

  await page.getByRole('button', { name: 'Render proof' }).click()
  await expect(page.getByText('Print-ready proof is ready.')).toBeVisible({ timeout: 10_000 })

  await page.locator('[data-address-field="name"]').fill('Anthony Maro')
  await page.locator('[data-address-field="email"]').fill('anthony@example.com')
  await page.locator('[data-address-field="address1"]').fill('197 Heritage Trace')
  await page.locator('[data-address-field="city"]').fill('Boston')
  await page.locator('[data-address-field="state_code"]').fill('MA')
  await page.locator('[data-address-field="zip"]').fill('02116')
  await expect(page.getByText('Standard shipping locked for this address.')).toBeVisible({ timeout: 10_000 })

  await page.getByRole('button', { name: 'Proceed to Payment' }).click()
  await expect(page).toHaveURL(/checkout\.stripe\.com\/c\/pay\/cs_test_radmaps_money_path/)
  await expect(page.getByRole('heading', { name: 'Stripe test checkout' })).toBeVisible()

  expect(state.quotePayload).toMatchObject({
    cart_source: 'custom',
    map_id: MAP_ID,
    quantity: 1,
    digital_only: false,
    shipping_address: {
      country_code: 'US',
      state_code: 'MA',
      zip: '02116',
    },
  })
  expect(state.sessionPayload).toMatchObject({
    cart_source: 'custom',
    checkout_attempt_id: CHECKOUT_ATTEMPT_ID,
    quote_id: QUOTE_ID,
    map_id: MAP_ID,
    quantity: 1,
    digital_only: false,
  })
  expect(state.mapRecord?.style_config.poster_text_overrides?.trail_name?.text).toBe('Money Path Checkout Proof')
  expect(state.mapRecord?.proof_render_hash).toBe(PROOF_HASH)
})
