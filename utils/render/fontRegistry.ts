// utils/render/fontRegistry.ts
//
// Single source of truth for font availability. Editor and worker both
// import this; whichever weights/files are listed here are the ONLY
// fonts the renderer can use, by definition.
//
// Anti-drift contract:
//   FONT_REGISTRY satisfies Record<FontFamily, FontDef>
//
// → adding a value to the FontFamily union (types/index.ts) without
//   adding an entry here = compile error.
// → adding a font here without dropping the .ttf file in fonts/ = CI
//   error from scripts/validate-fonts.ts.
// → changing any TTF byte-content = font_bundle_version hash bumps =
//   chrome cache invalidates (HASH_VERSION.chrome.fontBundle).
//
// Adding a new font: drop file in fonts/, add an entry below, add the
// family to FontFamily union. Three-line PR.

import type { FontFamily } from '~/types'

export interface FontFile {
  /** CSS font-weight value (300, 400, 500, 600, 700, 800). */
  weight: number
  /** Path RELATIVE to the repo root. Both editor and worker resolve
   *  from here so no platform-specific aliasing creeps in. */
  path: string
  /** Optional italic variant. We don't ship italics today. */
  style?: 'normal' | 'italic'
}

export interface FontDef {
  /** CSS font-family name. Must match exactly what posterData.ts emits. */
  family: string
  /** Generic fallback for browsers that haven't loaded the font yet. */
  fallback: 'sans-serif' | 'serif' | 'monospace' | 'display'
  /** All available weight files. */
  files: FontFile[]
}

const FONTS_ROOT = 'fonts'

