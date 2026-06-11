import { describe, expect, it } from 'vitest'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { COLOR_THEMES, DEFAULT_CONTOUR_MAJOR_WIDTH, DEFAULT_ROUTE_WIDTH, DEFAULT_SEGMENT_CASING_WIDTH, DEFAULT_STYLE_CONFIG, type ColorTheme, type CompositionId, type StyleConfig } from '../types'
import { contrastRatio } from '../utils/colorContrast'
import { getPosterCompositionProfile } from '../utils/posterCompositions'
import { getPosterTypography } from '../utils/posterData'
import {
  ALL_COLOR_THEME_IDS,
  COMPOSITION_IDS,
  LEGACY_THEME_MIGRATION_TARGETS,
  REFINED_THEME_IDS,
  REFINED_THEMES,
  getRefinedThemeById,
  getThemeDefinition,
} from '../utils/themes/refined'
import { applyThemeToStyleConfig } from '../utils/themeApplication'
import { THEME_CHROME_CONTRACTS, getThemeChromeContract } from '../utils/themes/chromeContract'
import {
  THEME_PARITY_AUDIT_CONTRACTS,
  THEME_PARITY_SEMANTIC_GROUPS,
  THEME_SEMANTIC_PARITY_THRESHOLD,
  getParityApprovedThemeIds,
  getThemeParityApprovalState,
  getThemeParityAuditContract,
  getThemesMissingChromeContract,
  hasRequiredSemanticRuntimeGroups,
  meetsThemeSemanticParityThreshold,
  passesThemeSemanticRuntimeGate,
  scoreThemeSemanticParity,
} from '../utils/themes/parityAuditContract'
import {
  IMAGE_GATED_THEME_IDS,
  SPEC_GATED_THEME_IDS,
  THEME_SCREENSHOT_MANIFEST,
} from '../utils/themes/screenshotManifest'
import { THEME_SEMANTIC_AUDIT_CONTRACTS, getThemeSemanticAuditContract } from '../utils/themes/semanticAuditContract'
import { THEME_SPEC_CONTRACTS, getThemeSpecContract } from '../utils/themes/specContract'

