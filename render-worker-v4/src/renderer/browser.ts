// render-worker-v4/src/renderer/browser.ts
//
// v1 stance: there is NO browser fallback wired in v1.
//
// All presets route to 'native' (see utils/render/presetRenderer.ts).
// 'browser' remains an architectural seam — render_backend is part of
// the cache key so isolation keeps working — but no implementation
// ships. If a future preset spike reveals an unfixable Native parity
// gap, the existing render-worker/ Puppeteer service is the fallback;
// implementation is a one-screen HTTP call here. No Gotenberg sidecar,
// no extra Chromium, no new Railway dyno.
//
// To wire it (when/if needed):
//   1. Add RENDER_WORKER_LEGACY_URL to config.ts (URL of the existing
//      Puppeteer worker).
//   2. POST {RENDER_WORKER_LEGACY_URL}/render with a body matching the
//      legacy worker's /render contract (see render-worker/index.js),
//      requesting map-only output.
//   3. Replace the throw below with the HTTP call.
//   4. Flip the affected preset(s) in PRESET_RENDERER from 'native' to
//      'browser'. Existing cache rows for those presets stay valid for
//      the Native backend; the new browser-backend renders populate
//      separate cache entries (cache isolation is automatic).

export interface BrowserRenderInput {
  styleJson: object
  widthPx: number
  heightPx: number
  dpi: number
  center: [number, number]
  zoom: number
  bearing?: number
  pitch?: number
}

export interface BrowserRenderOutput {
  pngBuffer: Buffer
  widthPx: number
  heightPx: number
  renderMs: number
}

export function browserAvailable(): boolean {
  return false
}

export async function renderBrowser(_input: BrowserRenderInput): Promise<BrowserRenderOutput> {
  throw new Error(
    'browser fallback not implemented in v1 — every preset must route to native. ' +
      'If a preset needs a fallback, wire render-worker/ (legacy Puppeteer) here.',
  )
}
