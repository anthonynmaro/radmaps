import { describe, expect, it } from 'vitest'

import {
  PRINT_MAPLIBRE_MAX_CANVAS_SIZE_PX,
  PRINT_MAPLIBRE_SUPERSAMPLE_PIXEL_RATIO,
  resolveMapLibrePrintCanvasOptions,
} from '../utils/render/maplibrePrintCanvas'

describe('resolveMapLibrePrintCanvasOptions', () => {
  it('leaves editor maps on MapLibre defaults', () => {
    expect(resolveMapLibrePrintCanvasOptions({
      isPrintRender: false,
      deviceScaleFactor: 2,
    })).toEqual({})
  })

  it('raises the print canvas cap and supersamples large print maps', () => {
    expect(resolveMapLibrePrintCanvasOptions({
      isPrintRender: true,
      deviceScaleFactor: 2,
    })).toEqual({
      pixelRatio: PRINT_MAPLIBRE_SUPERSAMPLE_PIXEL_RATIO,
      maxCanvasSize: [
        PRINT_MAPLIBRE_MAX_CANVAS_SIZE_PX,
        PRINT_MAPLIBRE_MAX_CANVAS_SIZE_PX,
      ],
    })
  })

  it('clamps pathological DPR values to the renderer-supported range', () => {
    expect(resolveMapLibrePrintCanvasOptions({
      isPrintRender: true,
      deviceScaleFactor: 99,
    })).toMatchObject({ pixelRatio: 4 })

    expect(resolveMapLibrePrintCanvasOptions({
      isPrintRender: true,
      deviceScaleFactor: -1,
    })).toMatchObject({ pixelRatio: 2 })
  })
})
