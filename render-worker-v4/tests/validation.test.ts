// tests/validation.test.ts
//
// Fixtures for each of the 14 validation checks. We craft the inputs so a
// single check fires per case and assert the issue surface.

import { describe, expect, it } from 'vitest'
import sharp from 'sharp'

import { getPrintFraming } from '../../utils/print/printFraming.js'
import { getProviderProfile } from '../../utils/print/providerProfile.js'

import { buildChromeSvg } from '../src/chrome/svgTemplate.js'
import type { RouteStats, StyleConfig } from '../src/types.js'
import { validatePoster, VALIDATOR_VERSION } from '../src/validation.js'

const baseStats: RouteStats = {
  distance_km: 10,
  elevation_gain_m: 500,
  elevation_loss_m: 500,
  max_elevation_m: 1500,
  min_elevation_m: 1000,
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
    trail_name: 'Test Trail',
    background_color: '#FFFFFF',
    label_text_color: '#000000',
    label_bg_color: '#FFFFFF',
    route_color: '#FF6B35',
    route_width: 4,
    route_opacity: 1,
    show_branding: true,
    ...extra,
  } as StyleConfig
}

async function makeJpeg(width: number, height: number, opts: { uniform?: boolean } = {}) {
  const buffer = opts.uniform
    ? await sharp({
        create: {
          width,
          height,
          channels: 3,
          background: { r: 235, g: 235, b: 235 },
        },
      })
        .jpeg({ quality: 95 })
        .toBuffer()
    : await sharp({
        create: {
          width,
          height,
          channels: 3,
          // Noisy image — distinct colour buckets, well-distributed luminance.
          background: { r: 80, g: 120, b: 200 },
        },
      })
        .composite([
          {
            input: Buffer.from(
              `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
                <rect x="0" y="0" width="${width / 2}" height="${height}" fill="#ff0000"/>
                <rect x="${width / 2}" y="0" width="${width / 2}" height="${height}" fill="#00ff00"/>
                <circle cx="${width / 2}" cy="${height / 2}" r="${Math.min(width, height) / 4}" fill="#0000ff"/>
              </svg>`,
            ),
          },
        ])
        .jpeg({ quality: 95 })
        .toBuffer()
  return buffer
}

