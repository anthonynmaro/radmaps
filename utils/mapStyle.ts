import { DEFAULT_CONTOUR_MAJOR_WIDTH, type StyleConfig, type TrailSegment } from '~/types'
import {
  CIRCLE_SCALE_PROPERTIES,
  LINE_SCALE_PROPERTIES,
  ROUTE_SCALE_PROPERTIES,
  SYMBOL_SCALE_PROPERTIES,
  effectiveStyleConfig,
  getPresetGraph,
  styleGraphUsesContours,
  type ScaledMapLibreProperty,
} from '~/utils/styleLayerGraph'

type MapStyleObject = Record<string, unknown> & {
  layers?: Array<Record<string, unknown>>
}

function withScaleMetadata<T extends Record<string, unknown>>(layer: T, scale: ScaledMapLibreProperty[]): T {
  const metadata = (layer.metadata && typeof layer.metadata === 'object')
    ? layer.metadata as Record<string, unknown>
    : {}
  const radmaps = (metadata.radmaps && typeof metadata.radmaps === 'object')
    ? metadata.radmaps as Record<string, unknown>
    : {}
  return {
    ...layer,
    metadata: {
      ...metadata,
      radmaps: {
        ...radmaps,
        scale,
      },
    },
  }
}

function applyGraphLayerMetadata<T extends object>(style: T, config: StyleConfig): T {
  const mapStyle = style as MapStyleObject
  if (!Array.isArray(mapStyle.layers)) return style
  const graphLayers = new Map(getPresetGraph(config.preset).layers.map(layer => [layer.id, layer]))
  mapStyle.layers = mapStyle.layers.map((layer) => {
    const graphLayer = graphLayers.get(String(layer.id ?? ''))
    return graphLayer?.scale?.length ? withScaleMetadata(layer, graphLayer.scale) : layer
  })
  return mapStyle as T
}

/**
 * Build a MapLibre GL Style JSON object from a StyleConfig.
 * Used in both the browser MapPreview and the server render worker.
 *
 * Contour strategy (two paths):
 *   Browser  → contourTileUrl is provided by MapPreview.vue (maplibre-contour protocol)
 *              Generates contours on-the-fly from free AWS terrarium DEM tiles.
 *              Supports configurable meter intervals via contour_detail.
 *   Print    → Browserless renders the same MapPreview path, so it should also
 *              provide contourTileUrl and use the browser-generated contours.
 *   Fallback → contourTileUrl is undefined; falls back to Mapbox terrain-v2
 *              vector tiles for legacy/non-browser style generation.
 *
 * Base tile options (base_tile_style):
 *   carto-light / carto-dark  — free CARTO raster tiles (no token)
 *   maptiler-outdoor/topo/winter — MapTiler raster tiles (requires MAPTILER_TOKEN)
 *   topographic preset        — Mapbox Outdoors v12 (requires MAPBOX_TOKEN)
 */
export function buildMapStyle(
  config: StyleConfig,
  mapboxToken?: string,
  maptilerToken?: string,
  contourTileUrl?: string,
  stadiaToken?: string,
): object {
  const effectiveConfig = effectiveStyleConfig(config)
  let style: object
  if (effectiveConfig.preset === 'topographic') {
    style = buildTopographicStyle(effectiveConfig, mapboxToken, contourTileUrl)
  } else if (isRadMapsAtlasPreset(effectiveConfig.preset)) {
    style = buildRadMapsAtlasStyle(effectiveConfig, mapboxToken, contourTileUrl)
  } else if (effectiveConfig.preset === 'route-only') {
    style = buildRouteOnlyStyle(effectiveConfig, mapboxToken, maptilerToken, contourTileUrl)
  } else if (effectiveConfig.preset === 'road-network') {
    style = buildRoadNetworkStyle(effectiveConfig, mapboxToken, contourTileUrl)
  } else if (effectiveConfig.preset === 'contour-art') {
    style = buildContourArtStyle(effectiveConfig, mapboxToken, contourTileUrl)
  } else if (effectiveConfig.preset === 'natural-topo') {
    style = buildNaturalTopoStyle(effectiveConfig, mapboxToken, maptilerToken, contourTileUrl)
  } else if (effectiveConfig.preset === 'stadia-watercolor') {
    style = buildStadiaWatercolorStyle(effectiveConfig, contourTileUrl, stadiaToken, mapboxToken)
  } else if (effectiveConfig.preset === 'stadia-toner') {
    style = buildStadiaTonerStyle(effectiveConfig, contourTileUrl, stadiaToken, mapboxToken)
  } else if (effectiveConfig.preset === 'native-toner') {
    style = buildNativeTonerStyle(effectiveConfig, mapboxToken, contourTileUrl)
  } else if (effectiveConfig.preset === 'native-watercolor') {
    style = buildNativeWatercolorStyle(effectiveConfig, contourTileUrl, mapboxToken)
  } else if (effectiveConfig.preset === 'alidade-smooth') {
    style = buildAlidadeSmoothStyle(effectiveConfig, maptilerToken, mapboxToken, contourTileUrl)
  } else if (effectiveConfig.preset === 'alidade-smooth-dark') {
    style = buildAlidadeSmoothDarkStyle(effectiveConfig, maptilerToken, mapboxToken, contourTileUrl)
  } else {
    style = buildMinimalistStyle(effectiveConfig, mapboxToken, maptilerToken, contourTileUrl)
  }
  return applyGraphLayerMetadata(style, effectiveConfig)
}

function isRadMapsAtlasPreset(preset?: string) {
  return Boolean(preset?.startsWith('radmaps-'))
}

function atlasLayerEnabled(config: StyleConfig, layer: keyof NonNullable<StyleConfig['atlas_layers']>, fallback = true) {
  return config.atlas_layers?.[layer] ?? fallback
}

function atlasNumberSetting(value: number | undefined, fallback: number, min = 0, max = 1) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, value))
}

function sameOriginTileUrl(path: string) {
  const origin = typeof globalThis !== 'undefined'
    ? (globalThis as { location?: { origin?: string } }).location?.origin
    : ''
  return origin ? `${origin}${path}` : path
}

export function styleUsesContours(config: Pick<StyleConfig, 'preset' | 'show_contours'>): boolean {
  return styleGraphUsesContours(config)
}

// ─── Contour thresholds for maplibre-contour ─────────────────────────────────
// Per-detail-level thresholds: { mapZoom: [minorIntervalMeters, majorIntervalMeters] }
// These are used in MapPreview.vue to generate the contourTileUrl.
// Exported so MapPreview can build the URL without duplicating the table.
//
// maplibre-contour's getOptionsForZoom picks the HIGHEST key ≤ current map
// zoom. If no key qualifies, levels=[] and nothing is drawn. Start at zoom 1
// as a universal fallback — the library fetches DEM tiles at zoom+overzoom
// (overzooming from higher-res tiles) so contours are accurate even when the
// map is zoomed out. Key 1 covers any poster zoom below the first named key.
export const CONTOUR_THRESHOLDS: Record<number, Record<number, [number, number]>> = {
  0: { 1: [1000, 5000], 7: [500, 2000], 8: [500, 2000], 9: [300, 1500], 10: [200, 1000], 11: [200, 1000], 12: [200, 1000], 13: [100, 500],  14: [50,  200] },
  1: { 1: [500,  2000], 7: [300, 1500], 8: [200, 1000], 9: [100, 500],  10: [100, 500],  11: [100, 500],  12: [100, 500],  13: [50,  200],  14: [20,  100] },
  2: { 1: [200,  1000], 7: [200, 1000], 8: [100, 500],  9: [50,  250],  10: [50,  200],  11: [50,  200],  12: [50,  200],  13: [20,  100],  14: [10,  50]  },
  3: { 1: [100,  500],  7: [100, 500],  8: [50,  250],  9: [30,  150],  10: [20,  100],  11: [20,  100],  12: [20,  100],  13: [10,  50],   14: [5,   20]  }, // default
  4: { 1: [50,   250],  7: [50,  250],  8: [30,  150],  9: [20,  100],  10: [10,  50],   11: [10,  50],   12: [10,  50],   13: [5,   20],   14: [5,   10]  },
  5: { 1: [20,   100],  7: [20,  100],  8: [10,  50],   9: [10,  50],   10: [5,   20],   11: [5,   20],   12: [5,   20],   13: [2,   10],   14: [2,   5]   },
}

// ─── Color helpers ────────────────────────────────────────────────────────────

// Linearly interpolate between two hex colors. t=0 → a, t=1 → b.
export function blendHex(a: string, b: string, t: number): string {
  const ar = parseInt(a.slice(1, 3), 16), ag = parseInt(a.slice(3, 5), 16), ab = parseInt(a.slice(5, 7), 16)
  const br = parseInt(b.slice(1, 3), 16), bg = parseInt(b.slice(3, 5), 16), bb = parseInt(b.slice(5, 7), 16)
  const r = Math.round(ar + (br - ar) * t).toString(16).padStart(2, '0')
  const g = Math.round(ag + (bg - ag) * t).toString(16).padStart(2, '0')
  const bh = Math.round(ab + (bb - ab) * t).toString(16).padStart(2, '0')
  return `#${r}${g}${bh}`
}

