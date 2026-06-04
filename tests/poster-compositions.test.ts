import { describe, expect, it } from 'vitest'
import { COMPOSITION_IDS, REFINED_THEMES } from '~/utils/themes/refined'
import {
  COMPOSITION_OPTIONS,
  POSTER_COMPOSITIONS,
  getPosterCompositionProfile,
  posterCompositionClassName,
  resolvePosterCompositionId,
} from '~/utils/posterCompositions'
import { getPosterTypography } from '~/utils/posterData'

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
  })

  it('produces stable CSS class names for browser assertions', () => {
    expect(posterCompositionClassName('blueprint-strava')).toBe('poster-composition--blueprint-strava')
    expect(posterCompositionClassName('legacy-classic')).toBe('poster-composition--legacy-classic')
  })

  it('marks label-band title compositions so light text stays readable', () => {
    expect(POSTER_COMPOSITIONS['modernist-block'].headerBackground).toBe('label')
    expect(POSTER_COMPOSITIONS['travel-banner'].headerBackground).toBe('label')
    expect(POSTER_COMPOSITIONS['editorial-tall'].headerBackground).toBe('paper')
  })

  it('uses refined typography profiles instead of legacy theme aliases', () => {
    expect(getPosterTypography({ color_theme: 'editorial-minimal' }).titleTracking).toBe('0')
    expect(getPosterTypography({ color_theme: 'brutalist' }).titleTracking).toBe('0.02em')
    expect(getPosterTypography({ color_theme: 'bold-modern' }).titleLineHeight).toBe('0.94')
    expect(getPosterTypography({ color_theme: 'field-journal' }).titleFont).toContain('Newsreader')
    expect(getPosterTypography({ color_theme: 'blueprint' }).titleTracking).toBe('0.02em')
    expect(getPosterTypography({ color_theme: 'blackline' }).titleLineHeight).toBe('0.95')
    expect(getPosterTypography({ color_theme: 'night-ride' }).statsWeight).toBe('800')
    expect(getPosterTypography({ color_theme: 'daybreak-trace' }).titleFont).toContain('Newsreader')
  })
})
