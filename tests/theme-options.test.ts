import { describe, expect, it } from 'vitest'
import { COLOR_THEMES, DEFAULT_STYLE_CONFIG, type StyleConfig } from '~/types'
import {
  QUICK_THEME_OPTION_GROUPS,
  QUICK_THEME_OPTIONS,
  deriveThemePreviewConfig,
  groupThemeOptionsByColorway,
  groupThemeOptionsByPurpose,
  orderedQuickThemeOptionsForRoute,
  priorityThemeIdsForMap,
  purposeForTheme,
  resolveThemePreviewBaseMapMode,
  showsRefinedThemeBadge,
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

const SPEC_POSTER_THEME_IDS = [
  'editorial-minimal',
  'usgs-vintage',
  'classic-trail',
  'midcentury-travel',
  'ranch-ochre',
  'daybreak-trace',
  'risograph',
  'blueprint',
  'moonstone',
  'blueprint-strava',
  'electric-atlas',
  'field-journal',
  'botanical',
  'bold-modern',
  'blackline',
  'contour-wash',
  'splits-stats',
  'night-ride',
  'marathon-bib',
  'dark-sky',
  'copper-night',
  'brutalist',
  'cartouche-place',
  'sea-chart',
  'relief-shaded',
  'transit-diagram',
  'plein-air',
]

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

  it('exposes every design-spec poster recipe through Quick theme options', () => {
    expect(QUICK_THEME_OPTIONS.map(theme => theme.id)).toEqual(expect.arrayContaining(SPEC_POSTER_THEME_IDS))
  })

  it('groups refined colorways under their parent theme without removing quick options', () => {
    const groups = groupThemeOptionsByColorway(QUICK_THEME_OPTIONS)
    const byParent = new Map(groups.map(group => [group.theme.id, group.colorways.map(theme => theme.id)]))

    expect(groups).toEqual(QUICK_THEME_OPTION_GROUPS)
    expect(QUICK_THEME_OPTIONS.map(theme => theme.id)).toEqual(expect.arrayContaining([
      'classic-trail',
      'ranch-ochre',
      'daybreak-trace',
      'blackline',
      'moonstone',
      'night-ride',
      'copper-night',
    ]))
    expect(byParent.get('usgs-vintage')).toEqual(['classic-trail'])
    expect(byParent.get('midcentury-travel')).toEqual(['ranch-ochre', 'daybreak-trace'])
    expect(byParent.get('bold-modern')).toEqual(['blackline'])
    expect(byParent.get('blueprint')).toEqual(['moonstone'])
    expect(byParent.get('splits-stats')).toEqual(['night-ride'])
    expect(byParent.get('dark-sky')).toEqual(['copper-night'])
  })

  it('drives the Refined picker badge from the manifest only', () => {
    for (const themeId of SPEC_POSTER_THEME_IDS) {
      expect(showsRefinedThemeBadge(themeId), themeId).toBe(true)
    }

    expect(showsRefinedThemeBadge('chalk')).toBe(false)
    expect(showsRefinedThemeBadge('topaz')).toBe(false)
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
    expect(preview.base_map_mode).toBe('terrain')
    expect(preview.poster_text_overrides).toEqual({ trail_name: { text: 'Saved title' } })
  })

  it('resolves base map mode deterministically from route context', () => {
    const flatRoute = { distance_km: 42, elevation_gain_m: 22, elevation_loss_m: 20, max_elevation_m: 190, min_elevation_m: 160 }
    const mountainRoute = { distance_km: 12, elevation_gain_m: 900, elevation_loss_m: 900, max_elevation_m: 1800, min_elevation_m: 700 }

    expect(resolveThemePreviewBaseMapMode({ stats: flatRoute })).toBe('terrain')
    expect(resolveThemePreviewBaseMapMode({ stats: { ...flatRoute }, atlas_coverage_status: 'base' })).toBe('streets')
    expect(resolveThemePreviewBaseMapMode({ stats: mountainRoute })).toBe('terrain')
    expect(resolveThemePreviewBaseMapMode({ stats: mountainRoute }, 'minimal')).toBe('minimal')
  })

  it('applies minimal as a base-mode overlay without replacing the theme preset', () => {
    const theme = getThemeDefinition('blueprint')
    expect(theme).toBeTruthy()

    const preview = deriveThemePreviewConfig(config(), theme!, {
      stats: { distance_km: 42, elevation_gain_m: 22, elevation_loss_m: 20, max_elevation_m: 190, min_elevation_m: 160 },
      baseMapMode: 'minimal',
    })

    expect(preview.base_map_mode).toBe('minimal')
    expect(preview.preset).toBe(theme!.map_defaults?.preset)
    expect(preview.show_contours).toBe(false)
    expect(preview.show_roads).toBe(false)
    expect(preview.show_place_labels).toBe(false)
    expect(preview.atlas_layers).toMatchObject({
      contour: false,
      transportation: false,
      water: false,
      place: false,
      poi: false,
    })
  })

  it('derives street tokens from theme contour tokens when Atlas coverage is available', () => {
    const theme = getThemeDefinition('transit-diagram')
    expect(theme).toBeTruthy()

    const preview = deriveThemePreviewConfig(config(), theme!, {
      stats: { distance_km: 42, elevation_gain_m: 22, elevation_loss_m: 20, max_elevation_m: 190, min_elevation_m: 160 },
      atlas_coverage_status: 'base',
      baseMapMode: 'auto',
    })

    expect(preview.base_map_mode).toBe('streets')
    expect(preview.show_contours).toBe(false)
    expect(preview.show_roads).toBe(true)
    expect(preview.show_place_labels).toBe(false)
    expect(preview.atlas_layers).toMatchObject({
      contour: false,
      transportation: true,
      place: false,
      poi: false,
    })
    expect(preview.atlas_layer_settings?.transportation?.major_color).toBe(preview.contour_major_color)
    expect(preview.atlas_layer_settings?.transportation?.minor_color).toBe(preview.contour_color)
    expect(preview.atlas_layer_settings?.transportation?.labels).toBe(false)
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

    expect(orderedQuickThemeOptionsForRoute({ distance_km: 5, elevation_gain_m: 80, elevation_loss_m: 0, max_elevation_m: 0, min_elevation_m: 0 }).slice(0, 5).map(theme => theme.id)).toEqual([
      'editorial-minimal',
      'midcentury-travel',
      'bold-modern',
      'sea-chart',
      'plein-air',
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

  it('groups quick themes by purpose and orders groups from the uploaded data', () => {
    const byId = new Map(QUICK_THEME_OPTIONS.map(theme => [theme.id, theme]))
    expect(purposeForTheme(byId.get('cartouche-place')!)).toBe('place')
    expect(purposeForTheme(byId.get('splits-stats')!)).toBe('route-urban')
    expect(purposeForTheme(byId.get('sea-chart')!)).toBe('nautical')

    const placeGroups = groupThemeOptionsByPurpose(QUICK_THEME_OPTIONS, {
      stats: PLACE_STATS,
      geojson: POINT_GEOJSON,
    })
    const routeGroups = groupThemeOptionsByPurpose(QUICK_THEME_OPTIONS, {
      stats: { distance_km: 16, elevation_gain_m: 900, elevation_loss_m: 0, max_elevation_m: 1300, min_elevation_m: 400 },
    })

    const groupedThemeIds = placeGroups.flatMap(group => group.themes.map(theme => theme.id))
    expect(placeGroups[0]?.purpose).toBe('place')
    expect(groupedThemeIds).toHaveLength(QUICK_THEME_OPTIONS.length)
    expect(new Set(groupedThemeIds)).toEqual(new Set(QUICK_THEME_OPTIONS.map(theme => theme.id)))
    expect(routeGroups[0]?.purpose).toBe('route-terrain')
  })

  it('uses the terrain base overlay for place previews by default', () => {
    const theme = getThemeDefinition('transit-diagram')
    expect(theme).toBeTruthy()

    const preview = deriveThemePreviewConfig(config(), theme!, {
      stats: PLACE_STATS,
      geojson: POINT_GEOJSON,
    })

    expect(preview.base_map_mode).toBe('terrain')
    expect(preview.show_roads).toBe(false)
    expect(preview.show_place_labels).toBe(false)
    expect(preview.show_poi_labels).toBe(false)
    expect(preview.show_contours).toBe(true)
    expect(preview.atlas_layers).toMatchObject({
      contour: true,
      transportation: false,
      place: false,
      poi: false,
    })
  })

  it('preserves manual streets label ink in place previews without enabling labels', () => {
    const theme = getThemeDefinition('midcentury-travel')
    expect(theme).toBeTruthy()

    const preview = deriveThemePreviewConfig(config(), theme!, {
      stats: PLACE_STATS,
      geojson: POINT_GEOJSON,
      atlas_coverage_status: 'base',
      baseMapMode: 'streets',
    })

    expect(preview.place_labels_color).toBe('#31442D')
    expect(preview.poi_labels_color).toBe('#31442D')
    expect(preview.atlas_layer_settings?.place?.label_color).toBe('#31442D')
    expect(preview.show_place_labels).toBe(false)
  })
})
