import { describe, expect, it } from 'vitest'
import { COLOR_THEMES, DEFAULT_CONTOUR_MAJOR_WIDTH, DEFAULT_STYLE_CONFIG, type ColorTheme, type CompositionId, type StyleConfig } from '../types'
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
  it('adds the 13 design-update theme definitions without changing current defaults', () => {
    expect(REFINED_THEMES).toHaveLength(13)
    expect(DEFAULT_STYLE_CONFIG.color_theme).toBe('chalk')
    expect(DEFAULT_STYLE_CONFIG.show_roads).toBe(true)
    expect(DEFAULT_STYLE_CONFIG.show_hillshade).toBe(false)
    expect(DEFAULT_STYLE_CONFIG.composition).toBeUndefined()
  })

  it('keeps every refined theme wired to a valid composition and map defaults', () => {
    for (const theme of REFINED_THEMES) {
      expect(COMPOSITION_IDS).toContain(theme.composition)
      expect(theme.audience.length).toBeGreaterThan(0)
      expect(theme.map_defaults.preset, theme.id).toBeTruthy()
      expect(typeof theme.map_defaults.show_grid, theme.id).toBe('boolean')
      if (theme.map_defaults.show_contours) {
        expect(theme.map_defaults.contour_detail, theme.id).toBeGreaterThanOrEqual(5)
        expect(theme.map_defaults.contour_major_width, theme.id).toBe(DEFAULT_CONTOUR_MAJOR_WIDTH)
      }
      if (theme.map_defaults.show_grid) {
        expect(theme.map_defaults.grid_opacity, theme.id).toBe(0.2)
        expect(theme.map_defaults.grid_scope, theme.id).toMatch(/^(poster|map)$/)
      }
    }
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
  })

  it('keeps legacy themes renderable while declaring migration targets', () => {
    const legacyIds = COLOR_THEMES.filter(theme => theme.legacy).map(theme => theme.id)

    expect(legacyIds).toContain('chalk')
    expect(legacyIds).toContain('topo-art')
    expect(LEGACY_THEME_MIGRATION_TARGETS.chalk).toBe('editorial-minimal')
    expect(LEGACY_THEME_MIGRATION_TARGETS['mid-century']).toBe('midcentury-travel')
    expect(getThemeDefinition('chalk')?.legacy).toBe(true)
    expect(getRefinedThemeById('editorial-minimal')?.composition).toBe('editorial-tall')
    expect(getRefinedThemeById('midcentury-travel')?.map_defaults.preset).toBe('contour-art')
  })

  it('keeps preview-forward contour themes backed by contour map detail', () => {
    const brutalist = getRefinedThemeById('brutalist')

    expect(brutalist?.composition).toBe('brutalist-slab')
    expect(brutalist?.map_defaults.preset).toBe('contour-art')
    expect(brutalist?.map_defaults.show_contours).toBe(true)
    expect(brutalist?.map_defaults.contour_detail).toBeGreaterThanOrEqual(5)
  })
})