// ─── Tile effect URL wrapper ──────────────────────────────────────────────────
// Prefixes raster tile URLs with a custom 'styledtile://' protocol when a
// per-pixel effect is active. Parameters are encoded into the URL so MapLibre
// generates a distinct cache key whenever they change.
//
// Format: styledtile://{effect},{...params}|{realTileUrl}
//
// The MapPreview.vue protocol handler parses this, fetches the real tile,
// applies the pixel transform via OffscreenCanvas, and returns the result.
// The render-worker registers an identical handler in its inline script.
function styledTileUrls(config: StyleConfig, urls: string[]): string[] {
  const effect = config.tile_effect ?? 'none'
  if (effect === 'none') return urls

  if (effect === 'invert') {
    return urls.map(u => `styledtile://invert|${u}`)
  }

  if (effect === 'duotone') {
    // Shadow → label_text_color (dark), Highlight → background_color (light).
    // Together they remap any tile's luminance into the poster's own palette.
    const shadow    = (config.label_text_color  ?? '#1C1917').replace('#', '')
    const highlight = (config.background_color  ?? '#F7F4EF').replace('#', '')
    const strength  = Math.round((config.tile_duotone_strength ?? 0.9) * 100)
    return urls.map(u => `styledtile://duotone,${shadow},${highlight},${strength}|${u}`)
  }

  if (effect === 'posterize') {
    const levels = config.tile_posterize_levels ?? 4
    return urls.map(u => `styledtile://posterize,${levels}|${u}`)
  }

  if (effect === 'layer-color') {
    // Trilinear luminance mapping: dark pixels → shadow, mid → midtone, light → highlight.
    // Defaults to the poster's text/bg palette so out-of-the-box results match the theme.
    const shadowHex    = config.tile_shadow_color    ?? config.label_text_color  ?? '#1C1917'
    const highlightHex = config.tile_highlight_color ?? config.background_color  ?? '#F7F4EF'
    const midHex       = config.tile_midtone_color   ?? blendHex(shadowHex, highlightHex, 0.5)
    const shadow    = shadowHex.replace('#', '')
    const mid       = midHex.replace('#', '')
    const highlight = highlightHex.replace('#', '')
    return urls.map(u => `styledtile://layer-color,${shadow},${mid},${highlight}|${u}`)
  }

  return urls
}

export function mapBackgroundColor(config: StyleConfig): string {
  return config.tile_effect === 'invert'
    ? (config.label_text_color ?? '#1C1917')
    : (config.background_color ?? '#F7F4EF')
}

export function mapInkColor(config: StyleConfig): string {
  return config.tile_effect === 'invert'
    ? (config.background_color ?? '#F7F4EF')
    : (config.label_text_color ?? '#1C1917')
}

// ─── DEM source (hillshade) ───────────────────────────────────────────────────
// AWS Terrain Tiles (Tilezen/Terrarium) — free, no auth, terrarium encoding.
function demSource(_token: string) {
  return {
    'mapbox-dem': {
      type: 'raster-dem' as const,
      tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
      tileSize: 256,
      maxzoom: 15,
      encoding: 'terrarium' as const,
      attribution: '© Mapzen, © OpenStreetMap contributors',
    },
  }
}

// ─── Contour sources ──────────────────────────────────────────────────────────

// Browser path: maplibre-contour generates vector contours from the DEM tiles.
// The tileUrl is a custom "contour://" protocol URL produced by DemSource.contourProtocol().
function mlContourSource(tileUrl: string) {
  return {
    'contours': {
      type: 'vector' as const,
      tiles: [tileUrl],
      minzoom: 0,
      maxzoom: 14,
    },
  }
}

// Fallback path (render worker): Mapbox terrain-v2 vector tiles.
function terrainV2Source(token: string) {
  return {
    'mapbox-terrain-v2': {
      type: 'vector' as const,
      tiles: [`https://api.mapbox.com/v4/mapbox.mapbox-terrain-v2/{z}/{x}/{y}.vector.pbf?access_token=${token}`],
      minzoom: 10,
      maxzoom: 15,
      attribution: '© Mapbox',
    },
  }
}

function contourSource(token: string, contourTileUrl?: string) {
  return contourTileUrl ? mlContourSource(contourTileUrl) : terrainV2Source(token)
}

// ─── Hillshade layers ─────────────────────────────────────────────────────────

function hillshadeLayers(config: StyleConfig) {
  if (!config.show_hillshade) return []
  return [
    {
      id: 'hillshade',
      type: 'hillshade' as const,
      source: 'mapbox-dem',
      paint: {
        'hillshade-shadow-color': '#000000',
        'hillshade-highlight-color': '#FFFFFF',
        'hillshade-accent-color': '#000000',
        'hillshade-illumination-direction': 335,
        'hillshade-exaggeration': config.hillshade_intensity,
      },
    },
  ]
}

// ─── Contour line layers ──────────────────────────────────────────────────────

export function contourMinorLineWidthExpression(config: StyleConfig): unknown[] {
  const weight = config.contour_minor_width ?? 1
  if (config.preset === 'contour-art') {
    return ['interpolate', ['linear'], ['zoom'], 5, 0.75 * weight, 14, 1.4 * weight]
  }
  return ['interpolate', ['linear'], ['zoom'], 5, 0.8 * weight, 14, 1.0 * weight]
}

export function contourMidLineWidthExpression(config: StyleConfig): unknown[] {
  const weight = config.contour_minor_width ?? 1
  return ['interpolate', ['linear'], ['zoom'], 5, 1.1 * weight, 14, 1.5 * weight]
}

export function contourMajorLineWidthExpression(config: StyleConfig): unknown[] {
  const weight = config.contour_major_width ?? DEFAULT_CONTOUR_MAJOR_WIDTH
  if (config.preset === 'contour-art') {
    return ['interpolate', ['linear'], ['zoom'], 5, 1.3 * weight, 14, 2.8 * weight]
  }
  return ['interpolate', ['linear'], ['zoom'], 5, 1.5 * weight, 14, 2.5 * weight]
}

function contourLayers(config: StyleConfig, usingMlContour: boolean) {
  if (!config.show_contours) return []

  // ── maplibre-contour path ───────────────────────────────────────────────────
  // Source layer: 'contours'  |  level: 0 = minor, 1 = major
  if (usingMlContour) {
    const layers: object[] = [
      {
        id: 'contours-minor',
        type: 'line',
        source: 'contours',
        'source-layer': 'contours',
        filter: ['!=', ['get', 'level'], 1],
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': config.contour_color,
          'line-opacity': ['interpolate', ['linear'], ['zoom'],
            5, config.contour_opacity,
            14, config.contour_opacity * 0.9,
          ],
          'line-width': contourMinorLineWidthExpression(config),
        },
      },
      {
        id: 'contours-major',
        type: 'line',
        source: 'contours',
        'source-layer': 'contours',
        filter: ['==', ['get', 'level'], 1],
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': config.contour_major_color,
          'line-opacity': config.contour_opacity,
          'line-width': contourMajorLineWidthExpression(config),
        },
      },
    ]

    if (config.show_elevation_labels) {
      layers.push({
        id: 'contours-labels',
        type: 'symbol',
        source: 'contours',
        'source-layer': 'contours',
        filter: ['==', ['get', 'level'], 1],
        layout: {
          'symbol-placement': 'line',
          'symbol-spacing': 500,
          'text-field': ['concat', ['to-string', ['get', 'ele']], 'm'],
          'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Regular'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 5, 9, 14, 13],
          'text-letter-spacing': 0.06,
          'text-padding': 4,
          'text-pitch-alignment': 'viewport',
          // viewport keeps labels horizontal — far more legible than map-aligned
          // which tilts text to follow the contour curve
          'text-rotation-alignment': 'viewport',
        },
        paint: {
          'text-color': config.contour_major_color,
          // Use the poster background colour as the halo so it reads on both
          // light (chalk/topaz) and dark (obsidian/midnight) themes
          'text-halo-color': config.background_color,
          'text-halo-width': 2,
          'text-opacity': config.contour_opacity,
        },
      })
    }

    return layers
  }

  // ── terrain-v2 fallback (render worker) ─────────────────────────────────────
  // Source layer: 'contour'  |  index: 5 = mid, 10 = major
  const detail = Math.round(config.contour_detail ?? 2)

  const layers: object[] = []

  if (detail >= 2) {
    layers.push({
      id: 'contours-minor',
      type: 'line',
      source: 'mapbox-terrain-v2',
      'source-layer': 'contour',
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': config.contour_color,
        'line-opacity': ['interpolate', ['linear'], ['zoom'],
          5, config.contour_opacity,
          14, config.contour_opacity * 0.9,
        ],
        'line-width': contourMinorLineWidthExpression(config),
      },
    })
  }

  if (detail >= 1) {
    layers.push({
      id: 'contours-mid',
      type: 'line',
      source: 'mapbox-terrain-v2',
      'source-layer': 'contour',
      filter: ['==', ['get', 'index'], 5],
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': config.contour_color,
        'line-opacity': config.contour_opacity,
        'line-width': contourMidLineWidthExpression(config),
      },
    })
  }

  layers.push({
    id: 'contours-major',
    type: 'line',
    source: 'mapbox-terrain-v2',
    'source-layer': 'contour',
    filter: ['==', ['get', 'index'], 10],
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: {
      'line-color': config.contour_major_color,
      'line-opacity': config.contour_opacity,
      'line-width': contourMajorLineWidthExpression(config),
    },
  })

  if (config.show_elevation_labels) {
    layers.push({
      id: 'contours-labels',
      type: 'symbol',
      source: 'mapbox-terrain-v2',
      'source-layer': 'contour',
      filter: ['==', ['get', 'index'], 10],
      layout: {
        'symbol-placement': 'line',
        'symbol-spacing': 500,
        'text-field': ['concat', ['to-string', ['get', 'ele']], 'm'],
        'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Regular'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 5, 9, 14, 13],
        'text-letter-spacing': 0.06,
        'text-padding': 4,
        'text-pitch-alignment': 'viewport',
        'text-rotation-alignment': 'viewport',
      },
      paint: {
        'text-color': config.contour_major_color,
        'text-halo-color': config.background_color,
        'text-halo-width': 2,
        'text-opacity': config.contour_opacity,
      },
    })
  }

  return layers
}

// ─── Roads overlay ───────────────────────────────────────────────────────────
// Mapbox Streets v8 vector tiles — uses the same token as terrain.
// Falls back gracefully (no source/layers added) when no token is present.

function roadsSource(token: string) {
  return {
    'mapbox-streets': {
      type: 'vector' as const,
      tiles: [`https://api.mapbox.com/v4/mapbox.mapbox-streets-v8/{z}/{x}/{y}.vector.pbf?access_token=${token}`],
      minzoom: 0,
      maxzoom: 16,
      attribution: '© Mapbox © OpenStreetMap contributors',
    },
  }
}

const NATURAL_WATERWAY_CLASSES = ['river', 'canal', 'stream', 'stream_intermittent'] as const

