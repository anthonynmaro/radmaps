import { describe, expect, it } from 'vitest'
import {
  classifyAssetQuality,
  computeEffectiveDpi,
  defaultAssetPlacement,
  heightPercentForAsset,
} from '../utils/imageAssets'
import type { MapAsset } from '../types'

const baseAsset: MapAsset = {
  id: 'asset-1',
  kind: 'image',
  source_url: 'https://example.com/original.jpg',
  render_url: 'https://example.com/render.jpg',
  mime_type: 'image/jpeg',
  width_px: 3600,
  height_px: 2400,
  file_size_bytes: 1000,
  x: 0,
  y: 0,
  width: 50,
  height: 22.22,
  rotation: 0,
  opacity: 1,
  z_index: 30,
  quality_status: 'good',
}

describe('image asset print quality helpers', () => {
  it('classifies effective DPI using print thresholds', () => {
    expect(classifyAssetQuality(300)).toBe('excellent')
    expect(classifyAssetQuality(150)).toBe('good')
    expect(classifyAssetQuality(100)).toBe('warning')
    expect(classifyAssetQuality(99)).toBe('poor')
  })

  it('computes effective DPI from placed physical size', () => {
    expect(computeEffectiveDpi(baseAsset, '24x36')).toBe(300)
  })

  it('preserves image aspect ratio when converting width percent to height percent', () => {
    expect(heightPercentForAsset(36, 3000, 2000, '24x36')).toBe(16)
  })

  it('places logos near the footer by default', () => {
    const placement = defaultAssetPlacement('logo', 1200, 600, '24x36')
    expect(placement.x).toBe(8)
    expect(placement.y).toBeGreaterThan(80)
    expect(placement.z_index).toBeGreaterThan(placement.width)
  })
})
