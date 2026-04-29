/**
 * Shared poster typography and layout data.
 * Single source of truth for both MapPreview.vue (browser) and render-worker/index.js (Node).
 *
 * Sizes are stored as plain numbers — consumers append the appropriate CSS unit:
 *   Browser (MapPreview.vue):  `${profile.titleSize}cqh`
 *   Render worker:             `${profile.titleSize}vh`
 */

import type { StyleConfig } from '~/types'

// ── Interfaces ────────────────────────────────────────────────────────────────

export interface PosterTypographyProfile {
  titleFont: string       // full font stack, e.g. "'Work Sans', sans-serif"
  titleWeight: string
  titleTracking: string
  titleCase: string       // 'uppercase' | 'none'
  titleSize: number       // unit-less (append 'cqh' or 'vh')
  titleLineHeight: string
  subFont: string
  subWeight: string
  subTracking: string
  subSize: number         // unit-less
  statsFont: string
  statsWeight: string
}

export interface PosterLayoutProfile {
  titleAlign: 'center' | 'left'
  titlePosition: 'top' | 'bottom'
}

// ── Font helpers ──────────────────────────────────────────────────────────────

export const SERIF_FONTS = new Set([
  'Playfair Display',
  'Cormorant Garamond',
  'Libre Baskerville',
  'DM Serif Display',
])

export function toFontStack(family: string): string {
  return `'${family}', ${SERIF_FONTS.has(family) ? 'serif' : 'sans-serif'}`
}

// ── Typography table ──────────────────────────────────────────────────────────