function waterwayLayer(id: string, color: string, opacity: number, minWidth: number, maxWidth: number): object {
  return {
    id,
    type: 'line',
    source: 'mapbox-streets',
    'source-layer': 'waterway',
    filter: ['in', ['get', 'class'], ['literal', [...NATURAL_WATERWAY_CLASSES]]],
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: {
      'line-color': color,
      'line-opacity': opacity,
      'line-width': ['interpolate', ['linear'], ['zoom'], 7, minWidth, 14, maxWidth],
    },
  }
}

function usesRoadOverlay(config: StyleConfig): boolean {
  return config.show_roads === true || config.show_place_labels !== false || config.show_poi_labels === true
}

function placeLabelTypes(scale: StyleConfig['place_labels_scale']): string[] {
  if (scale === 'city') return ['city']
  if (scale === 'village') return ['city', 'town', 'village']
  return ['city', 'town']  // default: 'town'
}

function roadsLayers(config: StyleConfig): object[] {
  const roadColor  = config.roads_color  ?? config.label_text_color
  const roadOpacity = config.roads_opacity ?? 0.6
  const labelColor  = config.place_labels_color  ?? config.label_text_color
  const labelOpacity = config.place_labels_opacity ?? 0.75
  const poiColor  = config.poi_labels_color  ?? config.label_text_color
  const poiOpacity = config.poi_labels_opacity ?? 0.65

  const layers: object[] = []

  if (config.show_roads) {
    layers.push(
      // Motorways + trunk — widest, most prominent
      {
        id: 'roads-major',
        type: 'line',
        source: 'mapbox-streets',
        'source-layer': 'road',
        filter: ['in', ['get', 'class'], ['literal', ['motorway', 'trunk']]],
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': roadColor,
          'line-opacity': roadOpacity * 0.50,
          'line-width': ['interpolate', ['linear'], ['zoom'], 7, 1.0, 14, 3.5],
        },
      },
      // Primary + secondary
      {
        id: 'roads-primary',
        type: 'line',
        source: 'mapbox-streets',
        'source-layer': 'road',
        filter: ['in', ['get', 'class'], ['literal', ['primary', 'secondary']]],
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': roadColor,
          'line-opacity': roadOpacity * 0.37,
          'line-width': ['interpolate', ['linear'], ['zoom'], 9, 0.7, 14, 2.5],
        },
      },
      // Tertiary + local streets
      {
        id: 'roads-minor',
        type: 'line',
        source: 'mapbox-streets',
        'source-layer': 'road',
        filter: ['in', ['get', 'class'], ['literal', ['tertiary', 'street', 'service', 'path']]],
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': roadColor,
          'line-opacity': roadOpacity * 0.23,
          'line-width': ['interpolate', ['linear'], ['zoom'], 11, 0.5, 14, 1.5],
        },
      },
    )
  }

  // Place labels (cities, towns, villages) — shown by default
  if (config.show_place_labels !== false) {
    layers.push({
      id: 'roads-place-labels',
      type: 'symbol',
      source: 'mapbox-streets',
      'source-layer': 'place_label',
      filter: ['in', ['get', 'type'], ['literal', placeLabelTypes(config.place_labels_scale)]],
      layout: {
        'text-field': ['get', 'name'],
        'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Regular'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 8, 9, 14, 13],
        'text-anchor': 'center',
        'text-max-width': 8,
      },
      paint: {
        'text-color': labelColor,
        'text-opacity': labelOpacity,
        'text-halo-color': config.background_color,
        'text-halo-width': 1.5,
      },
    })
  }

  // POI labels — opt-in only
  if (config.show_poi_labels) {
    layers.push({
      id: 'roads-poi-labels',
      type: 'symbol',
      source: 'mapbox-streets',
      'source-layer': 'poi_label',
      filter: ['all',
        ['has', 'name'],
        ['<=', ['to-number', ['get', 'filterrank'], 5], 3],
      ],
      layout: {
        'text-field': ['get', 'name'],
        'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Regular'],
        'text-size': 10,
        'text-anchor': 'top',
        'text-offset': [0, 0.6],
        'text-max-width': 6,
      },
      paint: {
        'text-color': poiColor,
        'text-opacity': poiOpacity,
        'text-halo-color': config.background_color,
        'text-halo-width': 1,
      },
    })
  }

  return layers
}

// ─── Trail segment sources/layers ────────────────────────────────────────────

const ELEVATION_GRADIENT_PAINT = [
  'interpolate', ['linear'], ['line-progress'],
  0,    '#4F8EF7',
  0.25, '#52B788',
  0.6,  '#F4A261',
  0.85, '#E76F51',
  1,    '#C1121F',
] as const

export function trailSegmentSources(segments: TrailSegment[] = []): Record<string, object> {
  const sources: Record<string, object> = {}
  for (const seg of segments) {
    if (!seg.visible) continue
    sources[`trail-seg-${seg.id}`] = {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
      ...(seg.color_mode === 'gradient' ? { lineMetrics: true } : {}),
    }
  }
  return sources
}

export function trailSegmentLayers(segments: TrailSegment[] = [], config: StyleConfig): object[] {
  const layers: object[] = []
  for (const seg of segments) {
    if (!seg.visible) continue
    const width = seg.width ?? config.route_width ?? 2
    const opacity = seg.opacity ?? 0.9
    const dashArray = seg.dash ? [4, 3] : undefined
    const useGradient = seg.color_mode === 'gradient'

    layers.push(withScaleMetadata({
      id: `trail-seg-casing-${seg.id}`,
      type: 'line',
      source: `trail-seg-${seg.id}`,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': config.segment_casing_color ?? '#FFFFFF',
        'line-width': width + (config.segment_casing_width ?? 3),
        'line-opacity': opacity,
      },
    }, LINE_SCALE_PROPERTIES))

    const lineLayer: Record<string, unknown> = {
      id: `trail-seg-line-${seg.id}`,
      type: 'line',
      source: `trail-seg-${seg.id}`,
      layout: {
        'line-join': 'round',
        'line-cap': 'round',
      },
      paint: {
        ...(useGradient ? { 'line-gradient': ELEVATION_GRADIENT_PAINT } : { 'line-color': seg.color }),
        'line-width': width,
        'line-opacity': opacity,
        ...(dashArray ? { 'line-dasharray': dashArray } : {}),
      },
    }
    layers.push(withScaleMetadata(lineLayer, LINE_SCALE_PROPERTIES))
  }
  return layers
}

// ─── Segment endpoint handles ─────────────────────────────────────────────────
// Small colored dots at the start/end of each visible trail segment.
// Data is populated by MapPreview.vue's populateSegmentSources().
// circle-color is data-driven from the GeoJSON feature's `color` property.

function segmentHandleSource(): object {
  return {
    'segment-handles': {
      type: 'geojson' as const,
      data: { type: 'FeatureCollection', features: [] },
    },
  }
}

export function effectiveSegmentDotRadius(config: StyleConfig): number {
  const configured = typeof config.segment_dot_size === 'number' && Number.isFinite(config.segment_dot_size)
    ? config.segment_dot_size
    : 1.5
  return Math.min(Math.max(configured, 0.5), 2.5)
}

function segmentHandleLayers(config: StyleConfig): object[] {
  const dotR = effectiveSegmentDotRadius(config)
  return [
    withScaleMetadata({
      id: 'segment-handle-dot',
      type: 'circle',
      source: 'segment-handles',
      paint: {
        'circle-radius': dotR,
        'circle-color': ['get', 'color'],
        'circle-opacity': 1,
      },
    }, CIRCLE_SCALE_PROPERTIES),
  ]
}

// Pins are rendered as maplibregl.Marker HTML elements (see MapPreview.vue → placePinMarkers).
// No MapLibre source/layers needed — markers sit in the DOM above the canvas.

// ─── Route source ─────────────────────────────────────────────────────────────
// lineMetrics must be true when using line-gradient; data is populated by MapPreview.vue.

function routeSource(config: StyleConfig): object {
  // lineMetrics is required for line-gradient, but causes MapLibre to draw connector
  // segments between MultiLineString sub-lines. Disable it when deleted ranges are
  // present so that route gaps render correctly; the layer falls back to line-color.
  const useGradient = config.route_color_mode === 'gradient' && !(config.route_deleted_ranges ?? []).length
  return {
    type: 'geojson' as const,
    data: { type: 'FeatureCollection', features: [] },
    ...(useGradient ? { lineMetrics: true } : {}),
  }
}

// ─── Route layers ─────────────────────────────────────────────────────────────

function routeLayers(config: StyleConfig) {
  const casing = withScaleMetadata({
    id: 'route-line-casing',
    type: 'line',
    source: 'route',
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: {
      'line-color': mapBackgroundColor(config),
      'line-width': config.route_width + 4,
      'line-opacity': config.route_opacity,
    },
  }, ROUTE_SCALE_PROPERTIES)

  const useGradient = config.route_color_mode === 'gradient' && !(config.route_deleted_ranges ?? []).length
  if (useGradient) {
    return [
      casing,
      withScaleMetadata({
        id: 'route-line',
        type: 'line',
        source: 'route',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-gradient': ELEVATION_GRADIENT_PAINT,
          'line-width': config.route_width,
          'line-opacity': config.route_opacity,
        },
      }, ROUTE_SCALE_PROPERTIES),
    ]
  }

  return [
    casing,
    withScaleMetadata({
      id: 'route-line',
      type: 'line',
      source: 'route',
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': config.route_color,
        'line-width': config.route_width,
        'line-opacity': config.route_opacity,
      },
    }, ROUTE_SCALE_PROPERTIES),
  ]
}

// ─── Minimalist Style ─────────────────────────────────────────────────────────

