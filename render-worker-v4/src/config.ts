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

export const VERSION = '0.1.0'

export const CONFIG = {
  port: int('PORT', 3002),
  workerSecret: required('RENDER_WORKER_SECRET'),

  supabaseUrl: required('SUPABASE_URL'),
  supabaseServiceKey: required('SUPABASE_SERVICE_KEY'),

  // Phase 8 print queue consumer. Optional at boot so /render-proof can run
  // without a pg connection during early integration.
  databaseUrl: optional('DATABASE_URL'),

  mapboxToken: optional('MAPBOX_TOKEN'),
  maptilerToken: optional('MAPTILER_TOKEN'),
  stadiaToken: optional('STADIA_API_KEY'),
  appUrl: optional('APP_URL', 'https://radmaps.studio'),
  browserlessToken: optional('BROWSERLESS_TOKEN'),
  browserlessEndpoint: optional('BROWSERLESS_ENDPOINT', 'https://production-sfo.browserless.io'),
  browserlessTimeoutMs: int('BROWSERLESS_TIMEOUT_MS', 60_000),
  renderTicketSecret: optional('RENDER_TICKET_SECRET', process.env.RENDER_WORKER_SECRET ?? ''),

  tileCacheDir: optional('TILE_CACHE_DIR', '/app/tile-cache'),
  tileCacheMaxSizeMb: int('TILE_CACHE_MAX_SIZE_MB', 2048),

  logLevel: optional('LOG_LEVEL', 'info'),
} as const

// Hosts allowed for logo fetches (REMEDIATION.md SSRF mitigation).
// Supabase Storage origin + the public app origin. No metadata IPs, no http.
export function getAllowedLogoOrigins(): string[] {
  const out: string[] = []
  try {
    out.push(new URL(CONFIG.supabaseUrl).origin)
  } catch {
    /* malformed SUPABASE_URL is caught at boot via required() */
  }
  try {
    if (CONFIG.appUrl) out.push(new URL(CONFIG.appUrl).origin)
  } catch {
    /* noop */
  }
  return out
}
