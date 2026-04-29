import { describe, it, expect } from 'vitest'
import { blendHex, CONTOUR_THRESHOLDS, styledTileUrls } from '../utils/mapStyle'
import type { StyleConfig } from '../types'

// ── Minimal StyleConfig stub ───────────────────────────────────────────────────

function cfg(overrides: Partial<StyleConfig> = {}): StyleConfig {
  return {
    preset: 'minimalist',
    background_color: '#F4EFE6',
    route_color: '#C1121F',
    route_width: 3,
    route_opacity: 0.9,
    route_smooth: 0,
    route_crop_start: 0,
    route_crop_end: 100,
    show_contours: false,
    contour_color: '#C8BDB0',
    contour_major_color: '#9E9082',
    contour_opacity: 0.75,
    contour_detail: 3,
    contour_minor_width: 1,
    contour_major_width: 1,
    show_elevation_labels: false,
    show_hillshade: false,
    hillshade_intensity: 0.5,
    hillshade_highlight: 0.3,
    water_color: '#B8D8E8',
    land_color: '#EDE8DF',
    font_family: 'DM Sans',
    body_font_family: 'DM Sans',
    title_size: 48,
    subtitle_size: 24,
    labels: { show_title: true, show_distance: true, show_elevation_gain: true, show_date: false, show_location: true },
    label_position: 'bottom',
    border_style: 'thin',
    padding_factor: 0.15,
    color_theme: 'chalk',
    print_size: '18x24',
    base_tile_style: 'carto-light',
    trail_name: '',
    occasion_text: '',
    location_text: '',
    label_text_color: '#1C1917',
    label_bg_color: '#F4EFE6',
    tile_effect: 'none',
    tile_duotone_strength: 0.9,
    tile_posterize_levels: 4,
    tile_grain: 0,
    tile_contrast: 0,
    tile_saturation: 0,
    tile_hue_rotate: 0,
    show_vignette: false,
    vignette_intensity: 0.45,
    segment_casing_width: 3,
    segment_casing_color: '#FFFFFF',
    segment_dot_size: 4,
    map_frozen: false,
    show_start_pin: true,
    show_finish_pin: true,
    show_logo: false,
    logo_position: 'map-top-right',
    logo_size: 8,
    text_overlays: [],
    trail_segments: [],
    trail_legend: { show: true, position: 'bottom-left' },
    show_branding: true,
    show_roads: false,
    ...overrides,
  } as StyleConfig
}

// ── blendHex ──────────────────────────────────────────────────────────────────

describe('blendHex', () => {
  it('t=0 returns the first color', () => {
    expect(blendHex('#000000', '#ffffff', 0)).toBe('#000000')
  })

  it('t=1 returns the second color', () => {
    expect(blendHex('#000000', '#ffffff', 1)).toBe('#ffffff')
  })

  it('t=0.5 produces midpoint between black and white', () => {
    const result = blendHex('#000000', '#ffffff', 0.5)
    expect(result).toBe('#808080')
  })

  it('returns a valid #RRGGBB string for any input', () => {
    const result = blendHex('#1C1917', '#F4EFE6', 0.33)
    expect(result).toMatch(/^#[0-9a-f]{6}$/)
  })

  it('is symmetric — swap colors and invert t gives the same result', () => {
    const a = '#1C1917', b = '#F4EFE6'
    expect(blendHex(a, b, 0.3)).toBe(blendHex(b, a, 0.7))
  })

  it('blends two non-trivial colors at t=0.5', () => {
    // #0000ff and #ff0000 → #800080 (midpoint magenta)
    expect(blendHex('#0000ff', '#ff0000', 0.5)).toBe('#800080')
  })
})

// ── CONTOUR_THRESHOLDS ────────────────────────────────────────────────────────

describe('CONTOUR_THRESHOLDS', () => {
  it('has exactly 6 detail levels (0–5)', () => {
    expect(Object.keys(CONTOUR_THRESHOLDS)).toHaveLength(6)
    for (let d = 0; d <= 5; d++) {
      expect(CONTOUR_THRESHOLDS[d]).toBeDefined()
    }
  })

  it('at detail=3 zoom=14, minor=5 and major=20', () => {
    expect(CONTOUR_THRESHOLDS[3][14]).toEqual([5, 20])
  })

  it('minor interval is always less than major interval at every level and zoom', () => {
    for (const detail of Object.values(CONTOUR_THRESHOLDS)) {
      for (const [minor, major] of Object.values(detail)) {
        expect(minor).toBeLessThan(major)
      }
    }
  })

  it('each detail level has entries starting at zoom 1', () => {
    for (let d = 0; d <= 5; d++) {
      expect(CONTOUR_THRESHOLDS[d][1]).toBeDefined()
    }
  })

  it('higher detail levels have finer (smaller) intervals at zoom 14', () => {
    const detail3Minor = CONTOUR_THRESHOLDS[3][14][0]
    const detail5Minor = CONTOUR_THRESHOLDS[5][14][0]
    expect(detail5Minor).toBeLessThanOrEqual(detail3Minor)
  })
})

// ── styledTileUrls ────────────────────────────────────────────────────────────

describe('styledTileUrls', () => {
  const urls = ['https://tiles.example.com/{z}/{x}/{y}.png']

  it('returns input unchanged when tile_effect is none', () => {
    expect(styledTileUrls(cfg({ tile_effect: 'none' }), urls)).toEqual(urls)
  })

  it('returns input unchanged when tile_effect is undefined', () => {
    expect(styledTileUrls(cfg({ tile_effect: undefined }), urls)).toEqual(urls)
  })

  it('prefixes with styledtile://duotone for duotone effect', () => {
    const result = styledTileUrls(cfg({ tile_effect: 'duotone' }), urls)
    expect(result[0]).toMatch(/^styledtile:\/\/duotone,/)
    expect(result[0]).toContain(urls[0])
  })

  it('includes duotone strength parameter in the URL', () => {
    const result = styledTileUrls(cfg({ tile_effect: 'duotone', tile_duotone_strength: 0.5 }), urls)
    expect(result[0]).toContain(',50|')
  })

  it('prefixes with styledtile://posterize for posterize effect', () => {
    const result = styledTileUrls(cfg({ tile_effect: 'posterize', tile_posterize_levels: 4 }), urls)
    expect(result[0]).toMatch(/^styledtile:\/\/posterize,4\|/)
  })

  it('prefixes with styledtile://layer-color for layer-color effect', () => {
    const result = styledTileUrls(cfg({ tile_effect: 'layer-color' }), urls)
    expect(result[0]).toMatch(/^styledtile:\/\/layer-color,/)
  })

  it('transforms all URLs when multiple are provided', () => {
    const multi = ['https://a.example.com/tile', 'https://b.example.com/tile']
    const result = styledTileUrls(cfg({ tile_effect: 'posterize' }), multi)
    expect(result).toHaveLength(2)
    expect(result[0]).toMatch(/^styledtile:\/\/posterize/)
    expect(result[1]).toMatch(/^styledtile:\/\/posterize/)
  })
})
