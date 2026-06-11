import type { ColorTheme, CompositionId, StyleConfig } from '~/types'
import { getThemeDefinition } from '~/utils/themes/refined'
import {
  POSTER_EDGE_MARGINS,
  RULE_INK,
  RULE_WEIGHTS,
  bottomBandPadding,
  inkRule,
  innerBandPadding,
  topBandPadding,
} from '~/utils/themes/posterTokens'

export type PosterCompositionId = CompositionId | 'legacy-classic'

export interface PosterCompositionProfile {
  id: PosterCompositionId
  label: string
  audience: string
  titleAlign: 'center' | 'left'
  titlePosition: 'top' | 'bottom'
  headerOrder: number
  mapOrder: number
  footerOrder: number
  headerPadding: string
  footerPadding: string
  headerBackground: 'paper' | 'label'
  mapMargin: string
  mapBorder: string
  mapShadow: string
  footerVariant: 'standard' | 'compact' | 'data' | 'bib' | 'hidden'
  statsEmphasis: 'standard' | 'quiet' | 'large' | 'numeric'
  showGridOverlay: boolean
  showStarField: boolean
  showPaperTexture: boolean
  showSideRail: boolean
}

export const COMPOSITION_OPTIONS: Array<{ id: CompositionId; label: string; audience: string }> = [
  { id: 'editorial-tall', label: 'Editorial', audience: 'Gallery / collector' },
  { id: 'park-quad', label: 'Park Quad', audience: 'National Park / tourist' },
  { id: 'travel-banner', label: 'Travel Banner', audience: 'National Park / tourist' },
  { id: 'riso-stack', label: 'Riso Stack', audience: 'Trail marketing / merch' },
  { id: 'blueprint-grid', label: 'Blueprint Grid', audience: 'Engineer / surveyor' },
  { id: 'blueprint-strava', label: 'Blueprint Data', audience: 'Strava ride / data import' },
  { id: 'journal-spread', label: 'Journal', audience: 'Hiker / traveler' },
  { id: 'modernist-block', label: 'Modernist', audience: 'Designer / collector' },
  { id: 'splits-grid', label: 'Splits', audience: 'Runner / cyclist' },
  { id: 'bib-numerals', label: 'Race Bib', audience: 'Marathon / event' },
  { id: 'darksky-stars', label: 'Dark Sky', audience: 'Backcountry / dark sky park' },
  { id: 'botanical-plate', label: 'Botanical', audience: 'Garden / landscape' },
  { id: 'brutalist-slab', label: 'Brutalist', audience: 'Urban runner / cyclist' },
  { id: 'art-wash', label: 'Art Wash', audience: 'Soft art print / keepsake' },
  { id: 'place-frame', label: 'Cartouche', audience: 'Place portrait / no-route map' },
  { id: 'sea-chart', label: 'Sea Chart', audience: 'Waterfront / coastal route' },
  { id: 'transit-diagram', label: 'Transit', audience: 'Tour / stops itinerary' },
]

const STANDARD_TOP = {
  titleAlign: 'center',
  titlePosition: 'top',
  headerOrder: 0,
  mapOrder: 1,
  footerOrder: 2,
} as const

const STANDARD_BOTTOM = {
  titleAlign: 'left',
  titlePosition: 'bottom',
  headerOrder: 1,
  mapOrder: 0,
  footerOrder: 2,
} as const

const BASE_PROFILE = {
  headerPadding: topBandPadding(4.6, POSTER_EDGE_MARGINS.standard, 2.4),
  footerPadding: bottomBandPadding(1.6, POSTER_EDGE_MARGINS.standard, 1.8),
  headerBackground: 'paper',
  mapMargin: '0',
  mapBorder: '0 solid transparent',
  mapShadow: 'none',
  footerVariant: 'standard',
  statsEmphasis: 'standard',
  showGridOverlay: false,
  showStarField: false,
  showPaperTexture: false,
  showSideRail: false,
} satisfies Omit<PosterCompositionProfile, 'id' | 'label' | 'audience' | 'titleAlign' | 'titlePosition' | 'headerOrder' | 'mapOrder' | 'footerOrder'>