const THEME_TYPOGRAPHY: Record<string, PosterTypographyProfile> = {
  // ── Family A ──────────────────────────────────────────────────────────────
  chalk: {
    titleFont: "'Work Sans', sans-serif",
    titleWeight: '300',
    titleTracking: '0.38em',
    titleCase: 'uppercase',
    titleSize: 3.4,
    titleLineHeight: '1.15',
    subFont: "'Work Sans', sans-serif",
    subWeight: '400',
    subTracking: '0.28em',
    subSize: 1.0,
    statsFont: "'Work Sans', sans-serif",
    statsWeight: '500',
  },
  topaz: {
    titleFont: "'Space Grotesk', sans-serif",
    titleWeight: '700',
    titleTracking: '0.06em',
    titleCase: 'uppercase',
    titleSize: 4.4,
    titleLineHeight: '1.05',
    subFont: "'Space Grotesk', sans-serif",
    subWeight: '400',
    subTracking: '0.22em',
    subSize: 1.05,
    statsFont: "'Space Grotesk', sans-serif",
    statsWeight: '600',
  },
  dusk: {
    titleFont: "'DM Serif Display', serif",
    titleWeight: '400',
    titleTracking: '0.03em',
    titleCase: 'none',
    titleSize: 4.8,
    titleLineHeight: '1.1',
    subFont: "'DM Sans', sans-serif",
    subWeight: '400',
    subTracking: '0.22em',
    subSize: 1.0,
    statsFont: "'DM Sans', sans-serif",
    statsWeight: '500',
  },
  obsidian: {
    titleFont: "'Big Shoulders Display', sans-serif",
    titleWeight: '800',
    titleTracking: '-0.01em',
    titleCase: 'uppercase',
    titleSize: 5.8,
    titleLineHeight: '0.95',
    subFont: "'DM Sans', sans-serif",
    subWeight: '400',
    subTracking: '0.35em',
    subSize: 1.0,
    statsFont: "'Big Shoulders Display', sans-serif",
    statsWeight: '700',
  },
  forest: {
    titleFont: "'Oswald', sans-serif",
    titleWeight: '600',
    titleTracking: '0.08em',
    titleCase: 'uppercase',
    titleSize: 4.6,
    titleLineHeight: '1.05',
    subFont: "'Oswald', sans-serif",
    subWeight: '300',
    subTracking: '0.22em',
    subSize: 1.0,
    statsFont: "'Oswald', sans-serif",
    statsWeight: '500',
  },
  midnight: {
    titleFont: "'Fjalla One', sans-serif",
    titleWeight: '400',
    titleTracking: '0.12em',
    titleCase: 'uppercase',
    titleSize: 4.8,
    titleLineHeight: '1.05',
    subFont: "'DM Sans', sans-serif",
    subWeight: '300',
    subTracking: '0.32em',
    subSize: 1.0,
    statsFont: "'Fjalla One', sans-serif",
    statsWeight: '400',
  },
  // ── Family B ──────────────────────────────────────────────────────────────
  editorial: {
    titleFont: "'Playfair Display', serif",
    titleWeight: '400',
    titleTracking: '0.02em',
    titleCase: 'none',
    titleSize: 5.0,
    titleLineHeight: '1.1',
    subFont: "'Playfair Display', serif",
    subWeight: '400',
    subTracking: '0.18em',
    subSize: 1.0,
    statsFont: "'Libre Baskerville', serif",
    statsWeight: '400',
  },
  bauhaus: {
    titleFont: "'Big Shoulders Display', sans-serif",
    titleWeight: '900',
    titleTracking: '-0.02em',
    titleCase: 'uppercase',
    titleSize: 6.8,
    titleLineHeight: '0.9',
    subFont: "'DM Sans', sans-serif",
    subWeight: '400',
    subTracking: '0.28em',
    subSize: 0.95,
    statsFont: "'Big Shoulders Display', sans-serif",
    statsWeight: '700',
  },
  vintage: {
    titleFont: "'DM Serif Display', serif",
    titleWeight: '400',
    titleTracking: '0.04em',
    titleCase: 'none',
    titleSize: 5.2,
    titleLineHeight: '1.08',
    subFont: "'DM Serif Display', serif",
    subWeight: '400',
    subTracking: '0.22em',
    subSize: 1.0,
    statsFont: "'DM Sans', sans-serif",
    statsWeight: '400',
  },
  brutalist: {
    titleFont: "'Bebas Neue', sans-serif",
    titleWeight: '400',
    titleTracking: '0.07em',
    titleCase: 'uppercase',
    titleSize: 7.2,
    titleLineHeight: '0.92',
    subFont: "'DM Sans', sans-serif",
    subWeight: '700',
    subTracking: '0.35em',
    subSize: 0.9,
    statsFont: "'Bebas Neue', sans-serif",
    statsWeight: '400',
  },
  risograph: {
    titleFont: "'Oswald', sans-serif",
    titleWeight: '500',
    titleTracking: '0.10em',
    titleCase: 'uppercase',
    titleSize: 5.0,
    titleLineHeight: '1.0',
    subFont: "'Oswald', sans-serif",
    subWeight: '300',
    subTracking: '0.25em',
    subSize: 1.0,
    statsFont: "'Work Sans', sans-serif",
    statsWeight: '500',
  },
  blueprint: {
    titleFont: "'Space Grotesk', sans-serif",
    titleWeight: '700',
    titleTracking: '0.14em',
    titleCase: 'uppercase',
    titleSize: 4.2,
    titleLineHeight: '1.05',
    subFont: "'Space Grotesk', sans-serif",
    subWeight: '400',
    subTracking: '0.28em',
    subSize: 0.9,
    statsFont: "'Space Grotesk', sans-serif",
    statsWeight: '600',
  },
  kertok: {
    titleFont: "'Work Sans', sans-serif",
    titleWeight: '200',
    titleTracking: '0.06em',
    titleCase: 'none',
    titleSize: 4.6,
    titleLineHeight: '1.12',
    subFont: "'Work Sans', sans-serif",
    subWeight: '300',
    subTracking: '0.20em',
    subSize: 0.95,
    statsFont: "'Work Sans', sans-serif",
    statsWeight: '300',
  },
  'mid-century': {
    titleFont: "'Oswald', sans-serif",
    titleWeight: '400',
    titleTracking: '0.16em',
    titleCase: 'uppercase',
    titleSize: 4.4,
    titleLineHeight: '1.05',
    subFont: "'Work Sans', sans-serif",
    subWeight: '400',
    subTracking: '0.30em',
    subSize: 0.95,
    statsFont: "'Oswald', sans-serif",
    statsWeight: '400',
  },
  'topo-art': {
    titleFont: "'Work Sans', sans-serif",
    titleWeight: '400',
    titleTracking: '0.28em',
    titleCase: 'uppercase',
    titleSize: 3.6,
    titleLineHeight: '1.15',
    subFont: "'Work Sans', sans-serif",
    subWeight: '300',
    subTracking: '0.22em',
    subSize: 0.95,
    statsFont: "'Work Sans', sans-serif",
    statsWeight: '400',
  },
  'dark-sky': {
    titleFont: "'Fjalla One', sans-serif",
    titleWeight: '400',
    titleTracking: '0.08em',
    titleCase: 'uppercase',
    titleSize: 5.4,
    titleLineHeight: '1.0',
    subFont: "'DM Sans', sans-serif",
    subWeight: '300',
    subTracking: '0.35em',
    subSize: 1.0,
    statsFont: "'Fjalla One', sans-serif",
    statsWeight: '400',
  },
}

