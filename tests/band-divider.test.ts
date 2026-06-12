// Editor-v2 D2 — band-divider drag contracts.
//
// 1. Clamp math is pure and keeps every drag inside the print-legibility band
//    bounds (CHROME_BAND_HEIGHT_BOUNDS — the same constants the existing
//    chrome band/row resize enforces) AND the map-area floor
//    (BAND_DIVIDER_MAP_MIN_PCT of poster height).
// 2. MAP-GEOMETRY INVARIANT: only the divider gesture and the pre-existing
//    chrome row/band resize may change the map rect. Band heights are the only
//    poster_layout inputs that move the map, so the invariant is asserted two
//    ways: clamp outputs can never push the map below its floor, and a source
//    contract pins the exhaustive list of MapPreview functions that write a
//    band height into the poster_layout write path.
// 3. Persistence reuses the existing poster_layout band-height mechanism:
//    patchPosterLayout/mergePosterLayout round-trip, and deleting the band
//    override (the existing reset path) restores theme recipe heights.

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  BAND_DIVIDER_MAP_MIN_PCT,
  CHROME_BAND_HEIGHT_BOUNDS,
  bandDividerHeightBounds,
  clampBandDividerHeight,
  defaultPosterLayout,
  mergePosterLayout,
  patchPosterLayout,
  resolveDividerAdjacency,
} from '../utils/posterLayout'
import { DEFAULT_STYLE_CONFIG } from '../types'
import type { StyleConfig } from '../types'

function styleConfig(patch: Partial<StyleConfig> = {}): StyleConfig {
  return { ...DEFAULT_STYLE_CONFIG, ...patch }
}

describe('clampBandDividerHeight (pure clamp math)', () => {
  it('passes through heights inside all bounds (0.1 rounding)', () => {
    expect(clampBandDividerHeight(22, 14)).toBe(22)
    expect(clampBandDividerHeight(17.349, 14)).toBe(17.3)
  })

  it('enforces the band print-legibility floor (CHROME_BAND_HEIGHT_BOUNDS.min)', () => {
    expect(clampBandDividerHeight(2, 14)).toBe(CHROME_BAND_HEIGHT_BOUNDS.min)
    expect(clampBandDividerHeight(-10, 0)).toBe(CHROME_BAND_HEIGHT_BOUNDS.min)
  })

  it('enforces the band ceiling (CHROME_BAND_HEIGHT_BOUNDS.max) when the map floor allows it', () => {
    // other band 14% → map floor allows 100 - 40 - 14 = 46 → band cap 34 governs.
    expect(clampBandDividerHeight(80, 14)).toBe(CHROME_BAND_HEIGHT_BOUNDS.max)
  })

  it('enforces the map-area floor when it binds before the band ceiling', () => {
    // other band at the 34% ceiling → this band may only reach 100 - 40 - 34 = 26.
    expect(clampBandDividerHeight(34, CHROME_BAND_HEIGHT_BOUNDS.max)).toBe(26)
    // hidden footer (0%) → cap is min(34, 60) = 34.
    expect(clampBandDividerHeight(60, 0)).toBe(CHROME_BAND_HEIGHT_BOUNDS.max)
  })

  it('band floor wins in the degenerate case where both floors cannot be satisfied', () => {
    // An (unreachable through this clamp) 60% other band leaves no room above
    // the map floor; the band still keeps its own legibility floor.
    expect(clampBandDividerHeight(20, 60)).toBe(CHROME_BAND_HEIGHT_BOUNDS.min)
    const bounds = bandDividerHeightBounds(60)
    expect(bounds.max).toBe(CHROME_BAND_HEIGHT_BOUNDS.min)
  })

  it('map-rect invariant: no sequence of divider drags pushes the map below its floor', () => {
    // Property sweep: from any persisted other-band height that this clamp can
    // itself produce, every proposed drag keeps map ≥ BAND_DIVIDER_MAP_MIN_PCT.
    for (let other = CHROME_BAND_HEIGHT_BOUNDS.min; other <= CHROME_BAND_HEIGHT_BOUNDS.max; other += 1.3) {
      for (let proposed = -20; proposed <= 120; proposed += 3.7) {
        const clamped = clampBandDividerHeight(proposed, other)
        const mapShare = 100 - clamped - other
        expect(mapShare).toBeGreaterThanOrEqual(BAND_DIVIDER_MAP_MIN_PCT - 1e-9)
        expect(clamped).toBeGreaterThanOrEqual(CHROME_BAND_HEIGHT_BOUNDS.min)
        expect(clamped).toBeLessThanOrEqual(CHROME_BAND_HEIGHT_BOUNDS.max)
      }
    }
  })
})

