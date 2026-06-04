import type { ColorTheme, RouteStats, StyleConfig, ThemeDefinition } from '~/types'
import { COLOR_THEMES } from '~/types'
import { getPosterCompositionProfile, POSTER_COMPOSITIONS } from '~/utils/posterCompositions'
import { applyThemeToStyleConfig } from '~/utils/themeApplication'
import { REFINED_THEMES } from '~/utils/themes/refined'

export type ThemeThumbProfile = {
  titlePosition: 'top' | 'bottom'
  titleAlign: 'center' | 'left'
  fontWeight: string
  fontSize: string
  letterSpacing: string
  textTransform: string
  lineHeight: string
  headerBackground?: 'paper' | 'label'
  footerBackground?: 'paper' | 'label'
}

const THEME_THUMB: Record<string, ThemeThumbProfile> = {
  chalk:           { titlePosition: 'top',    titleAlign: 'center', fontWeight: '300', fontSize: '5.5px', letterSpacing: '0.32em', textTransform: 'uppercase', lineHeight: '1.2'  },
  topaz:           { titlePosition: 'top',    titleAlign: 'center', fontWeight: '700', fontSize: '7.5px', letterSpacing: '0.06em', textTransform: 'uppercase', lineHeight: '1.05' },
  dusk:            { titlePosition: 'top',    titleAlign: 'center', fontWeight: '400', fontSize: '7.5px', letterSpacing: '0.03em', textTransform: 'none',      lineHeight: '1.1'  },
  obsidian:        { titlePosition: 'top',    titleAlign: 'center', fontWeight: '800', fontSize: '9px',   letterSpacing: '0',       textTransform: 'uppercase', lineHeight: '0.95' },
  forest:          { titlePosition: 'top',    titleAlign: 'center', fontWeight: '600', fontSize: '7.5px', letterSpacing: '0.08em', textTransform: 'uppercase', lineHeight: '1.05' },
  midnight:        { titlePosition: 'top',    titleAlign: 'center', fontWeight: '400', fontSize: '7px',   letterSpacing: '0.12em', textTransform: 'uppercase', lineHeight: '1.05' },
  editorial:       { titlePosition: 'top',    titleAlign: 'left',   fontWeight: '400', fontSize: '7.5px', letterSpacing: '0.02em', textTransform: 'none',      lineHeight: '1.1'  },
  bauhaus:         { titlePosition: 'bottom', titleAlign: 'left',   fontWeight: '900', fontSize: '9.5px', letterSpacing: '0',       textTransform: 'uppercase', lineHeight: '0.9'  },
  vintage:         { titlePosition: 'top',    titleAlign: 'center', fontWeight: '400', fontSize: '8px',   letterSpacing: '0.04em', textTransform: 'none',      lineHeight: '1.08' },
  brutalist:       { titlePosition: 'bottom', titleAlign: 'left',   fontWeight: '400', fontSize: '9.5px', letterSpacing: '0.07em', textTransform: 'uppercase', lineHeight: '0.92' },
  risograph:       { titlePosition: 'top',    titleAlign: 'left',   fontWeight: '500', fontSize: '7px',   letterSpacing: '0.10em', textTransform: 'uppercase', lineHeight: '1.0'  },
  blueprint:       { titlePosition: 'bottom', titleAlign: 'left',   fontWeight: '700', fontSize: '6px',   letterSpacing: '0.14em', textTransform: 'uppercase', lineHeight: '1.05' },
  kertok:          { titlePosition: 'top',    titleAlign: 'left',   fontWeight: '200', fontSize: '7px',   letterSpacing: '0.06em', textTransform: 'none',      lineHeight: '1.12' },
  'mid-century':   { titlePosition: 'bottom', titleAlign: 'center', fontWeight: '400', fontSize: '6px',   letterSpacing: '0.16em', textTransform: 'uppercase', lineHeight: '1.05' },
  'topo-art':      { titlePosition: 'top',    titleAlign: 'center', fontWeight: '400', fontSize: '5.5px', letterSpacing: '0.28em', textTransform: 'uppercase', lineHeight: '1.15' },
  'dark-sky':      { titlePosition: 'bottom', titleAlign: 'center', fontWeight: '400', fontSize: '8px',   letterSpacing: '0.08em', textTransform: 'uppercase', lineHeight: '1.0'  },
  'classic-trail': { titlePosition: 'top',    titleAlign: 'left',   fontWeight: '400', fontSize: '7.5px', letterSpacing: '0.015em', textTransform: 'none',      lineHeight: '0.98' },
  'ranch-ochre':   { titlePosition: 'top',    titleAlign: 'center', fontWeight: '600', fontSize: '8px',   letterSpacing: '0.04em',  textTransform: 'uppercase', lineHeight: '0.95' },
  blackline:       { titlePosition: 'top',    titleAlign: 'left',   fontWeight: '900', fontSize: '9px',   letterSpacing: '0',       textTransform: 'uppercase', lineHeight: '0.86' },
  'copper-night':  { titlePosition: 'bottom', titleAlign: 'center', fontWeight: '400', fontSize: '7.5px', letterSpacing: '0.06em',  textTransform: 'uppercase', lineHeight: '0.98' },
  moonstone:       { titlePosition: 'bottom', titleAlign: 'left',   fontWeight: '700', fontSize: '6px',   letterSpacing: '0.08em',  textTransform: 'uppercase', lineHeight: '1.02' },
  'night-ride':    { titlePosition: 'top',    titleAlign: 'left',   fontWeight: '800', fontSize: '7px',   letterSpacing: '0.04em',  textTransform: 'uppercase', lineHeight: '0.96' },
  'daybreak-trace': { titlePosition: 'top',   titleAlign: 'center', fontWeight: '400', fontSize: '8px',   letterSpacing: '0.01em',  textTransform: 'none',      lineHeight: '0.98' },
  'electric-atlas': { titlePosition: 'bottom', titleAlign: 'left',  fontWeight: '800', fontSize: '6px',   letterSpacing: '0.04em',  textTransform: 'uppercase', lineHeight: '0.98' },
}

