import { describe, it, expect } from 'vitest'
import {
  computeMapContentHash,
  computeChromeHash,
  computeProofRenderHash,
  computePrintHash,
  stableStringify,
} from '../utils/render/hash'
import { HASH_VERSION } from '../utils/render/hashVersion'
import { getPrintFraming } from '../utils/print/printFraming'
import { DEFAULT_STYLE_CONFIG, type StyleConfig, type RouteStats } from '../types'

// ─── Fixtures ────────────────────────────────────────────────────────────────

const stats: RouteStats = {
  distance_km: 12.4,
  elevation_gain_m: 380,
  elevation_loss_m: 380,
  max_elevation_m: 1850,
  min_elevation_m: 1470,
  date: '2024-08-01',
  location: 'Tahoe Rim',
}

const geojson: GeoJSON.FeatureCollection = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'LineString',
        coordinates: [
          [-120.0, 39.0],
          [-120.05, 39.05],
          [-120.1, 39.1],
        ],
      },
    },
  ],
}

const framing = getPrintFraming('24x36', 'final')

const baseConfig: StyleConfig = { ...DEFAULT_STYLE_CONFIG }

describe('hash determinism', () => {
  it('same input produces same map_content_hash', () => {
    const a = computeMapContentHash(baseConfig, geojson, framing)
    const b = computeMapContentHash(baseConfig, geojson, framing)
    expect(a).toBe(b)
    expect(a).toMatch(/^[0-9a-f]{64}$/)
  })

  it('same input produces same chrome_hash', () => {
    const a = computeChromeHash(baseConfig, stats)
    const b = computeChromeHash(baseConfig, stats)
    expect(a).toBe(b)
    expect(a).toMatch(/^[0-9a-f]{64}$/)
  })
})

describe('two-layer isolation', () => {
  it('changing a map field changes map_content_hash', () => {
    const a = computeMapContentHash(baseConfig, geojson, framing)
    // route_color is classified 'map'
    const next = { ...baseConfig, route_color: '#00FF00' }
    const b = computeMapContentHash(next, geojson, framing)
    expect(a).not.toBe(b)
  })

  it('changing a chrome field does NOT change map_content_hash', () => {
    const a = computeMapContentHash(baseConfig, geojson, framing)
    // trail_name is classified 'chrome'
    const next = { ...baseConfig, trail_name: 'Different name' }
    const b = computeMapContentHash(next, geojson, framing)
    expect(a).toBe(b)
  })

  it('changing a chrome field DOES change chrome_hash', () => {
    const a = computeChromeHash(baseConfig, stats)
    const next = { ...baseConfig, trail_name: 'Different name' }
    const b = computeChromeHash(next, stats)
    expect(a).not.toBe(b)
  })

  it('changing a map field does NOT change chrome_hash', () => {
    const a = computeChromeHash(baseConfig, stats)
    const next = { ...baseConfig, route_color: '#00FF00' }
    const b = computeChromeHash(next, stats)
    expect(a).toBe(b)
  })

  it('label_position is treated as chrome (changes chrome_hash, not map_content_hash)', () => {
    const mapA = computeMapContentHash(baseConfig, geojson, framing)
    const chromeA = computeChromeHash(baseConfig, stats)
    const next = { ...baseConfig, label_position: 'top' as const }
    const mapB = computeMapContentHash(next, geojson, framing)
    const chromeB = computeChromeHash(next, stats)
    expect(mapA).toBe(mapB)
    expect(chromeA).not.toBe(chromeB)
  })
})

