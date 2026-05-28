import { describe, expect, it } from 'vitest'

import { resolveBrowserRenderViewport } from '../utils/render/renderViewport'
import type { PrintFraming } from '../utils/print/printFraming'

function framing(width: number, height: number): PrintFraming {
  return {
    trimWidthIn: 16,
    trimHeightIn: 24,
    bleedIn: 0,
    safeMarginIn: 0,
    dpi: 150,
    fullWidthPx: width,
    fullHeightPx: height,
    bleedBox: { x: 0, y: 0, w: width, h: height },
    trimBox: { x: 0, y: 0, w: width, h: height },
    safeBox: { x: 0, y: 0, w: width, h: height },
    mapViewportPx: { x: 0, y: 0, w: width, h: height },
  }
}

describe('resolveBrowserRenderViewport', () => {
  it('uses high DPR to keep proof CSS layout close to saved editor width', () => {
    const viewport = resolveBrowserRenderViewport(
      framing(2435, 3635),
      { map_editor_width: 458 },
      { fallbackDeviceScaleFactor: 1 },
    )

    expect(viewport.deviceScaleFactor).toBe(4)
    expect(viewport.viewportWidthPx).toBe(609)
    expect(viewport.viewportHeightPx).toBe(909)
  })

  it('falls back to the caller DPR when no editor width is saved', () => {
    const viewport = resolveBrowserRenderViewport(
      framing(2435, 3635),
      {},
      { fallbackDeviceScaleFactor: 2 },
    )

    expect(viewport.deviceScaleFactor).toBe(2)
    expect(viewport.viewportWidthPx).toBe(1218)
    expect(viewport.viewportHeightPx).toBe(1818)
  })
})