const DEFAULT_THEME_THUMB: ThemeThumbProfile = {
  titlePosition: 'top',
  titleAlign: 'center',
  fontWeight: '700',
  fontSize: '7px',
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  lineHeight: '1.1',
}

export const THEME_FONT_PREVIEW: Record<string, string> = {
  chalk:       "'Work Sans', sans-serif",
  topaz:       "'Space Grotesk', sans-serif",
  dusk:        "'DM Serif Display', serif",
  obsidian:    "'Big Shoulders Display', sans-serif",
  forest:      "'Oswald', sans-serif",
  midnight:    "'Fjalla One', sans-serif",
  editorial:   "'Playfair Display', serif",
  bauhaus:     "'Big Shoulders Display', sans-serif",
  vintage:     "'DM Serif Display', serif",
  brutalist:   "'Bebas Neue', sans-serif",
  risograph:   "'Oswald', sans-serif",
  blueprint:   "'Space Grotesk', sans-serif",
  kertok:      "'Work Sans', sans-serif",
  'mid-century': "'Oswald', sans-serif",
  'topo-art':  "'Work Sans', sans-serif",
  'dark-sky':  "'Fjalla One', sans-serif",
  'classic-trail': "'DM Serif Display', serif",
  'ranch-ochre': "'Oswald', sans-serif",
  blackline: "'Big Shoulders Display', sans-serif",
  'copper-night': "'Fjalla One', sans-serif",
  moonstone: "'Space Grotesk', sans-serif",
  'night-ride': "'Space Grotesk', sans-serif",
  'daybreak-trace': "'DM Serif Display', serif",
  'electric-atlas': "'Space Grotesk', sans-serif",
}

