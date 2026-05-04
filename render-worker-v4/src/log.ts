// render-worker-v4/src/log.ts
//
// Single-line JSON log emitter. Railway's log drain consumes stdout
// line-by-line, so each event is one self-contained JSON object. Plan v4
// §16 enumerates the metric events we emit; helpers below name them.

import { CONFIG } from './config.js'

const LEVELS = ['debug', 'info', 'warn', 'error'] as const
type Level = (typeof LEVELS)[number]

function levelEnabled(level: Level): boolean {
  const idx = LEVELS.indexOf(level)
  const minIdx = LEVELS.indexOf((CONFIG.logLevel as Level) ?? 'info')
  return idx >= (minIdx === -1 ? LEVELS.indexOf('info') : minIdx)
}

function emit(level: Level, fields: Record<string, unknown>): void {
  if (!levelEnabled(level)) return
  const line = JSON.stringify({ level, ts: new Date().toISOString(), ...fields })
  // stdout for info/debug, stderr for warn/error so Railway's UI tags them.
  if (level === 'error' || level === 'warn') {
    process.stderr.write(line + '\n')
  } else {
    process.stdout.write(line + '\n')
  }
}

export const log = {
  debug: (event: string, fields: Record<string, unknown> = {}) =>
    emit('debug', { event, ...fields }),
  info: (event: string, fields: Record<string, unknown> = {}) =>
    emit('info', { event, ...fields }),
  warn: (event: string, fields: Record<string, unknown> = {}) =>
    emit('warn', { event, ...fields }),
  error: (event: string, fields: Record<string, unknown> = {}) =>
    emit('error', { event, ...fields }),
}

// ─── Plan v4 §16 metric helpers ─────────────────────────────────────────────

export function logRenderComplete(fields: {
  render_class: 'proof' | 'final'
  render_backend: 'native' | 'browser'
  render_ms: number
  product_size: string
  memory_peak_mb: number
  cache_hit: boolean
  map_id?: string
  stripe_session_id?: string
}): void {
  log.info('render_complete', fields)
}

export function logRenderFailed(fields: {
  render_class: 'proof' | 'final'
  render_backend: 'native' | 'browser'
  reason: string
  product_size?: string
  map_id?: string
  stripe_session_id?: string
}): void {
  log.error('render_failed', fields)
}

export function logCacheLookup(fields: {
  cache: 'render_cache' | 'product_renders' | 'tile_cache'
  hit: boolean
  key?: string
}): void {
  log.debug('cache_lookup', fields)
}

export function logTileFetch(fields: {
  url_host: string
  ms: number
  status: number
  bytes?: number
}): void {
  log.debug('tile_fetch', fields)
}

export function logValidationResult(fields: {
  render_class: 'proof' | 'final'
  passed: boolean
  errors: number
  warnings: number
}): void {
  log.info('validation_result', fields)
}