export const POSTER_COMPOSITIONS: Record<PosterCompositionId, PosterCompositionProfile> = {
  'legacy-classic': {
    id: 'legacy-classic',
    label: 'Classic',
    audience: 'Legacy maps',
    ...STANDARD_TOP,
    ...BASE_PROFILE,
  },
  'editorial-tall': {
    id: 'editorial-tall',
    label: 'Editorial',
    audience: 'Gallery / collector',
    ...STANDARD_TOP,
    titleAlign: 'left',
    ...BASE_PROFILE,
    headerPadding: topBandPadding(6.1, POSTER_EDGE_MARGINS.wide, 3.1),
    footerPadding: bottomBandPadding(1.9, POSTER_EDGE_MARGINS.wide, 2.1),
    statsEmphasis: 'quiet',
  },
  'park-quad': {
    id: 'park-quad',
    label: 'Park Quad',
    audience: 'National Park / tourist',
    ...STANDARD_TOP,
    ...BASE_PROFILE,
    mapMargin: '0 4.25cqw', // bespoke quad inset
    mapBorder: inkRule(RULE_WEIGHTS.fine, RULE_INK.soft),
    showPaperTexture: true,
    showGridOverlay: true,
  },
  'travel-banner': {
    id: 'travel-banner',
    label: 'Travel Banner',
    audience: 'National Park / tourist',
    ...STANDARD_BOTTOM,
    titleAlign: 'center',
    ...BASE_PROFILE,
    headerPadding: bottomBandPadding(2.35, POSTER_EDGE_MARGINS.banner, 2.75),
    headerBackground: 'paper',
    footerVariant: 'data',
    statsEmphasis: 'quiet',
  },
  'riso-stack': {
    id: 'riso-stack',
    label: 'Riso Stack',
    audience: 'Trail marketing / merch',
    ...STANDARD_BOTTOM,
    titleAlign: 'left',
    ...BASE_PROFILE,
    headerPadding: '0',
    footerPadding: '0',
    mapMargin: '0',
    mapBorder: '0',
    mapShadow: 'none',
    showPaperTexture: true,
  },
  'blueprint-grid': {
    id: 'blueprint-grid',
    label: 'Blueprint Grid',
    audience: 'Engineer / surveyor',
    ...STANDARD_BOTTOM,
    ...BASE_PROFILE,
    headerPadding: bottomBandPadding(2.3, POSTER_EDGE_MARGINS.banner, 3),
    footerVariant: 'compact',
    showGridOverlay: true,
  },
  'blueprint-strava': {
    id: 'blueprint-strava',
    label: 'Blueprint Data',
    audience: 'Strava ride / data import',
    ...STANDARD_BOTTOM,
    titleAlign: 'left',
    ...BASE_PROFILE,
    headerPadding: innerBandPadding(1.65, POSTER_EDGE_MARGINS.data, 1.25),
    footerPadding: bottomBandPadding(1.2, POSTER_EDGE_MARGINS.data, 1.65),
    mapMargin: 'calc(6.65cqh + var(--print-bleed, 0px)) 5.2cqw 0', // bespoke over-map data margin
    mapBorder: inkRule(RULE_WEIGHTS.hairline, RULE_INK.strong),
    footerVariant: 'data',
    statsEmphasis: 'numeric',
    showGridOverlay: true,
  },
  'journal-spread': {
    id: 'journal-spread',
    label: 'Journal',
    audience: 'Hiker / traveler',
    ...STANDARD_TOP,
    titleAlign: 'left',
    ...BASE_PROFILE,
    headerPadding: topBandPadding(5.4, 7, 2.1), // bespoke journal gutter
    mapMargin: '0 4.75cqw', // bespoke journal inset
    mapBorder: inkRule(RULE_WEIGHTS.hairline, RULE_INK.faint),
    showPaperTexture: true,
    showSideRail: false,
  },
  'modernist-block': {
    id: 'modernist-block',
    label: 'Modernist',
    audience: 'Designer / collector',
    ...STANDARD_BOTTOM,
    ...BASE_PROFILE,
    // Bespoke 4-edge hero padding: oversized left gutter carries the block.
    headerPadding: '3.2cqh calc(5.5cqw + var(--print-bleed, 0px)) calc(4.25cqh + var(--print-bleed, 0px)) calc(18.9cqw + var(--print-bleed, 0px))',
    headerBackground: 'paper',
    footerVariant: 'hidden',
    footerPadding: '0',
    mapMargin: '0',
    mapBorder: '0 solid transparent',
    statsEmphasis: 'large',
    showSideRail: false,
  },
  'splits-grid': {
    id: 'splits-grid',
    label: 'Splits',
    audience: 'Runner / cyclist',
    ...STANDARD_BOTTOM,
    titleAlign: 'left',
    ...BASE_PROFILE,
    headerPadding: innerBandPadding(1.65, POSTER_EDGE_MARGINS.wide, 1.1),
    footerPadding: bottomBandPadding(1.25, POSTER_EDGE_MARGINS.wide, 1.65),
    footerVariant: 'data',
    statsEmphasis: 'numeric',
    showGridOverlay: true,
  },
  'bib-numerals': {
    id: 'bib-numerals',
    label: 'Race Bib',
    audience: 'Marathon / event',
    ...STANDARD_BOTTOM,
    titleAlign: 'center',
    ...BASE_PROFILE,
    headerPadding: innerBandPadding(2.2, 7.2, 2.4), // bespoke bib gutters
    footerPadding: bottomBandPadding(1.15, 8.8, 2.35),
    footerVariant: 'bib',
    statsEmphasis: 'large',
  },
  'darksky-stars': {
    id: 'darksky-stars',
    label: 'Dark Sky',
    audience: 'Backcountry / dark sky park',
    ...STANDARD_BOTTOM,
    titleAlign: 'center',
    ...BASE_PROFILE,
    headerPadding: bottomBandPadding(2.5, 5.4, 3.5), // bespoke night gutter
    footerVariant: 'compact',
    showStarField: true,
  },
  'botanical-plate': {
    id: 'botanical-plate',
    label: 'Botanical',
    audience: 'Garden / landscape',
    ...STANDARD_BOTTOM,
    titleAlign: 'center',
    ...BASE_PROFILE,
    headerPadding: bottomBandPadding(3.25, 7.6, 3.7), // bespoke plate gutter
    footerPadding: '0',
    mapMargin: 'calc(5.25cqh + var(--print-bleed, 0px)) 6.8cqw 0', // bespoke over-map plate margin
    mapBorder: inkRule(RULE_WEIGHTS.hairline, RULE_INK.whisper),
    footerVariant: 'hidden',
    showPaperTexture: true,
  },
  'brutalist-slab': {
    id: 'brutalist-slab',
    label: 'Brutalist',
    audience: 'Urban runner / cyclist',
    ...STANDARD_TOP,
    titleAlign: 'left',
    ...BASE_PROFILE,
    headerPadding: topBandPadding(4.6, 6.7, 2.3), // bespoke slab gutters
    footerPadding: bottomBandPadding(1.8, 6.7, 2.4),
    mapMargin: '0 6.7cqw',
    mapBorder: `${RULE_WEIGHTS.slab}px solid currentColor`,
    statsEmphasis: 'large',
  },
  'art-wash': {
    id: 'art-wash',
    label: 'Art Wash',
    audience: 'Soft art print / keepsake',
    ...STANDARD_TOP,
    titleAlign: 'center',
    ...BASE_PROFILE,
    headerPadding: '1.4cqh 3.2cqw',
    footerPadding: '0',
    mapMargin: '0',
    mapBorder: '0 solid transparent',
    footerVariant: 'hidden',
    statsEmphasis: 'quiet',
    showPaperTexture: true,
  },
  'place-frame': {
    id: 'place-frame',
    label: 'Cartouche',
    audience: 'Place portrait / no-route map',
    ...STANDARD_TOP,
    ...BASE_PROFILE,
    headerPadding: '2cqh 3cqw',
    footerPadding: '0',
    mapMargin: '0',
    mapBorder: '0 solid transparent',
    footerVariant: 'hidden',
    statsEmphasis: 'quiet',
    showPaperTexture: true,
    showGridOverlay: false,
  },
  'sea-chart': {
    id: 'sea-chart',
    label: 'Sea Chart',
    audience: 'Waterfront / coastal route',
    ...STANDARD_TOP,
    titleAlign: 'left',
    ...BASE_PROFILE,
    headerPadding: '0',
    footerPadding: '0',
    mapMargin: '0',
    mapBorder: '0 solid transparent',
    footerVariant: 'hidden',
    statsEmphasis: 'standard',
    showGridOverlay: false,
    showPaperTexture: true,
  },
  'transit-diagram': {
    id: 'transit-diagram',
    label: 'Transit',
    audience: 'Tour / stops itinerary',
    ...STANDARD_BOTTOM,
    ...BASE_PROFILE,
    headerPadding: bottomBandPadding(1.6, POSTER_EDGE_MARGINS.wide, 2.1),
    footerPadding: bottomBandPadding(1.1, POSTER_EDGE_MARGINS.wide, 1.3),
    headerBackground: 'paper',
    mapMargin: '0',
    mapBorder: '0 solid transparent',
    footerVariant: 'hidden',
    statsEmphasis: 'numeric',
    showGridOverlay: false,
  },
}

export function resolvePosterCompositionId(styleConfig: Pick<StyleConfig, 'composition' | 'color_theme'>): PosterCompositionId {
  if (styleConfig.composition && POSTER_COMPOSITIONS[styleConfig.composition]) {
    return styleConfig.composition
  }
  if (styleConfig.color_theme === 'risograph') return 'legacy-classic'
  const theme = getThemeDefinition(styleConfig.color_theme as ColorTheme)
  if (theme?.composition && POSTER_COMPOSITIONS[theme.composition]) {
    return theme.composition
  }
  return 'legacy-classic'
}

export function getPosterCompositionProfile(styleConfig: Pick<StyleConfig, 'composition' | 'color_theme'>): PosterCompositionProfile {
  return POSTER_COMPOSITIONS[resolvePosterCompositionId(styleConfig)]
}

export function posterCompositionClassName(id: PosterCompositionId): string {
  return `poster-composition--${id.replace(/[^a-z0-9]+/g, '-')}`
}
