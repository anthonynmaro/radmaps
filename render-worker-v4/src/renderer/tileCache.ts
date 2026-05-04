// render-worker-v4/src/renderer/tileCache.ts
//
// Disk-backed LRU tile cache for the Native renderer.
//
// Plan v4 §"Worker tile cache":
//   • Key = sha256(normalize(url)).
//   • Normalization strips auth/token query parameters before hashing —
//     token rotation must NOT invalidate the cache.
//   • Atomic writes: writeFile(tmp); rename(tmp, final).
//   • Periodic eviction sweep when total size > limit.
//
// We mount the cache directory as a persistent volume in production so warm
// tiles survive Railway redeploys. In tests we point TILE_CACHE_DIR at a
// throwaway tmp dir.

import { createHash } from 'node:crypto'
import { promises as fs } from 'node:fs'
import path from 'node:path'

import { CONFIG } from '../config.js'
import { logTileFetch } from '../log.js'

// Query-string keys we strip before hashing the cache key. These are the
// known auth-bearing params across the four tile providers we use.
const STRIP_QUERY_KEYS = new Set([
  // Mapbox
  'access_token',
  // MapTiler
  'key',
  // Stadia (sometimes pinned via api_key in addition to Referer auth)
  'api_key',
  'apiKey',
  // CARTO occasionally forwards auth via this param on enterprise.
  'auth_token',
  // Generic
  'token',
])

/**
 * Normalize a tile URL: strip auth-bearing query params, stable-sort the
 * remainder, lowercase the host. Returns the canonical string we hash.
 *
 * Exposed as a named export so the unit test can pin behaviour.
 */
export function normalizeTileUrl(url: string): string {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return url
  }
  const params = new URLSearchParams()
  const keys: string[] = []
  parsed.searchParams.forEach((_v, k) => {
    if (!STRIP_QUERY_KEYS.has(k)) keys.push(k)
  })
  keys.sort()
  for (const k of keys) {
    // Preserve first occurrence; tile URLs don't repeat keys in practice.
    const v = parsed.searchParams.get(k)
    if (v != null) params.append(k, v)
  }
  const queryString = params.toString()
  return `${parsed.protocol}//${parsed.host.toLowerCase()}${parsed.pathname}${
    queryString ? '?' + queryString : ''
  }`
}

function keyFor(url: string): string {
  return createHash('sha256').update(normalizeTileUrl(url)).digest('hex')
}

function pathFor(cacheDir: string, key: string): string {
  // Two-level fanout to avoid millions of files in a single directory.
  return path.join(cacheDir, key.slice(0, 2), key.slice(2, 4), key)
}

// ─── Disk operations ────────────────────────────────────────────────────────

async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true })
}

async function safeStat(p: string): Promise<{ size: number; mtimeMs: number } | null> {
  try {
    const s = await fs.stat(p)
    return { size: s.size, mtimeMs: s.mtimeMs }
  } catch {
    return null
  }
}

async function readFileOrNull(p: string): Promise<Buffer | null> {
  try {
    return await fs.readFile(p)
  } catch {
    return null
  }
}

async function atomicWrite(finalPath: string, body: Buffer): Promise<void> {
  await ensureDir(path.dirname(finalPath))
  const tmp = `${finalPath}.${process.pid}.${Date.now()}.tmp`
  await fs.writeFile(tmp, body)
  await fs.rename(tmp, finalPath)
}

// ─── Public API ─────────────────────────────────────────────────────────────

export interface TileCacheOptions {
  /** Cache root. Defaults to CONFIG.tileCacheDir. */
  dir?: string
  /** Hard size limit in MB before eviction kicks in. */
  maxSizeMb?: number
  /** Override for tests so we can mock the network. */
  fetchImpl?: typeof fetch
  /** Optional extra HTTP headers (e.g. Stadia Referer). */
  defaultHeaders?: Record<string, string>
}

export class TileCache {
  private readonly dir: string
  private readonly maxSizeBytes: number
  private readonly fetchImpl: typeof fetch
  private readonly defaultHeaders: Record<string, string>
  private inflight = new Map<string, Promise<Buffer>>()
  private bytesSinceSweep = 0

  constructor(opts: TileCacheOptions = {}) {
    this.dir = opts.dir ?? CONFIG.tileCacheDir
    this.maxSizeBytes = (opts.maxSizeMb ?? CONFIG.tileCacheMaxSizeMb) * 1024 * 1024
    this.fetchImpl = opts.fetchImpl ?? fetch
    this.defaultHeaders = opts.defaultHeaders ?? {}
  }

