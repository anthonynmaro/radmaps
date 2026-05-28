// render-worker-v4/src/config.ts
//
// Env-var parsing, centralised so every other module imports a typed CONFIG
// object instead of poking at process.env directly. Throws on startup if
// required vars are missing rather than failing mid-render.

function required(name: string): string {
  const v = process.env[name]
  if (!v) {
    throw new Error(`Missing required env var: ${name}`)
  }
  return v
}

function optional(name: string, fallback = ''): string {
  return process.env[name] ?? fallback
}

function int(name: string, fallback: number): number {
  const v = process.env[name]
  if (!v) return fallback
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

export type RenderBackend = 'browserless' | 'local-chromium'

function renderBackend(): RenderBackend {
  const value = optional('RENDER_BACKEND', 'browserless')
  if (value === 'browserless' || value === 'local-chromium') {
    return value
  }
  throw new Error(`Invalid RENDER_BACKEND: ${value}`)
}

export const VERSION = '0.1.0'

const browserlessTimeoutMs = int('BROWSERLESS_TIMEOUT_MS', 60_000)

export const CONFIG = {
  supabaseUrl: required('SUPABASE_URL'),
  supabaseServiceKey: required('SUPABASE_SERVICE_KEY'),

  // Direct Postgres connection used for SELECT ... FOR UPDATE SKIP LOCKED.
  databaseUrl: optional('DATABASE_URL'),

  appUrl: optional('APP_URL', 'https://radmaps.studio'),
  renderBackend: renderBackend(),
  renderTimeoutMs: int('RENDER_TIMEOUT_MS', browserlessTimeoutMs),
  browserlessToken: optional('BROWSERLESS_TOKEN'),
  browserlessEndpoint: optional('BROWSERLESS_ENDPOINT', 'https://production-sfo.browserless.io'),
  browserlessTimeoutMs,
  renderTicketSecret: required('RENDER_TICKET_SECRET'),

  logLevel: optional('LOG_LEVEL', 'info'),
} as const
