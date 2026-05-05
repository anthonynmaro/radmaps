import { describe, expect, it } from 'vitest'
import { DEFAULT_STYLE_CONFIG, type StyleConfig } from '../types'
import { buildMapStyle, effectiveSegmentDotRadius } from '../utils/mapStyle'

function layerById(style: object, id: string): { paint?: Record<string, unknown> } | undefined {
  return (style as { layers?: Array<{ id: string; paint?: Record<string, unknown> }> }).layers?.find(layer => layer.id === id)
}

describe('trail segment styling', () => {
  it('uses small precise segment handle dots by default', () => {
    expect(effectiveSegmentDotRadius(DEFAULT_STYLE_CONFIG)).toBe(1.5)
  })

  it('caps legacy-large segment handle dots', () => {
    const config: StyleConfig = { ...DEFAULT_STYLE_CONFIG, segment_dot_size: 4 }

    expect(effectiveSegmentDotRadius(config)).toBe(2.5)
  })

  it('renders segment handle dots without stroke halos', () => {
    const style = buildMapStyle(DEFAULT_STYLE_CONFIG)

    expect(layerById(style, 'segment-handle-halo')).toBeUndefined()
    expect(layerById(style, 'segment-handle-dot')?.paint).not.toHaveProperty('circle-stroke-width')
    expect(layerById(style, 'segment-handle-dot')?.paint).not.toHaveProperty('circle-stroke-color')
  })
})