describe('HASH_VERSION scoping', () => {
  it('bumping HASH_VERSION.map.renderer changes map_content_hash but not chrome_hash', () => {
    const mapA = computeMapContentHash(baseConfig, geojson, framing)
    const chromeA = computeChromeHash(baseConfig, stats)

    const original = HASH_VERSION.map.renderer
    // Mutate via cast — only safe because we restore in finally.
    ;(HASH_VERSION.map as { renderer: string }).renderer = 'maplibre-native-v999'
    try {
      const mapB = computeMapContentHash(baseConfig, geojson, framing)
      const chromeB = computeChromeHash(baseConfig, stats)
      expect(mapB).not.toBe(mapA)
      expect(chromeB).toBe(chromeA)
    } finally {
      ;(HASH_VERSION.map as { renderer: string }).renderer = original
    }
  })

  it('bumping HASH_VERSION.chrome.chromeTemplate changes chrome_hash but not map_content_hash', () => {
    const mapA = computeMapContentHash(baseConfig, geojson, framing)
    const chromeA = computeChromeHash(baseConfig, stats)

    const original = HASH_VERSION.chrome.chromeTemplate
    ;(HASH_VERSION.chrome as { chromeTemplate: string }).chromeTemplate = 'chrome-v999'
    try {
      const mapB = computeMapContentHash(baseConfig, geojson, framing)
      const chromeB = computeChromeHash(baseConfig, stats)
      expect(chromeB).not.toBe(chromeA)
      expect(mapB).toBe(mapA)
    } finally {
      ;(HASH_VERSION.chrome as { chromeTemplate: string }).chromeTemplate = original
    }
  })
})

describe('stableStringify', () => {
  it('produces identical output for objects with reordered keys', () => {
    const a = { foo: 1, bar: 2, baz: { qux: 3, quux: 4 } }
    const b = { baz: { quux: 4, qux: 3 }, bar: 2, foo: 1 }
    expect(stableStringify(a)).toBe(stableStringify(b))
  })

  it('preserves array order', () => {
    expect(stableStringify([1, 2, 3])).toBe('[1,2,3]')
    expect(stableStringify([3, 2, 1])).not.toBe('[1,2,3]')
  })

  it('drops undefined object fields (matches optional-StyleConfig stability)', () => {
    expect(stableStringify({ a: 1, b: undefined })).toBe('{"a":1}')
  })

  it('handles nested arrays/objects', () => {
    const a = { list: [{ x: 1, y: 2 }, { y: 4, x: 3 }] }
    const b = { list: [{ y: 2, x: 1 }, { x: 3, y: 4 }] }
    expect(stableStringify(a)).toBe(stableStringify(b))
  })

  it('hashes are stable under StyleConfig key reordering', () => {
    // Build a logically equivalent config in reverse key order.
    const reordered = Object.fromEntries(
      Object.entries(baseConfig).reverse(),
    ) as StyleConfig
    const a = computeMapContentHash(baseConfig, geojson, framing)
    const b = computeMapContentHash(reordered, geojson, framing)
    expect(a).toBe(b)

    const ca = computeChromeHash(baseConfig, stats)
    const cb = computeChromeHash(reordered, stats)
    expect(ca).toBe(cb)
  })
})

describe('proof + print hashes', () => {
  it('proof_render_hash is stable + composes map + chrome', () => {
    const m = computeMapContentHash(baseConfig, geojson, framing)
    const c = computeChromeHash(baseConfig, stats)
    const a = computeProofRenderHash(m, c)
    const b = computeProofRenderHash(m, c)
    expect(a).toBe(b)
    expect(a).toMatch(/^[0-9a-f]{64}$/)

    // Different inputs → different hash.
    expect(computeProofRenderHash(m, c + '0')).not.toBe(a)
  })

  it('print_hash includes product + dpi + bleed', () => {
    const m = computeMapContentHash(baseConfig, geojson, framing)
    const c = computeChromeHash(baseConfig, stats)
    const a = computePrintHash({
      mapContentHash: m,
      chromeHash: c,
      productUid: '16x24',
      dpi: 300,
      bleedMm: 3,
    })
    const b = computePrintHash({
      mapContentHash: m,
      chromeHash: c,
      productUid: '24x36',
      dpi: 300,
      bleedMm: 3,
    })
    const c1 = computePrintHash({
      mapContentHash: m,
      chromeHash: c,
      productUid: '16x24',
      dpi: 200,
      bleedMm: 3,
    })
    expect(a).not.toBe(b)
    expect(a).not.toBe(c1)
    expect(a).toMatch(/^[0-9a-f]{64}$/)
  })
})