export const THEME_FONT_NAME: Record<string, string> = {
  chalk:       'Work Sans Light',
  topaz:       'Space Grotesk Bold',
  dusk:        'DM Serif Display',
  obsidian:    'Big Shoulders Display',
  forest:      'Oswald SemiBold',
  midnight:    'Fjalla One',
  editorial:   'Playfair Display',
  bauhaus:     'Big Shoulders Display',
  vintage:     'DM Serif Display',
  brutalist:   'Bebas Neue',
  risograph:   'Oswald',
  blueprint:   'Space Grotesk',
  kertok:      'Work Sans',
  'mid-century': 'Oswald',
  'topo-art':  'Work Sans',
  'dark-sky':  'Fjalla One',
  'classic-trail': 'DM Serif Display',
  'ranch-ochre': 'Oswald',
  blackline: 'Big Shoulders Display',
  'copper-night': 'Fjalla One',
  moonstone: 'Space Grotesk',
  'night-ride': 'Space Grotesk',
  'daybreak-trace': 'DM Serif Display',
  'electric-atlas': 'Space Grotesk',
}

export const QUICK_THEME_OPTIONS: ThemeDefinition[] = [
  ...REFINED_THEMES,
  ...COLOR_THEMES.filter(theme => !theme.legacy && !REFINED_THEMES.some(refined => refined.id === theme.id)),
]

export const CLASSIC_THEME_OPTIONS: ThemeDefinition[] = COLOR_THEMES

export function getThemeThumbnailProfile(theme: ThemeDefinition, classic = false): ThemeThumbProfile {
  const composition = classic
    ? POSTER_COMPOSITIONS['legacy-classic']
    : getPosterCompositionProfile({
        color_theme: theme.id,
        composition: theme.composition,
      })
  const base = THEME_THUMB[theme.id] ?? DEFAULT_THEME_THUMB
  return {
    ...base,
    titlePosition: composition.titlePosition,
    titleAlign: composition.titleAlign,
    fontWeight: theme.id === 'brutalist' || theme.id === 'marathon-bib' ? '900' : base.fontWeight,
    fontSize: theme.id === 'brutalist' || theme.id === 'bold-modern' ? '8px' : base.fontSize,
    letterSpacing: theme.id === 'editorial-minimal' ? '0.02em' : base.letterSpacing,
    textTransform: theme.id === 'editorial-minimal' ? 'none' : base.textTransform,
    headerBackground: composition.headerBackground,
    footerBackground: 'label',
  }
}

export function getThemeFontPreview(theme: ThemeDefinition): string {
  return THEME_FONT_PREVIEW[theme.id] ?? (theme.font_family ? `'${theme.font_family}', sans-serif` : 'system-ui')
}

export function getThemeFontName(themeId: ColorTheme | string, theme?: ThemeDefinition): string {
  return THEME_FONT_NAME[themeId] ?? theme?.font_family ?? 'Work Sans'
}

type ThemeContext = {
  stats?: Partial<RouteStats> | null
  geojson?: GeoJSON.FeatureCollection | null
}

const PLACE_THEME_PRIORITY: ColorTheme[] = ['editorial-minimal', 'usgs-vintage', 'risograph']

export function deriveThemePreviewConfig(baseConfig: StyleConfig, theme: ThemeDefinition, context: ThemeContext = {}): StyleConfig {
  const base = JSON.parse(JSON.stringify(baseConfig)) as StyleConfig
  const themed = applyThemeToStyleConfig(base, theme)
  return isPlaceLikeContext(context) ? mapRichPlaceConfig(themed) : themed
}

export function priorityThemeIdsForMap(stats?: Partial<RouteStats> | null, geojson?: GeoJSON.FeatureCollection | null): ColorTheme[] {
  if (isPlaceLikeContext({ stats, geojson })) {
    return PLACE_THEME_PRIORITY
  }

  const activity = String(stats?.activity_type ?? '').toLowerCase()
  const elevationGain = stats?.elevation_gain_m ?? 0
  const distanceKm = stats?.distance_km ?? 0

  if (elevationGain >= 900 || activity.match(/hike|trail|mountain|alpine/)) {
    return ['usgs-vintage', 'field-journal', 'contour-wash']
  }

  if (activity.match(/run|ride|cycling|bike|virtualride|walk|strava/) || distanceKm >= 30) {
    return ['splits-stats', 'blueprint-strava', 'marathon-bib']
  }

  return ['editorial-minimal', 'midcentury-travel', 'bold-modern']
}

