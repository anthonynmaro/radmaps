/**
 * Theme resolution equality proof.
 *
 * Pins, for EVERY renderable theme id (refined + legacy), the byte-exact:
 *  1. style config produced by applying the theme to DEFAULT_STYLE_CONFIG,
 *  2. adaptive contour resolution (detail / overzoom / thresholds / resolved
 *     config) for representative route-stat archetypes, so every
 *     relief-response branch in utils/mapStyle.ts executes,
 *  3. buildMapStyle() style JSON for the mountain-loop and flat-marathon
 *     archetypes (style JSON is a pure function of the resolved config, which
 *     is itself pinned for all archetypes),
 *  4. poster chrome: defaultPosterLayout() per archetype, getPosterTypography,
 *     getPosterLayout, and the POSTER_COMPOSITIONS registry.
 *
 * This is the safety net for the theme-system refactor (map treatments +
 * poster tokens). The committed fixture is the law: refactors must keep every
 * entry byte-identical. Do NOT regenerate the fixture to make a refactor pass
 * — if a refactor step cannot keep the snapshot identical, the step is wrong.
 *
 * Intentional behavior changes (new themes, deliberate polish passes verified
 * against goldens) regenerate with:
 *
 *   UPDATE_THEME_RESOLUTION_SNAPSHOT=1 npx vitest run tests/theme-resolution-snapshot.test.ts
 *
 * and must declare the diff in the commit message.
 */
import { describe, expect, it } from 'vitest'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { DEFAULT_STYLE_CONFIG, type RouteStats, type StyleConfig } from '../types'
import { ALL_COLOR_THEME_IDS, getThemeDefinition } from '../utils/themes/refined'
import { applyThemeToStyleConfig } from '../utils/themeApplication'
import {
  buildMapStyle,
  resolveAdaptiveContourDetail,
  resolveAdaptiveContourOverzoom,
  resolveAdaptiveContourStyleConfig,
  resolveAdaptiveContourThresholds,
} from '../utils/mapStyle'
import { defaultPosterLayout } from '../utils/posterLayout'
import { POSTER_COMPOSITIONS } from '../utils/posterCompositions'
import { getPosterLayout, getPosterTypography } from '../utils/posterData'
import { SAMPLE_REGIONS } from '../utils/styleBrowserFixtures'

const FIXTURE_PATH = path.join(__dirname, 'fixtures', 'theme-resolution-snapshot.json')
const UPDATE = process.env.UPDATE_THEME_RESOLUTION_SNAPSHOT === '1'

// Fixed inputs so URLs embedded in style JSON are deterministic.
const SNAPSHOT_MAPBOX_TOKEN = 'snapshot-mapbox-token'
const SNAPSHOT_MAPTILER_TOKEN = 'snapshot-maptiler-token'
const SNAPSHOT_STADIA_TOKEN = 'snapshot-stadia-token'
const SNAPSHOT_CONTOUR_TILE_URL = 'contour://radmaps-snapshot/{z}/{x}/{y}'

/**
 * Route-stat archetypes. Each exercises a different adaptive relief band:
 *  - mountain-loop:  extreme relief (adaptive detail 0)
 *  - flat-marathon:  low relief (adaptive detail 5 → low-relief floors)
 *  - moderate-ridge: high band, adaptive detail 1 (theme min/max clamps fire)
 *  - place-only:     zeroed stats → unknown band (adaptive resolution no-op)
 */
const STATS_ARCHETYPES: Record<string, Partial<RouteStats> | undefined> = {
  'mountain-loop': SAMPLE_REGIONS['archetype-mountain-loop'].stats,
  'flat-marathon': SAMPLE_REGIONS['archetype-flat-marathon'].stats,
  'moderate-ridge': SAMPLE_REGIONS.dolomites.stats,
  'place-only': SAMPLE_REGIONS['archetype-place-only'].stats,
}

/** Archetypes whose full buildMapStyle() JSON is pinned (config is pinned for all). */
const FULL_STYLE_ARCHETYPES = new Set(['mountain-loop', 'flat-marathon'])

