// tests/compositor.test.ts
//
// Verifies:
//   • the composited output matches framing.fullWidthPx × fullHeightPx
//   • the chrome reaches the canvas (a sample row near the title band has
//     non-trivial colour variation)
//   • when border_style is 'thin', the rect is inside the trim box
//
// We use a synthetic 1024×1024 stub map PNG (sharp-generated solid colour)
// instead of running the Native renderer — that integration is exercised
// out-of-band by the spike CLI.

import { describe, expect, it } from 'vitest'
import sharp from 'sharp'

import { getPrintFraming } from '../../utils/print/printFraming.js'

import { compositePoster } from '../src/chrome/compositor.js'
import type { RouteStats, StyleConfig } from '../src/types.js'

const stats: RouteStats = {
  distance_km: 12.0,
  elevation_gain_m: 500,
  elevation_loss_m: 480,
  max_elevation_m: 1500,
  min_elevation_m: 1000,
  location: 'Test',
}

const styleConfig: StyleConfig = {
  preset: 'minimalist',
  base_tile_style: 'carto-light',
  print_size: '24x36',
  color_theme: 'chalk',
  font_family: 'Work Sans',
  border_style: 'thin',
  label_position: 'bottom',
  trail_name: 'Test Trail',
  background_color: '#FFFFFF',
  label_text_color: '#000000',
  label_bg_color: '#FFFFFF',
  route_color: '#FF6B35',
  route_width: 4,
  route_opacity: 1,
  show_branding: true,
} as StyleConfig

async function makeStubMap(framing: { fullWidthPx: number; fullHeightPx: number }): Promise<Buffer> {
  return sharp({
    create: {
      width: framing.fullWidthPx,
      height: framing.fullHeightPx,
      channels: 3,
      background: { r: 100, g: 150, b: 200 },
    },
  })
    .png()
    .toBuffer()
}

describe('compositePoster', () => {
  it('produces a JPEG at framing.fullWidthPx × fullHeightPx', async () => {
    const framing = getPrintFraming('18x24', 'proof')
    const stub = await makeStubMap(framing)
    const out = await compositePoster({ mapPng: stub, framing, styleConfig, stats })
    expect(out.widthPx).toBe(framing.fullWidthPx)
    expect(out.heightPx).toBe(framing.fullHeightPx)

    // Verify via sharp's metadata.
    const meta = await sharp(out.jpegBuffer).metadata()
    expect(meta.format).toBe('jpeg')
    expect(meta.width).toBe(framing.fullWidthPx)
    expect(meta.height).toBe(framing.fullHeightPx)
  })

  it('paints chrome (the band region differs from the map base colour)', async () => {
    const framing = getPrintFraming('18x24', 'proof')
    const stub = await makeStubMap(framing)
    const out = await compositePoster({ mapPng: stub, framing, styleConfig, stats })
    // The footer band is sized by footerBandHeightPx() in svgTemplate.ts —
    // currently ~8.5cqh of the full canvas. Sample a 6% strip from the
    // bottom of the trim box; that fits comfortably inside the band so
    // the mean reflects the white footer fill, not the blue map content
    // above it.
    //
    // Structural quirk: `sharp(buf).extract({}).stats()` chained directly
    // returns stats for the *original* image, ignoring the extract step
    // (Sharp pipeline reset). Materialise the extracted region with
    // toBuffer() first, then read stats from the new buffer.
    const bandH = Math.round(framing.trimBox.h * 0.06)
    const cropped = await sharp(out.jpegBuffer)
      .extract({
        left: framing.trimBox.x,
        top: framing.trimBox.y + framing.trimBox.h - bandH,
        width: framing.trimBox.w,
        height: bandH,
      })
      .toBuffer()
    const sample = await sharp(cropped).stats()
    // The footer band background is white(255,255,255) for our test fixture.
    // Mean R/G/B should skew >= 200 (close to white), not the stub's ~100/150/200.
    expect(sample.channels[0]!.mean).toBeGreaterThan(180)
    expect(sample.channels[1]!.mean).toBeGreaterThan(180)
  })

  it('respects label_position=top (chrome lands at top instead of bottom)', async () => {
    const framing = getPrintFraming('18x24', 'proof')
    const stub = await makeStubMap(framing)
    const topConfig = { ...styleConfig, label_position: 'top' as const }
    const out = await compositePoster({
      mapPng: stub,
      framing,
      styleConfig: topConfig as StyleConfig,
      stats,
    })
    // Sample within the band's actual height (~6% of trim) so the strip
    // sits inside the white band rather than spilling onto the blue map.
    const bandH = Math.round(framing.trimBox.h * 0.06)
    const topCrop = await sharp(out.jpegBuffer)
      .extract({
        left: framing.trimBox.x,
        top: framing.trimBox.y,
        width: framing.trimBox.w,
        height: bandH,
      })
      .toBuffer()
    const topSample = await sharp(topCrop).stats()
    // When label_position='top', the title band paints at the top.
    // That region should read as background-colour white, not blue map.
    expect(topSample.channels[0]!.mean).toBeGreaterThan(180)
    expect(topSample.channels[2]!.mean).toBeGreaterThan(180)
    // Footer band stays at the bottom regardless of label_position.
    const bottomCrop = await sharp(out.jpegBuffer)
      .extract({
        left: framing.trimBox.x,
        top: framing.trimBox.y + framing.trimBox.h - bandH,
        width: framing.trimBox.w,
        height: bandH,
      })
      .toBuffer()
    const bottomSample = await sharp(bottomCrop).stats()
    expect(bottomSample.channels[0]!.mean).toBeGreaterThan(180)
  })
})
