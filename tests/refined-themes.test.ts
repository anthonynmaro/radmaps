import { describe, expect, it } from 'vitest'
import { COLOR_THEMES, DEFAULT_CONTOUR_MAJOR_WIDTH, DEFAULT_ROUTE_WIDTH, DEFAULT_SEGMENT_CASING_WIDTH, DEFAULT_STYLE_CONFIG, type ColorTheme, type CompositionId, type StyleConfig } from '../types'
import {
  ALL_COLOR_THEME_IDS,
  COMPOSITION_IDS,
  LEGACY_THEME_MIGRATION_TARGETS,
  REFINED_THEME_IDS,
  REFINED_THEMES,
  getRefinedThemeById,
  getThemeDefinition,
} from '../utils/themes/refined'

describe('refined theme Phase 0 scaffolding', () => {
  it('adds the design-update theme definitions without changing current defaults', () => {
    expect(REFINED_THEMES).toHaveLength(14)
    expect(DEFAULT_STYLE_CONFIG.color_theme).toBe('chalk')
    expect(DEFAULT_STYLE_CONFIG.show_roads).toBe(true)
    expect(DEFAULT_STYLE_CONFIG.show_hillshade).toBe(false)
    expect(DEFAULT_STYLE_CONFIG.composition).toBeUndefined()
    expect(DEFAULT_STYLE_CONFIG.route_width).toBe(DEFAULT_ROUTE_WIDTH)
    expect(DEFAULT_STYLE_CONFIG.segment_casing_width).toBe(DEFAULT_SEGMENT_CASING_WIDTH)
  })

  it('keeps every refined theme wired to a valid composition and map defaults', () => {
    for (const theme of REFINED_THEMES) {
      expect(COMPOSITION_IDS).toContain(theme.composition)
      expect(theme.audience.length).toBeGreaterThan(0)
      expect(theme.map_defaults.preset, theme.id).toBeTruthy()
      expect(theme.map_defaults.preset, theme.id).toMatch(/^radmaps-/)
      expect(theme.map_defaults.atlas_style_id, theme.id).toBe(theme.map_defaults.preset)
      expect(typeof theme.map_defaults.show_grid, theme.id).toBe('boolean')
      if (theme.map_defaults.show_contours) {
        expect(theme.map_defaults.contour_detail, theme.id).toBeGreaterThanOrEqual(5)
        expect(theme.map_defaults.contour_major_width, theme.id).toBe(DEFAULT_CONTOUR_MAJOR_WIDTH)
        expect(theme.map_defaults.contour_opacity, theme.id).toBeLessThanOrEqual(0.46)
      }
      if (theme.map_defaults.show_grid) {
        expect(theme.map_defaults.grid_opacity, theme.id).toBeGreaterThan(0)
        expect(theme.map_defaults.grid_opacity, theme.id).toBeLessThanOrEqual(0.2)
        expect(theme.map_defaults.grid_scope, theme.id).toMatch(/^(poster|map)$/)
      }
    }
  })

  it('keeps blueprint grids inside the map area by default', () => {
    expect(getRefinedThemeById('blueprint')?.map_defaults).toMatchObject({
      show_grid: true,
      grid_scope: 'map',
      grid_opacity: 0.16,
    })
    expect(getRefinedThemeById('blueprint-strava')?.map_defaults).toMatchObject({
      show_grid: true,
      grid_scope: 'map',
      grid_opacity: 0.16,
    })
  })

  it('exposes new theme and composition ids through the shared unions', () => {
    const themeId: ColorTheme = 'marathon-bib'
    const compositionId: CompositionId = 'bib-numerals'
    const config: Partial<StyleConfig> = {
      color_theme: themeId,
      composition: compositionId,
      show_grid: false,
      grid_scope: 'poster',
      grid_opacity: 0.2,
      grid_weight: 1,
      dark: false,
      audience: 'Marathon / event',
    }

    expect(REFINED_THEME_IDS).toContain(config.color_theme)
    expect(COMPOSITION_IDS).toContain(config.composition)
    expect(ALL_COLOR_THEME_IDS).toContain('chalk')
    expect(ALL_COLOR_THEME_IDS).toContain('blueprint-strava')
    expect(ALL_COLOR_THEME_IDS).toContain('contour-wash')
  })

  it('keeps legacy themes renderable while declaring migration targets', () => {
    const legacyIds = COLOR_THEMES.filter(theme => theme.legacy).map(theme => theme.id)

    expect(legacyIds).toContain('chalk')
    expect(legacyIds).toContain('topo-art')
    expect(LEGACY_THEME_MIGRATION_TARGETS.chalk).toBe('editorial-minimal')
    expect(LEGACY_THEME_MIGRATION_TARGETS['mid-century']).toBe('midcentury-travel')
    expect(getThemeDefinition('chalk')?.legacy).toBe(true)
    expect(getRefinedThemeById('editorial-minimal')?.composition).toBe('editorial-tall')
    expect(getRefinedThemeById('midcentury-travel')?.map_defaults.preset).toBe('radmaps-simple-contour')
  })

  it('keeps mid-century map labels readable on its warm map surface', () => {
    const midcentury = getRefinedThemeById('midcentury-travel')

    expect(midcentury?.map_defaults.place_labels_color).toBe('#3A4A2A')
    expect(midcentury?.map_defaults.poi_labels_color).toBe('#3A4A2A')
    expect(midcentury?.map_defaults.atlas_layer_settings?.place?.label_color).toBe('#3A4A2A')
  })

  it('keeps preview-forward contour themes backed by contour map detail', () => {
    const brutalist = getRefinedThemeById('brutalist')
    const contourWash = getRefinedThemeById('contour-wash')

    expect(brutalist?.composition).toBe('brutalist-slab')
    expect(brutalist?.map_defaults.preset).toBe('radmaps-toner-light')
    expect(brutalist?.map_defaults.show_contours).toBe(true)
    expect(brutalist?.map_defaults.contour_detail).toBeGreaterThanOrEqual(5)
    expect(contourWash?.composition).toBe('modernist-block')
    expect(contourWash?.map_defaults.preset).toBe('radmaps-contour-wash')
    expect(contourWash?.map_defaults.show_contours).toBe(true)
  })
})