export const FONT_REGISTRY = {
  // ── Print workhorses — calm, legible, broad weight ranges ────────────────
  'Source Sans 3': {
    family: 'Source Sans 3',
    fallback: 'sans-serif',
    files: [
      { weight: 300, path: `${FONTS_ROOT}/Source_Sans_3.ttf` },
      { weight: 400, path: `${FONTS_ROOT}/Source_Sans_3.ttf` },
      { weight: 500, path: `${FONTS_ROOT}/Source_Sans_3.ttf` },
      { weight: 600, path: `${FONTS_ROOT}/Source_Sans_3.ttf` },
      { weight: 700, path: `${FONTS_ROOT}/Source_Sans_3.ttf` },
      { weight: 800, path: `${FONTS_ROOT}/Source_Sans_3.ttf` },
    ],
  },
  'Source Serif 4': {
    family: 'Source Serif 4',
    fallback: 'serif',
    files: [
      { weight: 300, path: `${FONTS_ROOT}/Source_Serif_4.ttf` },
      { weight: 400, path: `${FONTS_ROOT}/Source_Serif_4.ttf` },
      { weight: 500, path: `${FONTS_ROOT}/Source_Serif_4.ttf` },
      { weight: 600, path: `${FONTS_ROOT}/Source_Serif_4.ttf` },
      { weight: 700, path: `${FONTS_ROOT}/Source_Serif_4.ttf` },
      { weight: 800, path: `${FONTS_ROOT}/Source_Serif_4.ttf` },
    ],
  },
  'IBM Plex Sans': {
    family: 'IBM Plex Sans',
    fallback: 'sans-serif',
    files: [
      { weight: 300, path: `${FONTS_ROOT}/IBM_Plex_Sans.ttf` },
      { weight: 400, path: `${FONTS_ROOT}/IBM_Plex_Sans.ttf` },
      { weight: 500, path: `${FONTS_ROOT}/IBM_Plex_Sans.ttf` },
      { weight: 600, path: `${FONTS_ROOT}/IBM_Plex_Sans.ttf` },
      { weight: 700, path: `${FONTS_ROOT}/IBM_Plex_Sans.ttf` },
      { weight: 800, path: `${FONTS_ROOT}/IBM_Plex_Sans.ttf` },
    ],
  },
  'IBM Plex Mono': {
    family: 'IBM Plex Mono',
    fallback: 'monospace',
    files: [
      { weight: 400, path: `${FONTS_ROOT}/IBM_Plex_Mono.ttf` },
      { weight: 500, path: `${FONTS_ROOT}/IBM_Plex_Mono.ttf` },
      { weight: 600, path: `${FONTS_ROOT}/IBM_Plex_Mono.ttf` },
    ],
  },
  'Atkinson Hyperlegible Next': {
    family: 'Atkinson Hyperlegible Next',
    fallback: 'sans-serif',
    files: [
      { weight: 300, path: `${FONTS_ROOT}/Atkinson_Hyperlegible_Next.ttf` },
      { weight: 400, path: `${FONTS_ROOT}/Atkinson_Hyperlegible_Next.ttf` },
      { weight: 500, path: `${FONTS_ROOT}/Atkinson_Hyperlegible_Next.ttf` },
      { weight: 600, path: `${FONTS_ROOT}/Atkinson_Hyperlegible_Next.ttf` },
      { weight: 700, path: `${FONTS_ROOT}/Atkinson_Hyperlegible_Next.ttf` },
      { weight: 800, path: `${FONTS_ROOT}/Atkinson_Hyperlegible_Next.ttf` },
    ],
  },
  'Newsreader': {
    family: 'Newsreader',
    fallback: 'serif',
    files: [
      { weight: 300, path: `${FONTS_ROOT}/Newsreader.ttf` },
      { weight: 400, path: `${FONTS_ROOT}/Newsreader.ttf` },
      { weight: 500, path: `${FONTS_ROOT}/Newsreader.ttf` },
      { weight: 600, path: `${FONTS_ROOT}/Newsreader.ttf` },
      { weight: 700, path: `${FONTS_ROOT}/Newsreader.ttf` },
      { weight: 800, path: `${FONTS_ROOT}/Newsreader.ttf` },
    ],
  },

  // ── Editorial — condensed, impactful, poster-native ──────────────────────
  'Big Shoulders Display': {
    family: 'Big Shoulders Display',
    fallback: 'sans-serif',
    files: [
      { weight: 300, path: `${FONTS_ROOT}/Big_Shoulders_Display-300.ttf` },
      { weight: 400, path: `${FONTS_ROOT}/Big_Shoulders_Display-400.ttf` },
      { weight: 500, path: `${FONTS_ROOT}/Big_Shoulders_Display-500.ttf` },
      { weight: 700, path: `${FONTS_ROOT}/Big_Shoulders_Display-700.ttf` },
      { weight: 800, path: `${FONTS_ROOT}/Big_Shoulders_Display-800.ttf` },
      { weight: 900, path: `${FONTS_ROOT}/Big_Shoulders_Display-900.ttf` },
    ],
  },
  'Fjalla One': {
    family: 'Fjalla One',
    fallback: 'sans-serif',
    files: [{ weight: 400, path: `${FONTS_ROOT}/Fjalla_One-400.ttf` }],
  },
  'Oswald': {
    family: 'Oswald',
    fallback: 'sans-serif',
    files: [
      { weight: 300, path: `${FONTS_ROOT}/Oswald-300.ttf` },
      { weight: 400, path: `${FONTS_ROOT}/Oswald-400.ttf` },
      { weight: 500, path: `${FONTS_ROOT}/Oswald-500.ttf` },
      { weight: 600, path: `${FONTS_ROOT}/Oswald-600.ttf` },
      { weight: 700, path: `${FONTS_ROOT}/Oswald-700.ttf` },
    ],
  },
  'Bebas Neue': {
    family: 'Bebas Neue',
    fallback: 'sans-serif',
    files: [{ weight: 400, path: `${FONTS_ROOT}/Bebas_Neue-400.ttf` }],
  },

  // ── Modern — clean, contemporary ─────────────────────────────────────────
  'DM Sans': {
    family: 'DM Sans',
    fallback: 'sans-serif',
    files: [
      { weight: 300, path: `${FONTS_ROOT}/DM_Sans-300.ttf` },
      { weight: 400, path: `${FONTS_ROOT}/DM_Sans-400.ttf` },
      { weight: 500, path: `${FONTS_ROOT}/DM_Sans-500.ttf` },
      { weight: 700, path: `${FONTS_ROOT}/DM_Sans-700.ttf` },
    ],
  },
  'Space Grotesk': {
    family: 'Space Grotesk',
    fallback: 'sans-serif',
    files: [
      { weight: 300, path: `${FONTS_ROOT}/Space_Grotesk-300.ttf` },
      { weight: 400, path: `${FONTS_ROOT}/Space_Grotesk-400.ttf` },
      { weight: 500, path: `${FONTS_ROOT}/Space_Grotesk-500.ttf` },
      { weight: 700, path: `${FONTS_ROOT}/Space_Grotesk-700.ttf` },
    ],
  },
  'Outfit': {
    family: 'Outfit',
    fallback: 'sans-serif',
    files: [
      { weight: 300, path: `${FONTS_ROOT}/Outfit-300.ttf` },
      { weight: 400, path: `${FONTS_ROOT}/Outfit-400.ttf` },
      { weight: 500, path: `${FONTS_ROOT}/Outfit-500.ttf` },
      { weight: 700, path: `${FONTS_ROOT}/Outfit-700.ttf` },
    ],
  },
  'Work Sans': {
    family: 'Work Sans',
    fallback: 'sans-serif',
    files: [
      { weight: 300, path: `${FONTS_ROOT}/Work_Sans-300.ttf` },
      { weight: 400, path: `${FONTS_ROOT}/Work_Sans-400.ttf` },
      { weight: 500, path: `${FONTS_ROOT}/Work_Sans-500.ttf` },
      { weight: 700, path: `${FONTS_ROOT}/Work_Sans-700.ttf` },
    ],
  },

  // ── Refined — serif, timeless ────────────────────────────────────────────
  'Playfair Display': {
    family: 'Playfair Display',
    fallback: 'serif',
    files: [
      { weight: 400, path: `${FONTS_ROOT}/Playfair_Display-400.ttf` },
      { weight: 500, path: `${FONTS_ROOT}/Playfair_Display-500.ttf` },
      { weight: 600, path: `${FONTS_ROOT}/Playfair_Display-600.ttf` },
      { weight: 800, path: `${FONTS_ROOT}/Playfair_Display-800.ttf` },
    ],
  },
  'Cormorant Garamond': {
    family: 'Cormorant Garamond',
    fallback: 'serif',
    files: [
      { weight: 300, path: `${FONTS_ROOT}/Cormorant_Garamond-300.ttf` },
      { weight: 400, path: `${FONTS_ROOT}/Cormorant_Garamond-400.ttf` },
      { weight: 500, path: `${FONTS_ROOT}/Cormorant_Garamond-500.ttf` },
      { weight: 700, path: `${FONTS_ROOT}/Cormorant_Garamond-700.ttf` },
    ],
  },
  'Libre Baskerville': {
    family: 'Libre Baskerville',
    fallback: 'serif',
    files: [
      { weight: 400, path: `${FONTS_ROOT}/Libre_Baskerville-400.ttf` },
      { weight: 500, path: `${FONTS_ROOT}/Libre_Baskerville-500.ttf` },
      { weight: 600, path: `${FONTS_ROOT}/Libre_Baskerville-600.ttf` },
      { weight: 700, path: `${FONTS_ROOT}/Libre_Baskerville-700.ttf` },
    ],
  },
  'DM Serif Display': {
    family: 'DM Serif Display',
    fallback: 'serif',
    files: [{ weight: 400, path: `${FONTS_ROOT}/DM_Serif_Display-400.ttf` }],
  },
} as const satisfies Record<FontFamily, FontDef>

