// render-worker-v4/src/renderer/native.ts
//
// MapLibre Native renderer.
//
// We render at the oversized full-bleed viewport (plan v4 locked decision
// #2). Camera is read from style_config.map_center / map_zoom, with a
// log-base-2 zoom correction for the difference between the editor canvas
// width and the print canvas width (locked decision #3).
//
// Native's `request` callback is synchronous-callback-style. We bridge it
// through the LRU TileCache so tiles are deduped + persisted across
// renders.

// @ts-expect-error — @maplibre/maplibre-gl-native ships its own .d.ts but
// we don't take a hard dep on it for the build (the type comes from a
// peer-installed package). The runtime import is correct.
import mbgl from '@maplibre/maplibre-gl-native'
import sharp from 'sharp'

import { CONFIG } from '../config.js'
import { log } from '../log.js'
import type { StyleConfig } from '../types.js'

import { TileCache } from './tileCache.js'

let _tileCache: TileCache | null = null
function tileCache(): TileCache {
  if (_tileCache) return _tileCache
  _tileCache = new TileCache({
    defaultHeaders: {
      // Stadia Maps verifies Referer for domain-based auth (mirrors the
      // legacy worker's setExtraHTTPHeaders).
      Referer: CONFIG.appUrl ?? 'http://localhost:3000',
      'User-Agent': 'RadMaps-Render-Worker-v4/0.1',
    },
  })
  return _tileCache
}

// MapLibre Native's request callback signature. We type it loosely because
// the package's .d.ts varies across versions.
type NativeRequest = { url: string; kind?: number }
type NativeCallback = (err: Error | null, response?: { data: Buffer }) => void

// A 1×1 transparent PNG. Used as the response body when an upstream tile
// server returns 200 OK with an empty body (e.g. Stadia for out-of-coverage
// tiles). Passing 0 bytes to Native trips CGImageSourceCreateImageAtIndex
// failed; passing this gives Native something it can decode to "nothing
// visible" so the render proceeds.
const EMPTY_TILE_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNgAAIAAAUAAarVyFEAAAAASUVORK5CYII=',
  'base64',
)

function makeRequestHandler() {
  return (req: NativeRequest, callback: NativeCallback) => {
    const url = req.url
    if (!url) {
      callback(new Error('empty tile URL'))
      return
    }
    tileCache()
      .get(url)
      .then((data) => {
        // Stadia returns 200 OK with an empty body for tiles outside its
        // coverage. Passing 0 bytes to MapLibre Native triggers
        // CGImageSourceCreateImageAtIndex failed (Core Graphics). The
        // request callback also rejects undefined — it requires a
        // response object. Substitute a 1×1 transparent PNG so Native
        // has valid bytes to decode (renders nothing visible at that
        // tile slot, render keeps going).
        if (!data || data.byteLength === 0) {
          callback(null, { data: EMPTY_TILE_PNG })
          return
        }
        callback(null, { data })
      })
      .catch((err: Error) => callback(err))
  }
}

export interface NativeRenderInput {
  styleJson: object
  /** Bleed-canvas pixel dimensions. */
  widthPx: number
  heightPx: number
  /** Final DPI (after maxDpi clamp). */
  dpi: number
  center: [number, number]
  zoom: number
  bearing?: number
  pitch?: number
}

export interface NativeRenderOutput {
  pngBuffer: Buffer
  widthPx: number
  heightPx: number
  renderMs: number
}

/**
 * Compute the camera the Native renderer should consume.
 *
 * Plan v4: never re-derive camera from bbox. Use style_config.map_center +
 * style_config.map_zoom verbatim, with a log-base-2 correction for the
 * editor → render-canvas width ratio.
 *
 * The Native renderer uses ratio=1 + physical width (see renderNative for
 * the rationale — non-integer ratios produce buffer-size mismatches).
 * That means the zoom passed in is in physical-pixel terms, and the
 * correction is `log2(physicalRenderWidth / map_editor_width)`. The
 * editor's `map_editor_width` is the editor's CSS canvas width at the
 * time the camera was frozen — for the saved zoom to match the saved
 * area at a wider canvas, you increase zoom by log2 of the ratio.
 */