function buildMinimalistStyle(
  config: StyleConfig,
  mapboxToken?: string,
  maptilerToken?: string,
  contourTileUrl?: string,
): object {
  const mapboxTk = mapboxToken || ''
  const maptilerTk = maptilerToken || ''
  const base = config.base_tile_style ?? 'carto-light'
  const usingMlContour = !!contourTileUrl

  // ── Resolve base tiles ─────────────────────────────────────────────────────
  let baseTileSource: object
  let baseTileOpacity: number
  let baseTileAttribution: string

  if (base === 'maptiler-outdoor' || base === 'maptiler-topo' || base === 'maptiler-winter') {
    const styleMap: Record<string, string> = {
      'maptiler-outdoor': 'outdoor-v2',
      'maptiler-topo': 'topo-v2',
      'maptiler-winter': 'winter-v2',
    }
    baseTileSource = {
      type: 'raster' as const,
      tiles: styledTileUrls(config, [`https://api.maptiler.com/maps/${styleMap[base]}/{z}/{x}/{y}@2x.png?key=${maptilerTk}`]),
      tileSize: 512,
    }
    baseTileOpacity = 0.85
    baseTileAttribution = '© MapTiler © OpenStreetMap contributors'
  } else {
    const dark = base === 'carto-dark'
    // @2x raster tiles for retina/print quality. CARTO basemaps support
    // the `{r}` retina suffix; we hard-code `@2x` and bump tileSize to
    // 512 so MapLibre renders glyphs/edges sharply at print DPI.
    const sub = (s: string) =>
      ['a', 'b', 'c', 'd'].map(p => `https://${p}.basemaps.cartocdn.com/${s}/{z}/{x}/{y}@2x.png`)
    baseTileSource = {
      type: 'raster' as const,
      tiles: styledTileUrls(config, dark ? sub('dark_all') : sub('light_all')),
      tileSize: 512,
    }
    baseTileOpacity = base === 'carto-dark' ? 0.45 : 0.55
    baseTileAttribution = '© CARTO © OpenStreetMap contributors'
  }

  return {
    version: 8,
    name: 'RadMaps Minimalist',
    glyphs: mapboxTk
      ? `https://api.mapbox.com/fonts/v1/mapbox/{fontstack}/{range}.pbf?access_token=${mapboxTk}`
      : 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
    sources: {
      'base-tiles': { ...baseTileSource, attribution: baseTileAttribution },
      ...((config.show_hillshade || config.map_3d) ? demSource(mapboxTk) : {}),
      ...(config.show_contours ? contourSource(mapboxTk, contourTileUrl) : {}),
      ...(usesRoadOverlay(config) && mapboxTk ? roadsSource(mapboxTk) : {}),
      route: routeSource(config),
      ...trailSegmentSources(config.trail_segments),
      ...segmentHandleSource(),
    },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': mapBackgroundColor(config) } },
      {
        id: 'base-tiles', type: 'raster', source: 'base-tiles',
        paint: {
          'raster-opacity':    baseTileOpacity,
          'raster-contrast':   config.tile_contrast   ?? 0,
          'raster-saturation': config.tile_saturation ?? 0,
          'raster-hue-rotate': config.tile_hue_rotate ?? 0,
        },
      },
      ...hillshadeLayers(config),
      ...contourLayers(config, usingMlContour),
      ...(mapboxTk ? roadsLayers(config) : []),
      ...routeLayers(config),
      ...trailSegmentLayers(config.trail_segments, config),
      ...segmentHandleLayers(config),
    ],
  }
}

// ─── Route-Only Style ─────────────────────────────────────────────────────────
// No base raster tiles — just a solid background + route + optional contours/terrain.
// Produces the clean "route on paper" look: solid colour field, route line, faint labels.

function buildAtlasContourLayers(config: StyleConfig, usingMlContour: boolean, options: {
  watercolor: boolean
  night: boolean
  simple: boolean
}): object[] {
  if (!config.show_contours) return []
  if (!usingMlContour) return contourLayers(config, false)

  const ghostOpacity = options.simple ? 0 : options.watercolor ? 0.075 : options.night ? 0.12 : 0.08
  const layers: object[] = []
  if (ghostOpacity > 0) {
    layers.push(withScaleMetadata({
      id: 'contours-ghost-texture',
      type: 'line',
      source: 'contours',
      'source-layer': 'contours',
      filter: ['!=', ['get', 'level'], 1],
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': config.contour_color,
        'line-opacity': ghostOpacity,
        'line-width': ['interpolate', ['linear'], ['zoom'], 5, 1.2, 14, options.watercolor ? 2.2 : 1.6],
        'line-blur': options.watercolor ? 1.6 : 0.8,
      },
    }, LINE_SCALE_PROPERTIES))
  }

  layers.push(
    withScaleMetadata({
      id: 'contours-minor',
      type: 'line',
      source: 'contours',
      'source-layer': 'contours',
      filter: ['!=', ['get', 'level'], 1],
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': config.contour_color,
        'line-opacity': ['interpolate', ['linear'], ['zoom'], 5, config.contour_opacity, 14, config.contour_opacity * 0.9],
        'line-width': contourMinorLineWidthExpression(config),
        'line-blur': options.watercolor ? 0.25 : 0,
      },
    }, LINE_SCALE_PROPERTIES),
    withScaleMetadata({
      id: 'contours-mid',
      type: 'line',
      source: 'contours',
      'source-layer': 'contours',
      filter: ['==', ['get', 'level'], 1],
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': config.contour_color,
        'line-opacity': Math.max(0, config.contour_opacity * 0.55),
        'line-width': contourMidLineWidthExpression(config),
        'line-blur': options.watercolor ? 0.2 : 0,
      },
    }, LINE_SCALE_PROPERTIES),
    withScaleMetadata({
      id: 'contours-major',
      type: 'line',
      source: 'contours',
      'source-layer': 'contours',
      filter: ['==', ['get', 'level'], 1],
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': config.contour_major_color,
        'line-opacity': config.contour_opacity,
        'line-width': contourMajorLineWidthExpression(config),
        'line-blur': options.watercolor ? 0.08 : 0,
      },
    }, LINE_SCALE_PROPERTIES),
  )

  if (config.show_elevation_labels) {
    layers.push(withScaleMetadata({
      id: 'contours-labels',
      type: 'symbol',
      source: 'contours',
      'source-layer': 'contours',
      filter: ['==', ['get', 'level'], 1],
      layout: {
        'symbol-placement': 'line',
        'symbol-spacing': 500,
        'text-field': ['concat', ['to-string', ['get', 'ele']], 'm'],
        'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Regular'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 5, 9, 14, 13],
        'text-letter-spacing': 0.06,
        'text-padding': 4,
        'text-pitch-alignment': 'viewport',
        'text-rotation-alignment': 'viewport',
      },
      paint: {
        'text-color': config.contour_major_color,
        'text-halo-color': config.background_color,
        'text-halo-width': options.watercolor ? 2.4 : 2,
        'text-opacity': options.watercolor ? config.contour_opacity * 0.7 : config.contour_opacity,
      },
    }, SYMBOL_SCALE_PROPERTIES))
  }

  return layers
}

