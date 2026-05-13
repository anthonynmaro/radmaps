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

describe('poster layout merge', () => {
  it('hydrates legacy chrome slots into default header, footer, and rails', () => {
    const layout = defaultPosterLayout(baseConfig, stats)
    expect(layout.blocks.header.some(block => block.slot === 'trail_name')).toBe(true)
    expect(layout.blocks.header.some(block => block.slot === 'occasion_text')).toBe(true)
    expect(layout.blocks.footer.some(block => block.slot === 'distance')).toBe(true)
    expect(layout.blocks.footer.some(block => block.slot === 'date')).toBe(true)
    expect(layout.blocks.railLeft.some(block => block.slot === 'composition_side_rail')).toBe(true)
  })

  it('applies sparse block edits by id without replacing the whole default layout', () => {
    const defaults = defaultPosterLayout(baseConfig, stats)
    const merged = mergePosterLayout(defaults, {
      blocks: {
        header: [{ id: 'hdr-title', kind: 'title', slot: 'trail_name', col: 1, row: 2, span: 8, scale: 1.25 }],
      },
    })
    const title = merged.blocks.header.find(block => block.id === 'hdr-title')
    expect(title?.span).toBe(8)
    expect(title?.scale).toBe(1.25)
    expect(merged.blocks.header.some(block => block.id === 'hdr-kicker')).toBe(true)
  })

  it('honors tombstones for deleted composition blocks', () => {
    const layout = effectivePosterLayout({
      ...baseConfig,
      poster_layout: {
        blocks: {
          footer: [{ id: 'ft-note', kind: 'note', slot: 'composition_footer', col: 10, row: 1, span: 3, deleted: true }],
        },
      },
    }, stats)
    expect(layout.blocks.footer.some(block => block.id === 'ft-note')).toBe(false)
  })

  it('keeps user-added blocks when patching another sparse field', () => {
    const current: PartialPosterLayout = {
      blocks: {
        header: [{ id: 'custom', kind: 'text', col: 1, row: 1, span: 3, text: 'Custom' }],
      },
    }
    const next = patchPosterLayout(current, { bands: { header: { height: 24 } } })
    expect(next.blocks?.header?.[0]?.id).toBe('custom')
    expect(next.bands?.header?.height).toBe(24)
  })
})