export function resolveCamera(
  config: StyleConfig,
  renderWidthPx: number,
): { center: [number, number]; zoom: number } | null {
  // map_center may be null/undefined for legacy maps; caller must catch this.
  if (!config.map_center || config.map_zoom == null) return null
  const center = config.map_center as [number, number]
  let zoom = config.map_zoom as number
  const editorWidth = (config as { map_editor_width?: number }).map_editor_width
  if (editorWidth && editorWidth > 0) {
    zoom = zoom + Math.log2(renderWidthPx / editorWidth)
  }
  return { center, zoom }
}

/**
 * Render a MapLibre style at the supplied viewport. Returns a PNG buffer.
 *
 * MapLibre Native renders at `width × ratio` × `height × ratio` physical
 * pixels where ratio = dpi / 72. We pass logical CSS dimensions; sharp
 * encodes the resulting raw RGBA at physical resolution.
 */
export async function renderNative(input: NativeRenderInput): Promise<NativeRenderOutput> {
  // We render at ratio=1 with physical dimensions directly. This gives
  // deterministic buffer sizing — Native returns exactly width × height ×
  // 4 bytes, which Sharp can decode without size mismatch errors.
  //
  // Why not ratio = dpi/72?  At non-integer ratios (e.g. 4.167 for 300
  // DPI), Native's internal floor/ceil rounding can produce a buffer
  // that's a few rows short of `Math.round(logicalDim * ratio)`. Sharp
  // then errors with "VipsImage: memory area too small". Using ratio=1
  // sidesteps the rounding entirely.
  //
  // The visual cost is minor: at ratio>1, Native uses slightly more
  // precise sub-pixel rendering. At ratio=1 we still render at the
  // full physical pixel count — the only difference is internal
  // sub-pixel-AA precision, which is invisible in print at 300 DPI.
  const ratio = 1
  const renderWidth = input.widthPx
  const renderHeight = input.heightPx

  const map = new mbgl.Map({
    request: makeRequestHandler(),
    ratio,
  })

  const start = Date.now()
  let buffer: Buffer
  try {
    map.load(input.styleJson)
    buffer = await new Promise<Buffer>((resolve, reject) => {
      map.render(
        {
          width: renderWidth,
          height: renderHeight,
          zoom: input.zoom,
          center: input.center,
          bearing: input.bearing ?? 0,
          pitch: input.pitch ?? 0,
        },
        (err: Error | null, buf: Buffer) => {
          if (err) reject(err)
          else resolve(buf)
        },
      )
    })
  } catch (err) {
    log.error('native_render_failed', {
      message: err instanceof Error ? err.message : String(err),
    })
    throw err
  } finally {
    try {
      map.release()
    } catch {
      /* noop */
    }
  }

  // Defensive: the buffer should be exactly width × height × 4 bytes.
  const expected = renderWidth * renderHeight * 4
  if (buffer.byteLength !== expected) {
    log.warn('native_buffer_size_mismatch', {
      expected,
      actual: buffer.byteLength,
      delta: buffer.byteLength - expected,
    })
  }

  // Pipe RGBA → PNG. Sharp's `raw` adapter is the canonical way to consume
  // Native's output buffer.
  const png = await sharp(buffer, {
    raw: { width: renderWidth, height: renderHeight, channels: 4 },
  })
    .png({ compressionLevel: 6 })
    .toBuffer()

  return {
    pngBuffer: png,
    widthPx: renderWidth,
    heightPx: renderHeight,
    renderMs: Date.now() - start,
  }
}

/** True if the @maplibre/maplibre-gl-native binary loaded for this arch. */
export function nativeAvailable(): boolean {
  try {
    // mbgl.Map is the constructor; presence implies the addon loaded.
    return typeof mbgl?.Map === 'function'
  } catch {
    return false
  }
}
