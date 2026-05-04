// tests/svgTemplate.test.ts
//
// Cross-product fixtures: every (label_position × border_style) combo
// renders deterministic SVG content. We don't pixel-diff (that's the
// compositor test); we assert structural properties.

import { describe, expect, it } from 'vitest'

import { getPrintFraming } from '../../utils/print/printFraming.js'

import { buildChromeSvg } from '../src/chrome/svgTemplate.js'
import type { RouteStats, StyleConfig } from '../src/types.js'

const baseStats: RouteStats = {
  distance_km: 25.6,
  elevation_gain_m: 1234,
  elevation_loss_m: 1000,
  max_elevation_m: 2000,
  min_elevation_m: 800,
  location: 'Damascus, VA',
}

function baseStyle(extra: Partial<StyleConfig> = {}): StyleConfig {
  return {
    preset: 'minimalist',
    base_tile_style: 'carto-light',
    print_size: '24x36',
    color_theme: 'chalk',
    font_family: 'Work Sans',
    border_style: 'none',
    label_position: 'bottom',
    trail_name: 'Appalachian Trail',
    occasion_text: 'A long walk',
    location_text: 'Damascus, VA',
    background_color: '#F7F4EF',
    label_text_color: '#1C1917',
    label_bg_color: '#F7F4EF',
    route_color: '#FF6B35',
    route_width: 4,
    route_opacity: 1,
    show_logo: false,
    show_branding: true,
    ...extra,
  } as StyleConfig
}

describe('buildChromeSvg', () => {
  const framing = getPrintFraming('18x24', 'proof')

  // The chrome compositor honours `titleCase: 'uppercase'` from the editor's
  // shared posterTypography table, so the trail name is rendered in caps.
  // These assertions use the upper-cased form so they track the actual
  // rendered output.
  it('embeds the trail name as <text>', () => {
    const svg = buildChromeSvg({ framing, styleConfig: baseStyle(), stats: baseStats })
    expect(svg).toContain('APPALACHIAN TRAIL')
    expect(svg).toContain('<svg')
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"')
  })

  it('places title at top vs bottom based on the theme layout', () => {
    // The chrome consumes getPosterLayout(styleConfig).titlePosition, which
    // is derived from color_theme (see utils/posterData.ts). 'chalk' uses
    // titlePosition='top'; 'bauhaus' uses 'bottom'. Compare the rendered
    // title <text> y-coordinates between the two themes.
    const svgTop = buildChromeSvg({
      framing,
      styleConfig: baseStyle({ color_theme: 'chalk' }),
      stats: baseStats,
    })
    const svgBottom = buildChromeSvg({
      framing,
      styleConfig: baseStyle({ color_theme: 'bauhaus' as never }),
      stats: baseStats,
    })
    const yPattern = /y="(\d+(?:\.\d+)?)"[^>]*>APPALACHIAN TRAIL/
    const yTop = Number(svgTop.match(yPattern)?.[1] ?? '0')
    const yBottom = Number(svgBottom.match(yPattern)?.[1] ?? '0')
    expect(yTop).toBeGreaterThan(0)
    expect(yBottom).toBeGreaterThan(yTop)
  })

  it('renders both header and footer band backgrounds', () => {
    // The chrome always draws an opaque rect for the title band and the
    // stats footer (label_position='overlay' is not yet implemented in v4
    // — it's tracked as a Gate B follow-up). Two bg rects is the expected
    // baseline shape.
    const svg = buildChromeSvg({
      framing,
      styleConfig: baseStyle(),
      stats: baseStats,
    })
    expect(svg).toContain('APPALACHIAN TRAIL')
    const bgRects = svg.match(/<rect[^>]*fill="#F7F4EF"\s*\/>/g)?.length ?? 0
    expect(bgRects).toBeGreaterThanOrEqual(2)
  })

  it.each(['none', 'thin', 'thick'] as const)(
    'border_style=%s emits the editor-parity stroke geometry',
    (border) => {
      const svg = buildChromeSvg({
        framing,
        styleConfig: baseStyle({ border_style: border }),
        stats: baseStats,
      })
      // Editor parity (MapPreview.vue:903-907 frameStyle): the frame is
      // ALWAYS drawn at fixed 14px inset, opacity 0.18. Stroke is 1px
      // for 'thin' and 'none' (when border_style='none', editor uses
      // borderW='0' which falls through to '1px' default), and 2px for
      // 'thick'. The border rect is a fill="none" stroked rect.
      const borderRectRe = /<rect[^>]*fill="none"[^>]*stroke="#1C1917"[^>]*\/>/
      expect(borderRectRe.test(svg)).toBe(true)
      const expectedStroke = border === 'thick' ? 2 : 1
      expect(svg).toContain(`stroke-width="${expectedStroke}"`)
    },
  )

  it('XML-escapes user-supplied text', () => {
    const svg = buildChromeSvg({
      framing,
      styleConfig: baseStyle({ trail_name: '<script>alert(1)</script>' }),
      stats: baseStats,
    })
    // Trail name renders uppercase, so the escaped form is &lt;SCRIPT&gt;.
    // Either way, the raw `<script>` must never appear unescaped.
    expect(svg).not.toContain('<script>')
    expect(/&lt;script&gt;/i.test(svg)).toBe(true)
  })

  it('embeds logo as data: URI when supplied', () => {
    const svg = buildChromeSvg({
      framing,
      styleConfig: baseStyle({
        show_logo: true,
        logo_url: 'https://example.com/logo.png',
        logo_position: 'header-right',
      }),
      stats: baseStats,
      logoDataUri: 'data:image/png;base64,AAAA',
    })
    expect(svg).toContain('href="data:image/png;base64,AAAA"')
    // No external URL must remain.
    expect(svg).not.toContain('https://example.com/logo.png')
  })

  it('omits stats when distance/elevation are zero', () => {
    const stats: RouteStats = {
      distance_km: 0,
      elevation_gain_m: 0,
      elevation_loss_m: 0,
      max_elevation_m: 0,
      min_elevation_m: 0,
    }
    const svg = buildChromeSvg({ framing, styleConfig: baseStyle(), stats })
    expect(svg).not.toContain('MILES')
    expect(svg).not.toContain('FT GAIN')
  })
})