describe('refined theme Phase 0 scaffolding', () => {
  const passingSemanticRuntimeSummary = {
    passed: 94,
    total: 100,
    pass: true,
    groups: Object.fromEntries(THEME_PARITY_SEMANTIC_GROUPS.map(group => [
      group,
      { passed: 1, total: 1 },
    ])),
  }
  const passingSemanticReportShape = {
    summary: {
      passed: 94,
      total: 100,
      pass: true,
    },
    groups: passingSemanticRuntimeSummary.groups,
  }

  it('matches the design handoff inventory for names, fonts, compositions, and owned map presets', () => {
    const expectedInventory = [
      ['editorial-minimal', 'Editorial', 'editorial-tall', 'Playfair Display', 'Source Serif 4', 'radmaps-simple-contour'],
      ['usgs-vintage', 'USGS Heritage', 'park-quad', 'Libre Baskerville', 'Source Sans 3', 'radmaps-simple-contour'],
      ['midcentury-travel', 'Mid-Century', 'travel-banner', 'Oswald', 'Source Sans 3', 'radmaps-simple-contour'],
      ['risograph', 'Risograph', 'riso-stack', 'Big Shoulders Display', 'Work Sans', 'radmaps-simple-contour'],
      ['blueprint', 'Blueprint', 'blueprint-grid', 'Space Grotesk', 'IBM Plex Sans', 'radmaps-alidade-dark'],
      ['blueprint-strava', 'Trail Blueprint', 'blueprint-strava', 'Space Grotesk', 'IBM Plex Sans', 'radmaps-alidade-dark'],
      ['field-journal', 'Field Journal', 'journal-spread', 'Cormorant Garamond', 'Source Serif 4', 'radmaps-natural'],
      ['bold-modern', 'Modernist', 'modernist-block', 'Big Shoulders Display', 'DM Sans', 'radmaps-toner-light'],
      ['contour-wash', 'Contour Wash', 'art-wash', 'Space Grotesk', 'Source Sans 3', 'radmaps-contour-wash'],
      ['splits-stats', 'Trail Profile', 'splits-grid', 'Space Grotesk', 'IBM Plex Sans', 'radmaps-alidade-dark'],
      ['marathon-bib', 'Marathon', 'bib-numerals', 'Bebas Neue', 'Atkinson Hyperlegible Next', 'radmaps-alidade'],
      ['dark-sky', 'Dark Sky', 'darksky-stars', 'Cormorant Garamond', 'Source Sans 3', 'radmaps-night-relief'],
      ['botanical', 'Botanical Plate', 'botanical-plate', 'Cormorant Garamond', 'Source Serif 4', 'radmaps-natural'],
      ['brutalist', 'Brutalist', 'brutalist-slab', 'Bebas Neue', 'IBM Plex Sans', 'radmaps-toner-light'],
      ['classic-trail', 'Classic Trail', 'park-quad', 'Libre Baskerville', 'Source Sans 3', 'radmaps-simple-contour'],
      ['ranch-ochre', 'Ranch Ochre', 'travel-banner', 'Oswald', 'Source Sans 3', 'radmaps-simple-contour'],
      ['blackline', 'Blackline', 'modernist-block', 'Big Shoulders Display', 'IBM Plex Sans', 'radmaps-toner-light'],
      ['copper-night', 'Copper Night', 'darksky-stars', 'Cormorant Garamond', 'Source Sans 3', 'radmaps-night-relief'],
      ['moonstone', 'Moonstone', 'blueprint-grid', 'Space Grotesk', 'IBM Plex Sans', 'radmaps-alidade'],
      ['night-ride', 'Night Ride', 'splits-grid', 'Oswald', 'IBM Plex Sans', 'radmaps-alidade-dark'],
      ['daybreak-trace', 'Daybreak', 'travel-banner', 'Oswald', 'Source Sans 3', 'radmaps-simple-contour'],
      ['electric-atlas', 'Electric Atlas', 'blueprint-strava', 'Big Shoulders Display', 'IBM Plex Sans', 'radmaps-alidade-dark'],
      ['cartouche-place', 'Cartouche', 'place-frame', 'Playfair Display', 'Source Serif 4', 'radmaps-alidade'],
      ['sea-chart', 'Sea Chart', 'sea-chart', 'Libre Baskerville', 'IBM Plex Sans', 'radmaps-simple-contour'],
      ['relief-shaded', 'Shaded Relief', 'editorial-tall', 'Newsreader', 'Source Sans 3', 'radmaps-natural'],
      ['transit-diagram', 'Transit', 'transit-diagram', 'Outfit', 'IBM Plex Sans', 'radmaps-simple-contour'],
      ['plein-air', 'Plein Air', 'art-wash', 'Cormorant Garamond', 'Source Sans 3', 'radmaps-watercolor-paper'],
    ] as const

    for (const [id, label, composition, font, bodyFont, preset] of expectedInventory) {
      expect(getRefinedThemeById(id), id).toMatchObject({
        id,
        label,
        composition,
        font_family: font,
        body_font_family: bodyFont,
        map_defaults: {
          preset,
          atlas_style_id: preset,
        },
      })
    }
  })

  it('matches the extracted standalone theme contract for ids, labels, decisions, merges, fonts, and compositions', () => {
    expect(THEME_SPEC_CONTRACTS).toHaveLength(27)

    for (const spec of THEME_SPEC_CONTRACTS) {
      const theme = getRefinedThemeById(spec.id)
      expect(theme, spec.id).toBeTruthy()
      expect(theme, spec.id).toMatchObject({
        id: spec.id,
        label: spec.label,
        review_decision: spec.decision,
        composition: spec.composition,
        font_family: spec.titleFont,
        body_font_family: spec.bodyFont,
      })
      expect(theme?.colorway_of, spec.id).toBe(spec.mergeTarget)
      expect(spec.problem.length, spec.id).toBeGreaterThan(20)
      expect(spec.refinement.length, spec.id).toBeGreaterThan(20)
      expect(spec.mapStyleRequirements.length, spec.id).toBeGreaterThan(0)
      expect(spec.routeStyleRequirements.length, spec.id).toBeGreaterThan(0)
      expect(spec.requiredLayoutFeatures.length, spec.id).toBeGreaterThan(0)
    }
  })

  it('maps all screenshot/spec parity themes through one manifest', () => {
    expect(THEME_SCREENSHOT_MANIFEST).toHaveLength(27)
    expect(IMAGE_GATED_THEME_IDS).toHaveLength(24)
    expect(SPEC_GATED_THEME_IDS).toEqual(['field-journal', 'transit-diagram', 'plein-air'])
    expect(IMAGE_GATED_THEME_IDS).toContain('cartouche-place')

    const ids = THEME_SCREENSHOT_MANIFEST.map(entry => entry.themeId)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toEqual(expect.arrayContaining(THEME_SPEC_CONTRACTS.map(theme => theme.id)))

    for (const entry of THEME_SCREENSHOT_MANIFEST) {
      expect(getRefinedThemeById(entry.themeId), entry.themeId).toMatchObject({
        id: entry.themeId,
        label: entry.displayName,
        composition: entry.composition,
      })
      expect(entry.contentFixture, entry.themeId).toBe(getThemeSpecContract(entry.themeId)?.contentFixture)
      if (entry.routeFixture) {
        expect(entry.routeFixture.length, entry.themeId).toBeGreaterThan(2)
      }
      if (entry.track === 'image-gated') {
        expect(entry.referencePath, entry.themeId).toBeTruthy()
        expect(existsSync(path.resolve(entry.referencePath!)), entry.themeId).toBe(true)
      } else {
        expect(entry.referencePath, entry.themeId).toBeNull()
      }
    }
  })

  it('keeps visual review state explicit and only approves reviewed themes', () => {
    for (const entry of THEME_SCREENSHOT_MANIFEST) {
      const review = entry.visualReview
      expect(review, entry.themeId).toBeTruthy()
      if (!review) continue
      expect(['pending', 'approved', 'needs-work'], entry.themeId).toContain(review.status)
      if (review.status === 'approved') {
        expect(review.reviewer, entry.themeId).toBeTruthy()
        expect(review.reviewedAt, entry.themeId).toBeTruthy()
        expect(review.notes?.length ?? 0, entry.themeId).toBeGreaterThan(10)
      } else {
        expect(review.notes?.length ?? 0, entry.themeId).toBeGreaterThan(10)
      }
    }

    expect(THEME_SCREENSHOT_MANIFEST
      .filter(entry => entry.visualReview?.status === 'approved')
      .map(entry => entry.themeId)).toEqual(['blueprint'])
  })

  it('declares constrained editable allowlists for every refined theme', () => {
    const requiredEditableFields = [
      'trail_name',
      'location_text',
      'occasion_text',
      'route_color',
      'colorway',
      'map_camera',
      'print_size',
    ] as const
    const lockedThemeOwnedFields = [
      'show_roads',
      'show_place_labels',
      'show_poi_labels',
      'show_contours',
      'show_hillshade',
      'show_elevation_profile',
    ] as const

    for (const theme of REFINED_THEMES) {
      expect(theme.editable_fields, theme.id).toBeTruthy()
      expect(new Set(theme.editable_fields).size, theme.id).toBe(theme.editable_fields.length)
      for (const field of requiredEditableFields) {
        expect(theme.editable_fields, theme.id).toContain(field)
      }
      for (const field of lockedThemeOwnedFields) {
        expect(theme.editable_fields, theme.id).not.toContain(field)
      }
    }
  })

  it('does not leave approved themes marked partially unimplemented', () => {
    for (const entry of THEME_SCREENSHOT_MANIFEST) {
      if (entry.visualReview?.status !== 'approved') continue
      expect(getThemeSpecContract(entry.themeId)?.notImplemented, entry.themeId).toEqual([])
    }
  })

  it('defines non-pixel semantic audit gates for every parity theme', () => {
    expect(THEME_PARITY_AUDIT_CONTRACTS).toHaveLength(27)
    expect(THEME_SEMANTIC_AUDIT_CONTRACTS).toHaveLength(27)
    expect(THEME_PARITY_AUDIT_CONTRACTS.map(contract => contract.themeId).sort()).toEqual(
      THEME_SCREENSHOT_MANIFEST.map(entry => entry.themeId).sort(),
    )
    expect(THEME_SEMANTIC_AUDIT_CONTRACTS.map(contract => contract.themeId).sort()).toEqual(
      THEME_SCREENSHOT_MANIFEST.map(entry => entry.themeId).sort(),
    )
    expect(getThemesMissingChromeContract()).toEqual([])

    for (const entry of THEME_SCREENSHOT_MANIFEST) {
      const contract = getThemeParityAuditContract(entry.themeId)
      const semanticContract = getThemeSemanticAuditContract(entry.themeId)

      expect(contract, entry.themeId).toBeTruthy()
      expect(semanticContract, entry.themeId).toBeTruthy()
      expect(contract?.track, entry.themeId).toBe(entry.track)
      expect(contract?.requiredSemanticGroups, entry.themeId).toEqual([...THEME_PARITY_SEMANTIC_GROUPS])
      expect(contract?.requiresVisualReview, entry.themeId).toBe(true)
      expect(contract?.requiresRendererReadiness, entry.themeId).toBe(true)
      expect(contract?.requiresEditableAllowlist, entry.themeId).toBe(true)
      expect(contract?.requiresDynamicRouteGeometry, entry.themeId).toBe(true)
      expect(contract?.pixelScoreIsGate, entry.themeId).toBe(false)
    }
  })

  it('scores 94 percent semantic parity separately from non-gating pixel smoke', () => {
    expect(THEME_SEMANTIC_PARITY_THRESHOLD).toBe(0.94)
    expect(scoreThemeSemanticParity({ passed: 94, total: 100 })).toBe(0.94)
    expect(meetsThemeSemanticParityThreshold({ passed: 94, total: 100 })).toBe(true)
    expect(meetsThemeSemanticParityThreshold({ passed: 93, total: 100 })).toBe(false)
    expect(passesThemeSemanticRuntimeGate({ passed: 94, total: 100 })).toBe(false)
    expect(passesThemeSemanticRuntimeGate({ passed: 94, total: 100, pass: true })).toBe(false)
    expect(passesThemeSemanticRuntimeGate(passingSemanticRuntimeSummary)).toBe(true)
    expect(passesThemeSemanticRuntimeGate(passingSemanticReportShape)).toBe(true)
    expect(passesThemeSemanticRuntimeGate({ passed: 99, total: 100, pass: false })).toBe(false)
    expect(meetsThemeSemanticParityThreshold({ passed: 100, total: 100, pass: true })).toBe(true)
    expect(meetsThemeSemanticParityThreshold(passingSemanticReportShape)).toBe(true)
    expect(scoreThemeSemanticParity({ passed: 0, total: 0 })).toBe(0)
    expect(scoreThemeSemanticParity(passingSemanticReportShape)).toBe(0.94)
    expect(hasRequiredSemanticRuntimeGroups(passingSemanticRuntimeSummary)).toBe(true)
    expect(hasRequiredSemanticRuntimeGroups({
      ...passingSemanticRuntimeSummary,
      groups: {
        ...passingSemanticRuntimeSummary.groups,
        print: { passed: 0, total: 1 },
      },
    })).toBe(false)
  })

  it('keeps semantic audit token contracts aligned with effective refined theme styles', () => {
    const mismatches: string[] = []
    const expectAligned = (themeId: string, field: string, actual: unknown, expected: unknown) => {
      if (Object.is(actual, expected)) return
      mismatches.push(`${themeId}.${field}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`)
    }

    for (const contract of THEME_SEMANTIC_AUDIT_CONTRACTS) {
      const theme = getThemeDefinition(contract.themeId)
      expect(theme, contract.themeId).toBeTruthy()

      const config = applyThemeToStyleConfig(DEFAULT_STYLE_CONFIG, theme!)

      expectAligned(contract.themeId, 'font_family', config.font_family, contract.typography.titleFont)
      expectAligned(contract.themeId, 'body_font_family', config.body_font_family, contract.typography.bodyFont)
      expectAligned(contract.themeId, 'composition', config.composition, contract.layout.composition)
      expectAligned(contract.themeId, 'background_color', config.background_color, contract.palette.backgroundColor)
      expectAligned(contract.themeId, 'label_bg_color', config.label_bg_color, contract.palette.labelBackgroundColor)
      expectAligned(contract.themeId, 'label_text_color', config.label_text_color, contract.palette.labelTextColor)
      expectAligned(contract.themeId, 'route_color', config.route_color, contract.palette.routeColor)
      expectAligned(contract.themeId, 'preset', config.preset, contract.map.preset)
      expectAligned(contract.themeId, 'show_contours', config.show_contours, contract.map.showContours)
      expectAligned(contract.themeId, 'show_hillshade', config.show_hillshade, contract.map.showHillshade)
      expectAligned(contract.themeId, 'show_roads', config.show_roads, contract.map.showRoads)
      expectAligned(contract.themeId, 'show_place_labels', config.show_place_labels, contract.map.showPlaceLabels)
      expectAligned(contract.themeId, 'show_poi_labels', config.show_poi_labels, contract.map.showPoiLabels)
      expectAligned(contract.themeId, 'show_grid', config.show_grid, contract.map.showGrid)
      expectAligned(contract.themeId, 'tile_effect', config.tile_effect, contract.map.tileEffect)
      expectAligned(contract.themeId, 'tile_grain', config.tile_grain, contract.map.tileGrain)
      expectAligned(contract.themeId, 'show_elevation_profile', config.show_elevation_profile, contract.map.showElevationProfile ?? false)
      if (contract.map.showGrid) {
        expectAligned(contract.themeId, 'grid_scope', config.grid_scope, contract.map.gridScope)
        expectAligned(contract.themeId, 'grid_opacity', config.grid_opacity, contract.map.gridOpacity)
        expectAligned(contract.themeId, 'grid_spacing', config.grid_spacing, contract.map.gridSpacing)
        expectAligned(contract.themeId, 'grid_weight', config.grid_weight, contract.map.gridWeight)
      }
      expectAligned(contract.themeId, 'route.color', config.route_color, contract.route.color)
      expectAligned(contract.themeId, 'route_width', config.route_width, contract.route.width)
      expectAligned(contract.themeId, 'route_opacity', config.route_opacity, contract.route.opacity)
      expectAligned(contract.themeId, 'show_start_pin', config.show_start_pin, contract.route.startPin)
      expectAligned(contract.themeId, 'show_finish_pin', config.show_finish_pin, contract.route.finishPin)
    }

    expect(mismatches).toEqual([])
  })

  it('only marks themes done when runtime semantic, chrome, spec, visual, and not-implemented gates are all satisfied', () => {
    expect(getParityApprovedThemeIds()).toEqual([])
    expect(getParityApprovedThemeIds({
      blueprint: passingSemanticRuntimeSummary,
    })).toEqual(['blueprint'])

    for (const entry of THEME_SCREENSHOT_MANIFEST) {
      const state = getThemeParityApprovalState(entry.themeId)

      expect(state.semanticContractExists, entry.themeId).toBe(true)
      expect(state.chromeContractExists, entry.themeId).toBe(true)
      expect(state.specContractExists, entry.themeId).toBe(true)
      expect(state.semanticRuntimePassed, entry.themeId).toBe(false)
      expect(state.semanticGroupsPassed, entry.themeId).toBe(false)
      expect(state.canMarkDone, entry.themeId).toBe(false)
      if (entry.themeId !== 'blueprint') {
        expect(state.visualReviewApproved && state.notImplementedCleared, entry.themeId).toBe(false)
      }
    }

    const approvedRuntimeState = getThemeParityApprovalState('blueprint', passingSemanticRuntimeSummary)
    expect(approvedRuntimeState.semanticRuntimePassed).toBe(true)
    expect(approvedRuntimeState.semanticGroupsPassed).toBe(true)
    expect(approvedRuntimeState.visualReviewApproved).toBe(true)
    expect(approvedRuntimeState.notImplementedCleared).toBe(true)
    expect(approvedRuntimeState.canMarkDone).toBe(true)
  })

  it('defines chrome and motif audit contracts for every parity theme', () => {
    const renderedLayoutOverrides = new Map<ColorTheme, { titlePosition: 'top' | 'bottom'; titleAlign: 'left' | 'center' }>([
      ['editorial-minimal', { titlePosition: 'bottom', titleAlign: 'left' }],
      ['dark-sky', { titlePosition: 'top', titleAlign: 'center' }],
      ['copper-night', { titlePosition: 'top', titleAlign: 'center' }],
      ['usgs-vintage', { titlePosition: 'bottom', titleAlign: 'center' }],
      ['classic-trail', { titlePosition: 'bottom', titleAlign: 'center' }],
      ['cartouche-place', { titlePosition: 'bottom', titleAlign: 'center' }],
      ['sea-chart', { titlePosition: 'bottom', titleAlign: 'left' }],
      ['relief-shaded', { titlePosition: 'bottom', titleAlign: 'left' }],
      ['contour-wash', { titlePosition: 'bottom', titleAlign: 'center' }],
      ['plein-air', { titlePosition: 'bottom', titleAlign: 'left' }],
    ])
    const renderedFooterOverrides = new Map<ColorTheme, 'standard' | 'compact' | 'data' | 'bib' | 'hidden'>([
      ['editorial-minimal', 'standard'],
      ['midcentury-travel', 'hidden'],
      ['ranch-ochre', 'hidden'],
      ['daybreak-trace', 'hidden'],
      ['dark-sky', 'compact'],
      ['copper-night', 'compact'],
      ['relief-shaded', 'standard'],
      ['field-journal', 'hidden'],
    ])
    const renderedTitleCaseOverrides = new Map<ColorTheme, 'uppercase' | 'none'>([
      ['usgs-vintage', 'uppercase'],
      ['classic-trail', 'uppercase'],
      ['cartouche-place', 'uppercase'],
    ])

    expect(THEME_CHROME_CONTRACTS).toHaveLength(27)
    expect(THEME_CHROME_CONTRACTS.map(contract => contract.themeId).sort()).toEqual(
      THEME_SCREENSHOT_MANIFEST.map(entry => entry.themeId).sort(),
    )

    for (const entry of THEME_SCREENSHOT_MANIFEST) {
      const contract = getThemeChromeContract(entry.themeId)
      const theme = getRefinedThemeById(entry.themeId)
      const typography = getPosterTypography({ color_theme: entry.themeId })
      const composition = getPosterCompositionProfile({ color_theme: entry.themeId, composition: entry.composition })
      const expectedLayout = renderedLayoutOverrides.get(entry.themeId) ?? {
        titlePosition: composition.titlePosition,
        titleAlign: composition.titleAlign,
      }
      expect(contract, entry.themeId).toBeTruthy()
      expect(contract?.typography, entry.themeId).toEqual({
        titleFont: theme?.font_family,
        titleCase: renderedTitleCaseOverrides.get(entry.themeId) ?? typography.titleCase,
      })
      expect(contract?.layout, entry.themeId).toEqual({
        ...expectedLayout,
        footerVariant: renderedFooterOverrides.get(entry.themeId) ?? composition.footerVariant,
      })

      const requiredCount = [
        ...(contract?.requiredTestIds ?? []),
        ...(contract?.requiredSelectors ?? []),
        ...(contract?.requiredRouteLayers ?? []),
      ].length
      const forbiddenCount = [
        ...(contract?.forbiddenTestIds ?? []),
        ...(contract?.forbiddenSelectors ?? []),
        ...(contract?.forbiddenRouteLayers ?? []),
      ].length

      expect(requiredCount + forbiddenCount, entry.themeId).toBeGreaterThan(0)
      expect([
        ...(contract?.requiredTestIds ?? []),
        ...(contract?.forbiddenTestIds ?? []),
        ...(contract?.requiredRouteLayers ?? []),
        ...(contract?.forbiddenRouteLayers ?? []),
      ].every(value => value.length > 0), entry.themeId).toBe(true)
    }
  })

  it('keeps intentionally unimplemented motif chrome out of theme contracts', () => {
    expect(getThemeChromeContract('sea-chart')?.requiredTestIds).toEqual(expect.arrayContaining([
      'composition-sea-chart-art',
      'sea-chart-rose',
    ]))
    expect(getThemeChromeContract('sea-chart')?.requiredSelectors).toEqual(expect.arrayContaining([
      '.sea-chart-graticule',
      '.sea-chart-neatline',
      '.sea-chart-depth-bands',
      '.sea-chart-rose',
      '.sea-chart-rose path',
      '.sea-chart-soundings',
      '.sea-chart-soundings text',
      '.sea-chart-rhumb-lines',
      '.sea-chart-rhumb-lines path',
    ]))
    expect(getThemeChromeContract('transit-diagram')?.requiredTestIds).toEqual(expect.arrayContaining([
      'composition-transit-diagram-art',
      'transit-diagram-route-stations',
      'transit-diagram-legend',
      'transit-diagram-station-key',
    ]))
    expect(getThemeChromeContract('field-journal')?.requiredTestIds).toEqual(expect.arrayContaining([
      'composition-journal-notes',
      'composition-journal-route-sketch',
      'composition-journal-tape',
    ]))
    expect(getThemeChromeContract('field-journal')?.requiredSelectors).toEqual(expect.arrayContaining([
      '.journal-note-rule',
      '.journal-specimen-tag',
      '.journal-tape-strip',
    ]))
    expect(getThemeChromeContract('botanical')?.requiredTestIds).toEqual(expect.arrayContaining([
      'composition-botanical-frame',
      'composition-kicker',
      'composition-meta-line',
    ]))
    expect(getThemeChromeContract('botanical')?.requiredSelectors).toEqual(expect.arrayContaining([
      '.botanical-corner',
      '.poster-composition--botanical-plate .poster-location-line',
    ]))
    expect(getThemeChromeContract('marathon-bib')?.requiredTestIds).toEqual(expect.arrayContaining([
      'composition-bib-ghost',
      'composition-bib-paper',
      'composition-bib-pin-hole',
      'composition-bib-tear-strip',
      'composition-bib-finish-headline',
    ]))
    expect(getThemeChromeContract('bold-modern')?.requiredTestIds).toEqual(expect.arrayContaining([
      'composition-modernist-accent',
      'pin-marker-start',
      'pin-marker-finish',
    ]))
    expect(getThemeChromeContract('bold-modern')?.forbiddenTestIds).toEqual(expect.arrayContaining([
      'composition-side-rail',
      'composition-modernist-bleed',
    ]))
    expect(getThemeChromeContract('relief-shaded')?.requiredTestIds).toEqual(expect.arrayContaining([
      'composition-relief-bands',
      'composition-relief-legend',
      'composition-relief-stamp',
    ]))
    expect(getThemeChromeContract('relief-shaded')?.requiredSelectors).toEqual(expect.arrayContaining([
      '.relief-band',
      '.relief-legend-swatch',
    ]))
    expect(getThemeChromeContract('dark-sky')?.requiredTestIds).toEqual(expect.arrayContaining([
      'composition-star-field',
      'composition-star-constellation',
      'composition-darksky-ridge',
      'composition-footer-note',
    ]))
    expect(getThemeChromeContract('copper-night')?.requiredTestIds).toEqual(expect.arrayContaining([
      'composition-star-field',
      'composition-star-constellation',
      'composition-darksky-ridge',
      'composition-footer-note',
    ]))
    expect(getThemeChromeContract('moonstone')?.requiredTestIds).toEqual(expect.arrayContaining([
      'composition-technical-line-footer',
    ]))
    expect(getThemeChromeContract('electric-atlas')?.requiredTestIds).toEqual(expect.arrayContaining([
      'composition-map-grid-overlay',
      'composition-electric-trace',
      'composition-electric-chip',
    ]))
    expect(getThemeChromeContract('electric-atlas')?.requiredSelectors).toEqual(expect.arrayContaining([
      '.electric-trace-line',
      '.composition-electric-chip b',
    ]))
    expect(getThemeChromeContract('blueprint-strava')?.requiredTestIds).toEqual(expect.arrayContaining([
      'blueprint-drafting-topline',
      'blueprint-drafting-figure',
      'composition-technical-data-footer',
    ]))
    expect(getThemeChromeContract('blueprint-strava')?.requiredSelectors).toContain('.composition-technical-data-item')
    expect(getThemeChromeContract('plein-air')?.requiredTestIds).toEqual(expect.arrayContaining([
      'composition-plein-air-deckle',
      'composition-plein-air-palette',
    ]))
    expect(getThemeChromeContract('plein-air')?.requiredSelectors).toEqual(expect.arrayContaining([
      '.plein-air-palette-swatch',
      '.plein-air-deckle-edge',
    ]))
    expect(getThemeChromeContract('blueprint')?.requiredTestIds).toEqual(expect.arrayContaining([
      'blueprint-drafting-topline',
      'blueprint-drafting-figure',
      'blueprint-sheet-neatline',
    ]))
    expect(getThemeChromeContract('usgs-vintage')?.requiredTestIds).toEqual(expect.arrayContaining([
      'usgs-heritage-coordinate',
      'usgs-heritage-scale',
      'usgs-coordinate-ticks',
      'usgs-coordinate-tick',
    ]))
    expect(getThemeChromeContract('usgs-vintage')?.requiredSelectors).toEqual(expect.arrayContaining([
      '.usgs-heritage-map-label--coord',
      '.usgs-heritage-map-label--scale',
      '.usgs-coordinate-tick',
      '.usgs-coordinate-tick--nw',
      '.usgs-coordinate-tick--ne',
      '.usgs-coordinate-tick--se',
      '.usgs-coordinate-tick--sw',
    ]))
    expect(getThemeChromeContract('brutalist')?.requiredTestIds).toEqual(expect.arrayContaining([
      'composition-brutalist-registration-marks',
    ]))
    expect(getThemeChromeContract('brutalist')?.forbiddenTestIds).toEqual(expect.arrayContaining([
      'composition-brutalist-baseline-grid',
    ]))
    expect(getThemeChromeContract('brutalist')?.requiredSelectors).toEqual(expect.arrayContaining([
      '.composition-brutalist-registration-marks',
    ]))
    expect(getThemeChromeContract('brutalist')?.forbiddenSelectors).toEqual(expect.arrayContaining([
      '.composition-brutalist-baseline-grid',
    ]))
    for (const themeId of ['midcentury-travel', 'ranch-ochre', 'daybreak-trace'] as const) {
      expect(getThemeChromeContract(themeId)?.requiredSelectors, themeId).toEqual(expect.arrayContaining([
        '.composition-travel-sun__disk',
        '.composition-travel-sun__arc--wide',
        '.composition-travel-sun__arc--mid',
        '.composition-travel-sun__arc--inner',
      ]))
    }
  })

  it('keeps chrome contracts from relying only on route layer assertions', () => {
    for (const entry of THEME_SCREENSHOT_MANIFEST) {
      const contract = getThemeChromeContract(entry.themeId)
      const chromeAssertionCount = [
        ...(contract?.requiredTestIds ?? []),
        ...(contract?.requiredSelectors ?? []),
        ...(contract?.forbiddenTestIds ?? []),
        ...(contract?.forbiddenSelectors ?? []),
      ].length

      expect(chromeAssertionCount, entry.themeId).toBeGreaterThan(0)
    }
  })

  it('records explicit not-implemented decisions from the standalone contract', () => {
    for (const entry of THEME_SCREENSHOT_MANIFEST) {
      expect(getThemeSpecContract(entry.themeId)?.notImplemented, entry.themeId).toEqual([])
    }
  })

  it('adds the design-update theme definitions without changing current defaults', () => {
    expect(REFINED_THEMES).toHaveLength(27)
    expect(DEFAULT_STYLE_CONFIG.color_theme).toBe('chalk')
    expect(DEFAULT_STYLE_CONFIG.show_roads).toBe(true)
    expect(DEFAULT_STYLE_CONFIG.show_hillshade).toBe(false)
    expect(DEFAULT_STYLE_CONFIG.composition).toBeUndefined()
    expect(DEFAULT_STYLE_CONFIG.route_width).toBe(DEFAULT_ROUTE_WIDTH)
    expect(DEFAULT_STYLE_CONFIG.segment_casing_width).toBe(DEFAULT_SEGMENT_CASING_WIDTH)
  })

  it('keeps every refined theme wired to a valid composition and map defaults', () => {
    for (const theme of REFINED_THEMES) {
      expect(COMPOSITION_IDS).toContain(theme.composition)
      expect(theme.audience.length).toBeGreaterThan(0)
      expect(contrastRatio(theme.label_text_color, theme.label_bg_color), theme.id).toBeGreaterThanOrEqual(4.5)
      expect(theme.map_defaults.preset, theme.id).toBeTruthy()
      expect(theme.map_defaults.preset, theme.id).toMatch(/^radmaps-/)
      expect(theme.map_defaults.atlas_style_id, theme.id).toBe(theme.map_defaults.preset)
      expect(typeof theme.map_defaults.show_grid, theme.id).toBe('boolean')
      if (theme.map_defaults.show_contours) {
        expect(theme.map_defaults.contour_detail, theme.id).toBeGreaterThanOrEqual(0)
        expect(theme.map_defaults.contour_major_width, theme.id).toBeGreaterThan(0)
        expect(theme.map_defaults.contour_major_width, theme.id).toBeLessThanOrEqual(3)
        expect(theme.map_defaults.contour_opacity, theme.id).toBeLessThanOrEqual(0.6)
      }
      if (theme.map_defaults.show_grid) {
        expect(theme.map_defaults.grid_opacity, theme.id).toBeGreaterThan(0)
        expect(theme.map_defaults.grid_opacity, theme.id).toBeLessThanOrEqual(theme.id === 'cartouche-place' ? 0.3 : 0.2)
        expect(theme.map_defaults.grid_scope, theme.id).toMatch(/^(poster|map)$/)
      }
    }
  })

  it('declares a constrained editable allowlist for every refined theme', () => {
    const lockedThemeOwnedFields = [
      'show_grid',
      'grid_scope',
      'grid_opacity',
      'grid_weight',
      'grid_spacing',
      'poster_layout',
      'tile_effect',
      'atlas_layers',
      'atlas_layer_settings',
      'trail_segments',
    ]

    for (const theme of REFINED_THEMES) {
      expect(theme.editable_fields.length, theme.id).toBeGreaterThan(0)
      expect(theme.editable_fields, theme.id).toEqual(expect.arrayContaining([
        'trail_name',
        'location_text',
        'occasion_text',
        'route_color',
        'map_camera',
        'print_size',
      ]))
      expect(new Set(theme.editable_fields).size, theme.id).toBe(theme.editable_fields.length)
      for (const field of lockedThemeOwnedFields) {
        expect(theme.editable_fields, `${theme.id} exposes ${field}`).not.toContain(field)
      }
    }
  })

  it('keeps blueprint grids scoped to the screenshot-backed drafting surface', () => {
    expect(getRefinedThemeById('blueprint')?.map_defaults).toMatchObject({
      show_grid: true,
      grid_scope: 'poster',
      grid_opacity: 0.2,
      grid_spacing: 5,
    })
    expect(getRefinedThemeById('blueprint-strava')?.map_defaults).toMatchObject({
      show_grid: true,
      grid_scope: 'map',
      grid_opacity: 0.14,
    })
  })

  it('exposes new theme and composition ids through the shared unions', () => {
    const themeId: ColorTheme = 'cartouche-place'
    const compositionId: CompositionId = 'place-frame'
    const config: Partial<StyleConfig> = {
      color_theme: themeId,
      composition: compositionId,
      show_grid: false,
      grid_scope: 'poster',
      grid_opacity: 0.2,
      grid_weight: 1,
      dark: false,
      audience: 'Marathon / event',
    }

    expect(REFINED_THEME_IDS).toContain(config.color_theme)
    expect(COMPOSITION_IDS).toContain(config.composition)
    expect(ALL_COLOR_THEME_IDS).toContain('chalk')
    expect(ALL_COLOR_THEME_IDS).toContain('blueprint-strava')
    expect(ALL_COLOR_THEME_IDS).toContain('contour-wash')
    expect(ALL_COLOR_THEME_IDS).toContain('classic-trail')
    expect(ALL_COLOR_THEME_IDS).toContain('electric-atlas')
    expect(ALL_COLOR_THEME_IDS).toContain('cartouche-place')
    expect(ALL_COLOR_THEME_IDS).toContain('plein-air')
  })

  it('keeps legacy themes renderable while declaring migration targets', () => {
    const legacyIds = COLOR_THEMES.filter(theme => theme.legacy).map(theme => theme.id)

    expect(legacyIds).toContain('chalk')
    expect(legacyIds).toContain('topo-art')
    expect(LEGACY_THEME_MIGRATION_TARGETS.chalk).toBe('editorial-minimal')
    expect(LEGACY_THEME_MIGRATION_TARGETS['mid-century']).toBe('midcentury-travel')
    expect(getThemeDefinition('chalk')?.legacy).toBe(true)
    expect(getRefinedThemeById('editorial-minimal')?.composition).toBe('editorial-tall')
    expect(getRefinedThemeById('midcentury-travel')?.map_defaults.preset).toBe('radmaps-simple-contour')
  })

  it('keeps mid-century map labels readable on its warm map surface', () => {
    const midcentury = getRefinedThemeById('midcentury-travel')

    expect(midcentury?.map_defaults.place_labels_color).toBe('#31442D')
    expect(midcentury?.map_defaults.poi_labels_color).toBe('#31442D')
    expect(midcentury?.map_defaults.atlas_layer_settings?.place?.label_color).toBe('#31442D')
  })

  it('backs Risograph with owned contour linework instead of raster map chrome', () => {
    const risograph = getRefinedThemeById('risograph')

    expect(risograph?.map_defaults.preset).toBe('radmaps-simple-contour')
    expect(risograph?.map_defaults.show_roads).toBe(false)
    expect(risograph?.map_defaults.show_start_pin).toBe(false)
    expect(risograph?.map_defaults.show_finish_pin).toBe(false)
    expect(risograph?.map_defaults.atlas_layers).toMatchObject({
      contour: true,
      landcover: true,
      water: false,
      waterway: false,
      park: false,
      transportation: false,
      building: false,
      place: false,
      poi: false,
    })
    expect(risograph?.map_defaults.atlas_layer_settings?.transportation?.show_major).toBe(false)
    expect(risograph?.map_defaults.atlas_layer_settings?.water?.fill_opacity).toBe(0)
  })

  it('keeps contour-led themes aligned to their screenshot map density', () => {
    const brutalist = getRefinedThemeById('brutalist')
    const contourWash = getRefinedThemeById('contour-wash')

    expect(brutalist?.composition).toBe('brutalist-slab')
    expect(brutalist?.map_defaults.preset).toBe('radmaps-toner-light')
    expect(brutalist?.map_defaults.show_contours).toBe(true)
    expect(brutalist?.map_defaults.contour_detail).toBe(1)
    expect(contourWash?.composition).toBe('art-wash')
    expect(contourWash?.map_defaults.preset).toBe('radmaps-contour-wash')
    expect(contourWash?.map_defaults.show_contours).toBe(true)
    expect(contourWash?.route_color).toBe('#151412')
  })

  it('registers the expanded classical and expressive theme recipes', () => {
    expect(getRefinedThemeById('classic-trail')?.composition).toBe('park-quad')
    expect(getRefinedThemeById('classic-trail')?.colorway_of).toBe('usgs-vintage')
    expect(getRefinedThemeById('ranch-ochre')?.composition).toBe('travel-banner')
    expect(getRefinedThemeById('ranch-ochre')?.colorway_of).toBe('midcentury-travel')
    expect(getRefinedThemeById('blackline')?.composition).toBe('modernist-block')
    expect(getRefinedThemeById('blackline')?.colorway_of).toBe('bold-modern')
    expect(getRefinedThemeById('copper-night')?.composition).toBe('darksky-stars')
    expect(getRefinedThemeById('moonstone')?.map_defaults.show_grid).toBe(true)
    expect(getRefinedThemeById('night-ride')?.map_defaults.trail_label_style).toBeUndefined()
    expect(getRefinedThemeById('daybreak-trace')?.font_family).toBe('Oswald')
    expect(getRefinedThemeById('electric-atlas')?.map_defaults.grid_spacing).toBe(6)
    expect(getRefinedThemeById('electric-atlas')?.route_color).toBe('#FA498E')
  })

  it('registers the standalone review new-direction themes', () => {
    expect(getRefinedThemeById('cartouche-place')?.composition).toBe('place-frame')
    expect(getRefinedThemeById('sea-chart')?.composition).toBe('sea-chart')
    expect(getRefinedThemeById('relief-shaded')?.map_defaults.show_hillshade).toBe(true)
    expect(getRefinedThemeById('relief-shaded')?.route_color).toBe('#14110D')
    expect(getRefinedThemeById('relief-shaded')?.map_defaults.hillshade_intensity).toBeLessThan(0.3)
    expect(getRefinedThemeById('relief-shaded')?.map_defaults.route_width).toBeGreaterThanOrEqual(5)
    expect(getRefinedThemeById('transit-diagram')?.font_family).toBe('Outfit')
    expect(getRefinedThemeById('transit-diagram')?.map_defaults.preset).toBe('radmaps-simple-contour')
    expect(getRefinedThemeById('transit-diagram')?.map_defaults.route_opacity).toBeGreaterThanOrEqual(0.9)
    expect(getRefinedThemeById('transit-diagram')?.map_defaults.show_grid).toBe(true)
    expect(getRefinedThemeById('plein-air')?.map_defaults.preset).toBe('radmaps-watercolor-paper')
  })
})
