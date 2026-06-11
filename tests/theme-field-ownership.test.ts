import { describe, expect, it } from 'vitest'
import { DEFAULT_STYLE_CONFIG, type StyleConfig } from '~/types'
import {
  THEME_RESET_FIELDS,
  applyThemeToStyleConfig,
  applyThemeToStyleConfigWithMeta,
  resetAllToTheme,
} from '~/utils/themeApplication'
import {
  STICKY_STYLE_FIELDS,
  THEME_FIELD_OWNERSHIP,
  THEME_FIELD_OWNERSHIP_VERSION,
  USER_OWNED_STYLE_FIELDS,
  getThemeFieldOwnership,
} from '~/utils/themeFieldOwnership'
import { getThemeDefinition } from '~/utils/themes/refined'

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

/** A config sitting exactly at the outgoing theme's defaults (nothing manually changed). */
function configAtTheme(themeId: string): StyleConfig {
  const theme = getThemeDefinition(themeId)
  expect(theme, themeId).toBeTruthy()
  return applyThemeToStyleConfig(config(), theme!)
}

describe('theme field ownership registry', () => {
  it('exports a registry version for hashing/migration consumers', () => {
    expect(THEME_FIELD_OWNERSHIP_VERSION).toBe(1)
  })

  it('classifies every field in THEME_RESET_FIELDS (no reset field may ship unclassified)', () => {
    for (const field of Object.keys(THEME_RESET_FIELDS)) {
      expect(getThemeFieldOwnership(field), `THEME_RESET_FIELDS.${field} must be classified in THEME_FIELD_OWNERSHIP`).toBeDefined()
    }
  })

  it('classifies every DEFAULT_STYLE_CONFIG field', () => {
    for (const field of Object.keys(DEFAULT_STYLE_CONFIG)) {
      expect(getThemeFieldOwnership(field), `DEFAULT_STYLE_CONFIG.${field} must be classified in THEME_FIELD_OWNERSHIP`).toBeDefined()
    }
  })

  it('only contains the three known ownership values', () => {
    for (const [field, ownership] of Object.entries(THEME_FIELD_OWNERSHIP)) {
      expect(['theme-owned', 'user-owned', 'sticky'], field).toContain(ownership)
    }
  })

  it('locks the spec-mandated classifications', () => {
    // user-owned minimum per docs/STYLE_SYSTEM_EVOLUTION.md
    for (const field of ['poster_text_overrides', 'poster_layout', 'trail_segments', 'route_crop_start', 'route_crop_end', 'route_deleted_ranges', 'print_size', 'map_element_overrides'] as const) {
      expect(THEME_FIELD_OWNERSHIP[field], field).toBe('user-owned')
    }
    // sticky middle
    for (const field of ['route_color', 'route_width', 'route_opacity', 'label_text_color', 'label_bg_color', 'show_grid', 'grid_scope', 'grid_color', 'grid_opacity', 'grid_weight', 'grid_spacing'] as const) {
      expect(THEME_FIELD_OWNERSHIP[field], field).toBe('sticky')
    }
    expect(USER_OWNED_STYLE_FIELDS).toContain('map_element_overrides')
    expect(STICKY_STYLE_FIELDS).toContain('route_color')
  })
})

describe('applyThemeToStyleConfig — flag off (legacy behavior)', () => {
  it('clobbers a manual route_color edit, exactly as before', () => {
    const target = getThemeDefinition('usgs-vintage')!
    const edited = { ...configAtTheme('blueprint'), route_color: '#123456' }

    const next = applyThemeToStyleConfig(edited, target)
    expect(next.route_color).not.toBe('#123456')
    expect(next).toEqual(resetAllToTheme(edited, target))
  })

  it('reports empty preservedFields and the changed fields as resetFields', () => {
    const target = getThemeDefinition('usgs-vintage')!
    const edited = { ...configAtTheme('blueprint'), route_color: '#123456' }

    const result = applyThemeToStyleConfigWithMeta(edited, target)
    expect(result.preservedFields).toEqual([])
    expect(result.resetFields).toContain('route_color')
    expect(result.resetFields).toContain('color_theme')
    expect(result.config).toEqual(resetAllToTheme(edited, target))
  })
})

