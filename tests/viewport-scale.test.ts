import { describe, expect, it } from 'vitest'
import {
  applyViewportScaleToStyle,
  applyViewportZoomCompensationToStyle,
  getViewportVisualScale,
} from '../utils/render/viewportScale'

function layerById(style: { layers?: Array<Record<string, unknown>> }, id: string): {
  paint: Record<string, unknown>
  layout: Record<string, unknown>
} {
  const layer = style.layers?.find(item => item.id === id)
  if (!layer) throw new Error(`Missing layer ${id}`)
  return {
    paint: (layer.paint as Record<string, unknown> | undefined) ?? {},
    layout: (layer.layout as Record<string, unknown> | undefined) ?? {},
  }
}

describe('getViewportVisualScale', () => {
  it('uses current width divided by saved editor width', () => {
    expect(getViewportVisualScale({ currentWidth: 1500, savedEditorWidth: 1000 })).toBe(1.5)
  })

  it('falls back to 1 for missing or invalid widths', () => {
    expect(getViewportVisualScale({ currentWidth: 1500, savedEditorWidth: undefined })).toBe(1)
    expect(getViewportVisualScale({ currentWidth: 0, savedEditorWidth: 1000 })).toBe(1)
    expect(getViewportVisualScale({ currentWidth: 1500, savedEditorWidth: -1 })).toBe(1)
  })
})

describe('applyViewportScaleToStyle', () => {
  const style = {
    version: 8,
    layers: [
      {
        id: 'route-line-casing',
        type: 'line',
        metadata: { radmaps: { scale: ['line-width'] } },
        paint: { 'line-width': 8 },
      },
      {
        id: 'route-line',
        type: 'line',
        metadata: { radmaps: { scale: ['line-width'] } },
        paint: { 'line-width': 4 },
      },
      {
        id: 'trail-seg-line-a',
        type: 'line',
        metadata: { radmaps: { scale: ['line-width', 'line-dasharray'] } },
        paint: { 'line-width': 3, 'line-dasharray': [4, 3] },
      },
      {
        id: 'segment-handle-dot',
        type: 'circle',
        metadata: { radmaps: { scale: ['circle-radius', 'circle-stroke-width'] } },
        paint: { 'circle-radius': 4, 'circle-stroke-width': 1.5 },
      },
      {
        id: 'contours-minor',
        type: 'line',
        metadata: { radmaps: { scale: ['line-width'] } },
        paint: {
          'line-width': ['interpolate', ['linear'], ['zoom'], 5, 0.8, 14, 1],
        },
      },
      {
        id: 'contours-labels',
        type: 'symbol',
        metadata: { radmaps: { scale: ['text-size', 'text-halo-width'] } },
        layout: {
          'text-size': ['interpolate', ['linear'], ['zoom'], 5, 9, 14, 13],
        },
        paint: { 'text-halo-width': 2 },
      },
      {
        id: 'roads-place-labels',
        type: 'symbol',
        metadata: { radmaps: { scale: ['text-size', 'text-halo-width'] } },
        layout: { 'text-size': ['interpolate', ['linear'], ['zoom'], 8, 9, 14, 13] },
        paint: { 'text-halo-width': 1.5 },
      },
      {
        id: 'background',
        type: 'background',
        paint: { 'background-color': '#fff' },
      },
    ],
  }

  it('scales route, casing, trail segments, dash spacing, and segment dots', () => {
    const scaled = applyViewportScaleToStyle(style, 2)

    expect(layerById(scaled, 'route-line-casing').paint['line-width']).toBe(16)
    expect(layerById(scaled, 'route-line').paint['line-width']).toBe(8)
    expect(layerById(scaled, 'trail-seg-line-a').paint['line-width']).toBe(6)
    expect(layerById(scaled, 'trail-seg-line-a').paint['line-dasharray']).toEqual([8, 6])
    expect(layerById(scaled, 'segment-handle-dot').paint['circle-radius']).toBe(8)
    expect(layerById(scaled, 'segment-handle-dot').paint['circle-stroke-width']).toBe(3)
  })

  it('scales expression outputs without scaling zoom stop keys', () => {
    const scaled = applyViewportScaleToStyle(style, 2)
    expect(layerById(scaled, 'contours-minor').paint['line-width']).toEqual([
      'interpolate', ['linear'], ['zoom'], 5, 1.6, 14, 2,
    ])
    expect(layerById(scaled, 'contours-labels').layout['text-size']).toEqual([
      'interpolate', ['linear'], ['zoom'], 5, 18, 14, 26,
    ])
  })

  it('scales graph-marked text halos and leaves unrelated layers alone', () => {
    const scaled = applyViewportScaleToStyle(style, 2)
    expect(layerById(scaled, 'contours-labels').paint['text-halo-width']).toBe(4)
    expect(layerById(scaled, 'roads-place-labels').paint['text-halo-width']).toBe(3)
    expect(layerById(scaled, 'background').paint['background-color']).toBe('#fff')
  })

  it('does not scale layers that only happen to match historical ID patterns', () => {
    const scaled = applyViewportScaleToStyle({
      version: 8,
      layers: [
        { id: 'route-looking-layer', type: 'line', paint: { 'line-width': 9 } },
        { id: 'roads-looking-layer', type: 'symbol', layout: { 'text-size': 12 }, paint: { 'text-halo-width': 1 } },
      ],
    }, 2)

    expect(layerById(scaled, 'route-looking-layer').paint['line-width']).toBe(9)
    expect(layerById(scaled, 'roads-looking-layer').layout['text-size']).toBe(12)
    expect(layerById(scaled, 'roads-looking-layer').paint['text-halo-width']).toBe(1)
  })

  it('does not mutate the source style and scale 1 is equivalent', () => {
    const scaled = applyViewportScaleToStyle(style, 1)
    expect(scaled).toEqual(style)
    expect(scaled).not.toBe(style)
    expect(layerById(style, 'route-line').paint['line-width']).toBe(4)
  })
})

describe('applyViewportZoomCompensationToStyle', () => {
  it('shifts layer zoom ranges and zoom-expression stops by the render delta', () => {
    const shifted = applyViewportZoomCompensationToStyle({
      version: 8,
      sources: {},
      layers: [{
        id: 'labels',
        type: 'symbol',
        minzoom: 12,
        layout: {
          'text-size': ['interpolate', ['linear'], ['zoom'], 12, 8, 15, 11],
        },
        paint: {
          'text-opacity': ['step', ['zoom'], 0, 12, 0.5, 14, 0.8],
        },
      }],
    }, 1.5)

    expect(shifted.layers?.[0].minzoom).toBe(13.5)
    expect(shifted.layers?.[0].layout?.['text-size']).toEqual(['interpolate', ['linear'], ['zoom'], 13.5, 8, 16.5, 11])
    expect(shifted.layers?.[0].paint?.['text-opacity']).toEqual(['step', ['zoom'], 0, 13.5, 0.5, 15.5, 0.8])
  })
})