// ── Layout table ──────────────────────────────────────────────────────────────

const THEME_LAYOUT: Record<string, PosterLayoutProfile> = {
  // Family A — classic centered top
  chalk:         { titleAlign: 'center', titlePosition: 'top' },
  topaz:         { titleAlign: 'center', titlePosition: 'top' },
  dusk:          { titleAlign: 'center', titlePosition: 'top' },
  obsidian:      { titleAlign: 'center', titlePosition: 'top' },
  forest:        { titleAlign: 'center', titlePosition: 'top' },
  midnight:      { titleAlign: 'center', titlePosition: 'top' },
  // Family B — varied layouts
  editorial:     { titleAlign: 'left',   titlePosition: 'top' },
  bauhaus:       { titleAlign: 'left',   titlePosition: 'bottom' },
  vintage:       { titleAlign: 'center', titlePosition: 'top' },
  brutalist:     { titleAlign: 'left',   titlePosition: 'bottom' },
  risograph:     { titleAlign: 'left',   titlePosition: 'top' },
  blueprint:     { titleAlign: 'left',   titlePosition: 'bottom' },
  kertok:        { titleAlign: 'left',   titlePosition: 'top' },
  'mid-century': { titleAlign: 'center', titlePosition: 'bottom' },
  'topo-art':    { titleAlign: 'center', titlePosition: 'top' },
  'dark-sky':    { titleAlign: 'center', titlePosition: 'bottom' },
}

// ── Public API ────────────────────────────────────────────────────────────────

export function getPosterTypography(
  styleConfig: Pick<StyleConfig, 'color_theme' | 'font_family' | 'body_font_family'>,
): PosterTypographyProfile {
  const base = THEME_TYPOGRAPHY[styleConfig.color_theme ?? 'chalk'] ?? THEME_TYPOGRAPHY.chalk
  const titleOverride = styleConfig.font_family
  if (titleOverride) {
    const bodyOverride = styleConfig.body_font_family ?? titleOverride
    return {
      ...base,
      titleFont: toFontStack(titleOverride as string),
      subFont: toFontStack(bodyOverride as string),
      statsFont: toFontStack(bodyOverride as string),
    }
  }
  return base
}

export function getPosterLayout(
  styleConfig: Pick<StyleConfig, 'color_theme'>,
): PosterLayoutProfile {
  return THEME_LAYOUT[styleConfig.color_theme ?? 'chalk'] ?? THEME_LAYOUT.chalk
}
