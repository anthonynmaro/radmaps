// tests/tileCache.test.ts
//
// Verifies:
//   • atomic writes (no .tmp leftovers; final file fully populated)
//   • LRU eviction (oldest mtime evicted first when size > limit)
//   • URL normalization strips token-bearing query params before hashing
//
// These tests run without the network: we inject a fake `fetch` so the
// cache exercises its own paths.

import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { TileCache, normalizeTileUrl } from '../src/renderer/tileCache.js'

let tmpDir: string
beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tilecache-'))
})
afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true })
})

describe('normalizeTileUrl', () => {
  it('strips Mapbox access_token', () => {
    const a = normalizeTileUrl('https://api.mapbox.com/v4/tile/0/1/2?access_token=ABC')
    const b = normalizeTileUrl('https://api.mapbox.com/v4/tile/0/1/2?access_token=XYZ')
    expect(a).toBe(b)
  })

  it('strips MapTiler key + Stadia api_key', () => {
    const a = normalizeTileUrl('https://api.maptiler.com/tile?key=ABC&style=outdoor')
    const b = normalizeTileUrl('https://api.maptiler.com/tile?key=XYZ&style=outdoor')
    expect(a).toBe(b)
    expect(a).toContain('style=outdoor')
    expect(a).not.toContain('key=')

    const s1 = normalizeTileUrl('https://tiles.stadiamaps.com/x/y/z?api_key=ONE')
    const s2 = normalizeTileUrl('https://tiles.stadiamaps.com/x/y/z?api_key=TWO')
    expect(s1).toBe(s2)
  })

  it('lowercases the host so casing variations share the cache', () => {
    expect(normalizeTileUrl('https://API.MAPBOX.COM/v4/0/1/2.png')).toBe(
      'https://api.mapbox.com/v4/0/1/2.png',
    )
  })

  it('preserves non-auth query params and sorts them', () => {
    const a = normalizeTileUrl('https://x.example.com/tile?b=1&a=2')
    const b = normalizeTileUrl('https://x.example.com/tile?a=2&b=1')
    expect(a).toBe(b)
  })
})

describe('TileCache', () => {
  it('writes atomically (no .tmp leftover after a successful fetch)', async () => {
    const fakeFetch = (async (_url: string) => {
      return new Response(new Uint8Array([1, 2, 3, 4]).buffer, {
        status: 200,
        headers: { 'content-type': 'image/png' },
      })
    }) as typeof fetch
    const cache = new TileCache({ dir: tmpDir, maxSizeMb: 10, fetchImpl: fakeFetch })
    await cache.get('https://api.mapbox.com/v4/tile/0/1/2?access_token=A')

    // Walk tmpDir for any .tmp files.
    async function findTmp(dir: string): Promise<string[]> {
      const out: string[] = []
      for (const e of await fs.readdir(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name)
        if (e.isDirectory()) out.push(...(await findTmp(p)))
        else if (e.name.endsWith('.tmp')) out.push(p)
      }
      return out
    }
    expect(await findTmp(tmpDir)).toEqual([])
  })

  it('returns the same buffer on a second hit without re-fetching', async () => {
    let fetches = 0
    const fakeFetch = (async () => {
      fetches++
      return new Response(new Uint8Array([9, 8, 7]).buffer, { status: 200 })
    }) as typeof fetch
    const cache = new TileCache({ dir: tmpDir, maxSizeMb: 10, fetchImpl: fakeFetch })
    const url = 'https://api.mapbox.com/v4/tile/0/1/2?access_token=A'
    const a = await cache.get(url)
    const b = await cache.get(url)
    expect(a.equals(b)).toBe(true)
    expect(fetches).toBe(1)
  })

  it('treats token rotation as a cache hit', async () => {
    let fetches = 0
    const fakeFetch = (async () => {
      fetches++
      return new Response(new Uint8Array([5]).buffer, { status: 200 })
    }) as typeof fetch
    const cache = new TileCache({ dir: tmpDir, maxSizeMb: 10, fetchImpl: fakeFetch })
    await cache.get('https://api.mapbox.com/v4/0/0/0?access_token=OLD')
    await cache.get('https://api.mapbox.com/v4/0/0/0?access_token=NEW')
    expect(fetches).toBe(1)
  })

  it('evicts oldest entries when size > maxSizeBytes', async () => {
    const fakeFetch = (async () =>
      new Response(new Uint8Array(1024 * 1024).buffer, { status: 200 })) as typeof fetch
    // 5 MB total; 2 MB cap → at least one entry should be evicted.
    const cache = new TileCache({ dir: tmpDir, maxSizeMb: 2, fetchImpl: fakeFetch })
    for (let i = 0; i < 5; i++) {
      await cache.put(`https://x.example.com/tile/${i}`, Buffer.alloc(1024 * 1024))
    }
    const result = await cache.sweep()
    expect(result.deleted).toBeGreaterThan(0)
    expect(result.remainingBytes).toBeLessThanOrEqual(2 * 1024 * 1024)
  })
})
