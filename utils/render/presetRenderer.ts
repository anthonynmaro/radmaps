// utils/render/presetRenderer.ts
//
// Phase 10 foundation: shared PRESET_RENDERER table + helper.
//
// Source of truth for "which render backend should serve this preset?"
// Both the Nuxt server (server/api/maps/[id]/render.post.ts) and the
// v4 render worker (render-worker-v4/src/types.ts) import this so the
// table can never drift between the two sides.
//
// v1 policy: every preset routes to 'native'. Stadia presets use plain
// raster tile URLs (https://tiles.stadiamaps.com/tiles/stamen_*/{z}/{x}/{y}.jpg)
// which MapLibre Native renders natively. The styledtile:// custom-protocol
// tile effects (duotone/posterize/layer-color) are handled by Sharp
// post-processing on the rendered map PNG, not by a browser fallback.
//
// 'browser' remains an architectural seam: render_backend is part of the
// cache key (locked decision #4) so cache isolation keeps working if a
// future preset is downgraded. If that ever happens, the implementation
// is a one-screen HTTP call to the existing render-worker/ Puppeteer
// service — no new sidecar, no new infra.
//
// Adding a new preset? Default it to 'native'.

export type RenderBackend = 'native' | 'browser'

export const PRESET_RENDERER: Record<string, RenderBackend> = {
  minimalist: 'native',
  topographic: 'native',
  'route-only': 'native',
  'road-network': 'native',
  'contour-art': 'native',
  'natural-topo': 'native',
  'native-toner': 'native',
  'native-watercolor': 'native',
  'alidade-smooth': 'native',
  'alidade-smooth-dark': 'native',
  // Stadia presets are plain raster tiles — Native renders these directly.
  // Tile effects (duotone/posterize/layer-color) when enabled apply via
  // Sharp post-processing on the rendered map PNG, not via a custom protocol.
  'stadia-watercolor': 'native',
  'stadia-toner': 'native',
}

/**
 * Resolve the render backend for a preset, with optional explicit
 * override taking precedence.
 *
 * - explicit `override` wins (used by debug / forced-routing flows)
 * - otherwise look up in `PRESET_RENDERER`
 * - unknown / undefined preset defaults to `'native'`
 */
export function getRendererForPreset(
  preset: string | undefined,
  override?: RenderBackend,
): RenderBackend {
  if (override) return override
  if (preset && PRESET_RENDERER[preset]) return PRESET_RENDERER[preset]
  return 'native'
}
