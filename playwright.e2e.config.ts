import { defineConfig, devices } from '@playwright/test'

const PORT = process.env.PLAYWRIGHT_E2E_PORT ?? '3100'
const baseURL = `http://127.0.0.1:${PORT}`

function envOr(name: string, fallback: string) {
  const value = process.env[name]?.trim()
  return value || fallback
}

const supabaseURL = envOr('SUPABASE_URL', process.env.PLAYWRIGHT_E2E_SUPABASE_URL ?? 'http://127.0.0.1:54321')
const supabaseAnonKey = envOr('SUPABASE_ANON_KEY', 'e2e-anon-key')
const supabaseServiceKey = envOr('SUPABASE_SERVICE_KEY', 'e2e-service-key')
const stripePublishableKey = envOr('STRIPE_PUBLISHABLE_KEY', 'pk_test_radmaps_e2e')
const stripeSecretKey = envOr('STRIPE_SECRET_KEY', 'sk_test_radmaps_e2e')
const gelatoApiKey = envOr('GELATO_API_KEY', 'e2e-gelato-key')
const mapboxToken = envOr('MAPBOX_TOKEN', 'pk.e2e-mapbox-token')
const maptilerToken = envOr('MAPTILER_TOKEN', 'e2e-maptiler-key')
const stadiaApiKey = envOr('STADIA_API_KEY', 'e2e-stadia-key')
const renderTicketSecret = envOr('RENDER_TICKET_SECRET', 'e2e-render-ticket-secret')

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  expect: {
    timeout: 15_000,
  },
  use: {
    baseURL,
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `npm run dev -- --host 127.0.0.1 --port ${PORT}`,
    url: `${baseURL}/favicon.ico`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      RADMAPS_E2E: '1',
      GELATO_ORDER_TYPE: 'draft',
      SUPABASE_URL: supabaseURL,
      SUPABASE_ANON_KEY: supabaseAnonKey,
      SUPABASE_SERVICE_KEY: supabaseServiceKey,
      NUXT_PUBLIC_SUPABASE_URL: supabaseURL,
      NUXT_PUBLIC_SUPABASE_ANON_KEY: supabaseAnonKey,
      NUXT_PUBLIC_RADMAPS_E2E_AUTH: '1',
      STRIPE_PUBLISHABLE_KEY: stripePublishableKey,
      STRIPE_SECRET_KEY: stripeSecretKey,
      NUXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: stripePublishableKey,
      GELATO_API_KEY: gelatoApiKey,
      MAPBOX_TOKEN: mapboxToken,
      NUXT_PUBLIC_MAPBOX_TOKEN: mapboxToken,
      MAPTILER_TOKEN: maptilerToken,
      NUXT_PUBLIC_MAPTILER_TOKEN: maptilerToken,
      STADIA_API_KEY: stadiaApiKey,
      NUXT_PUBLIC_STADIA_API_KEY: stadiaApiKey,
      RENDER_TICKET_SECRET: renderTicketSecret,
    },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } },
    },
  ],
})
