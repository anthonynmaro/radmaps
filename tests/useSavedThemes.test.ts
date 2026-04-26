import { describe, it, expect } from 'vitest'
import {
  createSavedTheme,
  loadThemesFromStorage,
  SAVED_THEME_EXCLUDED_KEYS,
  type SavedTheme,
} from '../composables/useSavedThemes'
import type { StyleConfig } from '../types'

// Minimal StyleConfig with both style fields and content fields populated
const mockConfig: StyleConfig = {
  preset: 'minimalist',
  base_tile_style: 'carto-light',
  color_theme: 'chalk',
  print_size: '18x24',
  background_color: '#F7F4EF',
  label_bg_color: '#F7F4EF',
  label_text_color: '#1C1917',
  route_color: '#C1121F',
  route_width: 3,
  route_opacity: 0.9,
  route_smooth: 0,
  route_color_mode: 'solid',
  water_color: '#D1E8F0',
  land_color: '#F0EBE3',
  contour_color: '#B8A898',
  contour_major_color: '#8A7060',
  contour_opacity: 0.6,
  contour_detail: 3,
  hillshade_intensity: 0.3,
  hillshade_highlight: 0.5,
  show_contours: false,
  show_hillshade: false,
  show_elevation_labels: false,
  show_roads: false,
  show_start_pin: true,
  show_finish_pin: true,
  show_branding: true,
  show_logo: false,
  show_vignette: false,
  map_3d: false,
  font_family: 'Work Sans',
  body_font_family: 'DM Sans',
  title_size: 1,
  subtitle_size: 0.75,
  padding_factor: 0.15,
  border_style: 'none',
  tile_effect: 'none',
  tile_duotone_strength: 0.8,
  tile_posterize_levels: 4,
  tile_contrast: 0,
  tile_saturation: 0,
  tile_hue_rotate: 0,
  tile_grain: 0,
  // Content fields — should be stripped from saved themes
  trail_name: 'Mount Olympus Loop',
  occasion_text: 'Summer 2024',
  location_text: 'Greece',
  text_overlays: [{ id: 'x', content: 'Test', x: 50, y: 50, font_size: 2, color: '#000', font_family: 'Work Sans', alignment: 'center', opacity: 1, bold: false }],
  trail_segments: [{ id: 's1', name: 'Ascent', color: '#C1121F', visible: true, section_start: 0, section_end: 50 }],
  trail_legend: { show: true, position: 'bottom-left' },
  map_frozen: true,
  map_zoom: 12.5,
  map_center: [22.35, 40.09],
  labels: { distance: true, elevation: true, duration: false, date: false, pace: false, speed: false, calories: false, heartrate: false },
}

describe('createSavedTheme', () => {
  it('stores the given name', () => {
    const t = createSavedTheme('Alpine Sprint', mockConfig)
    expect(t.name).toBe('Alpine Sprint')
  })

  it('trims whitespace from name', () => {
    const t = createSavedTheme('  Trimmed  ', mockConfig)
    expect(t.name).toBe('Trimmed')
  })

  it('falls back to "My Theme" when name is blank', () => {
    const t = createSavedTheme('   ', mockConfig)
    expect(t.name).toBe('My Theme')
  })

  it('assigns a unique id', () => {
    const a = createSavedTheme('A', mockConfig)
    const b = createSavedTheme('B', mockConfig)
    expect(a.id).not.toBe(b.id)
  })

  it('preserves style properties', () => {
    const t = createSavedTheme('Test', mockConfig)
    expect(t.config.background_color).toBe('#F7F4EF')
    expect(t.config.route_color).toBe('#C1121F')
    expect(t.config.preset).toBe('minimalist')
    expect(t.config.color_theme).toBe('chalk')
  })

  it('strips all excluded content and state keys', () => {
    const t = createSavedTheme('Test', mockConfig)
    for (const key of SAVED_THEME_EXCLUDED_KEYS) {
      expect(t.config).not.toHaveProperty(key)
    }
  })

  it('strips trail_name', () => {
    const t = createSavedTheme('Test', mockConfig)
    expect(t.config.trail_name).toBeUndefined()
  })

  it('strips text_overlays', () => {
    const t = createSavedTheme('Test', mockConfig)
    expect(t.config.text_overlays).toBeUndefined()
  })

  it('strips trail_segments', () => {
    const t = createSavedTheme('Test', mockConfig)
    expect(t.config.trail_segments).toBeUndefined()
  })

  it('strips map_frozen, map_zoom, map_center', () => {
    const t = createSavedTheme('Test', mockConfig)
    expect(t.config.map_frozen).toBeUndefined()
    expect(t.config.map_zoom).toBeUndefined()
    expect(t.config.map_center).toBeUndefined()
  })

  it('does not mutate the original config', () => {
    createSavedTheme('Test', mockConfig)
    expect(mockConfig.trail_name).toBe('Mount Olympus Loop')
    expect(mockConfig.trail_segments).toHaveLength(1)
  })
})

describe('loadThemesFromStorage', () => {
  it('returns [] for null (empty storage)', () => {
    expect(loadThemesFromStorage(null)).toEqual([])
  })

  it('returns [] for empty string', () => {
    expect(loadThemesFromStorage('')).toEqual([])
  })

  it('parses a valid JSON array', () => {
    const themes: SavedTheme[] = [
      { id: '1', name: 'Night Rider', savedAt: '2024-01-01T00:00:00Z', config: { route_color: '#FF0000' } },
    ]
    expect(loadThemesFromStorage(JSON.stringify(themes))).toEqual(themes)
  })

  it('returns [] for malformed JSON without throwing', () => {
    expect(loadThemesFromStorage('{not valid json')).toEqual([])
  })

  it('handles an empty array', () => {
    expect(loadThemesFromStorage('[]')).toEqual([])
  })
})