function buildRadMapsAtlasStyle(
  config: StyleConfig,
  mapboxToken?: string,
  contourTileUrl?: string,
): object {
  const token = mapboxToken || ''
  const preset = config.preset || 'radmaps-field-topo'
  const isWatercolor = preset.includes('watercolor')
  const isNight = preset === 'radmaps-night-relief'
  const isToner = preset === 'radmaps-toner'
  const isSimpleContour = preset === 'radmaps-simple-contour'
  const atlasSettings = config.atlas_layer_settings ?? {}
  const ink = isNight ? '#d8f2dc' : isToner ? '#17222a' : '#405340'
  const land = atlasSettings.landcover?.color || (isNight ? '#102a1d' : isWatercolor ? '#cdddbd' : isToner ? '#edf2f5' : '#e7dfbf')
  const water = atlasSettings.water?.fill_color || (isNight ? '#3f9fbd' : isWatercolor ? '#47aeca' : isToner ? '#bfd5e8' : '#79b7c8')
  const waterway = atlasSettings.waterway?.color || atlasSettings.water?.waterway_color || water
  const park = atlasSettings.park?.fill_color || (isNight ? '#193f25' : isWatercolor ? '#b8d0aa' : isToner ? '#dfe8dd' : '#c9d29a')
  const road = atlasSettings.transportation?.road_color || (isWatercolor ? '#9a6b75' : isNight ? '#f18f45' : isToner ? '#203345' : '#b7663c')
  const roadMajor = atlasSettings.transportation?.major_color || road
  const roadMinor = atlasSettings.transportation?.minor_color || road
  const trail = atlasSettings.transportation?.trail_color || (isWatercolor ? '#7f8f70' : ink)
  const labelHalo = isNight ? '#0b1d15' : isWatercolor ? '#e8eadf' : '#f7f2e7'
  const label = atlasSettings.place?.label_color || config.place_labels_color || (isNight ? '#e5f3d8' : '#29362d')
  const poiLabel = atlasSettings.poi?.label_color || config.poi_labels_color || label
  const roadOpacity = atlasNumberSetting(atlasSettings.transportation?.opacity ?? config.roads_opacity, isWatercolor ? 0.52 : isNight ? 0.9 : 0.82)
  const usingMlContour = !!contourTileUrl
  const defaultContours = config.show_contours || isSimpleContour || preset === 'radmaps-field-topo' || preset === 'radmaps-night-relief'
  const wantsContours = atlasLayerEnabled(config, 'contour', defaultContours) && defaultContours
  const showLandcover = atlasLayerEnabled(config, 'landcover')
  const showPark = atlasLayerEnabled(config, 'park')
  const showWater = atlasLayerEnabled(config, 'water')
  const showWaterway = atlasLayerEnabled(config, 'waterway')
  const showBuildings = atlasLayerEnabled(config, 'building')
  const showTransportation = atlasLayerEnabled(config, 'transportation')
  const showPlaces = atlasLayerEnabled(config, 'place', config.show_place_labels !== false)
  const showPois = atlasLayerEnabled(config, 'poi', config.show_poi_labels ?? true)

  const sources: Record<string, object> = {
    'radmaps-atlas-base': {
      type: 'vector' as const,
      tiles: [sameOriginTileUrl('/api/atlas/tiles/base/{z}/{x}/{y}.mvt?environment=staging')],
      minzoom: 0,
      maxzoom: 14,
      attribution: '© OpenStreetMap contributors © RadMaps Atlas',
    },
    route: routeSource(config),
    ...trailSegmentSources(config.trail_segments),
    ...segmentHandleSource(),
  }

  if (wantsContours) {
    Object.assign(sources, contourSource(token, contourTileUrl))
  }
  if (config.show_hillshade && !isSimpleContour) {
    Object.assign(sources, demSource(token))
  }

  const contourColor = atlasSettings.contour?.minor_color || config.contour_color || (isNight ? '#63a97c' : isWatercolor ? '#78996e' : '#8b875e')
  const contourMajorColor = atlasSettings.contour?.major_color || atlasSettings.contour?.index_color || config.contour_major_color || (isNight ? '#8ed39f' : isWatercolor ? '#6f885f' : '#68653f')
  const contourOpacity = atlasNumberSetting(atlasSettings.contour?.minor_opacity ?? config.contour_opacity, isSimpleContour ? 0.75 : isWatercolor ? 0.22 : isNight ? 0.46 : 0.34)
  const contourConfig: StyleConfig = {
    ...config,
    show_contours: wantsContours,
    contour_color: contourColor,
    contour_major_color: contourMajorColor,
    contour_opacity: contourOpacity,
    contour_minor_width: atlasSettings.contour?.minor_width ?? config.contour_minor_width,
    contour_major_width: atlasSettings.contour?.major_width ?? atlasSettings.contour?.index_width ?? config.contour_major_width,
    show_elevation_labels: atlasSettings.contour?.labels ?? config.show_elevation_labels,
    background_color: labelHalo,
  }
  const atlasContourLayers = wantsContours
    ? buildAtlasContourLayers(contourConfig, usingMlContour, { watercolor: isWatercolor, night: isNight, simple: isSimpleContour })
    : []

  return {
    version: 8,
    name: `RadMaps Atlas ${preset}`,
    // Atlas labels use open MapLibre demo glyphs for local/proof testing so
    // owned styles do not depend on Mapbox font stacks just because a token is
    // present in the runtime config.
    glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
    sources,
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': isNight ? '#081611' : land } },
      ...(showLandcover ? [{ id: `${preset}-landcover`, type: 'fill', source: 'radmaps-atlas-base', 'source-layer': 'landcover', paint: { 'fill-color': land, 'fill-opacity': atlasNumberSetting(atlasSettings.landcover?.opacity, isSimpleContour ? 0.12 : 0.82) } }] : []),
      ...(showPark ? [{ id: `${preset}-park`, type: 'fill', source: 'radmaps-atlas-base', 'source-layer': 'park', paint: { 'fill-color': park, 'fill-opacity': atlasNumberSetting(atlasSettings.park?.opacity, isSimpleContour ? 0.10 : 0.58) } }] : []),
      ...(showWater ? [{ id: `${preset}-water`, type: 'fill', source: 'radmaps-atlas-base', 'source-layer': 'water', paint: { 'fill-color': water, 'fill-opacity': atlasNumberSetting(atlasSettings.water?.fill_opacity, isWatercolor ? 0.68 : 0.76) } }] : []),
      ...(showWaterway ? [withScaleMetadata({ id: `${preset}-waterway`, type: 'line', source: 'radmaps-atlas-base', 'source-layer': 'waterway', paint: { 'line-color': waterway, 'line-opacity': atlasNumberSetting(atlasSettings.waterway?.opacity ?? atlasSettings.water?.waterway_opacity, isWatercolor ? 0.70 : 0.78), 'line-width': ['interpolate', ['linear'], ['zoom'], 8, Math.max(0.05, (atlasSettings.waterway?.width ?? atlasSettings.water?.waterway_width ?? 1) * 0.35), 13, atlasSettings.waterway?.width ?? atlasSettings.water?.waterway_width ?? 1.1, 15, (atlasSettings.waterway?.width ?? atlasSettings.water?.waterway_width ?? 2.0)] } }, LINE_SCALE_PROPERTIES)] : []),
      ...(showBuildings ? [{ id: `${preset}-building`, type: 'fill', source: 'radmaps-atlas-base', 'source-layer': 'building', minzoom: 13, paint: { 'fill-color': atlasSettings.building?.fill_color || ink, 'fill-opacity': atlasNumberSetting(atlasSettings.building?.opacity, isSimpleContour ? 0.05 : 0.16) } }] : []),
      ...(config.show_hillshade && !isSimpleContour ? hillshadeLayers(config) : []),
      ...atlasContourLayers,
      ...(showTransportation ? [
        withScaleMetadata({ id: `${preset}-roads-minor`, type: 'line', source: 'radmaps-atlas-base', 'source-layer': 'transportation', filter: ['in', ['get', 'class'], ['literal', ['minor', 'service', 'street', 'path']]], paint: { 'line-color': roadMinor, 'line-opacity': roadOpacity * 0.62, 'line-width': ['interpolate', ['linear'], ['zoom'], 8, 0.25, 13, atlasSettings.transportation?.minor_width ?? 0.9, 16, (atlasSettings.transportation?.minor_width ?? 2.1)] } }, LINE_SCALE_PROPERTIES),
        withScaleMetadata({ id: `${preset}-roads-major`, type: 'line', source: 'radmaps-atlas-base', 'source-layer': 'transportation', filter: ['in', ['get', 'class'], ['literal', ['motorway', 'trunk', 'primary', 'secondary']]], paint: { 'line-color': roadMajor, 'line-opacity': roadOpacity, 'line-width': ['interpolate', ['linear'], ['zoom'], 6, 0.55, 12, atlasSettings.transportation?.major_width ?? 2.0, 16, (atlasSettings.transportation?.major_width ?? 4.2)] } }, LINE_SCALE_PROPERTIES),
        withScaleMetadata({ id: `${preset}-roads-trails`, type: 'line', source: 'radmaps-atlas-base', 'source-layer': 'transportation', filter: ['in', ['get', 'class'], ['literal', ['path', 'track', 'trail']]], paint: { 'line-color': trail, 'line-opacity': isWatercolor ? Math.min(roadOpacity, 0.45) : Math.min(roadOpacity, 0.65), 'line-width': ['interpolate', ['linear'], ['zoom'], 10, 0.35, 14, atlasSettings.transportation?.trail_width ?? 1.2, 16, (atlasSettings.transportation?.trail_width ?? 2.0)], 'line-dasharray': [1.2, 1.6] } }, LINE_SCALE_PROPERTIES),
      ] : []),
      ...routeLayers(config),
      ...(showPlaces ? [withScaleMetadata({ id: `${preset}-place-labels`, type: 'symbol', source: 'radmaps-atlas-base', 'source-layer': 'place', layout: { 'text-field': ['coalesce', ['get', 'name:en'], ['get', 'name']], 'text-font': ['Noto Sans Regular'], 'text-size': ['interpolate', ['linear'], ['zoom'], 5, atlasSettings.place?.font_size ?? 9, 12, (atlasSettings.place?.font_size ?? 15)], 'text-letter-spacing': 0.02 }, paint: { 'text-color': label, 'text-opacity': atlasNumberSetting(atlasSettings.place?.label_opacity ?? config.place_labels_opacity, isWatercolor ? 0.48 : 0.78), 'text-halo-color': atlasSettings.place?.halo_color || labelHalo, 'text-halo-width': isWatercolor ? 1.6 : 1.2 } }, SYMBOL_SCALE_PROPERTIES)] : []),
      ...(showPois ? [withScaleMetadata({ id: `${preset}-poi-labels`, type: 'symbol', source: 'radmaps-atlas-base', 'source-layer': 'poi', minzoom: 12, layout: { 'text-field': ['coalesce', ['get', 'name:en'], ['get', 'name']], 'text-font': ['Noto Sans Regular'], 'text-size': ['interpolate', ['linear'], ['zoom'], 12, 8, 15, 11], 'text-offset': ['literal', [0, 0.8]], 'text-anchor': 'top' }, paint: { 'text-color': poiLabel, 'text-opacity': atlasNumberSetting(atlasSettings.poi?.label_opacity ?? config.poi_labels_opacity, isWatercolor ? 0.34 : 0.62), 'text-halo-color': labelHalo, 'text-halo-width': 1.1 } }, SYMBOL_SCALE_PROPERTIES)] : []),
      ...trailSegmentLayers(config.trail_segments, config),
      ...segmentHandleLayers(config),
    ],
  }
}

function buildRouteOnlyStyle(
  config: StyleConfig,
  mapboxToken?: string,
  maptilerToken?: string,
  contourTileUrl?: string,
): object {
  const mapboxTk = mapboxToken || ''
  const usingMlContour = !!contourTileUrl
  const glyphs = mapboxTk
    ? `https://api.mapbox.com/fonts/v1/mapbox/{fontstack}/{range}.pbf?access_token=${mapboxTk}`
    : 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf'

  return {
    version: 8,
    name: 'RadMaps Route Only',
    glyphs,
    sources: {
      ...((config.show_hillshade || config.map_3d) ? demSource(mapboxTk) : {}),
      ...(config.show_contours ? contourSource(mapboxTk, contourTileUrl) : {}),
      ...(usesRoadOverlay(config) && mapboxTk ? roadsSource(mapboxTk) : {}),
      route: routeSource(config),
      ...trailSegmentSources(config.trail_segments),
      ...segmentHandleSource(),
    },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': mapBackgroundColor(config) } },
      ...hillshadeLayers(config),
      ...contourLayers(config, usingMlContour),
      ...(mapboxTk ? roadsLayers(config) : []),
      ...routeLayers(config),
      ...trailSegmentLayers(config.trail_segments, config),
      ...segmentHandleLayers(config),
    ],
  }
}

// ─── Road-Network Style ───────────────────────────────────────────────────────
// No raster tiles — vector roads from Mapbox Streets rendered as ink lines on a
// clean background. Produces the London-poster "city map" look.
// Requires a Mapbox token (same streets source as show_roads).