describe('band-divider persistence (existing poster_layout band-height mechanism)', () => {
  it('round-trips a divider-dragged height through patchPosterLayout + mergePosterLayout', () => {
    const config = styleConfig()
    const sparse = patchPosterLayout(undefined, { bands: { header: { height: 26 } } })
    expect(sparse.bands?.header?.height).toBe(26)
    const merged = mergePosterLayout(defaultPosterLayout(config), sparse)
    expect(merged.bands.header.height).toBe(26)
    // Band anchors (displacesMap) carry the same height — single source.
    const headerAnchor = merged.anchors?.find(anchor => anchor.id === 'band-header')
    expect(headerAnchor?.size?.height).toEqual({ kind: 'unit', value: 26, unit: '%' })
  })

  it('does not invent a parallel field: the write is bands.<band>.height only', () => {
    const sparse = patchPosterLayout(undefined, { bands: { footer: { height: 18 } } })
    expect(Object.keys(sparse)).toEqual(['bands'])
    expect(Object.keys(sparse.bands ?? {})).toEqual(['footer'])
    expect(Object.keys(sparse.bands?.footer ?? {})).toEqual(['height'])
  })

  it('reset path (deleting the band override) restores theme recipe heights', () => {
    const config = styleConfig()
    const defaults = defaultPosterLayout(config)
    const edited = mergePosterLayout(defaults, { bands: { header: { height: 30 } } })
    expect(edited.bands.header.height).toBe(30)
    // resetChromeBand deletes the band entry from the sparse layout; merging
    // the remainder restores the theme default.
    const reset = mergePosterLayout(defaults, { bands: {} })
    expect(reset.bands.header.height).toBe(defaults.bands.header.height)
  })

  it('non-geometry edits (rows, text cells) never change band heights', () => {
    const config = styleConfig()
    const defaults = defaultPosterLayout(config)
    const rowsEdit = mergePosterLayout(defaults, {
      bands: { header: { rows: [{ id: 'header-title', fr: 3.1, cells: [] }] } },
    })
    expect(rowsEdit.bands.header.height).toBe(defaults.bands.header.height)
    expect(rowsEdit.bands.footer.height).toBe(defaults.bands.footer.height)
  })
})

describe('resolveDividerAdjacency (rendered-order adjacency, D2 close-out)', () => {
  // Adjacency feeds from the RENDERED layout because several themes flip or
  // pin band order with bespoke `!important` CSS the composition constants
  // cannot see (usgs-vintage/classic-trail/editorial-minimal/relief-shaded
  // flip to title-bottom; dark-sky/copper-night absolutize the header).
  const band = (b: 'header' | 'footer', order: number, domBeforeMap: boolean) =>
    ({ band: b, order, domBeforeMap })

  it('standard title-top: header above, footer below', () => {
    expect(resolveDividerAdjacency([band('header', 0, true), band('footer', 2, false)], 1))
      .toEqual({ top: 'header', bottom: 'footer' })
  })

  it('title-bottom (modernist model / CSS-flipped usgs/classic/editorial-minimal): header below map, footer last', () => {
    // map order 0, header 1, footer 2 — the band ADJACENT below the map is the
    // header; the bottom divider must resize it, never the footer.
    expect(resolveDividerAdjacency([band('header', 1, true), band('footer', 2, false)], 0))
      .toEqual({ top: null, bottom: 'header' })
  })

  it('out-of-flow bands are simply absent (dark-sky absolute header): no divider for that edge', () => {
    expect(resolveDividerAdjacency([band('footer', 2, false)], 0))
      .toEqual({ top: null, bottom: 'footer' })
    expect(resolveDividerAdjacency([], 0)).toEqual({ top: null, bottom: null })
  })

  it('equal order falls back to DOM position, matching flex tie-break', () => {
    // Both order 0: header before map in DOM → header renders above the map.
    expect(resolveDividerAdjacency([band('header', 0, true)], 0))
      .toEqual({ top: 'header', bottom: null })
    // Footer after map in DOM at equal order → renders below.
    expect(resolveDividerAdjacency([band('footer', 0, false)], 0))
      .toEqual({ top: null, bottom: 'footer' })
  })

  it('nearest band wins when two bands share a side', () => {
    expect(resolveDividerAdjacency([band('header', 1, true), band('footer', 2, false)], 3))
      .toEqual({ top: 'footer', bottom: null })
  })
})

describe('map-geometry invariant — source contract on MapPreview.vue', () => {
  // ONLY the divider gesture and the pre-existing chrome row/band resize may
  // write a band height into the poster_layout write path. If this test fails
  // because a new writer appeared, that is a deliberate invariant change —
  // update docs/EDITOR_UX_NORTH_STAR.md gesture 2 and this contract together.
  const ALLOWED_BAND_HEIGHT_WRITERS = new Set([
    'flushBandDividerHeight', // editor-v2 D2 divider gesture (rAF-coalesced flush)
    'onChromeRowResizeMove', // pre-existing chrome row resize (band edge rows)
    'onChromeBandResizeMove', // pre-existing chrome band resize handler
  ])

  it('only the allowed gestures write poster_layout band heights', () => {
    const source = readFileSync(
      resolve(__dirname, '../components/map/MapPreview.vue'),
      'utf8',
    )

    // Map every named function to its span so each write site can be owned.
    const spans: Array<{ name: string; start: number }> = []
    const fnRe = /\nfunction (\w+)/g
    for (let match = fnRe.exec(source); match; match = fnRe.exec(source)) {
      spans.push({ name: match[1], start: match.index })
    }
    const ownerOf = (offset: number) => {
      let owner = '<module scope>'
      for (const span of spans) {
        if (span.start > offset) break
        owner = span.name
      }
      return owner
    }

    const writers = new Set<string>()
    const callRe = /(updateChromeBand|updatePosterLayout)\(/g
    for (let match = callRe.exec(source); match; match = callRe.exec(source)) {
      const window = source.slice(match.index, match.index + 260)
      if (/\bheight\b/.test(window)) writers.add(ownerOf(match.index))
    }

    expect(writers.size).toBeGreaterThan(0)
    for (const writer of writers) {
      expect(
        ALLOWED_BAND_HEIGHT_WRITERS.has(writer),
        `unexpected poster_layout band-height writer: ${writer}`,
      ).toBe(true)
    }
    // The divider gesture itself must be among the writers (it exists).
    expect(writers.has('flushBandDividerHeight')).toBe(true)
  })
})
