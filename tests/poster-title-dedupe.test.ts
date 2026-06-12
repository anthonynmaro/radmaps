/**
 * Hero-title dedupe rule (utils/posterFormatters.ts).
 *
 * Defect class: hero-title compositions (riso-stack, brutalist-slab,
 * modernist-block, …) own the poster title, but derived decor/slot defaults
 * historically used the trail name as a terminal fallback. With real user
 * data (trail name only — no occasion, no location) the poster rendered the
 * title twice: the composition hero AND a small caption/footer-note/kicker.
 * Curated audit fixtures masked this because their fixtureOverrides always
 * provide an occasion/location/composition_footer.
 *
 * Rule under test: a DERIVED value may never resolve to the same normalized
 * string as the hero title — it resolves to its next fallback or drops
 * ephemerally (data contract `ifMissing: 'remove'` posture).
 */
import { describe, expect, it } from 'vitest'
import { DEFAULT_STYLE_CONFIG, type RouteStats, type StyleConfig } from '../types'
import {
  duplicatesPosterTitle,
  firstPosterTextWithoutTitle,
  normalizePosterText,
  resolveOccasionLocationNote,
  resolveRisoCaptionText,
} from '../utils/posterFormatters'
import { buildThemeDataContext, resolveThemeDataContract } from '../utils/themeDataContract'
import { defaultPosterLayout } from '../utils/posterLayout'
import type { ChromeBlock, CompositionId, ColorTheme } from '../types'

const REAL_TITLE = 'H&H Connector'

/** Real-user-shaped config: a GPX upload with a trail name and nothing else. */
function realDataConfig(theme: ColorTheme, composition: CompositionId): StyleConfig {
  return {
    ...DEFAULT_STYLE_CONFIG,
    color_theme: theme,
    composition,
    trail_name: REAL_TITLE,
    occasion_text: '',
    location_text: '',
  }
}

/** Real-user-shaped stats: distance from the GPX, no location/date enrichment. */
const REAL_STATS: Partial<RouteStats> = { distance_km: 49.7 }

describe('normalizePosterText / duplicatesPosterTitle', () => {
  it('normalizes case and whitespace', () => {
    expect(normalizePosterText('  H&H   Connector \n')).toBe('h&h connector')
    expect(normalizePosterText(null)).toBe('')
    expect(normalizePosterText(undefined)).toBe('')
  })

  it('detects duplicates across case/whitespace variants', () => {
    expect(duplicatesPosterTitle('H&H CONNECTOR', REAL_TITLE)).toBe(true)
    expect(duplicatesPosterTitle(' h&h  connector ', REAL_TITLE)).toBe(true)
    expect(duplicatesPosterTitle('Boston Marathon', REAL_TITLE)).toBe(false)
  })

  it('never flags empty values or empty titles', () => {
    expect(duplicatesPosterTitle('', REAL_TITLE)).toBe(false)
    expect(duplicatesPosterTitle(REAL_TITLE, '')).toBe(false)
    expect(duplicatesPosterTitle('', '')).toBe(false)
  })
})

describe('firstPosterTextWithoutTitle (kicker fallback chains)', () => {
  it('modernist-block kicker drops when the region equals the title', () => {
    expect(firstPosterTextWithoutTitle([REAL_TITLE], REAL_TITLE)).toBe('')
  })

  it('place-frame kicker skips a title-valued location to the static fallback', () => {
    expect(firstPosterTextWithoutTitle(['', 'Jackson Hole', 'PLACE PORTRAIT'], 'Jackson Hole')).toBe('PLACE PORTRAIT')
  })

  it('transit-diagram kicker skips a title-valued location', () => {
    expect(firstPosterTextWithoutTitle(['Jackson Hole', 'TOUR LINE'], 'Jackson Hole')).toBe('TOUR LINE')
  })

  it('keeps non-duplicate candidates untouched (fixture-shaped data)', () => {
    expect(firstPosterTextWithoutTitle(['Teton County, Wyoming', 'PLACE PORTRAIT'], 'Jackson Hole')).toBe('Teton County, Wyoming')
    expect(firstPosterTextWithoutTitle(['WASHINGTON', 'FIELD STUDY'], 'Wonderland')).toBe('WASHINGTON')
  })
})

