import type { StyleConfig, TrailSegment } from '~/types'

/**
 * Build a MapLibre GL Style JSON object from a StyleConfig.
 * Used in both the browser MapPreview and the server render worker.
 *
 * Contour strategy (two paths):
 *   Browser  → contourTileUrl is provided by MapPreview.vue (maplibre-contour protocol)
 *              Generates contours on-the-fly from free AWS terrarium DEM tiles.
 *              Supports configurable meter intervals via contour_detail.
 *   Worker   → contourTileUrl is undefined; falls back to Mapbox terrain-v2 vector tiles.
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
): object {
  if (config.preset === 'topographic') {
    return buildTopographicStyle(config, mapboxToken, contourTileUrl)
  }
  if (config.preset === 'route-only') {
    return buildRouteOnlyStyle(config, mapboxToken, maptilerToken, contourTileUrl)
  }
  if (config.preset === 'road-network') {
    return buildRoadNetworkStyle(config, mapboxToken, contourTileUrl)
  }
  if (config.preset === 'contour-art') {
    return buildContourArtStyle(config, mapboxToken, contourTileUrl)
  }
  if (config.preset === 'natural-topo') {
    return buildNaturalTopoStyle(config, mapboxToken, maptilerToken, contourTileUrl)
  }
  if (config.preset === 'stadia-watercolor') {
    return buildStadiaWatercolorStyle(config, contourTileUrl)
  }
  if (config.preset === 'stadia-toner') {
    return buildStadiaTonerStyle(config, contourTileUrl)
  }
  return buildMinimalistStyle(config, mapboxToken, maptilerToken, contourTileUrl)
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

// ─── DEM source (hillshade) ───────────────────────────────────────────────────
// AWS Terrain Tiles (Tilezen/Terrarium) — free, no auth, terrarium encoding.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
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
          'line-width': ['interpolate', ['linear'], ['zoom'], 5, 0.8, 14, 1.0],
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
          'line-width': ['interpolate', ['linear'], ['zoom'], 5, 1.5, 14, 2.5],
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
        'line-width': ['interpolate', ['linear'], ['zoom'], 5, 0.8, 14, 1.0],
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
        'line-width': ['interpolate', ['linear'], ['zoom'], 5, 1.1, 14, 1.5],
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
      'line-width': ['interpolate', ['linear'], ['zoom'], 5, 1.5, 14, 2.5],
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

function roadsLayers(config: StyleConfig): object[] {
  if (!config.show_roads) return []
  const color = config.label_text_color

  return [
    // Motorways + trunk — widest, most prominent
    {
      id: 'roads-major',
      type: 'line',
      source: 'mapbox-streets',
      'source-layer': 'road',
      filter: ['in', ['get', 'class'], ['literal', ['motorway', 'trunk']]],
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': color,
        'line-opacity': 0.30,
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
        'line-color': color,
        'line-opacity': 0.22,
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
        'line-color': color,
        'line-opacity': 0.14,
        'line-width': ['interpolate', ['linear'], ['zoom'], 11, 0.5, 14, 1.5],
      },
    },
    // Place labels (cities, towns, villages)
    {
      id: 'roads-place-labels',
      type: 'symbol',
      source: 'mapbox-streets',
      'source-layer': 'place_label',
      filter: ['in', ['get', 'type'], ['literal', ['city', 'town', 'village']]],
      layout: {
        'text-field': ['get', 'name'],
        'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Regular'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 8, 9, 14, 13],
        'text-anchor': 'center',
        'text-max-width': 8,
      },
      paint: {
        'text-color': color,
        'text-opacity': 0.45,
        'text-halo-color': config.background_color,
        'text-halo-width': 1.5,
      },
    },
  ]
}

// ─── Trail segment sources/layers ────────────────────────────────────────────

export function trailSegmentSources(segments: TrailSegment[] = []): Record<string, object> {
  const sources: Record<string, object> = {}
  for (const seg of segments) {
    if (!seg.visible) continue
    sources[`trail-seg-${seg.id}`] = {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
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

    layers.push({
      id: `trail-seg-casing-${seg.id}`,
      type: 'line',
      source: `trail-seg-${seg.id}`,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': '#FFFFFF',
        'line-width': width + 3,
        'line-opacity': opacity,
      },
    })

    const lineLayer: Record<string, unknown> = {
      id: `trail-seg-line-${seg.id}`,
      type: 'line',
      source: `trail-seg-${seg.id}`,
      layout: {
        'line-join': 'round',
        'line-cap': 'round',
        ...(dashArray ? { 'line-dasharray': dashArray } : {}),
      },
      paint: {
        'line-color': seg.color,
        'line-width': width,
        'line-opacity': opacity,
      },
    }
    layers.push(lineLayer)
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

function segmentHandleLayers(): object[] {
  return [
    {
      id: 'segment-handle-halo',
      type: 'circle',
      source: 'segment-handles',
      paint: {
        'circle-radius': 9,
        'circle-color': '#FFFFFF',
        'circle-opacity': 0.88,
        'circle-blur': 0.15,
      },
    },
    {
      id: 'segment-handle-dot',
      type: 'circle',
      source: 'segment-handles',
      paint: {
        'circle-radius': 5.5,
        'circle-color': ['get', 'color'],
        'circle-stroke-color': '#FFFFFF',
        'circle-stroke-width': 1.5,
        'circle-opacity': 1,
      },
    },
  ]
}

// Pins are rendered as maplibregl.Marker HTML elements (see MapPreview.vue → placePinMarkers).
// No MapLibre source/layers needed — markers sit in the DOM above the canvas.

// ─── Route source ─────────────────────────────────────────────────────────────
// lineMetrics must be true when using line-gradient; data is populated by MapPreview.vue.

function routeSource(config: StyleConfig): object {
  return {
    type: 'geojson' as const,
    data: { type: 'FeatureCollection', features: [] },
    ...(config.route_color_mode === 'gradient' ? { lineMetrics: true } : {}),
  }
}

// ─── Route layers ─────────────────────────────────────────────────────────────

function routeLayers(config: StyleConfig) {
  const casing = {
    id: 'route-line-casing',
    type: 'line',
    source: 'route',
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: {
      'line-color': config.background_color ?? '#F7F4EF',
      'line-width': config.route_width + 4,
      'line-opacity': config.route_opacity,
    },
  }

  if (config.route_color_mode === 'gradient') {
    return [
      casing,
      {
        id: 'route-line',
        type: 'line',
        source: 'route',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-gradient': [
            'interpolate', ['linear'], ['line-progress'],
            0,    '#4F8EF7',
            0.25, '#52B788',
            0.6,  '#F4A261',
            0.85, '#E76F51',
            1,    '#C1121F',
          ],
          'line-width': config.route_width,
          'line-opacity': config.route_opacity,
        },
      },
    ]
  }

  return [
    casing,
    {
      id: 'route-line',
      type: 'line',
      source: 'route',
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': config.route_color,
        'line-width': config.route_width,
        'line-opacity': config.route_opacity,
      },
    },
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
    const sub = (s: string) =>
      ['a', 'b', 'c', 'd'].map(p => `https://${p}.basemaps.cartocdn.com/${s}/{z}/{x}/{y}.png`)
    baseTileSource = {
      type: 'raster' as const,
      tiles: styledTileUrls(config, dark ? sub('dark_all') : sub('light_all')),
      tileSize: 256,
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
      ...(config.show_roads && mapboxTk ? roadsSource(mapboxTk) : {}),
      route: routeSource(config),
      ...trailSegmentSources(config.trail_segments),
      ...segmentHandleSource(),
    },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': config.background_color } },
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
      ...(mapboxTk ? roadsLayers(config) : []),
      ...contourLayers(config, usingMlContour),
      ...routeLayers(config),
      ...trailSegmentLayers(config.trail_segments, config),
      ...segmentHandleLayers(),
    ],
  }
}

// ─── Route-Only Style ─────────────────────────────────────────────────────────
// No base raster tiles — just a solid background + route + optional contours/terrain.
// Produces the clean "route on paper" look: solid colour field, route line, faint labels.

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
      ...(config.show_roads && mapboxTk ? roadsSource(mapboxTk) : {}),
      route: routeSource(config),
      ...trailSegmentSources(config.trail_segments),
      ...segmentHandleSource(),
    },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': config.background_color } },
      ...hillshadeLayers(config),
      ...(mapboxTk ? roadsLayers(config) : []),
      ...contourLayers(config, usingMlContour),
      ...routeLayers(config),
      ...trailSegmentLayers(config.trail_segments, config),
      ...segmentHandleLayers(),
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
  const bg = config.background_color
  const ink = config.label_text_color

  const sources: Record<string, object> = {
    ...((config.show_hillshade || config.map_3d) ? demSource(token) : {}),
    ...(config.show_contours ? contourSource(token, contourTileUrl) : {}),
    route: routeSource(config),
    ...trailSegmentSources(config.trail_segments),
    ...segmentHandleSource(),
  }

  const roadLayers: object[] = []

  if (token) {
    sources['mapbox-streets'] = {
      type: 'vector' as const,
      tiles: [`https://api.mapbox.com/v4/mapbox.mapbox-streets-v8/{z}/{x}/{y}.vector.pbf?access_token=${token}`],
      minzoom: 0,
      maxzoom: 16,
      attribution: '© Mapbox © OpenStreetMap contributors',
    }

    // Water fill (light, below roads)
    roadLayers.push({
      id: 'rn-water',
      type: 'fill',
      source: 'mapbox-streets',
      'source-layer': 'water',
      paint: { 'fill-color': config.water_color ?? '#B8D8E8', 'fill-opacity': 0.6 },
    })

    // Land use — parks / green space
    roadLayers.push({
      id: 'rn-landuse',
      type: 'fill',
      source: 'mapbox-streets',
      'source-layer': 'landuse',
      filter: ['in', ['get', 'class'], ['literal', ['park', 'grass', 'wood', 'forest', 'scrub']]],
      paint: { 'fill-color': ink, 'fill-opacity': 0.04 },
    })

    // Service / footpath (thinnest)
    roadLayers.push({
      id: 'rn-service',
      type: 'line',
      source: 'mapbox-streets',
      'source-layer': 'road',
      filter: ['in', ['get', 'class'], ['literal', ['service', 'path', 'pedestrian', 'track']]],
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': ink,
        'line-opacity': 0.18,
        'line-width': ['interpolate', ['linear'], ['zoom'], 11, 0.3, 15, 0.8],
      },
    })

    // Residential / local streets
    roadLayers.push({
      id: 'rn-street',
      type: 'line',
      source: 'mapbox-streets',
      'source-layer': 'road',
      filter: ['in', ['get', 'class'], ['literal', ['street', 'street_limited', 'tertiary']]],
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': ink,
        'line-opacity': 0.32,
        'line-width': ['interpolate', ['linear'], ['zoom'], 9, 0.4, 14, 1.2],
      },
    })

    // Secondary
    roadLayers.push({
      id: 'rn-secondary',
      type: 'line',
      source: 'mapbox-streets',
      'source-layer': 'road',
      filter: ['in', ['get', 'class'], ['literal', ['secondary', 'primary']]],
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': ink,
        'line-opacity': 0.55,
        'line-width': ['interpolate', ['linear'], ['zoom'], 7, 0.6, 14, 2.0],
      },
    })

    // Motorway / trunk (boldest)
    roadLayers.push({
      id: 'rn-motorway',
      type: 'line',
      source: 'mapbox-streets',
      'source-layer': 'road',
      filter: ['in', ['get', 'class'], ['literal', ['motorway', 'trunk']]],
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': ink,
        'line-opacity': 0.75,
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
      ...roadLayers,
      ...hillshadeLayers(config),
      ...contourLayers(config, usingMlContour),
      ...routeLayers(config),
      ...trailSegmentLayers(config.trail_segments, config),
      ...segmentHandleLayers(),
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
  // Force maximum detail when used as the primary visual layer
  const artConfig = { ...config, show_contours: true, contour_detail: 4 }
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
      route: routeSource(config),
      ...trailSegmentSources(config.trail_segments),
      ...segmentHandleSource(),
    },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': config.background_color } },
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
                'line-width': ['interpolate', ['linear'], ['zoom'], 5, 0.5, 14, 0.9],
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
                'line-width': ['interpolate', ['linear'], ['zoom'], 5, 1.2, 14, 2.0],
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
      ...routeLayers(config),
      ...trailSegmentLayers(config.trail_segments, config),
      ...segmentHandleLayers(),
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
      ...(config.show_roads && mapboxTk ? roadsSource(mapboxTk) : {}),
      route: routeSource(config),
      ...trailSegmentSources(config.trail_segments),
      ...segmentHandleSource(),
    },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': config.background_color } },
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
      ...(mapboxTk ? roadsLayers(config) : []),
      ...contourLayers(config, usingMlContour),
      ...routeLayers(config),
      ...trailSegmentLayers(config.trail_segments, config),
      ...segmentHandleLayers(),
    ],
  }
}

// ─── Stadia Watercolor Style ──────────────────────────────────────────────────
// Hand-painted watercolor raster tiles from Stamen Design, hosted by Stadia Maps.
// Free for low-traffic / non-commercial use. Production needs a STADIA_API_KEY.

function buildStadiaWatercolorStyle(config: StyleConfig, contourTileUrl?: string): object {
  const usingMlContour = !!contourTileUrl

  return {
    version: 8,
    name: 'RadMaps Watercolor',
    glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
    sources: {
      'base-tiles': {
        type: 'raster' as const,
        tiles: styledTileUrls(config, [
          'https://tiles.stadiamaps.com/tiles/stamen_watercolor/{z}/{x}/{y}.jpg',
        ]),
        tileSize: 256,
        attribution: 'Map tiles by <a href="https://stamen.com">Stamen Design</a> / <a href="https://stadiamaps.com">Stadia Maps</a>, CC BY 3.0. Data © <a href="https://openstreetmap.org">OpenStreetMap</a> contributors',
      },
      ...((config.show_hillshade || config.map_3d) ? demSource('') : {}),
      ...(config.show_contours ? (contourTileUrl ? { contours: { type: 'vector' as const, tiles: [contourTileUrl], minzoom: 0, maxzoom: 14 } } : {}) : {}),
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
      ...(config.show_contours && usingMlContour ? contourLayers(config, true) : []),
      ...routeLayers(config),
      ...trailSegmentLayers(config.trail_segments, config),
      ...segmentHandleLayers(),
    ],
  }
}

// ─── Stadia Toner Style ───────────────────────────────────────────────────────
// High-contrast black & white graphic style by Stamen Design, hosted by Stadia Maps.

function buildStadiaTonerStyle(config: StyleConfig, contourTileUrl?: string): object {
  const usingMlContour = !!contourTileUrl

  return {
    version: 8,
    name: 'RadMaps Toner',
    glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
    sources: {
      'base-tiles': {
        type: 'raster' as const,
        tiles: styledTileUrls(config, [
          'https://tiles.stadiamaps.com/tiles/stamen_toner/{z}/{x}/{y}.png',
        ]),
        tileSize: 256,
        attribution: 'Map tiles by <a href="https://stamen.com">Stamen Design</a> / <a href="https://stadiamaps.com">Stadia Maps</a>, CC BY 3.0. Data © <a href="https://openstreetmap.org">OpenStreetMap</a> contributors',
      },
      ...((config.show_hillshade || config.map_3d) ? demSource('') : {}),
      ...(config.show_contours && usingMlContour ? { contours: { type: 'vector' as const, tiles: [contourTileUrl!], minzoom: 0, maxzoom: 14 } } : {}),
      route: routeSource(config),
      ...trailSegmentSources(config.trail_segments),
      ...segmentHandleSource(),
    },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': '#ffffff' } },
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
      ...(config.show_contours && usingMlContour ? contourLayers(config, true) : []),
      ...routeLayers(config),
      ...trailSegmentLayers(config.trail_segments, config),
      ...segmentHandleLayers(),
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
      ...(config.show_roads && token ? roadsSource(token) : {}),
      route: routeSource(config),
      ...trailSegmentSources(config.trail_segments),
      ...segmentHandleSource(),
    },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': config.background_color } },
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
      ...(token ? roadsLayers(config) : []),
      ...contourLayers(config, usingMlContour),
      ...routeLayers(config),
      ...trailSegmentLayers(config.trail_segments, config),
      ...segmentHandleLayers(),
    ],
  }
}
