import { defineConfig, devices } from '@playwright/test'

const PORT = process.env.PLAYWRIGHT_E2E_PORT ?? '3100'
const baseURL = `http://127.0.0.1:${PORT}`
const fakeSupabaseURL = process.env.PLAYWRIGHT_E2E_SUPABASE_URL ?? 'http://127.0.0.1:54321'

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
      SUPABASE_URL: fakeSupabaseURL,
      SUPABASE_ANON_KEY: 'e2e-anon-key',
      NUXT_PUBLIC_RADMAPS_E2E_AUTH: '1',
      STRIPE_PUBLISHABLE_KEY: 'pk_test_radmaps_e2e',
      MAPBOX_TOKEN: 'pk.e2e-mapbox-token',
      NUXT_PUBLIC_STADIA_API_KEY: 'e2e-stadia-key',
    },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } },
    },
  ],
})