const UNDEFINED_SENTINEL = '__undefined__'

/**
 * Canonical JSON form: keys sorted, `undefined` values preserved as a sentinel
 * (key presence matters for downstream object spreads), non-finite numbers
 * stringified. Byte-identical canonical JSON ⇔ identical resolved output.
 */
function canonicalize(value: unknown): unknown {
  if (value === undefined) return UNDEFINED_SENTINEL
  if (value === null) return null
  if (Array.isArray(value)) return value.map(canonicalize)
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>
    const out: Record<string, unknown> = {}
    for (const key of Object.keys(record).sort()) {
      out[key] = canonicalize(record[key])
    }
    return out
  }
  if (typeof value === 'number' && !Number.isFinite(value)) return `__number:${String(value)}__`
  return value
}

function buildThemeEntry(themeId: string) {
  const theme = getThemeDefinition(themeId)
  if (!theme) throw new Error(`No theme definition for id "${themeId}"`)
  const applied = applyThemeToStyleConfig(DEFAULT_STYLE_CONFIG, theme)

  const archetypes: Record<string, unknown> = {}
  for (const [archetypeId, stats] of Object.entries(STATS_ARCHETYPES)) {
    const resolved = resolveAdaptiveContourStyleConfig(applied, stats)
    const entry: Record<string, unknown> = {
      adaptive: canonicalize({
        detail: resolveAdaptiveContourDetail(applied, stats),
        overzoom: resolveAdaptiveContourOverzoom(applied),
        thresholds: resolveAdaptiveContourThresholds(applied, stats),
      }),
      resolvedConfig: canonicalize(resolved),
      posterLayout: canonicalize(defaultPosterLayout(applied, stats as RouteStats)),
    }
    if (FULL_STYLE_ARCHETYPES.has(archetypeId)) {
      entry.mapStyle = canonicalize(buildMapStyle(
        resolved as StyleConfig,
        SNAPSHOT_MAPBOX_TOKEN,
        SNAPSHOT_MAPTILER_TOKEN,
        SNAPSHOT_CONTOUR_TILE_URL,
        SNAPSHOT_STADIA_TOKEN,
      ))
    }
    archetypes[archetypeId] = entry
  }

  return {
    appliedConfig: canonicalize(applied),
    typography: canonicalize(getPosterTypography(applied)),
    layoutProfile: canonicalize(getPosterLayout(applied)),
    archetypes,
  }
}

function buildSnapshot() {
  const themes: Record<string, unknown> = {}
  for (const themeId of [...ALL_COLOR_THEME_IDS].sort()) {
    themes[themeId] = buildThemeEntry(themeId)
  }
  return {
    compositions: canonicalize(POSTER_COMPOSITIONS),
    themes,
  }
}

const current = buildSnapshot()

if (UPDATE) {
  mkdirSync(path.dirname(FIXTURE_PATH), { recursive: true })
  writeFileSync(FIXTURE_PATH, `${JSON.stringify(current, null, 1)}\n`)
}

const fixture = JSON.parse(readFileSync(FIXTURE_PATH, 'utf8')) as ReturnType<typeof buildSnapshot>

describe('theme resolution snapshot (refactor equality proof)', () => {
  it('pins the exact set of theme ids', () => {
    expect(Object.keys(current.themes).sort()).toEqual(Object.keys(fixture.themes).sort())
  })

  it('poster composition registry is byte-identical', () => {
    expect(current.compositions).toEqual(fixture.compositions)
    expect(JSON.stringify(current.compositions)).toBe(JSON.stringify(fixture.compositions))
  })

  for (const themeId of [...ALL_COLOR_THEME_IDS].sort()) {
    it(`theme "${themeId}" resolves byte-identically`, () => {
      const currentEntry = current.themes[themeId]
      const fixtureEntry = fixture.themes[themeId]
      expect(currentEntry).toEqual(fixtureEntry)
      // Deep equality above gives a readable diff; string equality is the law.
      expect(JSON.stringify(currentEntry)).toBe(JSON.stringify(fixtureEntry))
    })
  }
})
