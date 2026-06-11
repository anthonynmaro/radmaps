import { defineConfig, devices } from '@playwright/test'

const PORT = process.env.PLAYWRIGHT_PORT ?? '3000'

function envOr(name: string, fallback: string) {
  const value = process.env[name]?.trim()
  return value || fallback
}

const supabaseURL = envOr('SUPABASE_URL', 'http://127.0.0.1:54321')
const supabaseAnonKey = envOr('SUPABASE_ANON_KEY', 'playwright-anon-key')
const mapboxToken = envOr('MAPBOX_TOKEN', 'pk.playwright-mapbox-token')
const maptilerToken = envOr('MAPTILER_TOKEN', 'playwright-maptiler-key')
const stadiaApiKey = envOr('STADIA_API_KEY', 'playwright-stadia-key')
const renderTicketSecret = envOr('RENDER_TICKET_SECRET', 'playwright-render-ticket-secret')

export default defineConfig({
  testDir: './tests/style-browser',
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `npm run dev -- --port ${PORT}`,
    url: `http://localhost:${PORT}/`,
    reuseExistingServer: true,
    timeout: 120_000,
    env: {
      SUPABASE_URL: supabaseURL,
      SUPABASE_ANON_KEY: supabaseAnonKey,
      NUXT_PUBLIC_SUPABASE_URL: supabaseURL,
      NUXT_PUBLIC_SUPABASE_ANON_KEY: supabaseAnonKey,
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
    {
      name: 'mobile',
      use: { ...devices['iPhone 13'] },
    },
  ],
})