describe('validatePoster', () => {
  const framing = getPrintFraming('18x24', 'proof')
  const profile = getProviderProfile('18x24')

  it('passes a healthy fixture', async () => {
    const styleConfig = baseStyle()
    const chromeSvg = buildChromeSvg({ framing, styleConfig, stats: baseStats })
    const jpeg = await makeJpeg(framing.fullWidthPx, framing.fullHeightPx)
    const result = await validatePoster({
      jpegBuffer: jpeg,
      framing,
      profile,
      styleConfig,
      logoOk: true,
      chromeSvg,
      renderClass: 'proof',
    })
    expect(result.validator_version).toBe(VALIDATOR_VERSION)
    expect(result.errors.length).toBe(0)
  })

  it('flags dimension mismatch', async () => {
    const styleConfig = baseStyle()
    const chromeSvg = buildChromeSvg({ framing, styleConfig, stats: baseStats })
    const wrong = await makeJpeg(100, 100)
    const result = await validatePoster({
      jpegBuffer: wrong,
      framing,
      profile,
      styleConfig,
      logoOk: true,
      chromeSvg,
      renderClass: 'proof',
    })
    expect(result.errors.some((e) => e.check === 'dimensions')).toBe(true)
    expect(result.passed).toBe(false)
  })

  it('flags empty trail name', async () => {
    const styleConfig = baseStyle({ trail_name: '   ' })
    const chromeSvg = buildChromeSvg({ framing, styleConfig, stats: baseStats })
    const jpeg = await makeJpeg(framing.fullWidthPx, framing.fullHeightPx)
    const result = await validatePoster({
      jpegBuffer: jpeg,
      framing,
      profile,
      styleConfig,
      logoOk: true,
      chromeSvg,
      renderClass: 'proof',
    })
    expect(result.errors.some((e) => e.check === 'trail_name_present')).toBe(true)
  })

  it('flags failed logo as a hard error', async () => {
    const styleConfig = baseStyle({
      show_logo: true,
      logo_url: 'https://example.com/logo.png',
    })
    const chromeSvg = buildChromeSvg({ framing, styleConfig, stats: baseStats })
    const jpeg = await makeJpeg(framing.fullWidthPx, framing.fullHeightPx)
    const result = await validatePoster({
      jpegBuffer: jpeg,
      framing,
      profile,
      styleConfig,
      logoOk: false,
      chromeSvg,
      renderClass: 'proof',
    })
    expect(result.errors.some((e) => e.check === 'logo_loaded')).toBe(true)
  })

  it('flags blank/empty viewport (uniform pixel content)', async () => {
    const styleConfig = baseStyle()
    const chromeSvg = buildChromeSvg({ framing, styleConfig, stats: baseStats })
    const blank = await makeJpeg(framing.fullWidthPx, framing.fullHeightPx, { uniform: true })
    const result = await validatePoster({
      jpegBuffer: blank,
      framing,
      profile,
      styleConfig,
      logoOk: true,
      chromeSvg,
      renderClass: 'proof',
    })
    // tile_completeness or viewport_fill should fire.
    const fired = [...result.errors, ...result.warnings].some((i) =>
      ['viewport_fill', 'tile_completeness'].includes(i.check),
    )
    expect(fired).toBe(true)
  })

  it('flags an unresolved external URL in the chrome SVG', async () => {
    const styleConfig = baseStyle()
    // Hand-craft an SVG with an http(s) href to simulate a build bug.
    const chromeSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><image href="https://evil.example.com/logo.png" width="50" height="50" /></svg>`
    const jpeg = await makeJpeg(framing.fullWidthPx, framing.fullHeightPx)
    const result = await validatePoster({
      jpegBuffer: jpeg,
      framing,
      profile,
      styleConfig,
      logoOk: true,
      chromeSvg,
      renderClass: 'proof',
    })
    expect(result.errors.some((e) => e.check === 'external_urls')).toBe(true)
  })

  it('flags small text below the 6 pt minimum', async () => {
    const styleConfig = baseStyle()
    // A tiny 3px font at 300 DPI = 0.72pt → way below 6pt threshold.
    const chromeSvg = `<svg xmlns="http://www.w3.org/2000/svg"><text x="100" y="100" font-size="3">tiny</text></svg>`
    const jpeg = await makeJpeg(framing.fullWidthPx, framing.fullHeightPx)
    const result = await validatePoster({
      jpegBuffer: jpeg,
      framing,
      profile,
      styleConfig,
      logoOk: true,
      chromeSvg,
      renderClass: 'proof',
    })
    expect(result.warnings.some((w) => w.check === 'min_text_size')).toBe(true)
  })

  it('flags border drawn outside the trim box', async () => {
    const styleConfig = baseStyle({ border_style: 'thin' })
    // Forge an SVG with a border rect well outside the trim box.
    const chromeSvg = `<svg xmlns="http://www.w3.org/2000/svg"><rect x="-100" y="-100" width="50" height="50" stroke="#000" stroke-width="3" fill="none" /></svg>`
    const jpeg = await makeJpeg(framing.fullWidthPx, framing.fullHeightPx)
    const result = await validatePoster({
      jpegBuffer: jpeg,
      framing,
      profile,
      styleConfig,
      logoOk: true,
      chromeSvg,
      renderClass: 'proof',
    })
    expect(result.errors.some((e) => e.check === 'border_in_trim')).toBe(true)
  })

  it('flags file size over the provider cap', async () => {
    const styleConfig = baseStyle()
    const chromeSvg = buildChromeSvg({ framing, styleConfig, stats: baseStats })
    const jpeg = await makeJpeg(framing.fullWidthPx, framing.fullHeightPx)
    // Use a profile clone with maxFileSizeMb=0 so any output trips the cap.
    const tinyProfile = { ...profile, maxFileSizeMb: 0 }
    const result = await validatePoster({
      jpegBuffer: jpeg,
      framing,
      profile: tinyProfile,
      styleConfig,
      logoOk: true,
      chromeSvg,
      renderClass: 'proof',
    })
    expect(result.errors.some((e) => e.check === 'file_size')).toBe(true)
  })

  it('captures validator metadata', async () => {
    const styleConfig = baseStyle()
    const chromeSvg = buildChromeSvg({ framing, styleConfig, stats: baseStats })
    const jpeg = await makeJpeg(framing.fullWidthPx, framing.fullHeightPx)
    const result = await validatePoster({
      jpegBuffer: jpeg,
      framing,
      profile,
      styleConfig,
      logoOk: true,
      chromeSvg,
      renderClass: 'proof',
    })
    expect(typeof result.checked_at).toBe('string')
    expect(result.validator_version).toBe('print-validator-v1')
    expect(typeof result.passed).toBe('boolean')
  })
})