  async get(url: string): Promise<Buffer> {
    const key = keyFor(url)
    const filePath = pathFor(this.dir, key)

    // 1. Disk hit?
    const cached = await readFileOrNull(filePath)
    if (cached) {
      // Touch mtime so LRU eviction sees this as recently used.
      fs.utimes(filePath, new Date(), new Date()).catch(() => {})
      return cached
    }

    // 2. Coalesce concurrent misses for the same URL.
    const existing = this.inflight.get(key)
    if (existing) return existing

    const promise = this.fetchAndCache(url, key, filePath)
    this.inflight.set(key, promise)
    try {
      return await promise
    } finally {
      this.inflight.delete(key)
    }
  }

  /**
   * Write a buffer directly into the cache without fetching. Used in tests
   * and as a fast-path for tiles fetched via a non-default mechanism.
   */
  async put(url: string, body: Buffer): Promise<void> {
    const key = keyFor(url)
    const filePath = pathFor(this.dir, key)
    await atomicWrite(filePath, body)
    this.bytesSinceSweep += body.byteLength
    if (this.bytesSinceSweep > this.maxSizeBytes / 4) {
      this.bytesSinceSweep = 0
      // Fire-and-forget eviction; if multiple sweeps overlap that's fine.
      this.sweep().catch(() => {})
    }
  }

  private async fetchAndCache(url: string, key: string, filePath: string): Promise<Buffer> {
    const start = Date.now()
    let host = ''
    try {
      host = new URL(url).host
    } catch {
      /* noop */
    }
    const res = await this.fetchImpl(url, {
      headers: this.defaultHeaders,
      redirect: 'follow',
    })
    const ms = Date.now() - start
    if (!res.ok) {
      logTileFetch({ url_host: host, ms, status: res.status })
      throw new Error(`tile fetch ${res.status} ${res.statusText} :: ${url}`)
    }
    const ab = await res.arrayBuffer()
    const buf = Buffer.from(ab)
    logTileFetch({ url_host: host, ms, status: res.status, bytes: buf.byteLength })
    // Some tile servers (notably Stadia for out-of-coverage tiles) reply
    // 200 OK with an empty body. Caching that poisons the cache: MapLibre
    // Native rehydrates 0 bytes and Core Graphics throws
    // CGImageSourceCreateImageAtIndex failed. Treat empty as a transient
    // miss — return without writing, and let MapLibre handle "no data"
    // for that tile (renders blank patch, doesn't crash the whole tile load).
    if (buf.byteLength === 0) {
      return buf
    }
    // Write before resolving so a concurrent miss after this completes
    // sees the disk hit immediately.
    await atomicWrite(filePath, buf)
    this.bytesSinceSweep += buf.byteLength
    if (this.bytesSinceSweep > this.maxSizeBytes / 4) {
      this.bytesSinceSweep = 0
      this.sweep().catch(() => {})
    }
    return buf
  }

  /**
   * LRU eviction: walk the cache, sort by mtime, delete oldest until the
   * total drops below `maxSizeBytes`. O(n) on cache entries; only called
   * when bytesSinceSweep crosses 1/4 of the limit.
   */
  async sweep(): Promise<{ deleted: number; remainingBytes: number }> {
    const entries: Array<{ p: string; size: number; mtimeMs: number }> = []
    let total = 0
    await this.walk(this.dir, async (p) => {
      const s = await safeStat(p)
      if (!s) return
      entries.push({ p, size: s.size, mtimeMs: s.mtimeMs })
      total += s.size
    })
    if (total <= this.maxSizeBytes) {
      return { deleted: 0, remainingBytes: total }
    }
    entries.sort((a, b) => a.mtimeMs - b.mtimeMs) // oldest first
    let deleted = 0
    for (const e of entries) {
      if (total <= this.maxSizeBytes) break
      try {
        await fs.unlink(e.p)
        total -= e.size
        deleted++
      } catch {
        /* concurrent eviction or vanished file — skip */
      }
    }
    return { deleted, remainingBytes: total }
  }

  private async walk(dir: string, visit: (p: string) => Promise<void>): Promise<void> {
    let entries: Array<{ name: string; isDirectory: () => boolean; isFile: () => boolean }> = []
    try {
      // Cast through unknown to sidestep Node 20+ Dirent<NonSharedBuffer> generic
      // — we only need string names here, which the runtime always provides
      // when the cwd argument is a string.
      entries = (await fs.readdir(dir, { withFileTypes: true })) as unknown as typeof entries
    } catch {
      return
    }
    for (const entry of entries) {
      const name = String(entry.name)
      const p = path.join(dir, name)
      if (entry.isDirectory()) {
        await this.walk(p, visit)
      } else if (entry.isFile() && !name.endsWith('.tmp')) {
        await visit(p)
      }
    }
  }
}
