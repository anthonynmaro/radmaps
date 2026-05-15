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

function proofHash(config: StyleConfig) {
  return computeProofRenderHash(
    computeMapContentHash(config, geojson, framing),
    computeChromeHash(config, stats),
  )
}

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

  it('changing uploaded segment geometry changes map_content_hash', () => {
    const a = computeMapContentHash(baseConfig, geojson, framing)
    const next: StyleConfig = {
      ...baseConfig,
      trail_segments: [{
        id: 'uploaded',
        name: 'Spur',
        color: '#3A7CA5',
        visible: true,
        source: 'uploaded-track',
        geojson: {
          type: 'FeatureCollection',
          features: [{
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'LineString',
              coordinates: [
                [-121.0, 39.0],
                [-121.1, 39.1],
              ],
            },
          }],
        },
        bbox: [-121.1, 39.0, -121.0, 39.1],
        section_start: 0,
        section_end: 100,
      }],
    }
    const b = computeMapContentHash(next, geojson, framing)
    expect(a).not.toBe(b)
  })

  it('changing drawn segment geometry changes map_content_hash', () => {
    const drawn: StyleConfig = {
      ...baseConfig,
      trail_segments: [{
        id: 'drawn',
        name: 'Hand drawn',
        color: '#E87722',
        visible: true,
        source: 'drawn-track',
        geojson: {
          type: 'FeatureCollection',
          features: [{
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'LineString',
              coordinates: [
                [-121.0, 39.0],
                [-121.1, 39.1],
              ],
            },
          }],
        },
        bbox: [-121.1, 39.0, -121.0, 39.1],
        section_start: 0,
        section_end: 100,
      }],
    }
    const extended: StyleConfig = {
      ...drawn,
      trail_segments: drawn.trail_segments?.map(segment => ({
        ...segment,
        geojson: {
          type: 'FeatureCollection',
          features: [{
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'LineString',
              coordinates: [
                [-121.0, 39.0],
                [-121.1, 39.1],
                [-121.2, 39.2],
              ],
            },
          }],
        },
        bbox: [-121.2, 39.0, -121.0, 39.2],
      })),
    }

    const a = computeMapContentHash(drawn, geojson, framing)
    const b = computeMapContentHash(extended, geojson, framing)
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

  it('changing poster_layout changes chrome_hash but not map_content_hash', () => {
    const mapA = computeMapContentHash(baseConfig, geojson, framing)
    const chromeA = computeChromeHash(baseConfig, stats)
    const next: StyleConfig = {
      ...baseConfig,
      poster_layout: {
        bands: {
          header: {
            rows: [{
              id: 'header-title',
              cells: [{ id: 'hdr-title', block: { id: 'hdr-title-block', kind: 'title', slot: 'trail_name', scale: 1.2 } }],
            }],
          },
        },
      },
    }
    const mapB = computeMapContentHash(next, geojson, framing)
    const chromeB = computeChromeHash(next, stats)
    expect(mapB).toBe(mapA)
    expect(chromeB).not.toBe(chromeA)
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

  it('changes proof_render_hash for representative editor-visible style edits', () => {
    const base = proofHash(baseConfig)
    const variants: Array<[string, StyleConfig]> = [
      ['composition', { ...baseConfig, composition: 'riso-stack' }],
      ['theme color', { ...baseConfig, color_theme: 'risograph', route_color: '#E8533C' }],
      ['poster text', { ...baseConfig, trail_name: 'Edited Trail Name' }],
      ['inline text override', {
        ...baseConfig,
        poster_text_overrides: {
          composition_footer: {
            text: 'Edited footer',
            scale: 1.4,
            opacity: 0.8,
          },
        },
      }],
      ['grid chrome', { ...baseConfig, show_grid: true, grid_scope: 'map', grid_color: '#123456', grid_opacity: 0.2 }],
      ['terrain paint', { ...baseConfig, map_3d: true, map_pitch: 45, terrain_exaggeration: 2.2 }],
      ['hillshade paint', { ...baseConfig, show_hillshade: true, hillshade_intensity: 0.85 }],
      ['road paint', { ...baseConfig, show_roads: true, roads_color: '#223344', roads_opacity: 0.25 }],
      ['label paint', { ...baseConfig, show_place_labels: true, place_labels_color: '#445566', place_labels_opacity: 0.4 }],
      ['contour paint', { ...baseConfig, contour_color: '#667788', contour_major_color: '#112233', contour_opacity: 0.35 }],
      ['camera', { ...baseConfig, map_frozen: true, map_zoom: 12.5, map_center: [-87.66, 41.87], map_editor_width: 720 }],
    ]

    for (const [name, config] of variants) {
      expect(proofHash(config), name).not.toBe(base)
    }
  })
})
