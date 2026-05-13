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
  headerPadding: 'calc(5cqh + var(--print-bleed, 0px)) calc(7cqw + var(--print-bleed, 0px)) 2.8cqh',
  footerPadding: '1.8cqh calc(7cqw + var(--print-bleed, 0px)) calc(1.8cqh + var(--print-bleed, 0px))',
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
    headerPadding: 'calc(7cqh + var(--print-bleed, 0px)) calc(8cqw + var(--print-bleed, 0px)) 3.4cqh',
    footerPadding: '2cqh calc(8cqw + var(--print-bleed, 0px)) calc(2.2cqh + var(--print-bleed, 0px))',
    statsEmphasis: 'quiet',
  },
  'park-quad': {
    id: 'park-quad',
    label: 'Park Quad',
    audience: 'National Park / tourist',
    ...STANDARD_TOP,
    ...BASE_PROFILE,
    mapMargin: '0 5cqw',
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
    headerPadding: '3.2cqh calc(6cqw + var(--print-bleed, 0px)) 3.4cqh',
    headerBackground: 'label',
    footerVariant: 'compact',
    statsEmphasis: 'quiet',
  },
  'riso-stack': {
    id: 'riso-stack',
    label: 'Riso Stack',
    audience: 'Trail marketing / merch',
    ...STANDARD_TOP,
    titleAlign: 'left',
    ...BASE_PROFILE,
    headerPadding: 'calc(5.5cqh + var(--print-bleed, 0px)) calc(8cqw + var(--print-bleed, 0px)) 2.4cqh',
    mapMargin: '0 6cqw 1cqh',
    mapBorder: '2px solid currentColor',
    mapShadow: '0.8cqh 0.8cqh 0 color-mix(in srgb, var(--water-color, currentColor) 80%, transparent)',
    showPaperTexture: true,
  },
  'blueprint-grid': {
    id: 'blueprint-grid',
    label: 'Blueprint Grid',
    audience: 'Engineer / surveyor',
    ...STANDARD_BOTTOM,
    ...BASE_PROFILE,
    headerPadding: '2.4cqh calc(6cqw + var(--print-bleed, 0px)) calc(3.2cqh + var(--print-bleed, 0px))',
    footerVariant: 'compact',
    showGridOverlay: true,
  },
  'blueprint-strava': {
    id: 'blueprint-strava',
    label: 'Blueprint Data',
    audience: 'Strava ride / data import',
    ...STANDARD_TOP,
    titleAlign: 'left',
    ...BASE_PROFILE,
    headerPadding: 'calc(3.2cqh + var(--print-bleed, 0px)) calc(5cqw + var(--print-bleed, 0px)) 1.8cqh',
    footerPadding: '1.4cqh calc(5cqw + var(--print-bleed, 0px)) calc(1.8cqh + var(--print-bleed, 0px))',
    mapMargin: '0 4cqw',
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
    headerPadding: 'calc(5.8cqh + var(--print-bleed, 0px)) calc(8cqw + var(--print-bleed, 0px)) 2.2cqh',
    mapMargin: '0 5.5cqw',
    mapBorder: '1px solid color-mix(in srgb, currentColor 24%, transparent)',
    showPaperTexture: true,
    showSideRail: true,
  },
  'modernist-block': {
    id: 'modernist-block',
    label: 'Modernist',
    audience: 'Designer / collector',
    ...STANDARD_BOTTOM,
    ...BASE_PROFILE,
    headerPadding: '3cqh calc(5.5cqw + var(--print-bleed, 0px)) calc(3.4cqh + var(--print-bleed, 0px)) calc(9cqw + var(--print-bleed, 0px))',
    headerBackground: 'label',
    footerPadding: '1.6cqh calc(5.5cqw + var(--print-bleed, 0px)) calc(1.8cqh + var(--print-bleed, 0px)) calc(9cqw + var(--print-bleed, 0px))',
    mapMargin: '0',
    mapBorder: '0 solid transparent',
    statsEmphasis: 'large',
    showSideRail: true,
  },
  'splits-grid': {
    id: 'splits-grid',
    label: 'Splits',
    audience: 'Runner / cyclist',
    ...STANDARD_TOP,
    titleAlign: 'left',
    ...BASE_PROFILE,
    headerPadding: 'calc(4.2cqh + var(--print-bleed, 0px)) calc(5cqw + var(--print-bleed, 0px)) 1.8cqh',
    footerPadding: '2.4cqh calc(5cqw + var(--print-bleed, 0px)) calc(2.6cqh + var(--print-bleed, 0px))',
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
    headerPadding: 'calc(4.5cqh + var(--print-bleed, 0px)) calc(7cqw + var(--print-bleed, 0px)) 2.2cqh',
    footerPadding: '2.4cqh calc(7cqw + var(--print-bleed, 0px)) calc(2.8cqh + var(--print-bleed, 0px))',
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
    headerPadding: '2.6cqh calc(7cqw + var(--print-bleed, 0px)) calc(3.8cqh + var(--print-bleed, 0px))',
    footerVariant: 'compact',
    showStarField: true,
  },
  'botanical-plate': {
    id: 'botanical-plate',
    label: 'Botanical',
    audience: 'Garden / landscape',
    ...STANDARD_TOP,
    ...BASE_PROFILE,
    mapMargin: '0 5cqw',
    mapBorder: '1px solid color-mix(in srgb, currentColor 22%, transparent)',
    showPaperTexture: true,
  },
  'brutalist-slab': {
    id: 'brutalist-slab',
    label: 'Brutalist',
    audience: 'Urban runner / cyclist',
    ...STANDARD_BOTTOM,
    ...BASE_PROFILE,
    headerPadding: '2.4cqh calc(5cqw + var(--print-bleed, 0px)) calc(3.5cqh + var(--print-bleed, 0px))',
    footerPadding: '1.8cqh calc(5cqw + var(--print-bleed, 0px)) calc(2cqh + var(--print-bleed, 0px))',
    mapMargin: '0',
    mapBorder: '0 solid transparent',
    statsEmphasis: 'large',
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
