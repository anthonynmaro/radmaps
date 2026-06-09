import { describe, expect, it } from 'vitest'
import { COLOR_THEMES, DEFAULT_STYLE_CONFIG, type StyleConfig } from '~/types'
import {
  QUICK_THEME_OPTIONS,
  deriveThemePreviewConfig,
  orderedQuickThemeOptionsForRoute,
  priorityThemeIdsForMap,
} from '~/utils/themeOptions'
import { REFINED_THEMES, getThemeDefinition } from '~/utils/themes/refined'

const POINT_GEOJSON: GeoJSON.FeatureCollection = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'Point',
        coordinates: [-99.1332, 19.4326],
      },
    },
  ],
}

const PLACE_STATS = {
  distance_km: 0,
  elevation_gain_m: 0,
  elevation_loss_m: 0,
  max_elevation_m: 0,
  min_elevation_m: 0,
}

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

describe('theme options', () => {
  it('keeps the shared quick-theme ordering aligned with the existing quick tab', () => {
    const expectedIds = [
      ...REFINED_THEMES.map(theme => theme.id),
      ...COLOR_THEMES
        .filter(theme => !theme.legacy && !REFINED_THEMES.some(refined => refined.id === theme.id))
        .map(theme => theme.id),
    ]

    expect(QUICK_THEME_OPTIONS.map(theme => theme.id)).toEqual(expectedIds)
  })

  it('derives preview configs without mutating the base style config', () => {
    const base = config({
      color_theme: 'chalk',
      route_color: '#111111',
      poster_text_overrides: {
        trail_name: { text: 'Saved title', color: '#FF00FF' },
      },
    })
    const before = JSON.parse(JSON.stringify(base))
    const theme = getThemeDefinition('blueprint')
    expect(theme).toBeTruthy()

    const preview = deriveThemePreviewConfig(base, theme!)

    expect(base).toEqual(before)
    expect(preview).not.toBe(base)
    expect(preview.color_theme).toBe('blueprint')
    expect(preview.poster_text_overrides).toEqual({ trail_name: { text: 'Saved title' } })
  })

  it('orders quick themes deterministically from route stats', () => {
    expect(priorityThemeIdsForMap({ distance_km: 42, elevation_gain_m: 200, elevation_loss_m: 0, max_elevation_m: 0, min_elevation_m: 0 })).toEqual([
      'splits-stats',
      'blueprint-strava',
      'marathon-bib',
      'transit-diagram',
    ])

    expect(priorityThemeIdsForMap({ distance_km: 9, elevation_gain_m: 1400, elevation_loss_m: 0, max_elevation_m: 0, min_elevation_m: 0 })).toEqual([
      'relief-shaded',
      'usgs-vintage',
      'field-journal',
      'contour-wash',
    ])

    expect(orderedQuickThemeOptionsForRoute({ distance_km: 5, elevation_gain_m: 80, elevation_loss_m: 0, max_elevation_m: 0, min_elevation_m: 0 }).slice(0, 3).map(theme => theme.id)).toEqual([
      'editorial-minimal',
      'midcentury-travel',
      'bold-modern',
    ])
  })

  it('prioritizes place-readable themes for point maps', () => {
    expect(priorityThemeIdsForMap(PLACE_STATS, POINT_GEOJSON)).toEqual([
      'cartouche-place',
      'editorial-minimal',
      'usgs-vintage',
    ])

    expect(orderedQuickThemeOptionsForRoute(PLACE_STATS, POINT_GEOJSON).slice(0, 3).map(theme => theme.id)).toEqual([
      'cartouche-place',
      'editorial-minimal',
      'usgs-vintage',
    ])
  })

  it('adds map context to place previews without forcing contours back on', () => {
    const theme = getThemeDefinition('splits-stats')
    expect(theme).toBeTruthy()

    const preview = deriveThemePreviewConfig(config(), theme!, {
      stats: PLACE_STATS,
      geojson: POINT_GEOJSON,
    })

    expect(preview.show_roads).toBe(true)
    expect(preview.show_place_labels).toBe(true)
    expect(preview.show_poi_labels).toBe(true)
    expect(preview.show_contours).toBe(false)
    expect(preview.roads_color).toBe(preview.contour_major_color)
    expect(preview.roads_color).not.toBe(preview.route_color)
    expect(preview.roads_opacity).toBeLessThanOrEqual(0.5)
    expect(preview.atlas_layers).toMatchObject({
      contour: false,
      water: true,
      waterway: true,
      transportation: true,
      place: true,
      poi: true,
    })
  })

  it('preserves mid-century readable place-label ink in place previews', () => {
    const theme = getThemeDefinition('midcentury-travel')
    expect(theme).toBeTruthy()

    const preview = deriveThemePreviewConfig(config(), theme!, {
      stats: PLACE_STATS,
      geojson: POINT_GEOJSON,
    })

    expect(preview.place_labels_color).toBe('#3A4A2A')
    expect(preview.poi_labels_color).toBe('#3A4A2A')
    expect(preview.atlas_layer_settings?.place?.label_color).toBe('#3A4A2A')
  })
})