export function orderedQuickThemeOptionsForRoute(stats?: Partial<RouteStats> | null, geojson?: GeoJSON.FeatureCollection | null): ThemeDefinition[] {
  const priority = new Set(priorityThemeIdsForMap(stats, geojson))
  return [
    ...QUICK_THEME_OPTIONS.filter(theme => priority.has(theme.id)),
    ...QUICK_THEME_OPTIONS.filter(theme => !priority.has(theme.id)),
  ]
}

function isPlaceLikeContext(context: ThemeContext): boolean {
  const distanceKm = context.stats?.distance_km ?? 0
  const activity = String(context.stats?.activity_type ?? '').toLowerCase()
  return distanceKm <= 0 && !activity && !hasRenderableLine(context.geojson)
}

function hasRenderableLine(geojson?: GeoJSON.FeatureCollection | null): boolean {
  for (const feature of geojson?.features ?? []) {
    const geometry = feature.geometry
    if (geometry.type === 'LineString' && geometry.coordinates.length > 1) return true
    if (geometry.type === 'MultiLineString' && geometry.coordinates.some(line => line.length > 1)) return true
  }
  return false
}

function mapRichPlaceConfig(config: StyleConfig): StyleConfig {
  const showContours = config.show_contours !== false
  const roadOpacity = config.dark ? 0.48 : 0.42
  const roadColor = config.roads_color ?? config.contour_major_color ?? (config.dark ? '#7CB0E8' : '#9A8062')
  const minorRoadColor = config.atlas_layer_settings?.transportation?.minor_color ?? config.contour_color ?? roadColor
  const trailColor = config.atlas_layer_settings?.transportation?.trail_color ?? config.label_text_color ?? roadColor
  const placeLabelOpacity = config.dark ? 0.68 : 0.64
  const poiLabelOpacity = config.dark ? 0.38 : 0.34

  return {
    ...config,
    show_roads: true,
    roads_color: roadColor,
    roads_opacity: roadOpacity,
    show_place_labels: true,
    place_labels_opacity: placeLabelOpacity,
    place_labels_scale: config.place_labels_scale ?? 'village',
    show_poi_labels: true,
    poi_labels_opacity: poiLabelOpacity,
    atlas_layers: {
      ...config.atlas_layers,
      contour: showContours,
      water: true,
      waterway: true,
      park: true,
      landcover: true,
      transportation: true,
      building: true,
      place: true,
      poi: true,
    },
    atlas_layer_settings: {
      ...config.atlas_layer_settings,
      transportation: {
        ...config.atlas_layer_settings?.transportation,
        density: 'detailed',
        opacity: roadOpacity,
        major_color: config.atlas_layer_settings?.transportation?.major_color ?? roadColor,
        minor_color: minorRoadColor,
        trail_color: trailColor,
        major_width: config.atlas_layer_settings?.transportation?.major_width ?? 1.65,
        minor_width: config.atlas_layer_settings?.transportation?.minor_width ?? 0.72,
        trail_width: config.atlas_layer_settings?.transportation?.trail_width ?? 0.7,
        show_major: true,
        show_minor: true,
        show_trails: true,
      },
      place: {
        ...config.atlas_layer_settings?.place,
        label_opacity: placeLabelOpacity,
        font_size: Math.max(config.atlas_layer_settings?.place?.font_size ?? 0, 15),
      },
      poi: {
        ...config.atlas_layer_settings?.poi,
        labels: true,
        label_opacity: poiLabelOpacity,
      },
    },
  }
}
