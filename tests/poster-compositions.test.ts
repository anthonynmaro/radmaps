import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { COMPOSITION_IDS, REFINED_THEMES } from '~/utils/themes/refined'
import {
  COMPOSITION_OPTIONS,
  POSTER_COMPOSITIONS,
  getPosterCompositionProfile,
  posterCompositionClassName,
  resolvePosterCompositionId,
} from '~/utils/posterCompositions'
import { getPosterTypography } from '~/utils/posterData'
import { defaultPosterLayout } from '~/utils/posterLayout'
import { POSTER_TEXT_SLOT_ANCHOR_OCCURRENCES } from '~/utils/posterSlotAnchors'
import { DEFAULT_STYLE_CONFIG } from '../types'

describe('poster composition registry', () => {
  it('has a profile and picker option for every design-update composition', () => {
    const optionIds = COMPOSITION_OPTIONS.map(option => option.id)

    for (const id of COMPOSITION_IDS) {
      expect(POSTER_COMPOSITIONS[id]).toBeTruthy()
      expect(optionIds).toContain(id)
    }
  })

  it('maps every refined theme to a registered composition profile', () => {
    for (const theme of REFINED_THEMES) {
      const profile = getPosterCompositionProfile({
        color_theme: theme.id,
        composition: theme.composition,
      })
      expect(profile.id).toBe(theme.composition)
      expect(profile.label.length).toBeGreaterThan(0)
    }
  })

  it('keeps legacy rows on the legacy classic layout when no composition is stored', () => {
    expect(resolvePosterCompositionId({ color_theme: 'chalk' })).toBe('legacy-classic')
    expect(getPosterCompositionProfile({ color_theme: 'chalk' }).titlePosition).toBe('top')
  })

  it('uses theme composition when a refined row has not stored composition yet', () => {
    expect(resolvePosterCompositionId({ color_theme: 'blueprint-strava' })).toBe('blueprint-strava')
    expect(resolvePosterCompositionId({ color_theme: 'marathon-bib' })).toBe('bib-numerals')
    expect(resolvePosterCompositionId({ color_theme: 'cartouche-place' })).toBe('place-frame')
    expect(resolvePosterCompositionId({ color_theme: 'contour-wash' })).toBe('art-wash')
  })

  it('produces stable CSS class names for browser assertions', () => {
    expect(posterCompositionClassName('blueprint-strava')).toBe('poster-composition--blueprint-strava')
    expect(posterCompositionClassName('legacy-classic')).toBe('poster-composition--legacy-classic')
  })

  it('renders technical data compositions with map-first bottom title chrome', () => {
    const profile = POSTER_COMPOSITIONS['blueprint-strava']

    expect(profile.titlePosition).toBe('bottom')
    expect(profile.mapOrder).toBeLessThan(profile.headerOrder)
    expect(profile.footerVariant).toBe('data')
    expect(profile.showGridOverlay).toBe(true)
  })

  it('gives place-frame posters decorative header data slots', () => {
    const layout = defaultPosterLayout({
      ...DEFAULT_STYLE_CONFIG,
      color_theme: 'cartouche-place',
      composition: 'place-frame',
      occasion_text: 'MÉXICO',
    })
    const slots = layout.bands.header.rows
      .flatMap(row => row.cells)
      .map(cell => cell.block?.slot)

    expect(slots).toContain('composition_kicker')
    expect(slots).toContain('composition_meta')
  })

  it('renders trail profile compositions with map-first profile chrome', () => {
    const profile = POSTER_COMPOSITIONS['splits-grid']

    expect(profile.titlePosition).toBe('bottom')
    expect(profile.mapOrder).toBeLessThan(profile.headerOrder)
    expect(profile.footerVariant).toBe('data')
    expect(profile.showGridOverlay).toBe(true)
  })

  it('marks label-band title compositions so light text stays readable', () => {
    expect(POSTER_COMPOSITIONS['modernist-block'].headerBackground).toBe('paper')
    expect(POSTER_COMPOSITIONS['travel-banner'].headerBackground).toBe('paper')
    expect(POSTER_COMPOSITIONS['editorial-tall'].headerBackground).toBe('paper')
  })

  it('uses refined typography profiles instead of legacy theme aliases', () => {
    expect(getPosterTypography({ color_theme: 'editorial-minimal' }).titleTracking).toBe('0')
    expect(getPosterTypography({ color_theme: 'brutalist' }).titleFont).toContain('Bebas Neue')
    expect(getPosterTypography({ color_theme: 'bold-modern' }).titleLineHeight).toBe('0.88')
    expect(getPosterTypography({ color_theme: 'field-journal' }).titleFont).toContain('Cormorant Garamond')
    expect(getPosterTypography({ color_theme: 'blueprint' }).titleTracking).toBe('0.07em')
    expect(getPosterTypography({ color_theme: 'blackline' }).titleLineHeight).toBe('0.9')
    expect(getPosterTypography({ color_theme: 'night-ride' }).statsWeight).toBe('800')
    expect(getPosterTypography({ color_theme: 'daybreak-trace' }).titleFont).toContain('Oswald')
    expect(getPosterTypography({ color_theme: 'cartouche-place' }).titleFont).toContain('Playfair Display')
    expect(getPosterTypography({ color_theme: 'transit-diagram' }).titleFont).toContain('Outfit')
  })

  it('keeps Field Journal chrome title rendering on the contract font', () => {
    const source = readFileSync(resolve(process.cwd(), 'components/map/MapPreview.vue'), 'utf8')
    const rule = source.match(/\.poster-composition--journal-spread \.poster-trail-name \{[\s\S]*?\}/)?.[0] ?? ''

    expect(rule).toContain('font-family: "Cormorant Garamond", "Source Serif 4", serif !important;')
    expect(rule).not.toContain('Fraunces')
  })

  it('keeps Plein Air art-wash title rendering hand-set and theme-specific', () => {
    const source = readFileSync(resolve(process.cwd(), 'components/map/MapPreview.vue'), 'utf8')
    const rule = source.match(/\.poster-composition--art-wash\[data-theme="plein-air"\] \.poster-trail-name \{[\s\S]*?\}/)?.[0] ?? ''

    expect(rule).toContain('font-family: "Cormorant Garamond", "Newsreader", serif !important;')
    expect(rule).toContain('font-style: italic !important;')
    expect(rule).toContain('text-align: left !important;')
    expect(rule).toContain('text-shadow:')
  })

  it('classifies every poster text slot occurrence by anchor location', () => {
    const slots = new Set(POSTER_TEXT_SLOT_ANCHOR_OCCURRENCES.map(occurrence => occurrence.slot))
    expect(slots).toEqual(new Set([
      'trail_name',
      'occasion_text',
      'location_text',
      'distance',
      'elevation_gain',
      'date',
      'coordinates',
      'start_pin_label',
      'finish_pin_label',
      'composition_kicker',
      'composition_meta',
      'composition_footer',
      'composition_side_rail',
    ]))
  })

  it('records free and map-level exceptions needed by the anchor model', () => {
    const freeTitleblocks = POSTER_TEXT_SLOT_ANCHOR_OCCURRENCES
      .filter(occurrence => occurrence.location === 'free-over-map-titleblock')
      .map(occurrence => occurrence.id)

    expect(freeTitleblocks).toContain('free-place-frame-titleblock')
    expect(freeTitleblocks).toContain('free-sea-chart-titleblock')
    expect(freeTitleblocks).toContain('free-art-wash-titleblock')
    expect(POSTER_TEXT_SLOT_ANCHOR_OCCURRENCES).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'usgs-map-coordinate', slot: 'composition_kicker', anchorType: 'map' }),
      expect.objectContaining({ id: 'usgs-map-scale', slot: 'composition_meta', anchorType: 'map' }),
      expect.objectContaining({ id: 'composition-side-rail', slot: 'composition_side_rail', anchorType: 'map' }),
      expect.objectContaining({ id: 'start-pin-label', slot: 'start_pin_label', location: 'map-pin-label' }),
      expect.objectContaining({ id: 'finish-pin-label', slot: 'finish_pin_label', location: 'map-pin-label' }),
    ]))
  })
})
