import { describe, expect, it } from 'vitest'
import { DEFAULT_STYLE_CONFIG, type RouteStats, type StyleConfig } from '../types'
import {
  createInitialPuckPosterData,
  puckPosterDataToDocument,
  type PuckPosterData,
} from '../utils/puckPosterSpike'

const stats: RouteStats = {
  distance_km: 30.7,
  elevation_gain_m: 1320,
  elevation_loss_m: 1280,
  max_elevation_m: 390,
  min_elevation_m: 180,
  date: '2026-05-10',
  location: 'Kickapoo State Park',
}

const styleConfig: StyleConfig = {
  ...DEFAULT_STYLE_CONFIG,
  trail_name: 'Kickapoo Endurance Race',
  location_text: 'Kickapoo State Park',
  occasion_text: 'Complete trail network',
  color_theme: 'editorial-minimal',
}

describe('Puck poster spike adapter', () => {
  it('creates a structured RadMaps document from seeded Puck poster data', () => {
    const data = createInitialPuckPosterData(styleConfig, stats)
    const document = puckPosterDataToDocument(data)

    expect(document.source).toBe('puck-spike')
    expect(document.aspect).toBe('2:3')
    expect(document.themeId).toBe('editorial-minimal')
    expect(document.bands.map).toMatchObject({
      locked: true,
      renderer: 'MapPreview.vue',
    })
    expect(document.bands.header.rows).toHaveLength(3)
    expect(document.bands.header.rows[0]?.cells).toHaveLength(2)
    expect(document.bands.header.rows[1]?.cells).toHaveLength(1)
    expect(document.bands.footer.rows[0]?.cells).toHaveLength(3)
    expect(JSON.stringify(document)).toContain('Kickapoo Endurance Race')
  })

  it('ignores unknown components and strips raw HTML/CSS-shaped fields', () => {
    const data: PuckPosterData = {
      root: {
        props: {
          aspect: '3:2',
          themeId: 'new-poster-system',
        },
      },
      content: [
        {
          type: 'Row',
          props: {
            id: 'unsafe-row',
            band: 'header',
            columns: 2,
            heightFr: 1,
            html: '<section>do not persist</section>',
            css: '.bad { position: fixed }',
            col1: [{
              type: 'TextBlock',
              props: {
                id: 'unsafe-text',
                text: '<script>alert(1)</script>Alpine Loop',
                role: 'title',
                align: 'center',
                style: { position: 'fixed' },
              },
            }],
            col2: [{
              type: 'RawHtml',
              props: {
                html: '<img src="https://example.test/remote.png">',
              },
            }],
          },
        },
      ],
    }

    const document = puckPosterDataToDocument(data)
    const serialized = JSON.stringify(document)

    expect(document.aspect).toBe('3:2')
    expect(document.bands.header.rows[0]?.cells[0]?.blocks[0]).toMatchObject({
      kind: 'text',
      text: 'alert(1)Alpine Loop',
      align: 'center',
    })
    expect(document.bands.header.rows[0]?.cells[1]?.blocks).toEqual([])
    expect(serialized).not.toContain('<script')
    expect(serialized).not.toContain('position: fixed')
    expect(serialized).not.toContain('RawHtml')
    expect(serialized).not.toContain('https://example.test')
  })

  it('turns explicit spacer rows into first-class poster rows', () => {
    const document = puckPosterDataToDocument({
      root: { props: { aspect: '2:3', themeId: 'spacer-theme' } },
      content: [
        {
          type: 'SpacerRow',
          props: {
            id: 'header-space',
            band: 'header',
            heightFr: 1.25,
          },
        },
        {
          type: 'SpacerRow',
          props: {
            id: 'footer-space',
            band: 'footer',
            heightFr: 0.5,
          },
        },
      ],
    })

    expect(document.bands.header.rows[0]).toMatchObject({
      id: 'header-space',
      kind: 'spacer',
      heightFr: 1.25,
    })
    expect(document.bands.footer.rows[0]?.cells[0]?.blocks[0]).toMatchObject({
      kind: 'spacer',
      heightFr: 0.5,
    })
  })
})
