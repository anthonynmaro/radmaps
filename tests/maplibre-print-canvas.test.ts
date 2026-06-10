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
    })).toEqual({
      pixelRatio: 2,
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
    })).toMatchObject({ pixelRatio: 1 })
  })
})