function buildRoadNetworkStyle(
  config: StyleConfig,
  mapboxToken?: string,
  contourTileUrl?: string,
): object {
  const token = mapboxToken || ''
  const usingMlContour = !!contourTileUrl
  const bg = mapBackgroundColor(config)
  const ink = mapInkColor(config)
  const roadColor = config.roads_color ?? ink
  const roadOpacity = config.roads_opacity ?? 1

  const sources: Record<string, object> = {
    ...((config.show_hillshade || config.map_3d) ? demSource(token) : {}),
    ...(config.show_contours ? contourSource(token, contourTileUrl) : {}),
    route: routeSource(config),
    ...trailSegmentSources(config.trail_segments),
    ...segmentHandleSource(),
  }

  // Fills (water, landuse) belong below hillshade/contours as base features.
  // Road lines belong above hillshade/contours so labels/lines aren't cut by terrain.
  const fillLayers: object[] = []
  const roadLineLayers: object[] = []

  if (token) {
    sources['mapbox-streets'] = {
      type: 'vector' as const,
      tiles: [`https://api.mapbox.com/v4/mapbox.mapbox-streets-v8/{z}/{x}/{y}.vector.pbf?access_token=${token}`],
      minzoom: 0,
      maxzoom: 16,
      attribution: '© Mapbox © OpenStreetMap contributors',
    }

    // Water fill (light, below roads)
    fillLayers.push({
      id: 'rn-water',
      type: 'fill',
      source: 'mapbox-streets',
      'source-layer': 'water',
      paint: { 'fill-color': config.water_color ?? '#B8D8E8', 'fill-opacity': 0.6 },
    })
    fillLayers.push(waterwayLayer('rn-waterways', config.water_color ?? '#B8D8E8', 0.7, 0.45, 1.6))

    // Land use — parks / green space
    fillLayers.push({
      id: 'rn-landuse',
      type: 'fill',
      source: 'mapbox-streets',
      'source-layer': 'landuse',
      filter: ['in', ['get', 'class'], ['literal', ['park', 'grass', 'wood', 'forest', 'scrub']]],
      paint: { 'fill-color': ink, 'fill-opacity': 0.04 },
    })
  }

  if (token && config.show_roads) {
    // Service / footpath (thinnest)
    roadLineLayers.push({
      id: 'rn-service',
      type: 'line',
      source: 'mapbox-streets',
      'source-layer': 'road',
      filter: ['in', ['get', 'class'], ['literal', ['service', 'path', 'pedestrian', 'track']]],
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': roadColor,
        'line-opacity': roadOpacity * 0.18,
        'line-width': ['interpolate', ['linear'], ['zoom'], 11, 0.3, 15, 0.8],
      },
    })

    // Residential / local streets
    roadLineLayers.push({
      id: 'rn-street',
      type: 'line',
      source: 'mapbox-streets',
      'source-layer': 'road',
      filter: ['in', ['get', 'class'], ['literal', ['street', 'street_limited', 'tertiary']]],
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': roadColor,
        'line-opacity': roadOpacity * 0.32,
        'line-width': ['interpolate', ['linear'], ['zoom'], 9, 0.4, 14, 1.2],
      },
    })

    // Secondary
    roadLineLayers.push({
      id: 'rn-secondary',
      type: 'line',
      source: 'mapbox-streets',
      'source-layer': 'road',
      filter: ['in', ['get', 'class'], ['literal', ['secondary', 'primary']]],
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': roadColor,
        'line-opacity': roadOpacity * 0.55,
        'line-width': ['interpolate', ['linear'], ['zoom'], 7, 0.6, 14, 2.0],
      },
    })

    // Motorway / trunk (boldest)
    roadLineLayers.push({
      id: 'rn-motorway',
      type: 'line',
      source: 'mapbox-streets',
      'source-layer': 'road',
      filter: ['in', ['get', 'class'], ['literal', ['motorway', 'trunk']]],
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': roadColor,
        'line-opacity': roadOpacity * 0.75,
        'line-width': ['interpolate', ['linear'], ['zoom'], 5, 0.8, 14, 3.0],
      },
    })
  }

  return {
    version: 8,
    name: 'RadMaps Road Network',
    glyphs: token
      ? `https://api.mapbox.com/fonts/v1/mapbox/{fontstack}/{range}.pbf?access_token=${token}`
      : 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
    sources,
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': bg } },
      ...fillLayers,
      ...hillshadeLayers(config),
      ...contourLayers(config, usingMlContour),
      ...roadLineLayers,
      ...routeLayers(config),
      ...trailSegmentLayers(config.trail_segments, config),
      ...segmentHandleLayers(config),
    ],
  }
}

// ─── Contour-Art Style ────────────────────────────────────────────────────────
// No raster tiles — contour lines ARE the map. Clean white (or theme) background
// with high-detail contours styled for print quality. Route overlaid on top.
// Produces the John Muir Trail topo-art look.

function buildContourArtStyle(
  config: StyleConfig,
  mapboxToken?: string,
  contourTileUrl?: string,
): object {
  const token = mapboxToken || ''
  const usingMlContour = !!contourTileUrl
  const artConfig = { ...config, show_contours: true, contour_detail: config.contour_detail ?? 4 }
  const glyphs = token
    ? `https://api.mapbox.com/fonts/v1/mapbox/{fontstack}/{range}.pbf?access_token=${token}`
    : 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf'

  return {
    version: 8,
    name: 'RadMaps Contour Art',
    glyphs,
    sources: {
      ...((config.show_hillshade || config.map_3d) ? demSource(token) : {}),
      ...contourSource(token, contourTileUrl),
      ...(token ? roadsSource(token) : {}),
      route: routeSource(config),
      ...trailSegmentSources(config.trail_segments),
      ...segmentHandleSource(),
    },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': mapBackgroundColor(config) } },
      ...(token
        ? [{
            id: 'contour-art-water',
            type: 'fill',
            source: 'mapbox-streets',
            'source-layer': 'water',
            paint: {
              'fill-color': config.water_color ?? '#B8D8E8',
              'fill-opacity': 0.62,
            },
          },
          waterwayLayer('contour-art-waterways', config.water_color ?? '#B8D8E8', 0.85, 0.6, 2.0)]
        : []),
      // Hillshade at very low opacity for subtle topographic depth
      ...(config.show_hillshade
        ? [{
            id: 'hillshade',
            type: 'hillshade' as const,
            source: 'mapbox-dem',
            paint: {
              'hillshade-shadow-color': '#000000',
              'hillshade-highlight-color': '#FFFFFF',
              'hillshade-accent-color': '#000000',
              'hillshade-illumination-direction': 335,
              'hillshade-exaggeration': Math.min(config.hillshade_intensity, 0.25),
            },
          }]
        : []
      ),
      // Contour art layers — wider lines for bold print look
      ...(usingMlContour
        ? [
            {
              id: 'contours-minor',
              type: 'line',
              source: 'contours',
              'source-layer': 'contours',
              filter: ['!=', ['get', 'level'], 1],
              layout: { 'line-join': 'round', 'line-cap': 'round' },
              paint: {
                'line-color': artConfig.contour_color,
                'line-opacity': artConfig.contour_opacity,
                'line-width': contourMinorLineWidthExpression(artConfig),
              },
            },
            {
              id: 'contours-major',
              type: 'line',
              source: 'contours',
              'source-layer': 'contours',
              filter: ['==', ['get', 'level'], 1],
              layout: { 'line-join': 'round', 'line-cap': 'round' },
              paint: {
                'line-color': artConfig.contour_major_color,
                'line-opacity': artConfig.contour_opacity,
                'line-width': contourMajorLineWidthExpression(artConfig),
              },
            },
            ...(config.show_elevation_labels ? [{
              id: 'contours-labels',
              type: 'symbol',
              source: 'contours',
              'source-layer': 'contours',
              filter: ['==', ['get', 'level'], 1],
              layout: {
                'symbol-placement': 'line',
                'symbol-spacing': 500,
                'text-field': ['concat', ['to-string', ['get', 'ele']], 'm'],
                'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Regular'],
                'text-size': ['interpolate', ['linear'], ['zoom'], 5, 9, 14, 13],
                'text-letter-spacing': 0.06,
                'text-padding': 4,
                'text-pitch-alignment': 'viewport',
                'text-rotation-alignment': 'viewport',
              },
              paint: {
                'text-color': artConfig.contour_major_color,
                'text-halo-color': config.background_color,
                'text-halo-width': 2,
                'text-opacity': artConfig.contour_opacity,
              },
            }] : []),
          ]
        : contourLayers(artConfig, false)
      ),
      ...(token ? roadsLayers(config) : []),
      ...routeLayers(config),
      ...trailSegmentLayers(config.trail_segments, config),
      ...segmentHandleLayers(config),
    ],
  }
}

// ─── Natural Topo Style ───────────────────────────────────────────────────────
// MapTiler outdoor/topo tiles — natural colour palette (greens, blues, earth tones).
// Produces the full-colour terrain map look. Requires a MapTiler token.

function buildNaturalTopoStyle(
  config: StyleConfig,
  mapboxToken?: string,
  maptilerToken?: string,
  contourTileUrl?: string,
): object {
  const mapboxTk = mapboxToken || ''
  const maptilerTk = maptilerToken || ''
  const usingMlContour = !!contourTileUrl
  const tileStyle = (config.base_tile_style === 'maptiler-topo' || config.base_tile_style === 'maptiler-winter')
    ? config.base_tile_style
    : 'maptiler-outdoor'
  const styleMap: Record<string, string> = {
    'maptiler-outdoor': 'outdoor-v2',
    'maptiler-topo': 'topo-v2',
    'maptiler-winter': 'winter-v2',
  }
  const tileMapStyle = styleMap[tileStyle] ?? 'outdoor-v2'

  return {
    version: 8,
    name: 'RadMaps Natural Topo',
    glyphs: mapboxTk
      ? `https://api.mapbox.com/fonts/v1/mapbox/{fontstack}/{range}.pbf?access_token=${mapboxTk}`
      : 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
    sources: {
      'base-tiles': {
        type: 'raster' as const,
        tiles: styledTileUrls(config, [`https://api.maptiler.com/maps/${tileMapStyle}/{z}/{x}/{y}@2x.png?key=${maptilerTk}`]),
        tileSize: 512,
        attribution: '© MapTiler © OpenStreetMap contributors',
      },
      ...((config.show_hillshade || config.map_3d) ? demSource(mapboxTk) : {}),
      ...(config.show_contours ? contourSource(mapboxTk, contourTileUrl) : {}),
      ...(usesRoadOverlay(config) && mapboxTk ? roadsSource(mapboxTk) : {}),
      route: routeSource(config),
      ...trailSegmentSources(config.trail_segments),
      ...segmentHandleSource(),
    },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': mapBackgroundColor(config) } },
      {
        id: 'base-tiles',
        type: 'raster',
        source: 'base-tiles',
        paint: {
          'raster-opacity':    0.95,
          'raster-contrast':   config.tile_contrast   ?? 0,
          'raster-saturation': config.tile_saturation ?? 0,
          'raster-hue-rotate': config.tile_hue_rotate ?? 0,
        },
      },
      ...hillshadeLayers(config),
      ...contourLayers(config, usingMlContour),
      ...(mapboxTk ? roadsLayers(config) : []),
      ...routeLayers(config),
      ...trailSegmentLayers(config.trail_segments, config),
      ...segmentHandleLayers(config),
    ],
  }
}