describe('riso-stack caption (the founder-screenshot defect)', () => {
  it('real data — trail name only — drops the caption instead of repeating the hero title', () => {
    expect(resolveRisoCaptionText('', REAL_TITLE)).toBe('')
  })

  it('treats generic boilerplate occasions as missing (no title substitution)', () => {
    expect(resolveRisoCaptionText('Complete trail network', REAL_TITLE)).toBe('')
  })

  it('drops an occasion that normalizes to the hero title', () => {
    expect(resolveRisoCaptionText(' h&h  CONNECTOR ', REAL_TITLE)).toBe('')
  })

  it('fixture-shaped data is unchanged: a real occasion renders as the caption', () => {
    expect(resolveRisoCaptionText('The Wonderland Trail', 'Wonderland')).toBe('The Wonderland Trail')
  })
})

describe('brutalist-slab footer note', () => {
  it('real data — trail name only — resolves to empty (note drops ephemerally)', () => {
    expect(resolveOccasionLocationNote('', '', REAL_TITLE)).toBe('')
  })

  it('real data with location keeps only the location line (no title line)', () => {
    expect(resolveOccasionLocationNote('', 'Danville, Illinois', REAL_TITLE)).toBe('Danville, Illinois')
  })

  it('drops a title-valued occasion but keeps the location line', () => {
    expect(resolveOccasionLocationNote(REAL_TITLE, 'Danville, Illinois', REAL_TITLE)).toBe('Danville, Illinois')
  })

  it('fixture-shaped data is unchanged: occasion + location render as two lines', () => {
    expect(resolveOccasionLocationNote('Boston Marathon', 'Boston, Massachusetts', 'Boston'))
      .toBe('Boston Marathon\nBoston, Massachusetts')
  })
})

describe('resolved layout has exactly one title-valued text node (real data)', () => {
  const HERO_CASES: Array<[ColorTheme, CompositionId]> = [
    ['risograph', 'riso-stack'],
    ['bold-modern', 'modernist-block'],
    ['brutalist', 'brutalist-slab'],
  ]

  function collectBlocks(layout: ReturnType<typeof defaultPosterLayout>): ChromeBlock[] {
    const blocks: ChromeBlock[] = []
    for (const band of Object.values(layout.bands)) {
      for (const row of band.rows) {
        for (const cell of row.cells) {
          if (cell.block && !cell.block.deleted) blocks.push(cell.block)
        }
      }
    }
    for (const anchor of layout.anchors ?? []) {
      for (const row of anchor.rows ?? []) {
        for (const cell of row.cells) {
          if (cell.block && !cell.block.deleted) blocks.push(cell.block)
        }
      }
    }
    return blocks
  }

  for (const [theme, composition] of HERO_CASES) {
    it(`${composition}: one trail_name block in the layout, no other slot resolves to the title`, () => {
      const styleConfig = realDataConfig(theme, composition)
      const layout = defaultPosterLayout(styleConfig, REAL_STATS as RouteStats)
      const blocks = collectBlocks(layout)

      // Exactly one title-kind / trail_name-slot node. Band anchors mirror the
      // band rows, so count unique block ids rather than raw occurrences.
      const titleBlockIds = new Set(
        blocks.filter(block => block.slot === 'trail_name' || block.kind === 'title').map(block => block.id),
      )
      expect(titleBlockIds.size).toBe(1)

      // No non-title slot value in the resolved contract equals the title.
      const context = buildThemeDataContext({ styleConfig, stats: REAL_STATS })
      const contract = resolveThemeDataContract(theme, composition, context, 'final')
      for (const [slot, value] of Object.entries(contract.resolvedSlotValues)) {
        if (slot === 'trail_name') continue
        expect(
          duplicatesPosterTitle(value, REAL_TITLE),
          `slot ${slot} resolved to the hero title: "${value}"`,
        ).toBe(false)
      }
    })
  }

  it('fixture-shaped context still resolves the occasion (caption present, not a title dupe)', () => {
    const styleConfig: StyleConfig = {
      ...realDataConfig('risograph', 'riso-stack'),
      trail_name: 'Wonderland',
      occasion_text: 'The Wonderland Trail',
      location_text: 'Mount Rainier, Washington',
    }
    expect(resolveRisoCaptionText(styleConfig.occasion_text, styleConfig.trail_name)).toBe('The Wonderland Trail')
  })
})
