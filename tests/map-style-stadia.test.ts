import { describe, expect, it } from 'vitest'
import { DEFAULT_STYLE_CONFIG, type StyleConfig } from '../types'
import { buildMapStyle } from '../utils/mapStyle'

function baseTileUrl(style: object): string {
  const sources = (style as { sources?: Record<string, { tiles?: string[] }> }).sources
  const tileUrl = sources?.['base-tiles']?.tiles?.[0]
  if (!tileUrl) throw new Error('Missing base-tiles source URL')
  return tileUrl
}

describe('Stadia tile authentication', () => {
  it('adds the Stadia API key to watercolor tile URLs', () => {
    const config: StyleConfig = {
      ...DEFAULT_STYLE_CONFIG,
      preset: 'stadia-watercolor',
    }

    const style = buildMapStyle(config, undefined, undefined, undefined, 'stadia-test-token')

    expect(baseTileUrl(style)).toBe(
      'https://tiles.stadiamaps.com/tiles/stamen_watercolor/{z}/{x}/{y}@2x.jpg?api_key=stadia-test-token',
    )
  })

  it('adds the Stadia API key to toner tile URLs', () => {
    const config: StyleConfig = {
      ...DEFAULT_STYLE_CONFIG,
      preset: 'stadia-toner',
    }

    const style = buildMapStyle(config, undefined, undefined, undefined, 'stadia-test-token')

    expect(baseTileUrl(style)).toBe(
      'https://tiles.stadiamaps.com/tiles/stamen_toner/{z}/{x}/{y}@2x.png?api_key=stadia-test-token',
    )
  })

  it('uses Toner background tiles when place labels are hidden', () => {
    const config: StyleConfig = {
      ...DEFAULT_STYLE_CONFIG,
      preset: 'stadia-toner',
      show_place_labels: false,
    }

    const style = buildMapStyle(config, undefined, undefined, undefined, 'stadia-test-token')

    expect(baseTileUrl(style)).toBe(
      'https://tiles.stadiamaps.com/tiles/stamen_toner_background/{z}/{x}/{y}@2x.png?api_key=stadia-test-token',
    )
  })
})