// ─── Stadia Watercolor Style ──────────────────────────────────────────────────
// Hand-painted watercolor raster tiles from Stamen Design, hosted by Stadia Maps.
// Free for low-traffic / non-commercial use. Production needs a STADIA_API_KEY.

function buildStadiaWatercolorStyle(config: StyleConfig, contourTileUrl?: string, stadiaToken?: string, mapboxToken?: string): object {
  const usingMlContour = !!contourTileUrl
  const keyParam = stadiaToken ? `?api_key=${stadiaToken}` : ''
  const mapboxTk = mapboxToken || ''

  return {
    version: 8,
    name: 'RadMaps Watercolor',
    glyphs: mapboxTk
      ? `https://api.mapbox.com/fonts/v1/mapbox/{fontstack}/{range}.pbf?access_token=${mapboxTk}`
      : 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
    sources: {
      'base-tiles': {
        type: 'raster' as const,
        // Use @2x (512×512 retina) tiles + tileSize 512 so the worker
        // gets twice the source pixel density. At print DPI the rendered
        // zoom often exceeds the source maxzoom (Stadia stamen_watercolor
        // is capped at z14 server-side), and MapLibre upscales — @2x
        // halves the upscale factor so glyphs/edges stay sharp.
        tiles: styledTileUrls(config, [
          `https://tiles.stadiamaps.com/tiles/stamen_watercolor/{z}/{x}/{y}@2x.jpg${keyParam}`,
        ]),
        tileSize: 512,
        // Stadia stamen_watercolor's effective server-side maxzoom is 14 —
        // higher zooms return 204 No Content even though they advertise 16.
        // Cap here so MapLibre upscales z14 tiles for higher view zooms
        // (e.g. 300 DPI print rendering at zoom 15+) instead of leaving
        // gaps. Watercolor is artistic — soft upscale looks fine.
        maxzoom: 14,
        attribution: 'Map tiles by <a href="https://stamen.com">Stamen Design</a> / <a href="https://stadiamaps.com">Stadia Maps</a>, CC BY 3.0. Data © <a href="https://openstreetmap.org">OpenStreetMap</a> contributors',
      },
      ...((config.show_hillshade || config.map_3d) ? demSource('') : {}),
      ...(config.show_contours ? contourSource(mapboxTk, contourTileUrl) : {}),
      ...(usesRoadOverlay(config) && mapboxTk ? roadsSource(mapboxTk) : {}),
      route: routeSource(config),
      ...trailSegmentSources(config.trail_segments),
      ...segmentHandleSource(),
    },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': '#d4dde1' } },
      {
        id: 'base-tiles', type: 'raster', source: 'base-tiles',
        paint: {
          'raster-opacity':    0.95,
          'raster-contrast':   config.tile_contrast   ?? 0,
          'raster-saturation': config.tile_saturation ?? 0,
          'raster-hue-rotate': config.tile_hue_rotate ?? 0,
        },
      },
      ...(config.show_hillshade ? hillshadeLayers(config) : []),
      ...(config.show_contours ? contourLayers(config, usingMlContour) : []),
      ...(mapboxTk ? roadsLayers(config) : []),
      ...routeLayers(config),
      ...trailSegmentLayers(config.trail_segments, config),
      ...segmentHandleLayers(config),
    ],
  }
}

// ─── Stadia Toner Style ───────────────────────────────────────────────────────
// High-contrast black & white graphic style by Stamen Design, hosted by Stadia Maps.

function buildStadiaTonerStyle(config: StyleConfig, contourTileUrl?: string, stadiaToken?: string, mapboxToken?: string): object {
  const usingMlContour = !!contourTileUrl
  const keyParam = stadiaToken ? `?api_key=${stadiaToken}` : ''
  const mapboxTk = mapboxToken || ''
  const tonerLayerGroup = config.show_place_labels === false
    ? 'stamen_toner_background'
    : 'stamen_toner'

  return {
    version: 8,
    name: 'RadMaps Toner',
    glyphs: mapboxTk
      ? `https://api.mapbox.com/fonts/v1/mapbox/{fontstack}/{range}.pbf?access_token=${mapboxTk}`
      : 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
    sources: {
      'base-tiles': {
        type: 'raster' as const,
        // @2x for HiDPI print rendering — see watercolor source comment.
        tiles: styledTileUrls(config, [
          `https://tiles.stadiamaps.com/tiles/${tonerLayerGroup}/{z}/{x}/{y}@2x.png${keyParam}`,
        ]),
        tileSize: 512,
        attribution: 'Map tiles by <a href="https://stamen.com">Stamen Design</a> / <a href="https://stadiamaps.com">Stadia Maps</a>, CC BY 3.0. Data © <a href="https://openstreetmap.org">OpenStreetMap</a> contributors',
      },
      ...((config.show_hillshade || config.map_3d) ? demSource('') : {}),
      ...(config.show_contours ? contourSource(mapboxTk, contourTileUrl) : {}),
      ...(usesRoadOverlay(config) && mapboxTk ? roadsSource(mapboxTk) : {}),
      route: routeSource(config),
      ...trailSegmentSources(config.trail_segments),
      ...segmentHandleSource(),
    },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': mapBackgroundColor(config) } },
      {
        id: 'base-tiles', type: 'raster', source: 'base-tiles',
        paint: {
          'raster-opacity':    0.85,
          'raster-contrast':   config.tile_contrast   ?? 0,
          'raster-saturation': config.tile_saturation ?? 0,
          'raster-hue-rotate': config.tile_hue_rotate ?? 0,
        },
      },
      ...(config.show_hillshade ? hillshadeLayers(config) : []),
      ...(config.show_contours ? contourLayers(config, usingMlContour) : []),
      ...(mapboxTk ? roadsLayers(config) : []),
      ...routeLayers(config),
      ...trailSegmentLayers(config.trail_segments, config),
      ...segmentHandleLayers(config),
    ],
  }
}

// ─── Beta: Native Toner ───────────────────────────────────────────────────────
// B&W vector look using Mapbox Streets v8. Falls back to CARTO light with
// raster-saturation: -1 when no Mapbox token is present.

function buildNativeTonerStyle(
  config: StyleConfig,
  mapboxToken?: string,
  contourTileUrl?: string,
): object {
  const token = mapboxToken || ''
  const usingMlContour = !!contourTileUrl
  const ink = mapInkColor(config)
  const roadColor = config.roads_color ?? ink
  const roadOpacity = config.roads_opacity ?? 1

  const sources: Record<string, object> = {
    ...((config.show_hillshade || config.map_3d) ? demSource(token) : {}),
    ...(config.show_contours ? contourSource(token, contourTileUrl) : {}),
    route: routeSource(config),
    ...trailSegmentSources(config.trail_segments),
    ...segmentHandleSource(),
  }

  // Fills (water, landuse, buildings) sit below hillshade/contours as base features.
  // Road lines sit above so they aren't visually cut by terrain.
  const baseLayers: object[] = []
  const roadLineLayers: object[] = []

  if (token) {
    sources['mapbox-streets'] = {
      type: 'vector' as const,
      tiles: [`https://api.mapbox.com/v4/mapbox.mapbox-streets-v8/{z}/{x}/{y}.vector.pbf?access_token=${token}`],
      minzoom: 0,
      maxzoom: 16,
      attribution: '© Mapbox © OpenStreetMap contributors',
    }
    baseLayers.push(
      { id: 'nt-water',     type: 'fill', source: 'mapbox-streets', 'source-layer': 'water',
        paint: { 'fill-color': ink, 'fill-opacity': 0.85 } },
      waterwayLayer('nt-waterways', ink, 0.85, 0.45, 1.7),
      { id: 'nt-landuse',   type: 'fill', source: 'mapbox-streets', 'source-layer': 'landuse',
        filter: ['in', ['get', 'class'], ['literal', ['park', 'grass', 'wood', 'forest', 'scrub']]],
        paint: { 'fill-color': ink, 'fill-opacity': 0.08 } },
      { id: 'nt-buildings', type: 'fill', source: 'mapbox-streets', 'source-layer': 'building',
        paint: { 'fill-color': ink, 'fill-opacity': 0.06 } },
    )
  }

  if (token && config.show_roads) {
    roadLineLayers.push(
      { id: 'nt-service', type: 'line', source: 'mapbox-streets', 'source-layer': 'road',
        filter: ['in', ['get', 'class'], ['literal', ['service', 'path', 'pedestrian', 'track']]],
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': roadColor, 'line-opacity': roadOpacity * 0.25,
          'line-width': ['interpolate', ['linear'], ['zoom'], 11, 0.4, 15, 1.0] } },
      { id: 'nt-street', type: 'line', source: 'mapbox-streets', 'source-layer': 'road',
        filter: ['in', ['get', 'class'], ['literal', ['street', 'street_limited', 'tertiary']]],
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': roadColor, 'line-opacity': roadOpacity * 0.55,
          'line-width': ['interpolate', ['linear'], ['zoom'], 9, 0.5, 14, 1.6] } },
      { id: 'nt-secondary', type: 'line', source: 'mapbox-streets', 'source-layer': 'road',
        filter: ['in', ['get', 'class'], ['literal', ['secondary', 'primary']]],
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': roadColor, 'line-opacity': roadOpacity * 0.80,
          'line-width': ['interpolate', ['linear'], ['zoom'], 7, 0.8, 14, 2.8] } },
      { id: 'nt-motorway', type: 'line', source: 'mapbox-streets', 'source-layer': 'road',
        filter: ['in', ['get', 'class'], ['literal', ['motorway', 'trunk']]],
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': roadColor, 'line-opacity': roadOpacity * 1.0,
          'line-width': ['interpolate', ['linear'], ['zoom'], 5, 1.0, 14, 4.0] } },
    )
  }

  if (!token) {
    sources['base-tiles'] = {
      type: 'raster' as const,
      tiles: styledTileUrls(config, ['a', 'b', 'c', 'd'].map(p => `https://${p}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png`)),
      tileSize: 512,
      attribution: '© CARTO © OpenStreetMap contributors',
    }
    baseLayers.push({
      id: 'base-tiles', type: 'raster', source: 'base-tiles',
      paint: { 'raster-opacity': 0.9, 'raster-saturation': -1, 'raster-contrast': 0.30 },
    })
  }

  return {
    version: 8,
    name: 'RadMaps Native Toner',
    glyphs: token
      ? `https://api.mapbox.com/fonts/v1/mapbox/{fontstack}/{range}.pbf?access_token=${token}`
      : 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
    sources,
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': mapBackgroundColor(config) } },
      ...baseLayers,
      ...hillshadeLayers(config),
      ...contourLayers(config, usingMlContour),
      ...roadLineLayers,
      ...routeLayers(config),
      ...trailSegmentLayers(config.trail_segments, config),
      ...segmentHandleLayers(config),
    ],
  }
}

