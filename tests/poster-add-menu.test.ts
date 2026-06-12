// Editor-v2 D3 — + Add menu contracts (docs/EDITOR_UX_NORTH_STAR.md gesture 4).
//
// The Stat picker is DATA-BOUND: options derive from the theme data contract's
// ThemeDataContext (the same source the footer stats consume), and a binding
// without real data is not offered and not insertable — fabricated values are
// impossible by construction. Stat overlays serialize as ordinary text
// overlays plus a `data_binding` field, so legacy maps (no binding) render
// byte-identically through the plain-content path.

import { describe, expect, it } from 'vitest'
import {
  addPosterEditorIconCentered,
  addPosterEditorStat,
  availablePosterStatBindings,
  formatPosterStatBinding,
} from '../utils/posterEditorElements'
import { buildThemeDataContext } from '../utils/themeDataContract'
import { DEFAULT_STYLE_CONFIG } from '../types'
import type { StyleConfig } from '../types'

function styleConfig(patch: Partial<StyleConfig> = {}): StyleConfig {
  return { ...DEFAULT_STYLE_CONFIG, ...patch }
}

const FULL_STATS = {
  distance_km: 49.7,
  elevation_gain_m: 1369,
  date: 'JUNE 2026',
}

const FULL_CONTEXT = buildThemeDataContext({
  stats: FULL_STATS,
  bbox: [-87.74, 40.14, -87.71, 40.18],
  geojson: {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      properties: {},
      geometry: { type: 'LineString', coordinates: [[-87.74, 40.14], [-87.71, 40.18]] },
    }],
  },
})

const EMPTY_CONTEXT = buildThemeDataContext({})

describe('formatPosterStatBinding', () => {
  it('formats each binding from real data with the footer-band conventions', () => {
    expect(formatPosterStatBinding('distance', FULL_CONTEXT)).toBe('30.9 MI')
    expect(formatPosterStatBinding('distance', FULL_CONTEXT, { distanceUnit: 'km' })).toBe('49.7 KM')
    expect(formatPosterStatBinding('elevation_gain', FULL_CONTEXT)).toBe('4,491 FT GAIN')
    expect(formatPosterStatBinding('date', FULL_CONTEXT)).toBe('JUNE 2026')
    expect(formatPosterStatBinding('coordinates', FULL_CONTEXT)).toMatch(/^\d+°\d+'N \d+°\d+'W$/)
  })

  it('returns empty string for every binding when the contract has no data', () => {
    expect(formatPosterStatBinding('distance', EMPTY_CONTEXT)).toBe('')
    expect(formatPosterStatBinding('elevation_gain', EMPTY_CONTEXT)).toBe('')
    expect(formatPosterStatBinding('date', EMPTY_CONTEXT)).toBe('')
    expect(formatPosterStatBinding('coordinates', EMPTY_CONTEXT)).toBe('')
  })
})

describe('availablePosterStatBindings (no fabricated values insertable)', () => {
  it('offers every binding when all data is real', () => {
    const options = availablePosterStatBindings(FULL_CONTEXT)
    expect(options.map(option => option.binding)).toEqual([
      'distance', 'elevation_gain', 'date', 'coordinates',
    ])
    for (const option of options) expect(option.value).not.toBe('')
  })

  it('offers nothing for an empty context', () => {
    expect(availablePosterStatBindings(EMPTY_CONTEXT)).toEqual([])
  })

  it('drops exactly the bindings without data', () => {
    const noElevation = buildThemeDataContext({
      stats: { distance_km: 12.2 },
      geojson: FULL_CONTEXT.bbox ? {
        type: 'FeatureCollection',
        features: [{
          type: 'Feature',
          properties: {},
          geometry: { type: 'LineString', coordinates: [[-87.74, 40.14], [-87.71, 40.18]] },
        }],
      } : null,
    })
    const bindings = availablePosterStatBindings(noElevation).map(option => option.binding)
    expect(bindings).toContain('distance')
    expect(bindings).not.toContain('elevation_gain')
    expect(bindings).not.toContain('date')
  })
})

describe('addPosterEditorStat', () => {
  it('creates a data-bound text overlay with the formatted value as content', () => {
    const result = addPosterEditorStat(styleConfig(), 'distance', FULL_CONTEXT, { x: 48, y: 62 })
    expect(result).not.toBeNull()
    const overlay = result!.config.text_overlays!.at(-1)!
    expect(overlay.data_binding).toBe('distance')
    expect(overlay.content).toBe('30.9 MI')
    expect(overlay.x).toBe(48)
    expect(overlay.y).toBe(62)
    expect(result!.id).toBe(`text:${overlay.id}`)
  })

  it('respects the km footer unit preference', () => {
    const result = addPosterEditorStat(
      styleConfig({ composition_footer_distance_unit: 'km' }),
      'distance',
      FULL_CONTEXT,
    )
    expect(result!.config.text_overlays!.at(-1)!.content).toBe('49.7 KM')
  })

  it('refuses to insert a binding without real data (returns null, config untouched)', () => {
    const config = styleConfig()
    const result = addPosterEditorStat(config, 'elevation_gain', EMPTY_CONTEXT)
    expect(result).toBeNull()
    expect(config.text_overlays ?? []).toHaveLength(0)
  })
})

describe('addPosterEditorIconCentered', () => {
  it('positions the icon box so its center lands on the requested point', () => {
    const result = addPosterEditorIconCentered(styleConfig(), 'mountain', { x: 50, y: 40 })
    const icon = result.config.icon_overlays!.at(-1)!
    expect(icon.x + icon.width / 2).toBeCloseTo(50)
    expect(icon.y + icon.height / 2).toBeCloseTo(40)
    expect(icon.icon).toBe('mountain')
  })

  it('clamps near the poster edge so the box stays on-canvas', () => {
    const result = addPosterEditorIconCentered(styleConfig(), 'star', { x: 99, y: 1 })
    const icon = result.config.icon_overlays!.at(-1)!
    expect(icon.x + icon.width).toBeLessThanOrEqual(100)
    expect(icon.y).toBeGreaterThanOrEqual(0)
  })
})
