import type { ColorTheme, CompositionId, StyleConfig } from '~/types'
import { getThemeDefinition } from '~/utils/themes/refined'

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
  headerPadding: 'calc(4.6cqh + var(--print-bleed, 0px)) calc(6cqw + var(--print-bleed, 0px)) 2.4cqh',
  footerPadding: '1.6cqh calc(6cqw + var(--print-bleed, 0px)) calc(1.8cqh + var(--print-bleed, 0px))',
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
    headerPadding: 'calc(6.1cqh + var(--print-bleed, 0px)) calc(6.8cqw + var(--print-bleed, 0px)) 3.1cqh',
    footerPadding: '1.9cqh calc(6.8cqw + var(--print-bleed, 0px)) calc(2.1cqh + var(--print-bleed, 0px))',
    statsEmphasis: 'quiet',
  },
  'park-quad': {
    id: 'park-quad',
    label: 'Park Quad',
    audience: 'National Park / tourist',
    ...STANDARD_TOP,
    ...BASE_PROFILE,
    mapMargin: '0 4.25cqw',
    mapBorder: '1.5px solid color-mix(in srgb, currentColor 32%, transparent)',
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
    headerPadding: '2.35cqh calc(4.8cqw + var(--print-bleed, 0px)) calc(2.75cqh + var(--print-bleed, 0px))',
    headerBackground: 'paper',
    footerVariant: 'hidden',
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
    headerPadding: '2.3cqh calc(4.8cqw + var(--print-bleed, 0px)) calc(3cqh + var(--print-bleed, 0px))',
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
    headerPadding: '1.65cqh calc(5.2cqw + var(--print-bleed, 0px)) 1.25cqh',
    footerPadding: '1.2cqh calc(5.2cqw + var(--print-bleed, 0px)) calc(1.65cqh + var(--print-bleed, 0px))',
    mapMargin: 'calc(6.65cqh + var(--print-bleed, 0px)) 5.2cqw 0',
    mapBorder: '1px solid color-mix(in srgb, currentColor 45%, transparent)',
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
    headerPadding: 'calc(5.4cqh + var(--print-bleed, 0px)) calc(7cqw + var(--print-bleed, 0px)) 2.1cqh',
    mapMargin: '0 4.75cqw',
    mapBorder: '1px solid color-mix(in srgb, currentColor 24%, transparent)',
    showPaperTexture: true,
    showSideRail: false,
  },
  'modernist-block': {
    id: 'modernist-block',
    label: 'Modernist',
    audience: 'Designer / collector',
    ...STANDARD_BOTTOM,
    ...BASE_PROFILE,
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
    ...STANDARD_TOP,
    titleAlign: 'left',
    ...BASE_PROFILE,
    headerPadding: 'calc(3.9cqh + var(--print-bleed, 0px)) calc(4.35cqw + var(--print-bleed, 0px)) 1.7cqh',
    footerPadding: '2.2cqh calc(4.35cqw + var(--print-bleed, 0px)) calc(2.4cqh + var(--print-bleed, 0px))',
    footerVariant: 'data',
    statsEmphasis: 'numeric',
    showGridOverlay: true,
  },
  'bib-numerals': {
    id: 'bib-numerals',
    label: 'Race Bib',
    audience: 'Marathon / event',
    ...STANDARD_TOP,
    ...BASE_PROFILE,
    headerPadding: 'calc(4.2cqh + var(--print-bleed, 0px)) calc(6.2cqw + var(--print-bleed, 0px)) 2.1cqh',
    footerPadding: '2.2cqh calc(6.2cqw + var(--print-bleed, 0px)) calc(2.6cqh + var(--print-bleed, 0px))',
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
    headerPadding: '2.5cqh calc(5.4cqw + var(--print-bleed, 0px)) calc(3.5cqh + var(--print-bleed, 0px))',
    footerVariant: 'compact',
    showStarField: true,
  },
  'botanical-plate': {
    id: 'botanical-plate',
    label: 'Botanical',
    audience: 'Garden / landscape',
    ...STANDARD_TOP,
    ...BASE_PROFILE,
    mapMargin: '0 4.4cqw',
    mapBorder: '1px solid color-mix(in srgb, currentColor 22%, transparent)',
    showPaperTexture: true,
  },
  'brutalist-slab': {
    id: 'brutalist-slab',
    label: 'Brutalist',
    audience: 'Urban runner / cyclist',
    ...STANDARD_TOP,
    titleAlign: 'left',
    ...BASE_PROFILE,
    headerPadding: 'calc(4.6cqh + var(--print-bleed, 0px)) calc(6.7cqw + var(--print-bleed, 0px)) 2.3cqh',
    footerPadding: '1.8cqh calc(6.7cqw + var(--print-bleed, 0px)) calc(2.4cqh + var(--print-bleed, 0px))',
    mapMargin: '0 6.7cqw',
    mapBorder: '3px solid currentColor',
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
    headerPadding: '1.6cqh calc(6.8cqw + var(--print-bleed, 0px)) calc(2.1cqh + var(--print-bleed, 0px))',
    footerPadding: '1.1cqh calc(6.8cqw + var(--print-bleed, 0px)) calc(1.3cqh + var(--print-bleed, 0px))',
    headerBackground: 'paper',
    mapMargin: '0',
    mapBorder: '0 solid transparent',
    footerVariant: 'data',
    statsEmphasis: 'numeric',
    showGridOverlay: false,
  },
}

export function resolvePosterCompositionId(styleConfig: Pick<StyleConfig, 'composition' | 'color_theme'>): PosterCompositionId {
  if (styleConfig.composition && POSTER_COMPOSITIONS[styleConfig.composition]) {
    return styleConfig.composition
  }
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