// ─── Beta: Native Watercolor ──────────────────────────────────────────────────
// Warm paper approximation: CARTO light at low opacity over a cream background.
// No Mapbox token required.

function buildNativeWatercolorStyle(
  config: StyleConfig,
  contourTileUrl?: string,
  mapboxToken?: string,
): object {
  const usingMlContour = !!contourTileUrl
  const mapboxTk = mapboxToken || ''
  const cartoUrls = ['a', 'b', 'c', 'd'].map(
    p => `https://${p}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png`,
  )

  return {
    version: 8,
    name: 'RadMaps Native Watercolor',
    glyphs: mapboxTk
      ? `https://api.mapbox.com/fonts/v1/mapbox/{fontstack}/{range}.pbf?access_token=${mapboxTk}`
      : 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
    sources: {
      'base-tiles': {
        type: 'raster' as const,
        tiles: styledTileUrls(config, cartoUrls),
        tileSize: 512,
        attribution: '© CARTO © OpenStreetMap contributors',
      },
      ...((config.show_hillshade || config.map_3d) ? demSource(mapboxTk) : {}),
      ...(config.show_contours ? contourSource(mapboxTk, contourTileUrl) : {}),
      ...(usesRoadOverlay(config) && mapboxTk ? roadsSource(mapboxTk) : {}),
      route: routeSource(config),
      ...trailSegmentSources(config.trail_segments),
      ...segmentHandleSource(),
    },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': mapBackgroundColor(config) } },
      {
        id: 'base-tiles', type: 'raster', source: 'base-tiles',
        paint: {
          'raster-opacity':    0.38,
          'raster-saturation': (config.tile_saturation ?? 0) - 0.35,
          'raster-hue-rotate': (config.tile_hue_rotate ?? 0) + 18,
          'raster-contrast':   (config.tile_contrast ?? 0) - 0.15,
        },
      },
      ...(config.show_hillshade ? hillshadeLayers(config) : []),
      ...(config.show_contours ? contourLayers(config, usingMlContour) : []),
      ...(mapboxTk ? roadsLayers(config) : []),
      ...routeLayers(config),
      ...trailSegmentLayers(config.trail_segments, config),
      ...segmentHandleLayers(config),
    ],
  }
}

// ─── Beta: Alidade Smooth ─────────────────────────────────────────────────────
// Clean modern cartography using MapTiler Streets v2 raster tiles.

function buildAlidadeSmoothStyle(
  config: StyleConfig,
  maptilerToken?: string,
  mapboxToken?: string,
  contourTileUrl?: string,
): object {
  const maptilerTk = maptilerToken || ''
  const mapboxTk   = mapboxToken   || ''
  const usingMlContour = !!contourTileUrl

  return {
    version: 8,
    name: 'RadMaps Alidade Smooth',
    glyphs: mapboxTk
      ? `https://api.mapbox.com/fonts/v1/mapbox/{fontstack}/{range}.pbf?access_token=${mapboxTk}`
      : 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
    sources: {
      'base-tiles': {
        type: 'raster' as const,
        tiles: styledTileUrls(config, [`https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}@2x.png?key=${maptilerTk}`]),
        tileSize: 512,
        attribution: '© MapTiler © OpenStreetMap contributors',
      },
      ...((config.show_hillshade || config.map_3d) ? demSource(mapboxTk) : {}),
      ...(config.show_contours ? contourSource(mapboxTk, contourTileUrl) : {}),
      ...(usesRoadOverlay(config) && mapboxTk ? roadsSource(mapboxTk) : {}),
      route: routeSource(config),
      ...trailSegmentSources(config.trail_segments),
      ...segmentHandleSource(),
    },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': mapBackgroundColor(config) } },
      {
        id: 'base-tiles', type: 'raster', source: 'base-tiles',
        paint: {
          'raster-opacity':    0.92,
          'raster-contrast':   config.tile_contrast   ?? 0,
          'raster-saturation': config.tile_saturation ?? 0,
          'raster-hue-rotate': config.tile_hue_rotate ?? 0,
        },
      },
      ...hillshadeLayers(config),
      ...contourLayers(config, usingMlContour),
      ...(mapboxTk ? roadsLayers(config) : []),
      ...routeLayers(config),
      ...trailSegmentLayers(config.trail_segments, config),
      ...segmentHandleLayers(config),
    ],
  }
}

// ─── Beta: Alidade Smooth Dark ────────────────────────────────────────────────
// Dark clean cartography using MapTiler Dataviz Dark raster tiles.
// If dataviz-dark is unavailable at your MapTiler tier, swap the map ID to dark-matter.

function buildAlidadeSmoothDarkStyle(
  config: StyleConfig,
  maptilerToken?: string,
  mapboxToken?: string,
  contourTileUrl?: string,
): object {
  const maptilerTk = maptilerToken || ''
  const mapboxTk   = mapboxToken   || ''
  const usingMlContour = !!contourTileUrl

  return {
    version: 8,
    name: 'RadMaps Alidade Smooth Dark',
    glyphs: mapboxTk
      ? `https://api.mapbox.com/fonts/v1/mapbox/{fontstack}/{range}.pbf?access_token=${mapboxTk}`
      : 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
    sources: {
      'base-tiles': {
        type: 'raster' as const,
        tiles: styledTileUrls(config, [`https://api.maptiler.com/maps/dataviz-dark/{z}/{x}/{y}@2x.png?key=${maptilerTk}`]),
        tileSize: 512,
        attribution: '© MapTiler © OpenStreetMap contributors',
      },
      ...((config.show_hillshade || config.map_3d) ? demSource(mapboxTk) : {}),
      ...(config.show_contours ? contourSource(mapboxTk, contourTileUrl) : {}),
      ...(usesRoadOverlay(config) && mapboxTk ? roadsSource(mapboxTk) : {}),
      route: routeSource(config),
      ...trailSegmentSources(config.trail_segments),
      ...segmentHandleSource(),
    },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': mapBackgroundColor(config) } },
      {
        id: 'base-tiles', type: 'raster', source: 'base-tiles',
        paint: {
          'raster-opacity':    0.88,
          'raster-contrast':   config.tile_contrast   ?? 0,
          'raster-saturation': config.tile_saturation ?? 0,
          'raster-hue-rotate': config.tile_hue_rotate ?? 0,
        },
      },
      ...hillshadeLayers(config),
      ...contourLayers(config, usingMlContour),
      ...(mapboxTk ? roadsLayers(config) : []),
      ...routeLayers(config),
      ...trailSegmentLayers(config.trail_segments, config),
      ...segmentHandleLayers(config),
    ],
  }
}

// ─── Topographic Style ────────────────────────────────────────────────────────

function buildTopographicStyle(
  config: StyleConfig,
  mapboxToken?: string,
  contourTileUrl?: string,
): object {
  const token = mapboxToken || ''
  const usingMlContour = !!contourTileUrl

  return {
    version: 8,
    name: 'RadMaps Topographic',
    glyphs: `https://api.mapbox.com/fonts/v1/mapbox/{fontstack}/{range}.pbf?access_token=${token}`,
    sources: {
      'mapbox-outdoors': {
        type: 'raster' as const,
        tiles: styledTileUrls(config, [`https://api.mapbox.com/styles/v1/mapbox/outdoors-v12/tiles/{z}/{x}/{y}@2x?access_token=${token}`]),
        tileSize: 512,
        attribution: '© Mapbox © OpenStreetMap contributors',
      },
      ...((config.show_hillshade || config.map_3d) ? demSource(token) : {}),
      ...(config.show_contours ? contourSource(token, contourTileUrl) : {}),
      ...(usesRoadOverlay(config) && token ? roadsSource(token) : {}),
      route: routeSource(config),
      ...trailSegmentSources(config.trail_segments),
      ...segmentHandleSource(),
    },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': mapBackgroundColor(config) } },
      {
        id: 'outdoors-tiles',
        type: 'raster',
        source: 'mapbox-outdoors',
        paint: {
          'raster-opacity':    config.show_hillshade ? 0.75 : 0.9,
          'raster-saturation': Math.max(-1, Math.min(1, (config.show_hillshade ? -0.15 : 0) + (config.tile_saturation ?? 0))),
          'raster-contrast':   config.tile_contrast   ?? 0,
          'raster-hue-rotate': config.tile_hue_rotate ?? 0,
        },
      },
      ...hillshadeLayers(config),
      ...contourLayers(config, usingMlContour),
      ...(token ? roadsLayers(config) : []),
      ...routeLayers(config),
      ...trailSegmentLayers(config.trail_segments, config),
      ...segmentHandleLayers(config),
    ],
  }
}
