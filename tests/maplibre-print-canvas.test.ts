import { describe, expect, it } from 'vitest'

import {
  PRINT_MAPLIBRE_MAX_CANVAS_SIZE_PX,
  resolveMapLibrePrintCanvasOptions,
} from '../utils/render/maplibrePrintCanvas'

describe('resolveMapLibrePrintCanvasOptions', () => {
  it('leaves editor maps on MapLibre defaults', () => {
    expect(resolveMapLibrePrintCanvasOptions({
      isPrintRender: false,
      deviceScaleFactor: 2,
    })).toEqual({})
  })

  it('raises the print canvas cap and matches the screenshot DPR', () => {
    expect(resolveMapLibrePrintCanvasOptions({
      isPrintRender: true,
      deviceScaleFactor: 2,
      mapCssWidth: 3636,
      mapCssHeight: 3656,
    })).toMatchObject({
      pixelRatio: 2,
      maxCanvasSize: [
        PRINT_MAPLIBRE_MAX_CANVAS_SIZE_PX,
        PRINT_MAPLIBRE_MAX_CANVAS_SIZE_PX,
      ],
    })
  })

  it('caps the backing scale when the map box would exceed the print canvas ceiling', () => {
    const result = resolveMapLibrePrintCanvasOptions({
      isPrintRender: true,
      deviceScaleFactor: 2,
      mapCssWidth: 3636,
      mapCssHeight: 4300,
    })

    expect(result).toMatchObject({
      maxCanvasSize: [
        PRINT_MAPLIBRE_MAX_CANVAS_SIZE_PX,
        PRINT_MAPLIBRE_MAX_CANVAS_SIZE_PX,
      ],
    })
    expect('pixelRatio' in result ? result.pixelRatio : null)
      .toBeCloseTo(PRINT_MAPLIBRE_MAX_CANVAS_SIZE_PX / 4300, 3)
  })

  it('clamps pathological DPR values to the renderer-supported range', () => {
    expect(resolveMapLibrePrintCanvasOptions({
      isPrintRender: true,
      deviceScaleFactor: 99,
    })).toMatchObject({ pixelRatio: 4 })

    expect(resolveMapLibrePrintCanvasOptions({
      isPrintRender: true,
      deviceScaleFactor: -1,
    })).toMatchObject({ pixelRatio: 1 })
  })
})
