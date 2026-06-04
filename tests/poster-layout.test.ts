import { describe, expect, it } from 'vitest'
import { DEFAULT_STYLE_CONFIG, type PartialPosterLayout, type RouteStats, type StyleConfig } from '../types'
import { defaultPosterLayout, effectivePosterLayout, mergePosterLayout, patchPosterLayout } from '../utils/posterLayout'

const stats: RouteStats = {
  distance_km: 10,
  elevation_gain_m: 300,
  elevation_loss_m: 300,
  max_elevation_m: 1000,
  min_elevation_m: 700,
  date: '2025-05-01',
  location: 'Marin County',
}

const baseConfig: StyleConfig = {
  ...DEFAULT_STYLE_CONFIG,
  trail_name: 'Mount Tam',
  occasion_text: 'Morning route',
  location_text: 'Mill Valley',
  composition: 'modernist-block',
  labels: {
    ...DEFAULT_STYLE_CONFIG.labels,
    show_date: true,
  },
}

function blocksFor(layout: ReturnType<typeof defaultPosterLayout>, band: 'header' | 'footer' | 'railLeft' | 'railRight') {
  return layout.bands[band].rows.flatMap(row => row.cells.map(cell => cell.block).filter(Boolean))
}

describe('poster layout merge', () => {
  it('hydrates legacy chrome slots into default header, footer, and rails', () => {
    const layout = defaultPosterLayout(baseConfig, stats)
    expect(blocksFor(layout, 'header').some(block => block?.slot === 'trail_name')).toBe(true)
    expect(blocksFor(layout, 'header').some(block => block?.slot === 'occasion_text')).toBe(false)
    expect(blocksFor(layout, 'footer').some(block => block?.slot === 'distance')).toBe(true)
    expect(blocksFor(layout, 'footer').some(block => block?.slot === 'date')).toBe(true)
    expect(blocksFor(layout, 'footer').some(block => block?.slot === 'composition_footer')).toBe(false)
    expect(blocksFor(layout, 'railLeft').some(block => block?.slot === 'composition_side_rail')).toBe(true)
  })

  it('represents intentional vertical whitespace as spacer rows', () => {
    const layout = defaultPosterLayout(baseConfig, stats)
    expect(layout.bands.header.rows[0]?.id).toBe('header-spacer-top')
    expect(layout.bands.header.rows.at(-1)?.id).toBe('header-spacer-bottom')
    expect(layout.bands.header.rows[0]?.cells[0]?.block?.kind).toBe('spacer')
    expect(layout.bands.footer.rows[0]?.id).toBe('footer-spacer-top')
    expect(layout.bands.footer.rows.at(-1)?.id).toBe('footer-spacer-bottom')
    expect(layout.bands.footer.rows.at(-1)?.cells[0]?.block?.kind).toBe('spacer')
  })

  it('keeps editorial starter top whitespace compact', () => {
    const layout = defaultPosterLayout({
      ...baseConfig,
      composition: 'editorial-tall',
    }, stats)
    const topSpacer = layout.bands.header.rows.find(row => row.id === 'header-spacer-top')
    const titleRow = layout.bands.header.rows.find(row => row.id === 'header-title')

    expect(layout.bands.header.height).toBeLessThanOrEqual(23)
    expect(topSpacer?.fr).toBeLessThanOrEqual(0.4)
    expect(titleRow?.fr).toBeGreaterThan(2)
  })

  it('omits decorative footer notes from default compositions', () => {
    const editorial = defaultPosterLayout({
      ...baseConfig,
      composition: 'editorial-tall',
    }, stats)
    const performance = defaultPosterLayout({
      ...baseConfig,
      composition: 'splits-grid',
    }, stats)

    expect(blocksFor(editorial, 'footer').some(block => block?.slot === 'composition_footer')).toBe(false)
    expect(blocksFor(performance, 'footer').some(block => block?.slot === 'composition_footer')).toBe(false)
  })

  it('keeps default occasion text only on roomier compositions', () => {
    const roomierCompositions = ['editorial-tall', 'journal-spread'] as const
    const denseCompositions = ['blueprint-grid', 'blueprint-strava', 'splits-grid', 'bib-numerals', 'brutalist-slab'] as const

    for (const composition of roomierCompositions) {
      const layout = defaultPosterLayout({ ...baseConfig, composition }, stats)
      expect(blocksFor(layout, 'header').some(block => block?.slot === 'occasion_text')).toBe(true)
    }

    for (const composition of denseCompositions) {
      const layout = defaultPosterLayout({ ...baseConfig, composition }, stats)
      expect(blocksFor(layout, 'header').some(block => block?.slot === 'occasion_text')).toBe(false)
    }
  })

  it('applies sparse row and cell edits by id without replacing the whole default layout', () => {
    const defaults = defaultPosterLayout(baseConfig, stats)
    const merged = mergePosterLayout(defaults, {
      bands: {
        header: {
          rows: [{
            id: 'header-title',
            cells: [{ id: 'hdr-title', block: { id: 'hdr-title-block', kind: 'title', slot: 'trail_name', scale: 1.25 } }],
          }],
        },
      },
    })
    const title = blocksFor(merged, 'header').find(block => block?.id === 'hdr-title-block')
    expect(title?.scale).toBe(1.25)
    expect(blocksFor(merged, 'header').some(block => block?.slot === 'location_text')).toBe(true)
  })

  it('honors tombstones for deleted cells', () => {
    const layout = effectivePosterLayout({
      ...baseConfig,
      poster_layout: {
        bands: {
          footer: {
            rows: [{
              id: 'footer-primary',
              cells: [{ id: 'ft-date', deleted: true }],
            }],
          },
        },
      },
    }, stats)
    expect(blocksFor(layout, 'footer').some(block => block?.slot === 'date')).toBe(false)
  })

  it('honors tombstones for deleted default rows', () => {
    const layout = effectivePosterLayout({
      ...baseConfig,
      poster_layout: {
        bands: {
          header: {
            rows: [{
              id: 'header-subtitle',
              deleted: true,
              cells: [{ id: 'hdr-location', deleted: true }],
            }],
          },
        },
      },
    }, stats)
    expect(layout.bands.header.rows.some(row => row.id === 'header-subtitle')).toBe(false)
    expect(blocksFor(layout, 'header').some(block => block?.slot === 'location_text')).toBe(false)
  })

  it('does not create a gain stat when the route has no elevation data', () => {
    const layout = defaultPosterLayout(baseConfig, {
      ...stats,
      elevation_gain_m: 0,
      elevation_loss_m: 0,
    })
    expect(blocksFor(layout, 'footer').some(block => block?.slot === 'elevation_gain')).toBe(false)
  })

  it('keeps an explicit gain text override when elevation data is missing', () => {
    const layout = defaultPosterLayout({
      ...baseConfig,
      poster_text_overrides: {
        elevation_gain: { text: "5,448'\nGain" },
      },
    }, {
      ...stats,
      elevation_gain_m: 0,
      elevation_loss_m: 0,
    })
    expect(blocksFor(layout, 'footer').some(block => block?.slot === 'elevation_gain')).toBe(true)
  })

  it('keeps user-added rows when patching another sparse field', () => {
    const current: PartialPosterLayout = {
      bands: {
        header: {
          rows: [{ id: 'custom-row', cells: [{ id: 'custom', block: { id: 'custom-block', kind: 'text', text: 'Custom' } }] }],
        },
      },
    }
    const next = patchPosterLayout(current, { bands: { header: { height: 24 } } })
    expect(next.bands?.header?.rows?.[0]?.id).toBe('custom-row')
    expect(next.bands?.header?.height).toBe(24)
  })
})
