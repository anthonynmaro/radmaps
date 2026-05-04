// render-worker-v4/src/chrome/compositor.ts
//
// Compose: raw map PNG (oversized full-bleed) + SVG chrome layer →
// final JPEG. Chrome is rendered to PNG by Sharp at the same canvas
// dimensions and overlaid via `composite()`.
//
// Plan v4: this is the only stage that consumes `label_position`. The
// raw map is identical regardless of label_position, which is the v4
// caching win: changing label_position is a chrome-only re-composite.

import sharp from 'sharp'

import type { PrintFraming } from '../../../utils/print/printFraming.js'
import type { OverlayLayoutResult } from '../../../utils/render/overlayLayout.js'
import type { Bbox } from '../../../utils/render/posterFormatters.js'

import type { LogoBuffer } from './logoFetch.js'
import { buildChromeSvg } from './svgTemplate.js'
import type { RouteStats, StyleConfig } from '../types.js'

export interface CompositeInput {
  mapPng: Buffer
  framing: PrintFraming
  styleConfig: StyleConfig
  stats: RouteStats
  logo?: LogoBuffer | null
  /** Pin + leader-line layout (utils/render/overlayLayout). Optional. */
  overlayLayout?: OverlayLayoutResult
  /** Map bbox for footer-band coordinates display. */
  bbox?: Bbox
}

export interface CompositeOutput {
  jpegBuffer: Buffer
  widthPx: number
  heightPx: number
}

function logoToDataUri(logo: LogoBuffer): string {
  return `data:${logo.contentType};base64,${logo.buffer.toString('base64')}`
}

/**
 * Render the chrome SVG to PNG, then composite onto the map raster, then
 * encode as a sRGB-tagged JPEG.
 */
export async function compositePoster(input: CompositeInput): Promise<CompositeOutput> {
  const { mapPng, framing, styleConfig, stats, logo, overlayLayout, bbox } = input

  // 1. Build the SVG chrome layer.
  const svg = buildChromeSvg({
    framing,
    styleConfig,
    stats,
    logoDataUri: logo ? logoToDataUri(logo) : undefined,
    overlayLayout,
    bbox,
  })

  // 2. Resize the map raster to match the framing canvas if it's drifted
  //    (e.g. Native rounded down logical pixels). We always trust framing
  //    as the canonical full-bleed size.
  const baseMap = await sharp(mapPng)
    .resize(framing.fullWidthPx, framing.fullHeightPx, { fit: 'cover' })
    .toBuffer()

  // 3. Rasterise the SVG. density=72 is fine because the SVG is sized in
  //    pixels (1 SVG unit = 1 device pixel).
  const chromePng = await sharp(Buffer.from(svg), { density: 72 })
    .resize(framing.fullWidthPx, framing.fullHeightPx)
    .png()
    .toBuffer()

  // 4. Compose. Final encoding: JPEG, quality 95, sRGB ICC tag, mozjpeg.
  const jpeg = await sharp(baseMap)
    .composite([{ input: chromePng, top: 0, left: 0 }])
    .withMetadata({ density: framing.dpi })
    // Sharp tags sRGB by default for JPEG; .toColourspace('srgb') makes it
    // explicit.
    .toColourspace('srgb')
    .jpeg({ quality: 95, mozjpeg: true, chromaSubsampling: '4:4:4' })
    .toBuffer()

  return {
    jpegBuffer: jpeg,
    widthPx: framing.fullWidthPx,
    heightPx: framing.fullHeightPx,
  }
}
