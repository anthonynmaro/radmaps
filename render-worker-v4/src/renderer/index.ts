// render-worker-v4/src/renderer/index.ts
//
// Renderer dispatch: pick Native or Browser per PRESET_RENDERER (or the
// caller's explicit override) and produce a raw map PNG at the oversized
// full-bleed viewport.

import type { PrintFraming } from '../../../utils/print/printFraming.js'

import { log } from '../log.js'
import {
  pickBackend,
  type RenderBackend,
  type StyleConfig,
} from '../types.js'

import { browserAvailable, renderBrowser, type BrowserRenderOutput } from './browser.js'
import {
  nativeAvailable,
  renderNative,
  resolveCamera,
  type NativeRenderOutput,
} from './native.js'

export interface RenderInput {
  styleJson: object
  styleConfig: StyleConfig
  framing: PrintFraming
  // Fallback camera if style_config.map_center / map_zoom are missing.
  fallbackCenter?: [number, number]
  fallbackZoom?: number
  backendOverride?: RenderBackend
}

export interface RenderOutput {
  pngBuffer: Buffer
  widthPx: number
  heightPx: number
  renderMs: number
  backend: RenderBackend
}

export function getRendererForPreset(
  preset: string | undefined,
  override?: RenderBackend,
): RenderBackend {
  return pickBackend(preset, override)
}

export async function renderMapLayer(input: RenderInput): Promise<RenderOutput> {
  const backend = getRendererForPreset(input.styleConfig.preset, input.backendOverride)

  // Camera: prefer style_config.map_center/map_zoom; otherwise the caller
  // has to supply a fallback (e.g. derived from bbox by the Nuxt route
  // before posting). We DO NOT re-derive from bbox here — that's a v4
  // locked decision.
  //
  // The Native renderer uses ratio=1 + physical width (see native.ts for
  // why), so zoom is in physical-pixel terms here. resolveCamera applies
  // log2(physicalWidth / map_editor_width) to scale up from the editor's
  // saved zoom to the print canvas size.
  const camera = resolveCamera(input.styleConfig, input.framing.fullWidthPx) ?? (
    input.fallbackCenter && input.fallbackZoom != null
      ? { center: input.fallbackCenter, zoom: input.fallbackZoom }
      : null
  )
  if (!camera) {
    throw new Error(
      'No camera available: style_config.map_center / map_zoom are missing and no fallback was provided',
    )
  }

  const common = {
    styleJson: input.styleJson,
    widthPx: input.framing.fullWidthPx,
    heightPx: input.framing.fullHeightPx,
    dpi: input.framing.dpi,
    center: camera.center,
    zoom: camera.zoom,
    bearing: 0,
    pitch: 0,
  }

  if (backend === 'native') {
    if (!nativeAvailable()) {
      throw new Error('Native renderer unavailable on this build')
    }
    const out: NativeRenderOutput = await renderNative(common)
    log.info('renderer_dispatch', { backend, width: out.widthPx, height: out.heightPx })
    return { ...out, backend }
  }

  // Browser backend is an architectural seam only in v1 — see browser.ts.
  if (!browserAvailable()) {
    throw new Error(
      'Browser renderer requested but no fallback is wired in v1. ' +
        'Either flip the preset back to "native" in PRESET_RENDERER, or wire the ' +
        'legacy render-worker/ Puppeteer service in renderer/browser.ts.',
    )
  }
  const out: BrowserRenderOutput = await renderBrowser(common)
  log.info('renderer_dispatch', { backend, width: out.widthPx, height: out.heightPx })
  return { ...out, backend }
}