// ─── Editor helpers ────────────────────────────────────────────────────────

/**
 * Generate the @font-face declarations the editor injects so the browser
 * loads our self-hosted TTFs (rather than Google Fonts CDN). Pair with
 * a public/fonts/ asset route serving the same files.
 */
export function generateFontFaceCss(opts: { fontsUrlBase: string }): string {
  const lines: string[] = []
  for (const def of Object.values(FONT_REGISTRY)) {
    for (const f of def.files) {
      const url = `${opts.fontsUrlBase}/${f.path.replace(/^fonts\//, '')}`
      const file = f as FontFile
      lines.push(
        `@font-face { font-family: '${def.family}'; src: url('${url}') format('truetype'); ` +
          `font-weight: ${f.weight}; font-style: ${file.style ?? 'normal'}; font-display: swap; }`,
      )
    }
  }
  return lines.join('\n')
}

// ─── Worker / harness helpers ──────────────────────────────────────────────

/** All font file paths, relative to repo root. Used by Dockerfile + install. */
export function listAllFontFiles(): string[] {
  return Object.values(FONT_REGISTRY).flatMap((def) => def.files.map((f) => f.path))
}

/** Resolve a CSS font stack for SVG: "'Family Name', generic-fallback". */
export function fontStack(family: FontFamily): string {
  const def = FONT_REGISTRY[family]
  const fallback = (def as FontDef).fallback
  return `'${def.family}', ${fallback === 'display' ? 'sans-serif' : fallback}`
}

/**
 * Clamp a requested CSS weight to the closest available weight for a
 * font family — by *file* presence, not faux-bold synthesis.
 *
 * Why this exists: browsers faux-bold-synthesise when the requested weight is
 * not available, so a Bebas Neue 700 request yields faux-bold Bebas Neue.
 * Clamping to a real font file keeps poster typography deterministic across
 * editor, render pages, and any future non-browser export code.
 *
 * Returns the family's nearest available weight (numerically). Falls
 * through to `requestedWeight` for unknown families so we don't break
 * non-registry font requests.
 */
export function clampWeightToAvailable(
  family: string,
  requestedWeight: string | number,
): number {
  const def = (FONT_REGISTRY as Record<string, FontDef | undefined>)[family]
  if (!def) return Number(requestedWeight) || 400
  const target = Number(requestedWeight) || 400
  const weights = def.files.map((f) => f.weight).sort((a, b) => a - b)
  if (weights.length === 0) return target
  // Pick the closest weight — ties prefer the heavier one (visual intent
  // when asking for "bold" is heavier-than-regular, not lighter).
  let best = weights[0]!
  let bestDist = Math.abs(target - best)
  for (const w of weights) {
    const d = Math.abs(target - w)
    if (d < bestDist || (d === bestDist && w > best)) {
      best = w
      bestDist = d
    }
  }
  return best
}
