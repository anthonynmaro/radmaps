import { describe, expect, it } from 'vitest'
import { REFINED_THEMES, REFINED_THEME_IDS, getRefinedThemeById } from '../utils/themes/refined'
import {
  BESPOKE_MAP_TREATMENT_THEME_IDS,
  DEFAULT_ADAPTIVE_CONTOUR_BEHAVIOR,
  HIGH_RELIEF_CONTOUR_RESPONSES,
  LOW_RELIEF_CONTOUR_FLOORS,
  MAP_TREATMENTS,
  THEME_MAP_TREATMENTS,
  resolveAdaptiveContourBehavior,
  treatmentRecipeDefaults,
} from '../utils/themes/mapTreatments'

describe('map treatment registry', () => {
  it('covers every refined theme (treatment or explicit bespoke note)', () => {
    const assigned = new Set([...Object.keys(THEME_MAP_TREATMENTS), ...BESPOKE_MAP_TREATMENT_THEME_IDS])
    for (const id of REFINED_THEME_IDS) {
      expect(assigned.has(id), `refined theme "${id}" needs a treatment assignment or a bespoke note`).toBe(true)
    }
  })

  it('only references known refined theme ids', () => {
    const refined = new Set<string>(REFINED_THEME_IDS)
    for (const id of Object.keys(THEME_MAP_TREATMENTS)) {
      expect(refined.has(id), `treatment assignment for unknown theme "${id}"`).toBe(true)
    }
    for (const id of BESPOKE_MAP_TREATMENT_THEME_IDS) {
      expect(refined.has(id), `bespoke note for unknown theme "${id}"`).toBe(true)
    }
  })

  it('bespoke themes do not also claim a treatment', () => {
    for (const id of BESPOKE_MAP_TREATMENT_THEME_IDS) {
      expect(THEME_MAP_TREATMENTS[id], `"${id}" is bespoke and assigned`).toBeUndefined()
    }
  })

  it('legacy/unknown theme ids resolve to stock adaptive behavior', () => {
    expect(resolveAdaptiveContourBehavior(undefined)).toEqual(DEFAULT_ADAPTIVE_CONTOUR_BEHAVIOR)
    expect(resolveAdaptiveContourBehavior('chalk')).toEqual(DEFAULT_ADAPTIVE_CONTOUR_BEHAVIOR)
    expect(resolveAdaptiveContourBehavior('sea-chart')).toEqual(DEFAULT_ADAPTIVE_CONTOUR_BEHAVIOR)
  })

  it('every behavior reference points at a defined response/floor table', () => {
    for (const treatment of Object.values(MAP_TREATMENTS)) {
      const behavior = { ...DEFAULT_ADAPTIVE_CONTOUR_BEHAVIOR, ...treatment.behavior }
      expect(HIGH_RELIEF_CONTOUR_RESPONSES[behavior.highReliefResponse]).toBeDefined()
      expect(LOW_RELIEF_CONTOUR_FLOORS[behavior.lowReliefFloor]).toBeDefined()
    }
    for (const [id, assignment] of Object.entries(THEME_MAP_TREATMENTS)) {
      const behavior = resolveAdaptiveContourBehavior(id)
      expect(HIGH_RELIEF_CONTOUR_RESPONSES[behavior.highReliefResponse], id).toBeDefined()
      expect(LOW_RELIEF_CONTOUR_FLOORS[behavior.lowReliefFloor], id).toBeDefined()
      expect(MAP_TREATMENTS[assignment.treatment], id).toBeDefined()
    }
  })

  it('STRICT RULE: treatment recipe defaults are exactly what every member resolves', () => {
    // A treatment recipe default may only exist when every member theme ends up
    // with that identical value in its resolved map_defaults. If a member needs
    // a different value, the key must move OUT of the treatment (recipes
    // overriding treatment defaults silently is how drift starts).
    for (const [id, assignment] of Object.entries(THEME_MAP_TREATMENTS)) {
      const theme = getRefinedThemeById(id)
      expect(theme, `assignment for "${id}" without a refined recipe`).toBeDefined()
      const defaults = treatmentRecipeDefaults(id as (typeof REFINED_THEME_IDS)[number])
      for (const [key, value] of Object.entries(defaults)) {
        expect(
          (theme!.map_defaults as Record<string, unknown>)[key],
          `"${id}" map_defaults.${key} must equal its "${assignment.treatment}" treatment default`,
        ).toEqual(value)
      }
    }
  })

  it('every refined theme map_defaults survives the treatment merge untouched (spot integrity)', () => {
    // The byte-level proof lives in tests/theme-resolution-snapshot.test.ts;
    // this is a fast structural sanity check that the merge produced objects.
    for (const theme of REFINED_THEMES) {
      expect(theme.map_defaults).toBeTypeOf('object')
      expect(theme.map_defaults.show_contours).toBeTypeOf('boolean')
    }
  })
})
