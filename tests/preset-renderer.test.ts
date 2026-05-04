// tests/preset-renderer.test.ts
//
// Phase 10 verification: PRESET_RENDERER table is the shared source of
// truth used by both the Nuxt server and render-worker-v4 to decide
// which backend serves a given preset. These tests enforce that the
// table covers every known preset and that the lookup helper
// degrades gracefully on unknown values.

import { describe, it, expect } from 'vitest'
import {
  PRESET_RENDERER,
  getRendererForPreset,
  type RenderBackend,
} from '../utils/render/presetRenderer'

describe('PRESET_RENDERER table', () => {
  it('covers every known preset with a defined backend', () => {
    // The presets the editor + render worker actually expect to see.
    const KNOWN_PRESETS = [
      'minimalist',
      'topographic',
      'route-only',
      'road-network',
      'contour-art',
      'natural-topo',
      'native-toner',
      'native-watercolor',
      'alidade-smooth',
      'alidade-smooth-dark',
      'stadia-watercolor',
      'stadia-toner',
    ]

    for (const preset of KNOWN_PRESETS) {
      expect(PRESET_RENDERER[preset], `missing entry for "${preset}"`).toBeDefined()
      const backend = PRESET_RENDERER[preset] as RenderBackend
      expect(['native', 'browser']).toContain(backend)
    }
  })

  it('routes every preset to native in v1', () => {
    // v1 stance: no browser fallback wired. Stadia presets use plain raster
    // tile URLs that MapLibre Native handles natively; tile effects apply
    // via Sharp post-processing. The 'browser' backend remains an
    // architectural seam (cache-key isolation) but no preset uses it.
    for (const preset of Object.keys(PRESET_RENDERER)) {
      expect(PRESET_RENDERER[preset]).toBe('native')
    }
  })
})

describe('getRendererForPreset', () => {
  it('returns the table value for a known preset', () => {
    expect(getRendererForPreset('minimalist')).toBe('native')
    expect(getRendererForPreset('stadia-watercolor')).toBe('native')
  })

  it('defaults to "native" for unknown presets', () => {
    expect(getRendererForPreset('does-not-exist')).toBe('native')
    expect(getRendererForPreset('')).toBe('native')
  })

  it('defaults to "native" when preset is undefined', () => {
    expect(getRendererForPreset(undefined)).toBe('native')
  })

  it('honours an explicit override above the table', () => {
    // Operator pinning: a preset can be forced to either backend at request time.
    expect(getRendererForPreset('minimalist', 'browser')).toBe('browser')
    expect(getRendererForPreset('stadia-watercolor', 'browser')).toBe('browser')
  })

  it('override beats the unknown-preset default', () => {
    expect(getRendererForPreset('does-not-exist', 'browser')).toBe('browser')
    expect(getRendererForPreset(undefined, 'browser')).toBe('browser')
  })
})