describe('applyThemeToStyleConfig — flag on (preserveUserIntent)', () => {
  const preserve = { preserveUserIntent: true }

  it('keeps a manual route_color edit across a theme switch', () => {
    const target = getThemeDefinition('usgs-vintage')!
    const edited = { ...configAtTheme('blueprint'), route_color: '#123456' }

    const result = applyThemeToStyleConfigWithMeta(edited, target, preserve)
    expect(result.config.route_color).toBe('#123456')
    expect(result.preservedFields).toContain('route_color')
    expect(result.config.color_theme).toBe('usgs-vintage')
  })

  it('resets a sticky field left at the outgoing theme default', () => {
    const target = getThemeDefinition('usgs-vintage')!
    const untouched = configAtTheme('blueprint')

    const result = applyThemeToStyleConfigWithMeta(untouched, target, preserve)
    const fullReset = resetAllToTheme(untouched, target)
    expect(result.config.route_color).toBe(fullReset.route_color)
    expect(result.config.route_width).toBe(fullReset.route_width)
    expect(result.config.show_grid).toBe(fullReset.show_grid)
    expect(result.preservedFields).not.toContain('route_color')
  })

  it('keeps manually changed route_width/route_opacity and grid settings', () => {
    const target = getThemeDefinition('bold-modern')!
    const base = configAtTheme('blueprint')
    const flippedGrid = !base.show_grid
    const edited = {
      ...base,
      route_width: 9,
      route_opacity: 0.42,
      show_grid: flippedGrid,
      grid_color: '#FF8800',
      grid_opacity: 0.55,
      grid_weight: 3,
      grid_spacing: 14,
      grid_scope: 'map' as const,
    }

    const { config: next, preservedFields } = applyThemeToStyleConfigWithMeta(edited, target, preserve)
    expect(next.route_width).toBe(9)
    expect(next.route_opacity).toBe(0.42)
    expect(next.show_grid).toBe(flippedGrid)
    expect(next.grid_color).toBe('#FF8800')
    expect(next.grid_opacity).toBe(0.55)
    expect(next.grid_weight).toBe(3)
    expect(next.grid_spacing).toBe(14)
    expect(next.grid_scope).toBe('map')
    expect(preservedFields).toEqual(expect.arrayContaining(['grid_color', 'grid_opacity', 'grid_weight']))
  })

  it('keeps manually changed label band colors', () => {
    const target = getThemeDefinition('usgs-vintage')!
    const edited = {
      ...configAtTheme('blueprint'),
      label_text_color: '#101010',
      label_bg_color: '#FAFAF0',
    }

    const { config: next } = applyThemeToStyleConfigWithMeta(edited, target, preserve)
    expect(next.label_text_color).toBe('#101010')
    expect(next.label_bg_color).toBe('#FAFAF0')
  })

  it('always preserves user-owned fields: layout, print size, route geometry, overlays', () => {
    const target = getThemeDefinition('usgs-vintage')!
    const edited = config({
      color_theme: 'blueprint',
      print_size: '32x48',
      route_crop_start: 5,
      route_crop_end: 95,
      route_deleted_ranges: [{ start: 10, end: 20 }],
      poster_layout: { bands: { header: { height: 31 } } },
      text_overlays: [{
        id: 'note-1',
        content: 'Mile 12 aid station',
        x: 40,
        y: 60,
        font_size: 2,
        color: '#222222',
        font_family: 'Work Sans',
        alignment: 'left',
        opacity: 1,
        bold: false,
      }],
    })

    const { config: next, preservedFields } = applyThemeToStyleConfigWithMeta(edited, target, preserve)
    expect(next.print_size).toBe('32x48')
    expect(next.route_crop_start).toBe(5)
    expect(next.route_crop_end).toBe(95)
    expect(next.route_deleted_ranges).toEqual([{ start: 10, end: 20 }])
    expect(next.poster_layout).toEqual({ bands: { header: { height: 31 } } })
    expect(next.text_overlays).toHaveLength(1)
    expect(preservedFields).toContain('poster_layout')
  })

  it('preserves full poster_text_overrides, including per-slot visual edits', () => {
    const target = getThemeDefinition('bold-modern')!
    const overrides = {
      trail_name: { text: 'My edited title', color: '#FF00FF', scale: 1.8 },
      distance: { color: '#00FF00' },
    }
    const edited = config({ color_theme: 'blueprint', poster_text_overrides: overrides })

    const { config: next } = applyThemeToStyleConfigWithMeta(edited, target, preserve)
    expect(next.poster_text_overrides).toEqual(overrides)
  })

  it('preserves trail segments verbatim — colors, widths, and dragged labels', () => {
    const darkSky = getThemeDefinition('dark-sky')!
    const segments = [
      {
        id: 'trail-1',
        name: 'Trail 1',
        color: '#2D6A4F',
        visible: true,
        section_start: 0,
        section_end: 50,
        width: 5,
        color_mode: 'gradient' as const,
        label_lnglat: [-89, 40] as [number, number],
      },
    ]
    const edited = config({ color_theme: 'blueprint', trail_segments: segments })

    const { config: next } = applyThemeToStyleConfigWithMeta(edited, darkSky, preserve)
    // Flag on, segments are user-owned: no dark-sky recolor, no label_lnglat strip.
    expect(next.trail_segments).toEqual(segments)

    // Flag off keeps the legacy dark-sky normalization.
    const legacy = applyThemeToStyleConfig(edited, darkSky)
    expect(legacy.trail_segments?.[0]?.color).toBe(darkSky.route_color)
    expect(legacy.trail_segments?.[0]?.label_lnglat).toBeUndefined()
  })

  it('preserves an unknown future map_element_overrides payload (guarded field)', () => {
    const target = getThemeDefinition('usgs-vintage')!
    const edited = {
      ...configAtTheme('blueprint'),
      map_element_overrides: { 'place:123': { hidden: true } },
    } as StyleConfig

    const { config: next } = applyThemeToStyleConfigWithMeta(edited, target, preserve)
    expect((next as unknown as Record<string, unknown>).map_element_overrides).toEqual({ 'place:123': { hidden: true } })
  })

  it('falls back to stock defaults as the sticky baseline when the outgoing theme is unknown', () => {
    const target = getThemeDefinition('usgs-vintage')!
    const edited = config({
      color_theme: 'not-a-real-theme' as StyleConfig['color_theme'],
      route_color: '#123456',
    })

    const { config: next } = applyThemeToStyleConfigWithMeta(edited, target, preserve)
    expect(next.route_color).toBe('#123456')
  })

  it('honors an explicit previousTheme over the color_theme lookup', () => {
    const blueprint = getThemeDefinition('blueprint')!
    const target = getThemeDefinition('usgs-vintage')!
    // Config claims another theme id but sits at blueprint's route color.
    const edited = { ...configAtTheme('blueprint'), color_theme: 'bold-modern' as StyleConfig['color_theme'] }

    const { config: next } = applyThemeToStyleConfigWithMeta(edited, target, { preserveUserIntent: true, previousTheme: blueprint })
    expect(next.route_color).toBe(resetAllToTheme(edited, target).route_color)
  })
})

describe('resetAllToTheme', () => {
  it('matches the flag-off application exactly (the toast undo path)', () => {
    for (const themeId of ['usgs-vintage', 'bold-modern', 'dark-sky', 'chalk']) {
      const theme = getThemeDefinition(themeId)
      expect(theme, themeId).toBeTruthy()
      const edited = config({
        color_theme: 'blueprint',
        route_color: '#123456',
        poster_layout: { bands: { header: { height: 31 } } },
      })
      expect(resetAllToTheme(edited, theme!), themeId).toEqual(applyThemeToStyleConfig(edited, theme!))
    }
  })
})
