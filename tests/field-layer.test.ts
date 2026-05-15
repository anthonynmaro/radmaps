import { describe, it, expect } from 'vitest'
import { FIELD_LAYER } from '../utils/render/fieldLayer'
import { DEFAULT_STYLE_CONFIG, type StyleConfig } from '../types'

// Belt-and-suspenders: TS already enforces full coverage via the
// `satisfies Record<keyof StyleConfig, ...>` clause. This runtime
// check confirms that DEFAULT_STYLE_CONFIG (and therefore any
// StyleConfig instance) only contains fields that FIELD_LAYER
// classifies — and that `label_position` is treated as 'chrome'
// per the v4 plan.

// Build an exhaustive StyleConfig instance with every optional
// property populated, so Object.keys() reflection is comprehensive.
// (DEFAULT_STYLE_CONFIG omits some optional fields — this fixture
// exercises them all.)
const fullConfig: StyleConfig = {
  ...DEFAULT_STYLE_CONFIG,
  // Optional map fields
  route_deleted_ranges: [],
  route_color_mode: 'solid',
  show_roads: false,
  roads_color: '#000',
  roads_opacity: 0.6,
  show_place_labels: true,
  place_labels_color: '#000',
  place_labels_opacity: 0.75,
  place_labels_scale: 'town',
  show_poi_labels: false,
  poi_labels_color: '#000',
  poi_labels_opacity: 0.65,
  start_pin_lnglat: [0, 0],
  finish_pin_lnglat: [0, 0],
  start_label_lnglat: [0, 0],
  finish_label_lnglat: [0, 0],
  start_pin_label: 'Start',
  finish_pin_label: 'Finish',
  pin_color: '#000',
  pin_opacity: 0.9,
  pin_font_family: 'Work Sans',
  trail_label_style: 'legend',
  leader_label_scale: 1,
  show_elevation_profile: false,
  elevation_profile_color: '#000',
  elevation_profile_opacity: 0.65,
  elevation_profile_height: 22,
  tile_shadow_color: '#000',
  tile_midtone_color: '#888',
  tile_highlight_color: '#fff',
  map_3d: false,
  map_pitch: 0,
  map_bearing: 0,
  terrain_exaggeration: 1.5,
  map_zoom: 12,
  map_center: [0, 0],
  // Optional chrome fields
  show_logo: false,
  logo_url: 'https://example.com/logo.png',
  logo_position: 'map-top-right',
  logo_size: 8,
  show_branding: true,
  title_scale: 1,
  occasion_scale: 1,
  subtitle_scale: 1,
  poster_text_overrides: {
    distance: { text: '26.2 miles', scale: 1.1, bold: true },
  },
  poster_layout: {
    bands: {
      header: {
        rows: [{ id: 'header-title', cells: [{ id: 'hdr-title', block: { id: 'hdr-title-block', kind: 'title', slot: 'trail_name' } }] }],
      },
    },
  },
}

describe('FIELD_LAYER — coverage', () => {
  it('every key on a fully-populated StyleConfig is classified', () => {
    const layerKeys = new Set(Object.keys(FIELD_LAYER))
    const styleKeys = Object.keys(fullConfig)
    const missing = styleKeys.filter((k) => !layerKeys.has(k))
    expect(missing).toEqual([])
  })

  it('every key on DEFAULT_STYLE_CONFIG is classified', () => {
    const layerKeys = new Set(Object.keys(FIELD_LAYER))
    const defaultKeys = Object.keys(DEFAULT_STYLE_CONFIG)
    const missing = defaultKeys.filter((k) => !layerKeys.has(k))
    expect(missing).toEqual([])
  })

  it('every FIELD_LAYER classification is "map" or "chrome"', () => {
    for (const [key, value] of Object.entries(FIELD_LAYER)) {
      expect(value, `field "${key}" must be 'map' or 'chrome'`).toMatch(/^(map|chrome)$/)
    }
  })
})

describe('FIELD_LAYER — locked decisions', () => {
  it('label_position is "chrome" (v4 oversized-viewport invariant)', () => {
    expect(FIELD_LAYER.label_position).toBe('chrome')
  })

  it('map_zoom and map_center are "map" (camera authority lives in the map layer)', () => {
    expect(FIELD_LAYER.map_zoom).toBe('map')
    expect(FIELD_LAYER.map_center).toBe('map')
  })

  it('print_size is "chrome" (canvas dims are a chrome concern; map raster is oversized)', () => {
    expect(FIELD_LAYER.print_size).toBe('chrome')
  })

  it('poster_text_overrides is "chrome" (editable imported text slots live in poster chrome)', () => {
    expect(FIELD_LAYER.poster_text_overrides).toBe('chrome')
  })

  it('poster_layout is "chrome" (direct chrome editing never invalidates the map raster)', () => {
    expect(FIELD_LAYER.poster_layout).toBe('chrome')
  })

  it('preset and base_tile_style are "map"', () => {
    expect(FIELD_LAYER.preset).toBe('map')
    expect(FIELD_LAYER.base_tile_style).toBe('map')
  })
})
