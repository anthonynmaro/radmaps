import { describe, expect, it } from 'vitest'
import { COLOR_THEMES, DEFAULT_STYLE_CONFIG, DEFAULT_TRAIL_SEGMENT_WIDTH, type StyleConfig } from '~/types'
import { contrastRatio, pickContrastSafeColor } from '~/utils/colorContrast'
import { applyThemeToStyleConfig } from '~/utils/themeApplication'
import { REFINED_THEMES, getThemeDefinition } from '~/utils/themes/refined'

function config(patch: Partial<StyleConfig> = {}): StyleConfig {
  return {
    ...DEFAULT_STYLE_CONFIG,
    ...patch,
    labels: {
      ...DEFAULT_STYLE_CONFIG.labels,
      ...patch.labels,
    },
  }
}

describe('theme application', () => {
  it('overwrites theme-owned colors, typography, composition, and text scales', () => {
    const theme = getThemeDefinition('midcentury-travel')
    expect(theme).toBeTruthy()

    const next = applyThemeToStyleConfig(config({
      color_theme: 'chalk',
      background_color: '#000000',
      label_bg_color: '#FFFFFF',
      label_text_color: '#111111',
      route_color: '#222222',
      font_family: 'Bebas Neue',
      body_font_family: 'DM Sans',
      composition: 'editorial-tall',
      poster_layout: {
        bands: {
          header: { height: 31 },
        },
      },
      title_scale: 1.75,
      occasion_scale: 0.75,
      subtitle_scale: 1.35,
    }), theme!)

    expect(next.color_theme).toBe('midcentury-travel')
    expect(next.preset).toBe('radmaps-simple-contour')
    expect(next.atlas_style_id).toBe('radmaps-simple-contour')
    expect(next.contour_detail).toBe(2)
    expect(next.contour_major_width).toBe(0.5)
    expect(next.background_color).toBe('#E6D2A2')
    expect(next.label_bg_color).toBe('#19382A')
    expect(next.label_text_color).toBe('#FAEBC2')
    expect(next.route_color).toBe('#2A2018')
    expect(next.font_family).toBe('Oswald')
    expect(next.body_font_family).toBe('Source Sans 3')
    expect(next.composition).toBe('travel-banner')
    expect(next.title_scale).toBe(1)
    expect(next.occasion_scale).toBe(1)
    expect(next.subtitle_scale).toBe(1)
    expect(next.show_start_pin).toBe(true)
    expect(next.show_finish_pin).toBe(true)
    expect(next.pin_color).toBe('#2A2018')
    expect(next.pin_opacity).toBe(1)
    expect(next.poster_layout).toBeUndefined()
  })

  it('strips stale per-slot visual overrides while preserving edited text', () => {
    const theme = getThemeDefinition('bold-modern')
    expect(theme).toBeTruthy()

    const next = applyThemeToStyleConfig(config({
      poster_text_overrides: {
        trail_name: {
          text: 'My edited title',
          color: '#FF00FF',
          font_family: 'Cormorant Garamond',
          scale: 1.8,
          bold: false,
          italic: true,
        },
        distance: {
          color: '#00FF00',
          scale: 0.7,
        },
      },
    }), theme!)

    expect(next.poster_text_overrides).toEqual({
      trail_name: { text: 'My edited title' },
    })
  })

  it('clears derived map/chrome color overrides so they follow the new theme', () => {
    const theme = getThemeDefinition('blueprint')
    expect(theme).toBeTruthy()

    const next = applyThemeToStyleConfig(config({
      roads_color: '#123456',
      place_labels_color: '#234567',
      poi_labels_color: '#345678',
      pin_color: '#456789',
      pin_opacity: 0.25,
      start_pin_lnglat: [-90, 40],
      finish_pin_lnglat: [-89, 41],
      start_label_lnglat: [-90.1, 40.1],
      finish_label_lnglat: [-89.1, 41.1],
      start_pin_label: 'Old Start',
      finish_pin_label: 'Old Finish',
      elevation_profile_color: '#ABCDEF',
      tile_shadow_color: '#56789A',
      tile_midtone_color: '#6789AB',
      tile_highlight_color: '#789ABC',
      toner_variant: 'dark',
      pin_font_family: 'Bebas Neue',
      leader_label_font_family: 'Bebas Neue',
      grid_color: '#ABCDEF',
      grid_opacity: 0.2,
      grid_weight: 3,
      grid_spacing: 14,
      grid_scope: 'map',
      atlas_layers: {
        water: false,
        transportation: false,
        place: false,
      },
      atlas_layer_settings: {
        landcover: { color: '#111111', opacity: 0.1 },
        water: { fill_color: '#222222', fill_opacity: 0.2 },
        transportation: { major_color: '#333333', opacity: 0.3 },
      },
    }), theme!)

    expect(next.roads_color).toBeUndefined()
    expect(next.place_labels_color).toBeUndefined()
    expect(next.poi_labels_color).toBeUndefined()
    expect(next.pin_color).toBeUndefined()
    expect(next.pin_opacity).toBeUndefined()
    expect(next.start_pin_lnglat).toBeUndefined()
    expect(next.finish_pin_lnglat).toBeUndefined()
    expect(next.start_label_lnglat).toBeUndefined()
    expect(next.finish_label_lnglat).toBeUndefined()
    expect(next.start_pin_label).toBeUndefined()
    expect(next.finish_pin_label).toBeUndefined()
    expect(next.elevation_profile_color).toBeUndefined()
    expect(next.route_color).toBe(theme!.route_color)
    expect(next.tile_shadow_color).toBeUndefined()
    expect(next.tile_midtone_color).toBeUndefined()
    expect(next.tile_highlight_color).toBeUndefined()
    expect(next.toner_variant).toBeUndefined()
    expect(next.atlas_layers).toEqual(theme!.map_defaults?.atlas_layers)
    expect(next.atlas_layer_settings).toEqual(theme!.map_defaults?.atlas_layer_settings)
    expect(next.pin_font_family).toBeUndefined()
    expect(next.leader_label_font_family).toBeUndefined()
    expect(next.grid_color).toBeUndefined()
    expect(next.grid_opacity).toBe(theme!.map_defaults?.grid_opacity)
    expect(next.grid_weight).toBe(theme!.map_defaults?.grid_weight)
    expect(next.grid_spacing).toBe(theme!.map_defaults?.grid_spacing)
    expect(next.grid_scope).toBe(theme!.map_defaults?.grid_scope)
  })

  it('applies Dark Sky without carrying stale leader-line or segment-casing state', () => {
    const theme = getThemeDefinition('dark-sky')
    expect(theme).toBeTruthy()

    const next = applyThemeToStyleConfig(config({
      show_hillshade: true,
      trail_label_style: 'legend',
      leader_label_scale: 1.4,
      segment_casing_color: '#FFFFFF',
      trail_segments: [
        {
          id: 'trail-1',
          name: 'Trail 1',
          color: '#2D6A4F',
          visible: true,
          section_start: 0,
          section_end: 50,
          color_mode: 'gradient',
          label_lnglat: [-89, 40],
        },
        {
          id: 'trail-2',
          name: 'Trail 2',
          color: '#C1121F',
          visible: true,
          section_start: 50,
          section_end: 100,
        },
      ],
    }), theme!)

    expect(next.show_hillshade).toBe(false)
    expect(next.trail_label_style).toBeUndefined()
    expect(next.leader_label_auto_fit).toBeUndefined()
    expect(next.leader_label_scale).toBeUndefined()
    expect(next.segment_casing_color).toBeUndefined()
    expect(next.atlas_layer_settings?.landcover?.color).toBe('#0C142B')
    expect(next.atlas_layer_settings?.park?.fill_color).toBe('#0B1020')
    expect(next.atlas_layer_settings?.park?.opacity).toBe(0)
    expect(next.trail_segments?.map(segment => segment.color)).toEqual(['#E8C66A', '#E8C66A'])
    expect(next.trail_segments?.map(segment => segment.color_mode)).toEqual(['solid', 'solid'])
    expect(next.trail_segments?.map(segment => segment.width)).toEqual([DEFAULT_TRAIL_SEGMENT_WIDTH, DEFAULT_TRAIL_SEGMENT_WIDTH])
    expect(next.trail_segments?.some(segment => segment.label_lnglat)).toBe(false)
  })

  it('clears stale special layout, profile, grid, and route-effect state when switching themes', () => {
    const theme = getThemeDefinition('usgs-vintage')
    expect(theme).toBeTruthy()

    const next = applyThemeToStyleConfig(config({
      show_elevation_profile: true,
      elevation_profile_opacity: 0.9,
      elevation_profile_height: 24,
      elevation_profile_position: 'map-overlay',
      elevation_profile_relief: 1,
      trail_label_style: 'leader-lines',
      leader_label_auto_fit: false,
      leader_label_scale: 1.6,
      leader_label_font_family: 'Bebas Neue',
      segment_casing_color: '#123456',
      segment_casing_width: 4,
      route_smooth: 2,
      start_pin_lnglat: [-90, 40],
      finish_pin_lnglat: [-89, 41],
      start_label_lnglat: [-90.1, 40.1],
      finish_label_lnglat: [-89.1, 41.1],
      start_pin_label: 'Old Start',
      finish_pin_label: 'Old Finish',
      pin_opacity: 0.25,
      tile_effect: 'posterize',
      show_grid: true,
      grid_scope: 'map',
      grid_opacity: 0.18,
      grid_weight: 3,
      grid_spacing: 14,
      poster_layout: {
        bands: {
          header: { height: 30 },
        },
      },
    }), theme!)

    expect(next.color_theme).toBe('usgs-vintage')
    expect(next.show_elevation_profile).toBe(false)
    expect(next.elevation_profile_opacity).toBeUndefined()
    expect(next.elevation_profile_height).toBeUndefined()
    expect(next.elevation_profile_position).toBeUndefined()
    expect(next.elevation_profile_relief).toBeUndefined()
    expect(next.trail_label_style).toBeUndefined()
    expect(next.leader_label_auto_fit).toBeUndefined()
    expect(next.leader_label_scale).toBeUndefined()
    expect(next.leader_label_font_family).toBeUndefined()
    expect(next.segment_casing_color).toBeUndefined()
    expect(next.segment_casing_width).toBeUndefined()
    expect(next.route_smooth).toBeUndefined()
    expect(next.tile_effect).toBe('none')
    expect(next.show_grid).toBe(false)
    expect(next.grid_scope).toBe('poster')
    expect(next.grid_opacity).toBe(0.2)
    expect(next.grid_weight).toBe(1)
    expect(next.grid_spacing).toBe(DEFAULT_STYLE_CONFIG.grid_spacing)
    expect(next.poster_layout).toBeUndefined()
  })

  it('clears stale artifact-prone controls for every refined theme while preserving theme-owned defaults', () => {
    const stale = config({
      show_elevation_profile: true,
      elevation_profile_color: '#FF00FF',
      elevation_profile_opacity: 0.9,
      elevation_profile_height: 24,
      elevation_profile_position: 'map-overlay',
      elevation_profile_relief: 1,
      trail_label_style: 'leader-lines',
      leader_label_auto_fit: false,
      leader_label_scale: 1.6,
      leader_label_font_family: 'Bebas Neue',
      segment_casing_color: '#123456',
      segment_casing_width: 4,
      route_smooth: 2,
      route_color_mode: 'gradient',
      tile_effect: 'posterize',
      tile_duotone_strength: 0.12,
      tile_posterize_levels: 8,
      tile_grain: 0.77,
      tile_contrast: 0.75,
      tile_saturation: -0.5,
      tile_hue_rotate: 180,
      show_vignette: true,
      vignette_intensity: 0.9,
      map_3d: true,
      map_pitch: 58,
      map_bearing: -32,
      terrain_exaggeration: 2.8,
      grid_color: '#ABCDEF',
      grid_scope: 'map',
      grid_opacity: 0.18,
      grid_weight: 3,
      grid_spacing: 14,
      atlas_layers: {
        water: false,
        transportation: false,
        place: false,
      },
      atlas_layer_settings: {
        landcover: { color: '#111111', opacity: 0.1 },
        water: { fill_color: '#222222', fill_opacity: 0.2 },
        transportation: { major_color: '#333333', opacity: 0.3 },
      },
      poster_layout: {
        bands: {
          header: { height: 30 },
        },
      },
      trail_segments: [
        {
          id: 'trail-1',
          name: 'Trail 1',
          color: '#2D6A4F',
          visible: true,
          section_start: 0,
          section_end: 100,
          label_lnglat: [-89, 40],
        },
      ],
    })

    for (const theme of REFINED_THEMES) {
      const next = applyThemeToStyleConfig(stale, theme)

      expect(next.color_theme, theme.id).toBe(theme.id)
      expect(next.poster_layout, theme.id).toBeUndefined()
      expect(next.elevation_profile_color, theme.id).toBeUndefined()
      expect(next.elevation_profile_opacity, theme.id).toBeUndefined()
      expect(next.elevation_profile_height, theme.id).toBe(theme.map_defaults.elevation_profile_height)
      expect(next.elevation_profile_position, theme.id).toBe(theme.map_defaults.elevation_profile_position)
      expect(next.elevation_profile_relief, theme.id).toBe(theme.map_defaults.elevation_profile_relief)
      expect(next.trail_label_style, theme.id).toBe(theme.map_defaults.trail_label_style)
      expect(next.leader_label_auto_fit, theme.id).toBeUndefined()
      expect(next.leader_label_scale, theme.id).toBeUndefined()
      expect(next.leader_label_font_family, theme.id).toBeUndefined()
      expect(next.segment_casing_color, theme.id).toBeUndefined()
      expect(next.segment_casing_width, theme.id).toBeUndefined()
      expect(next.start_pin_lnglat, theme.id).toBeUndefined()
      expect(next.finish_pin_lnglat, theme.id).toBeUndefined()
      expect(next.start_label_lnglat, theme.id).toBeUndefined()
      expect(next.finish_label_lnglat, theme.id).toBeUndefined()
      expect(next.start_pin_label, theme.id).toBeUndefined()
      expect(next.finish_pin_label, theme.id).toBeUndefined()
      expect(next.pin_opacity, theme.id).toBe(theme.map_defaults.pin_opacity)
      expect(next.trail_segments?.some(segment => segment.label_lnglat), theme.id).toBe(false)
      expect(next.route_smooth, theme.id).toBe(theme.map_defaults.route_smooth)
      expect(next.route_color_mode, theme.id).toBe(theme.map_defaults.route_color_mode ?? 'solid')
      expect(next.tile_effect, theme.id).toBe(theme.map_defaults.tile_effect ?? 'none')
      expect(next.tile_duotone_strength, theme.id).toBe(theme.map_defaults.tile_duotone_strength)
      expect(next.tile_posterize_levels, theme.id).toBe(theme.map_defaults.tile_posterize_levels)
      expect(next.tile_grain, theme.id).toBe(theme.tile_grain ?? DEFAULT_STYLE_CONFIG.tile_grain)
      expect(next.tile_contrast, theme.id).toBe(theme.map_defaults.tile_contrast)
      expect(next.tile_saturation, theme.id).toBe(theme.map_defaults.tile_saturation)
      expect(next.tile_hue_rotate, theme.id).toBe(theme.map_defaults.tile_hue_rotate)
      expect(next.show_vignette, theme.id).toBe(theme.map_defaults.show_vignette ?? false)
      expect(next.vignette_intensity, theme.id).toBe(theme.map_defaults.vignette_intensity)
      expect(next.map_3d, theme.id).toBe(theme.map_defaults.map_3d ?? false)
      expect(next.map_pitch, theme.id).toBe(theme.map_defaults.map_pitch ?? DEFAULT_STYLE_CONFIG.map_pitch)
      expect(next.map_bearing, theme.id).toBe(theme.map_defaults.map_bearing ?? DEFAULT_STYLE_CONFIG.map_bearing)
      expect(next.terrain_exaggeration, theme.id).toBe(theme.map_defaults.terrain_exaggeration ?? DEFAULT_STYLE_CONFIG.terrain_exaggeration)
      expect(next.grid_color, theme.id).toBeUndefined()
      expect(next.show_elevation_profile, theme.id).toBe(theme.map_defaults.show_elevation_profile ?? false)
      expect(next.show_grid, theme.id).toBe(theme.map_defaults.show_grid ?? theme.show_grid)
      expect(next.grid_scope, theme.id).toBe(theme.map_defaults.grid_scope ?? 'poster')
      expect(next.grid_opacity, theme.id).toBe(theme.map_defaults.grid_opacity ?? 0.2)
      expect(next.grid_weight, theme.id).toBe(theme.map_defaults.grid_weight ?? 1)
      expect(next.grid_spacing, theme.id).toBe(theme.map_defaults.grid_spacing ?? DEFAULT_STYLE_CONFIG.grid_spacing)
      expect(next.atlas_layers, theme.id).toEqual(theme.map_defaults.atlas_layers)
      expect(next.atlas_layer_settings, theme.id).toEqual(theme.map_defaults.atlas_layer_settings)
    }
  })

  it('can restore legacy marathon-era themes without forcing a refined composition', () => {
    const theme = COLOR_THEMES.find(theme => theme.id === 'chalk')
    expect(theme).toBeTruthy()

    const next = applyThemeToStyleConfig(config({
      color_theme: 'midcentury-travel',
      composition: 'travel-banner',
      audience: 'National Park / tourist',
      font_family: 'Oswald',
      body_font_family: 'Work Sans',
    }), theme!)

    expect(next.color_theme).toBe('chalk')
    expect(next.composition).toBeUndefined()
    expect(next.audience).toBeUndefined()
    expect(next.background_color).toBe('#F4EFE6')
    expect(next.base_tile_style).toBe('carto-light')
  })

  it('chooses contrast-safe default pin colors for pale and dark map backgrounds', () => {
    const pale = '#E6D2A2'
    const dark = '#0B2948'

    const midcenturyPin = pickContrastSafeColor(pale, ['#CF5535', '#19382A', '#FAEBC2'])
    const blueprintPin = pickContrastSafeColor(dark, ['#FFD45A', '#0B2948', '#DCEEFF'])

    expect(midcenturyPin).toBe('#19382A')
    expect(contrastRatio(midcenturyPin, pale)).toBeGreaterThanOrEqual(4.5)
    expect(blueprintPin).toBe('#FFD45A')
    expect(contrastRatio(blueprintPin, dark)).toBeGreaterThanOrEqual(4.5)
  })
})
