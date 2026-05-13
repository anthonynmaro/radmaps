import { describe, expect, it } from 'vitest'
import { DEFAULT_STYLE_CONFIG, type StyleConfig } from '~/types'
import { contrastRatio, pickContrastSafeColor } from '~/utils/colorContrast'
import { applyThemeToStyleConfig } from '~/utils/themeApplication'
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
      title_scale: 1.75,
      occasion_scale: 0.75,
      subtitle_scale: 1.35,
    }), theme!)

    expect(next.color_theme).toBe('midcentury-travel')
    expect(next.preset).toBe('contour-art')
    expect(next.contour_detail).toBe(5)
    expect(next.contour_major_width).toBe(0.5)
    expect(next.background_color).toBe('#E8DAB8')
    expect(next.label_bg_color).toBe('#1F3325')
    expect(next.label_text_color).toBe('#F0E5C5')
    expect(next.route_color).toBe('#D4603A')
    expect(next.font_family).toBe('Oswald')
    expect(next.body_font_family).toBe('Work Sans')
    expect(next.composition).toBe('travel-banner')
    expect(next.title_scale).toBe(1)
    expect(next.occasion_scale).toBe(1)
    expect(next.subtitle_scale).toBe(1)
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
      tile_shadow_color: '#56789A',
      tile_midtone_color: '#6789AB',
      tile_highlight_color: '#789ABC',
      pin_font_family: 'Bebas Neue',
      leader_label_font_family: 'Bebas Neue',
      grid_color: '#ABCDEF',
      grid_opacity: 0.2,
      grid_weight: 3,
      grid_scope: 'map',
    }), theme!)

    expect(next.roads_color).toBeUndefined()
    expect(next.place_labels_color).toBeUndefined()
    expect(next.poi_labels_color).toBeUndefined()
    expect(next.pin_color).toBeUndefined()
    expect(next.tile_shadow_color).toBeUndefined()
    expect(next.tile_midtone_color).toBeUndefined()
    expect(next.tile_highlight_color).toBeUndefined()
    expect(next.pin_font_family).toBeUndefined()
    expect(next.leader_label_font_family).toBeUndefined()
    expect(next.grid_color).toBeUndefined()
    expect(next.grid_opacity).toBe(0.2)
    expect(next.grid_weight).toBe(1)
    expect(next.grid_scope).toBe('poster')
  })

  it('chooses contrast-safe default pin colors for pale and dark map backgrounds', () => {
    const pale = '#E8DAB8'
    const dark = '#0F2D52'

    const midcenturyPin = pickContrastSafeColor(pale, ['#D4603A', '#1F3325', '#F0E5C5'])
    const blueprintPin = pickContrastSafeColor(dark, ['#FFD046', '#0F2D52', '#D0E4FF'])

    expect(midcenturyPin).toBe('#1F3325')
    expect(contrastRatio(midcenturyPin, pale)).toBeGreaterThanOrEqual(4.5)
    expect(blueprintPin).toBe('#FFD046')
    expect(contrastRatio(blueprintPin, dark)).toBeGreaterThanOrEqual(4.5)
  })
})
