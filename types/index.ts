// ─── StyleConfig ─────────────────────────────────────────────────────────────
// Shared between MapLibre preview (client) and render worker (server)

export type StylePreset =
  | 'minimalist' | 'topographic' | 'route-only' | 'road-network'
  | 'contour-art' | 'natural-topo' | 'stadia-watercolor' | 'stadia-toner'
  // Beta — native presets with no Stadia Maps dependency
  | 'native-toner' | 'native-watercolor' | 'alidade-smooth' | 'alidade-smooth-dark'
  // RadMaps owned Atlas presets. These are MapLibre recipes over first-party
  // PMTiles data, not separate third-party basemap products.
  | 'radmaps-minimalist'
  | 'radmaps-topographic'
  | 'radmaps-natural'
  | 'radmaps-toner-light'
  | 'radmaps-toner-dark'
  // Legacy hidden alias retained for existing saved maps.
  | 'radmaps-toner'
  | 'radmaps-field-topo'
  | 'radmaps-contour-wash'
  | 'radmaps-simple-contour'
  | 'radmaps-night-relief'
  | 'radmaps-watercolor'
  // Legacy hidden aliases retained for existing saved maps.
  | 'radmaps-watercolor-classic'
  | 'radmaps-watercolor-pigment-wash'
  | 'radmaps-watercolor-paper'
  | 'radmaps-watercolor-brush-ink'
  | 'radmaps-alidade'
  | 'radmaps-alidade-dark'
export type LabelPosition = 'bottom' | 'top' | 'overlay'
export type BorderStyle = 'thin' | 'thick' | 'none'
export type FontFamily =
  // Print workhorses — calm, legible, broad weight ranges
  | 'Source Sans 3'
  | 'Source Serif 4'
  | 'IBM Plex Sans'
  | 'IBM Plex Mono'
  | 'Atkinson Hyperlegible Next'
  | 'Newsreader'
  // Editorial — condensed, impactful, poster-native
  | 'Big Shoulders Display'
  | 'Fjalla One'
  | 'Oswald'
  | 'Bebas Neue'
  // Modern — clean, contemporary
  | 'DM Sans'
  | 'Space Grotesk'
  | 'Outfit'
  | 'Work Sans'
  // Refined — serif, timeless
  | 'Playfair Display'
  | 'Cormorant Garamond'
  | 'Libre Baskerville'
  | 'DM Serif Display'
export type ColorTheme =
  // Family A — classic poster palettes
  | 'chalk' | 'topaz' | 'dusk' | 'obsidian' | 'forest' | 'midnight'
  // Family B — distinct visual languages
  | 'editorial' | 'bauhaus' | 'vintage' | 'brutalist' | 'risograph'
  | 'blueprint' | 'kertok' | 'mid-century' | 'topo-art' | 'dark-sky'
  // Refined design-update themes. Additive only: old ids stay renderable.
  | 'editorial-minimal' | 'usgs-vintage' | 'midcentury-travel'
  | 'blueprint-strava' | 'field-journal' | 'bold-modern'
  | 'splits-stats' | 'marathon-bib' | 'botanical' | 'contour-wash'
  | 'classic-trail' | 'ranch-ochre' | 'blackline' | 'copper-night'
  | 'moonstone' | 'night-ride' | 'daybreak-trace' | 'electric-atlas'
  | 'cartouche-place' | 'sea-chart' | 'relief-shaded' | 'transit-diagram'
  | 'plein-air'

export type CompositionId =
  | 'editorial-tall'
  | 'park-quad'
  | 'travel-banner'
  | 'riso-stack'
  | 'blueprint-grid'
  | 'blueprint-strava'
  | 'journal-spread'
  | 'modernist-block'
  | 'splits-grid'
  | 'bib-numerals'
  | 'darksky-stars'
  | 'botanical-plate'
  | 'brutalist-slab'
  | 'art-wash'
  | 'place-frame'
  | 'sea-chart'
  | 'transit-diagram'
export type PrintSize = '8x12' | '12x18' | '16x24' | '20x30' | '24x36' | '32x48'
export type BaseTileStyle =
  | 'carto-light'
  | 'carto-dark'
  | 'maptiler-outdoor'
  | 'maptiler-topo'
  | 'maptiler-winter'
export type TonerVariant = 'auto' | 'light' | 'dark'

export type AtlasLayerId =
  | 'contour'
  | 'water'
  | 'waterway'
  | 'park'
  | 'landcover'
  | 'transportation'
  | 'outdoorRoute'
  | 'building'
  | 'poi'
  | 'place'

export type AtlasLayerVisibility = Partial<Record<AtlasLayerId, boolean>>
export type AtlasOutdoorRouteActivity = 'hiking' | 'cycling' | 'mountain-biking' | 'bikepacking'

export interface AtlasLayerSettings {
  contour?: {
    interval?: 'auto' | '20ft' | '40ft' | '100ft' | '10m' | '20m'
    minor_color?: string
    index_color?: string
    major_color?: string
    minor_opacity?: number
    index_opacity?: number
    major_opacity?: number
    minor_width?: number
    index_width?: number
    major_width?: number
    labels?: boolean
    label_color?: string
    label_opacity?: number
    units?: 'ft' | 'm'
  }
  transportation?: {
    density?: 'minimal' | 'balanced' | 'detailed'
    major_color?: string
    minor_color?: string
    road_color?: string
    trail_color?: string
    opacity?: number
    show_major?: boolean
    show_minor?: boolean
    show_trails?: boolean
    major_width?: number
    minor_width?: number
    trail_width?: number
    labels?: boolean
    label_color?: string
    label_opacity?: number
  }
  poi?: {
    density?: 'sparse' | 'balanced' | 'detailed'
    categories?: string[]
    icon_opacity?: number
    labels?: boolean
    label_color?: string
    label_opacity?: number
  }
  outdoorRoute?: {
    density?: 'sparse' | 'balanced' | 'detailed'
    activities?: AtlasOutdoorRouteActivity[]
    color?: string
    opacity?: number
    width?: number
    labels?: boolean
    label_color?: string
    label_opacity?: number
  }
  park?: {
    fill_color?: string
    boundary_color?: string
    opacity?: number
    boundary_opacity?: number
    labels?: boolean
    label_color?: string
    label_opacity?: number
  }
  water?: {
    fill_color?: string
    fill_opacity?: number
    waterway_color?: string
    waterway_opacity?: number
    waterway_width?: number
    labels?: boolean
    label_color?: string
    label_opacity?: number
  }
  waterway?: {
    color?: string
    opacity?: number
    width?: number
    labels?: boolean
  }
  landcover?: {
    color?: string
    opacity?: number
    texture?: 'none' | 'subtle' | 'paper' | 'relief'
  }
  building?: {
    fill_color?: string
    outline_color?: string
    opacity?: number
  }
  place?: {
    label_color?: string
    label_opacity?: number
    font_family?: string
    font_size?: number
    halo_color?: string
    halo_opacity?: number
  }
}

export interface StyleLabels {
  show_title: boolean
  show_distance: boolean
  show_elevation_gain: boolean
  show_date: boolean
  show_location: boolean
}

// ─── Poster Text Slots ───────────────────────────────────────────────────────

export type PosterTextSlot =
  | 'trail_name'
  | 'occasion_text'
  | 'location_text'
  | 'distance'
  | 'elevation_gain'
  | 'date'
  | 'coordinates'
  | 'start_pin_label'
  | 'finish_pin_label'
  | 'composition_kicker'
  | 'composition_meta'
  | 'composition_footer'
  | 'composition_side_rail'

export interface PosterTextOverride {
  text?: string
  font_family?: FontFamily
  color?: string
  bg_color?: string
  font_size_pt?: number
  align?: ChromeBlockAlign
  scale?: number
  opacity?: number
  bold?: boolean
  italic?: boolean
}

export type PosterTextOverrides = Partial<Record<PosterTextSlot, PosterTextOverride>>

export const DEFAULT_CONTOUR_MAJOR_WIDTH = 0.5
export const DEFAULT_ROUTE_WIDTH = 2.1
export const DEFAULT_ROUTE_CASING_WIDTH = 2.8
export const DEFAULT_TRAIL_SEGMENT_WIDTH = 2.1
export const DEFAULT_SEGMENT_CASING_WIDTH = 2.1

// ─── Poster Chrome Layout ───────────────────────────────────────────────────

export type ChromeBandId = 'header' | 'footer' | 'railLeft' | 'railRight'
export type ChromeBlockKind =
  | 'title'
  | 'subtitle'
  | 'eyebrow'
  | 'occasion'
  | 'coords'
  | 'stat'
  | 'note'
  | 'brand'
  | 'vlabel'
  | 'logo'
  | 'image'
  | 'spacer'
  | 'text'
export type ChromeBlockAlign = 'left' | 'center' | 'right'
export type ChromeBlockValign = 'top' | 'center' | 'bottom'

export interface ChromeBlock {
  id: string
  kind: ChromeBlockKind
  slot?: PosterTextSlot
  align?: ChromeBlockAlign
  valign?: ChromeBlockValign
  deleted?: boolean
  empty?: boolean
  removed?: boolean
  source?: 'theme' | 'user'
  text?: string
  label?: string
  value?: string
  url?: string
  font_family?: FontFamily
  font_size_pt?: number
  scale?: number
  color?: string
  bg_color?: string
  opacity?: number
  bold?: boolean
  italic?: boolean
  underline?: boolean
}

export interface ChromeGridCell {
  id: string
  fr?: number
  align?: ChromeBlockAlign
  valign?: ChromeBlockValign
  padding?: [number, number, number, number]
  deleted?: boolean
  block?: ChromeBlock
}

export interface ChromeGridRow {
  id: string
  fr?: number
  deleted?: boolean
  cells: ChromeGridCell[]
}

export interface ChromeBand {
  height?: number
  width?: number
  background?: string
  padding?: [number, number, number, number]
  rows: ChromeGridRow[]
}

// ─── Poster Anchor Layout ────────────────────────────────────────────────────

export type AnchorTarget = 'poster' | 'map' | ChromeBandId | { elementId: string }
export type AnchorEdge = 'top' | 'bottom' | 'left' | 'right' | 'center' | 'fill'
export type AnchorLengthUnit = 'cqw' | 'cqh' | 'px' | '%' | 'fr'
export type AnchorVariableToken = 'print-bleed'
export type AnchorDecorationToken =
  | 'cartouche-titleblock'
  | 'sea-chart-titleblock'
  | 'art-wash-titleblock'

export type AnchorLength =
  | { kind: 'unit'; value: number; unit: AnchorLengthUnit }
  | { kind: 'var'; token: AnchorVariableToken; fallback?: Extract<AnchorLength, { kind: 'unit' }> }
  | { kind: 'calc'; terms: Array<{ op: '+' | '-'; value: AnchorLength }> }
  | { kind: 'min' | 'max'; values: AnchorLength[] }

export type AnchorTransform =
  | { kind: 'translateX' | 'translateY'; value: AnchorLength }
  | { kind: 'translate'; x: AnchorLength; y: AnchorLength }
  | { kind: 'rotate'; deg: number }

export interface AnchorBox {
  left?: AnchorLength
  right?: AnchorLength
  top?: AnchorLength
  bottom?: AnchorLength
  width?: AnchorLength
  height?: AnchorLength
  maxWidth?: AnchorLength
  maxHeight?: AnchorLength
  padding?: [AnchorLength, AnchorLength, AnchorLength, AnchorLength]
  transform?: AnchorTransform[]
  decorations?: AnchorDecorationToken[]
}

export interface AnchorFitConfig {
  targetSizeCqh?: number
  minScale?: number
  maxLines?: number
  overflow?: 'clip' | 'clamp'
}

export interface AnchorFrame {
  id: string
  anchorTo: AnchorTarget
  edge: AnchorEdge
  displacesMap: boolean
  offset?: { x?: AnchorLength; y?: AnchorLength }
  size?: { width?: AnchorLength; height?: AnchorLength }
  z?: number
  slot?: PosterTextSlot
  fit?: AnchorFitConfig
  rows?: ChromeGridRow[]
  userPinned?: boolean
  box?: AnchorBox
  deleted?: boolean
}

export type PartialAnchorFrame = Partial<Omit<AnchorFrame, 'id' | 'rows'>> & {
  id: string
  rows?: ChromeGridRow[]
}

export interface PosterLayout {
  bands: Record<ChromeBandId, ChromeBand>
  anchors?: AnchorFrame[]
}

export interface PartialPosterLayout {
  bands?: Partial<Record<ChromeBandId, Partial<ChromeBand>>>
  anchors?: PartialAnchorFrame[]
}

// ─── Text Overlays ────────────────────────────────────────────────────────────

export type TextOverlayAlignment = 'left' | 'center' | 'right'

export interface TextOverlay {
  id: string
  content: string
  x: number                       // 0–100, % from left of map container
  y: number                       // 0–100, % from top of map container
  font_size: number               // in cqh units (0.5–6)
  color: string
  font_family: FontFamily
  alignment: TextOverlayAlignment
  opacity: number
  bold: boolean
  italic?: boolean
  bg_color?: string               // optional frosted pill background
  rotation?: number
  z_index?: number
  locked?: boolean
  hidden?: boolean
  constrain_to_safe_area?: boolean
}

// ─── Uploaded Image Assets ──────────────────────────────────────────────────

export type MapAssetKind = 'logo' | 'image'
export type MapAssetQualityStatus = 'excellent' | 'good' | 'warning' | 'poor'

export interface MapAsset {
  id: string
  kind: MapAssetKind
  source_url: string
  render_url: string
  mime_type: 'image/jpeg' | 'image/png' | 'image/webp'
  width_px: number
  height_px: number
  file_size_bytes: number
  x: number                       // %, from left of poster canvas; may be negative when artwork extends off-canvas
  y: number                       // %, from top of poster canvas; may be negative when artwork extends off-canvas
  width: number                   // 1–100, % of poster canvas width
  height: number                  // 1–100, % of poster canvas height
  rotation: number                // degrees
  opacity: number                 // 0–1
  z_index: number
  quality_status: MapAssetQualityStatus
  locked?: boolean
  hidden?: boolean
  allow_bleed?: boolean
}

// ─── Icon Overlays ───────────────────────────────────────────────────────────

export type PosterIconId =
  | 'trailhead'
  | 'mountain'
  | 'compass'
  | 'star'
  | 'camp'
  | 'water'

export interface IconOverlay {
  id: string
  icon: PosterIconId
  x: number
  y: number
  width: number
  height: number
  color: string
  opacity: number
  rotation: number
  z_index: number
  locked?: boolean
  hidden?: boolean
  constrain_to_safe_area?: boolean
}

// ─── Trail Segments ───────────────────────────────────────────────────────────

export interface TrailSegment {
  id: string
  name: string
  color: string
  visible: boolean
  source?: 'route-slice' | 'uploaded-track' | 'drawn-track'
  geojson?: GeoJSON.FeatureCollection
  bbox?: [number, number, number, number]
  stats?: RouteStats
  source_filename?: string
  section_start: number           // 0–100, % of source route coordinate array
  section_end: number             // 0–100
  width?: number                  // line width in px, defaults to route_width
  opacity?: number                // default: 0.9
  smooth?: number                 // 0–10 moving-average smoothing strength
  bend?: number                   // legacy/global curve strength fallback, -1–1
  bends?: number[]                // per-stretch curve strength between editable points, -1–1
  dash?: boolean                  // dashed line style
  color_mode?: 'solid' | 'gradient'
  label_lnglat?: [number, number] // user-dragged label position (lng/lat)
}

export interface TrailLegend {
  show: boolean
  position: 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right'
}

export interface DeletedRange {
  start: number  // 0–100, % of coordinate array
  end: number    // 0–100
  start_index?: number // exact coordinate index, inclusive; used by brush eraser
  end_index?: number   // exact coordinate index, exclusive; used by brush eraser
}

export interface StyleConfig {
  preset: StylePreset
  background_color: string
  route_color: string
  route_width: number
  route_opacity: number
  route_smooth: number
  route_crop_start: number      // 0–100, trims the visible start of the primary route
  route_crop_end: number        // 0–100, trims the visible end of the primary route
  route_deleted_ranges?: DeletedRange[]  // non-destructive mid-route section removal
  // Contours (requires Mapbox Terrain v2 vector tiles)
  show_contours: boolean
  contour_color: string
  contour_major_color: string
  contour_opacity: number
  contour_detail: number       // 0–5 → maplibre-contour threshold level; higher = finer intervals
  contour_minor_width: number  // line width multiplier for minor contours (default 1.0)
  contour_major_width: number  // line width multiplier for major contours (default 0.5)
  show_elevation_labels: boolean
  // Hillshade (requires Mapbox Terrain DEM v1)
  show_hillshade: boolean
  hillshade_intensity: number
  hillshade_highlight: number
  // Base colours
  water_color: string
  land_color: string
  font_family: FontFamily
  body_font_family: FontFamily
  title_size: number
  subtitle_size: number
  labels: StyleLabels
  label_position: LabelPosition
  border_style: BorderStyle
  padding_factor: number
  // Theme & layout
  color_theme: ColorTheme
  print_size: PrintSize
  base_tile_style: BaseTileStyle
  // Owned atlas state. Optional during rollout; legacy provider presets ignore it.
  atlas_manifest_id?: string
  atlas_style_id?: string
  toner_variant?: TonerVariant
  atlas_layers?: AtlasLayerVisibility
  atlas_layer_settings?: AtlasLayerSettings
  watercolor_seed?: string
  composition?: CompositionId
  audience?: string
  dark?: boolean
  composition_footer_distance_unit?: 'mi' | 'km'
  composition_footer_date_format?: 'day-month-year' | 'month-year'
  show_grid?: boolean
  grid_scope?: 'poster' | 'map'
  grid_color?: string
  grid_opacity?: number
  grid_weight?: number
  grid_spacing?: number
  // Poster text
  trail_name: string        // overrides map.title in the poster label band
  occasion_text: string     // e.g. "Anthony's 40th", "Summit Ridge 2024"
  location_text: string     // overrides stats.location
  label_text_color: string  // poster label band text colour
  label_bg_color: string    // poster label band background colour
  poster_text_overrides?: PosterTextOverrides // user edits for imported/theme text slots
  poster_layout?: PartialPosterLayout // sparse user edits to composition chrome layout
  // Branding
  show_branding?: boolean         // show "radmaps.studio" credit in footer (default: true)
  // Logo
  show_logo?: boolean
  logo_url?: string
  logo_position?: 'map-top-right' | 'header-right' | 'footer-left'
  logo_size?: number              // 5–20 cqh units, default: 8
  // Roads overlay (Mapbox Streets v8, requires mapbox token)
  show_roads?: boolean
  roads_color?: string              // default: auto from label_text_color
  roads_opacity?: number            // 0–1, default: 0.6
  show_place_labels?: boolean       // default: true when show_roads
  place_labels_color?: string       // default: label_text_color
  place_labels_opacity?: number     // 0–1, default: 0.75
  place_labels_scale?: 'city' | 'town' | 'village'  // max density shown, default: 'town'
  show_poi_labels?: boolean         // default: false
  poi_labels_color?: string         // default: label_text_color
  poi_labels_opacity?: number       // 0–1, default: 0.65
  // Route pins (start / finish markers)
  show_start_pin?: boolean
  show_finish_pin?: boolean
  start_pin_lnglat?: [number, number]  // dot position; undefined = first route coord
  finish_pin_lnglat?: [number, number] // dot position; undefined = last route coord
  start_label_lnglat?: [number, number]  // draggable label position (lng/lat)
  finish_label_lnglat?: [number, number]
  start_pin_label?: string             // default: 'Start'
  finish_pin_label?: string            // default: 'Finish'
  pin_color?: string                   // default: label_text_color
  pin_opacity?: number                 // 0–1, default: 0.9
  pin_font_family?: FontFamily
  // Per-field text scale multipliers (1.0 = default theme size)
  title_scale?: number
  occasion_scale?: number
  subtitle_scale?: number
  // Text overlays (floating text on map)
  text_overlays?: TextOverlay[]
  // Uploaded image/logo overlays (floating poster-level images)
  image_overlays?: MapAsset[]
  // Local SVG icon overlays (floating poster-level vectors)
  icon_overlays?: IconOverlay[]
  // Trail segments (named slices of the primary route)
  trail_segments?: TrailSegment[]
  // Undefined defaults to false when visible named trail segments exist, true otherwise.
  show_primary_route?: boolean
  trail_legend?: TrailLegend
  trail_label_style?: 'legend' | 'leader-lines'  // default: 'legend'
  segment_casing_width?: number   // casing/border extra px (added to seg width), default: 3
  segment_casing_color?: string   // border/casing line color, default: '#FFFFFF'
  segment_dot_size?: number       // radius of handle dots at segment endpoints, default: 1.5
  leader_label_scale?: number     // font size multiplier for leader line labels, default: 1.0
  leader_label_auto_fit?: boolean  // auto-reduces leader label type so dense labels fit
  leader_label_font_family?: FontFamily
  trail_show_stats?: boolean
  trail_show_elevation_gain?: boolean
  // Elevation profile (SVG chart overlaid on the map or rendered as a slim poster band)
  show_elevation_profile?: boolean
  elevation_profile_color?: string    // default: route_color
  elevation_profile_opacity?: number  // 0–1, default: 0.65
  elevation_profile_height?: number   // overlay: % of map height; band: cqh of poster height, default: 10–12
  elevation_profile_position?: 'map-overlay' | 'separate-band'
  elevation_profile_relief?: number   // 0.35–1, compresses vertical profile amplitude, default: 0.65
  // Tile post-processing effects
  tile_effect?: 'none' | 'duotone' | 'posterize' | 'layer-color' | 'invert'
  tile_duotone_strength?: number    // 0–1, blend strength (default 0.9)
  tile_posterize_levels?: number    // 2–8, colour quantisation levels (default 4)
  tile_grain?: number               // 0–1, film grain overlay intensity
  tile_contrast?: number            // -1–1, raster layer contrast
  tile_saturation?: number          // -1–1, raster layer saturation
  tile_hue_rotate?: number          // 0–360, raster layer hue rotation (degrees)
  // Layer-color effect: independent tinting of shadow / midtone / highlight bands
  tile_shadow_color?: string        // dark features (roads, labels); default: label_text_color
  tile_midtone_color?: string       // mid-luminance features; default: blend of shadow/highlight
  tile_highlight_color?: string     // light features (water, open land); default: background_color
  // Vignette overlay
  show_vignette?: boolean
  vignette_intensity?: number       // 0–1 (default 0.45)
  // Route gradient coloring — color the route by position along its length
  route_color_mode?: 'solid' | 'gradient'
  // 3D terrain + camera perspective
  map_3d?: boolean
  map_pitch?: number                // camera pitch in degrees, 0–70
  map_bearing?: number              // camera rotation in degrees, -180–180
  terrain_exaggeration?: number     // MapLibre terrain exaggeration, 0.5–3
  // Frozen view state — locks zoom + center for deterministic tile processing
  map_zoom?: number                 // locked zoom level (undefined = auto-fit from bounds)
  map_center?: [number, number]     // locked center [lng, lat] (undefined = auto-fit)
  map_frozen?: boolean              // when true: non-interactive, processing-ready
  map_editor_width?: number         // px width of map container when zoom was saved; used to correct zoom at print resolution
}

export const DEFAULT_STYLE_CONFIG: StyleConfig = {
  preset: 'minimalist',
  background_color: '#F4EFE6',
  route_color: '#C1121F',
  route_width: DEFAULT_ROUTE_WIDTH,
  route_opacity: 0.9,
  route_smooth: 0,
  route_crop_start: 0,
  route_crop_end: 100,
  show_contours: true,
  contour_color: '#C8BDB0',
  contour_major_color: '#9E9082',
  contour_opacity: 0.75,
  contour_detail: 3,
  contour_minor_width: 1.0,
  contour_major_width: DEFAULT_CONTOUR_MAJOR_WIDTH,
  show_elevation_labels: false,
  show_hillshade: false,
  hillshade_intensity: 0.5,
  hillshade_highlight: 0.3,
  water_color: '#B8D8E8',
  land_color: '#EDE8DF',
  font_family: 'Source Sans 3',
  body_font_family: 'Source Sans 3',
  title_size: 48,
  subtitle_size: 24,
  labels: {
    show_title: true,
    show_distance: true,
    show_elevation_gain: true,
    show_date: false,
    show_location: true,
  },
  label_position: 'bottom',
  border_style: 'thin',
  padding_factor: 0.15,
  color_theme: 'chalk',
  print_size: '24x36',
  base_tile_style: 'carto-light',
  trail_name: '',
  occasion_text: '',
  location_text: '',
  label_text_color: '#1C1917',
  label_bg_color: '#F4EFE6',
  show_branding: true,
  show_roads: true,
  show_grid: false,
  grid_scope: 'poster',
  grid_opacity: 0.2,
  grid_weight: 1,
  grid_spacing: 8,
  tile_effect: 'none',
  tile_duotone_strength: 0.9,
  tile_posterize_levels: 4,
  tile_grain: 0,
  tile_contrast: 0,
  tile_saturation: 0,
  tile_hue_rotate: 0,
  show_vignette: false,
  vignette_intensity: 0.45,
  segment_casing_width: DEFAULT_SEGMENT_CASING_WIDTH,
  segment_casing_color: '#FFFFFF',
  segment_dot_size: 1.5,
  leader_label_auto_fit: true,
  trail_show_stats: false,
  trail_show_elevation_gain: true,
  map_3d: false,
  map_pitch: 0,
  map_bearing: 0,
  terrain_exaggeration: 1.5,
  map_frozen: false,
  show_start_pin: true,
  show_finish_pin: true,
  show_logo: false,
  logo_position: 'map-top-right',
  logo_size: 8,
  text_overlays: [],
  image_overlays: [],
  icon_overlays: [],
  trail_segments: [],
  trail_legend: { show: true, position: 'bottom-left' },
}

// ─── Themes ──────────────────────────────────────────────────────────────────

export type ThemeEditableField =
  | 'trail_name'
  | 'location_text'
  | 'occasion_text'
  | 'route_color'
  | 'colorway'
  | 'show_roads'
  | 'show_place_labels'
  | 'show_poi_labels'
  | 'show_contours'
  | 'show_hillshade'
  | 'show_elevation_profile'
  | 'trail_segments'
  | 'map_camera'
  | 'print_size'

export interface ThemeDefinition {
  id: ColorTheme
  label: string
  family?: string
  audience?: string
  dark: boolean
  background_color: string
  label_bg_color: string
  label_text_color: string
  route_color: string
  water_color: string
  land_color: string
  base_tile_style: BaseTileStyle
  contour_color: string
  contour_major_color: string
  font_family?: FontFamily
  body_font_family?: FontFamily
  border_style?: BorderStyle
  tile_grain?: number
  composition?: CompositionId
  show_grid?: boolean
  legacy?: boolean
  migration_target?: ColorTheme
  review_decision?: 'keep' | 'revise' | 'merge' | 'new'
  colorway_of?: ColorTheme
  editable_fields?: ThemeEditableField[]
  map_defaults?: Partial<StyleConfig>
}

export const COLOR_THEMES: ThemeDefinition[] = [
  // ── Light themes ──────────────────────────────────────────────────────────
  {
    id: 'chalk',
    label: 'Chalk',
    dark: false,
    background_color: '#F4EFE6',
    label_bg_color: '#F4EFE6',
    label_text_color: '#1C1917',
    route_color: '#C1121F',
    water_color: '#B8D8E8',
    land_color: '#EBE6DC',
    base_tile_style: 'carto-light',
    contour_color: '#C8BDB0',
    contour_major_color: '#9E9082',
    legacy: true,
    migration_target: 'editorial-minimal',
  },
  {
    id: 'topaz',
    label: 'Topaz',
    dark: false,
    background_color: '#F3D5A5',
    label_bg_color: '#F3D5A5',
    label_text_color: '#3B2A1A',
    route_color: '#9B2C2C',
    water_color: '#8FBFBA',
    land_color: '#F8E8C5',
    base_tile_style: 'carto-light',
    contour_color: '#C8A478',
    contour_major_color: '#A07850',
    legacy: true,
    migration_target: 'usgs-vintage',
  },
  {
    id: 'dusk',
    label: 'Dusk',
    dark: true,
    background_color: '#2A2438',
    label_bg_color: '#2A2438',
    label_text_color: '#F5E8C7',
    route_color: '#E5A04B',
    water_color: '#1A1840',
    land_color: '#322B48',
    base_tile_style: 'carto-dark',
    contour_color: '#7070A0',
    contour_major_color: '#A0A0C8',
    legacy: true,
    migration_target: 'dark-sky',
  },
  // ── Dark themes ───────────────────────────────────────────────────────────
  {
    id: 'obsidian',
    label: 'Obsidian',
    dark: true,
    background_color: '#161616',
    label_bg_color: '#161616',
    label_text_color: '#FAFAFA',
    route_color: '#FB923C',
    water_color: '#1A3A4A',
    land_color: '#1E1E1E',
    base_tile_style: 'carto-dark',
    contour_color: '#8A8A8A',
    contour_major_color: '#BABABA',
    legacy: true,
    migration_target: 'dark-sky',
  },
  {
    id: 'forest',
    label: 'Forest',
    dark: false,
    background_color: '#E8E4D5',
    label_bg_color: '#E8E4D5',
    label_text_color: '#2D4A2B',
    route_color: '#A23B2A',
    water_color: '#A8C8BE',
    land_color: '#F0EDE0',
    base_tile_style: 'carto-light',
    contour_color: '#A8A870',
    contour_major_color: '#787848',
    legacy: true,
    migration_target: 'botanical',
  },
  {
    id: 'midnight',
    label: 'Midnight',
    dark: true,
    background_color: '#0F1B2D',
    label_bg_color: '#0F1B2D',
    label_text_color: '#E8EDF5',
    route_color: '#60A5FA',
    water_color: '#0A1F35',
    land_color: '#111A25',
    base_tile_style: 'carto-dark',
    contour_color: '#4A80A8',
    contour_major_color: '#72B0D8',
    legacy: true,
    migration_target: 'dark-sky',
  },
  // ── Family B — distinct visual languages ──────────────────────────────────
  {
    id: 'editorial',
    label: 'Editorial',
    dark: false,
    background_color: '#F8F6F2',
    label_bg_color: '#F8F6F2',
    label_text_color: '#1A1A1A',
    route_color: '#C1121F',
    water_color: '#C4D8E4',
    land_color: '#EEE8E0',
    base_tile_style: 'carto-light',
    contour_color: '#C8C0B0',
    contour_major_color: '#A09888',
    font_family: 'Playfair Display',
    border_style: 'none',
    tile_grain: 0,
    legacy: true,
    migration_target: 'editorial-minimal',
  },
  {
    id: 'bauhaus',
    label: 'Bauhaus',
    dark: false,
    background_color: '#FFFFFF',
    label_bg_color: '#FFFFFF',
    label_text_color: '#111111',
    route_color: '#E52727',
    water_color: '#C8D8E8',
    land_color: '#F5F5F5',
    base_tile_style: 'carto-light',
    contour_color: '#D0D0D0',
    contour_major_color: '#A0A0A0',
    font_family: 'Big Shoulders Display',
    border_style: 'thick',
    tile_grain: 0,
    legacy: true,
    migration_target: 'bold-modern',
  },
  {
    id: 'vintage',
    label: 'U009 Vintage',
    dark: false,
    background_color: '#E8D5A0',
    label_bg_color: '#E8D5A0',
    label_text_color: '#2A1A0A',
    route_color: '#B5451B',
    water_color: '#8EB0BA',
    land_color: '#EDE0B8',
    base_tile_style: 'carto-light',
    contour_color: '#C0A070',
    contour_major_color: '#907040',
    font_family: 'DM Serif Display',
    border_style: 'none',
    tile_grain: 0.28,
    legacy: true,
    migration_target: 'usgs-vintage',
  },
  {
    id: 'brutalist',
    label: 'Brutalist',
    dark: false,
    background_color: '#FFFFFF',
    label_bg_color: '#FFFFFF',
    label_text_color: '#000000',
    route_color: '#FF2010',
    water_color: '#C8D0D8',
    land_color: '#F5F5F5',
    base_tile_style: 'carto-light',
    contour_color: '#B8B8B8',
    contour_major_color: '#888888',
    font_family: 'Bebas Neue',
    border_style: 'thick',
    tile_grain: 0,
  },
  {
    id: 'risograph',
    label: 'Risograph',
    dark: false,
    background_color: '#F5ECD4',
    label_bg_color: '#F5ECD4',
    label_text_color: '#1A1A3E',
    route_color: '#E8533C',
    water_color: '#A0B8C0',
    land_color: '#EDE0C0',
    base_tile_style: 'carto-light',
    contour_color: '#C0A888',
    contour_major_color: '#988060',
    font_family: 'Oswald',
    border_style: 'none',
    tile_grain: 0.18,
  },
  {
    id: 'blueprint',
    label: 'Blueprint',
    dark: true,
    background_color: '#1B3A6B',
    label_bg_color: '#1B3A6B',
    label_text_color: '#D4E8FF',
    route_color: '#60B8FF',
    water_color: '#0A2040',
    land_color: '#1F4080',
    base_tile_style: 'carto-dark',
    contour_color: '#4080C0',
    contour_major_color: '#60A0E0',
    font_family: 'Space Grotesk',
    border_style: 'thin',
    tile_grain: 0.06,
  },
  {
    id: 'kertok',
    label: 'Kertok',
    dark: false,
    background_color: '#FAFAF8',
    label_bg_color: '#FAFAF8',
    label_text_color: '#2A2A2A',
    route_color: '#E52727',
    water_color: '#D0E0EC',
    land_color: '#F5F5F2',
    base_tile_style: 'carto-light',
    contour_color: '#D0C8C0',
    contour_major_color: '#B0A8A0',
    font_family: 'Work Sans',
    border_style: 'thin',
    tile_grain: 0,
    legacy: true,
    migration_target: 'usgs-vintage',
  },
  {
    id: 'mid-century',
    label: 'Mid-Century',
    dark: false,
    background_color: '#F0E6CE',
    label_bg_color: '#F0E6CE',
    label_text_color: '#2A2010',
    route_color: '#D4603A',
    water_color: '#A0B8C8',
    land_color: '#E8D8B8',
    base_tile_style: 'carto-light',
    contour_color: '#C8B088',
    contour_major_color: '#A08860',
    font_family: 'Oswald',
    border_style: 'none',
    tile_grain: 0.08,
    legacy: true,
    migration_target: 'midcentury-travel',
  },
  {
    id: 'topo-art',
    label: 'Topo Art',
    dark: false,
    background_color: '#F8F8F4',
    label_bg_color: '#F8F8F4',
    label_text_color: '#2C3020',
    route_color: '#7A6A50',
    water_color: '#C0D0D8',
    land_color: '#EEEDE8',
    base_tile_style: 'carto-light',
    contour_color: '#A8A880',
    contour_major_color: '#808860',
    font_family: 'Work Sans',
    border_style: 'thin',
    tile_grain: 0,
    legacy: true,
    migration_target: 'usgs-vintage',
  },
  {
    id: 'dark-sky',
    label: 'Dark Sky',
    dark: true,
    background_color: '#161616',
    label_bg_color: '#161616',
    label_text_color: '#F0F0F0',
    route_color: '#FF4444',
    water_color: '#0A1820',
    land_color: '#202020',
    base_tile_style: 'carto-dark',
    contour_color: '#404040',
    contour_major_color: '#686868',
    font_family: 'Fjalla One',
    border_style: 'none',
    tile_grain: 0.14,
  },
]

// ─── Print Sizes ──────────────────────────────────────────────────────────────

export interface PrintSizeDefinition {
  id: PrintSize
  label: string
  width_in: number
  height_in: number
}

export const PRINT_SIZES: PrintSizeDefinition[] = [
  { id: '8x12',  label: '8×12"',  width_in: 8,  height_in: 12 },
  { id: '12x18', label: '12×18"', width_in: 12, height_in: 18 },
  { id: '16x24', label: '16×24"', width_in: 16, height_in: 24 },
  { id: '20x30', label: '20×30"', width_in: 20, height_in: 30 },
  { id: '24x36', label: '24×36"', width_in: 24, height_in: 36 },
  { id: '32x48', label: '32×48"', width_in: 32, height_in: 48 },
]

// ─── Route Stats ─────────────────────────────────────────────────────────────

export interface RouteStats {
  distance_km: number
  elevation_gain_m: number
  elevation_loss_m: number
  max_elevation_m: number
  min_elevation_m: number
  duration_seconds?: number
  activity_type?: string
  date?: string
  location?: string
}

// ─── Searchable Location Metadata ────────────────────────────────────────────

export interface LocationMetadata {
  location_label?: string | null
  location_city?: string | null
  location_region?: string | null
  location_country?: string | null
  location_lng?: number | null
  location_lat?: number | null
}

// ─── Map Record ───────────────────────────────────────────────────────────────

export type MapStatus = 'draft' | 'rendering' | 'rendered' | 'ordered'

export interface TrailMap extends LocationMetadata {
  id: string
  user_id: string
  title: string
  subtitle?: string
  geojson: GeoJSON.FeatureCollection
  bbox: [number, number, number, number]
  stats: RouteStats
  style_config: StyleConfig
  thumbnail_url?: string
  render_url?: string
  proof_render_url?: string
  proof_render_hash?: string
  map_content_hash?: string
  chrome_hash?: string
  pdf_url?: string
  is_public?: boolean
  status: MapStatus
  created_at: string
  updated_at: string
}

// ─── Order ────────────────────────────────────────────────────────────────────

export type OrderStatus =
  | 'pending'
  | 'paid'
  | 'in_production'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'failed'
  | 'fulfillment_failed'
  | 'manual_review'
  | 'refunded'
  | 'partially_refunded'

export type FulfillmentStatus =
  | 'pending_payment'
  | 'paid'
  | 'rendering_print'
  | 'print_ready'
  | 'submitted_to_gelato'
  | 'manual_review'
  | 'failed'
  | 'render_queue_failed'
  | 'snapshot_missing'
  | 'quote_mismatch'
  | 'fraud_review'
  | 'cancelled'
  | 'refunded'
  | 'partially_refunded'

export interface ShippingAddress {
  name: string
  address1: string
  address2?: string
  city: string
  state_code: string
  country_code: string
  zip: string
  email: string
  phone?: string
}

export interface Order {
  id: string
  user_id: string | null         // nullable when guest_email is set
  map_id: string | null          // nullable when premade_slug is set
  stripe_pi_id: string
  stripe_session_id?: string | null
  stripe_customer_id?: string | null
  stripe_charge_id?: string | null
  gelato_order_id?: string
  product_uid: string
  print_size: string
  quantity: number
  shipping_address: ShippingAddress
  subtotal_cents: number
  discount_cents: number
  total_cents: number
  amount_subtotal_cents?: number
  amount_shipping_cents?: number
  amount_tax_cents?: number
  amount_discount_cents?: number
  amount_total_cents?: number
  amount_refunded_cents?: number
  currency: string
  status: OrderStatus
  fulfillment_status?: FulfillmentStatus | null
  payment_status?: string | null
  payment_method_type?: string | null
  receipt_url?: string | null
  pricing_snapshot_id?: string | null
  pricing_country_code?: string | null
  gelato_product_cost_cents?: number | null
  retail_unit_price_cents?: number | null
  pricing_markup_bps?: number | null
  pricing_rounding_rule?: string | null
  pricing_synced_at?: string | null
  shipping_quote_id?: string | null
  shipment_method_uid?: string | null
  quote_expires_at?: string | null
  refund_status?: 'none' | 'pending' | 'partial' | 'full' | 'failed'
  dispute_status?: 'none' | 'warning_needs_response' | 'under_review' | 'needs_response' | 'won' | 'lost' | 'closed'
  risk_level?: string | null
  tracking_code?: string
  carrier?: string
  digital_url?: string
  // Guest / premade purchase fields
  guest_email?: string | null
  premade_slug?: string | null
  premade_title?: string | null
  coupon_id?: string | null
  coupon_slug?: string | null
  created_at: string
  updated_at: string
}

export interface Coupon {
  id: string
  slug: string
  percent_off: number
  expires_at?: string | null
  max_redemptions?: number | null
  email?: string | null
  active: boolean
  stripe_coupon_id?: string
  created_by?: string | null
  updated_by?: string | null
  created_at: string
  updated_at: string
}

export type CouponRedemptionStatus = 'reserved' | 'redeemed' | 'released' | 'expired'

// ─── Admin / Staff Roles ─────────────────────────────────────────────────────

export type AdminRole = 'admin' | 'curator' | 'designer' | 'support'

export interface AdminUser {
  id: string
  user_id: string
  role: AdminRole
  active: boolean
  created_by?: string | null
  updated_by?: string | null
  created_at: string
  updated_at: string
}

// ─── Feature Flags ──────────────────────────────────────────────────────────

export type FeatureFlagEnvironment = 'development' | 'preview' | 'production' | 'all'
export type FeatureFlagRuleType = 'user_list' | 'admin_role' | 'all_staff' | 'percentage' | 'everyone'

export interface FeatureFlagRule {
  type: FeatureFlagRuleType
  enabled: boolean
  roles?: AdminRole[]
  user_ids?: string[]
  emails?: string[]
  percentage?: number
}

export interface FeatureFlag {
  id: string
  key: string
  name: string
  description?: string | null
  environment: FeatureFlagEnvironment
  enabled: boolean
  rules: FeatureFlagRule[]
  archived_at?: string | null
  created_by?: string | null
  updated_by?: string | null
  created_at: string
  updated_at: string
}

export interface FeatureFlagEvent {
  id: string
  feature_flag_id?: string | null
  flag_key: string
  environment: FeatureFlagEnvironment
  action: 'create' | 'update' | 'archive' | 'restore'
  actor_id?: string | null
  before?: Record<string, unknown> | null
  after?: Record<string, unknown> | null
  created_at: string
}

export interface FeatureFlagContext {
  userId?: string
  email?: string
  adminRole?: AdminRole | null
  isStaff?: boolean
}

// ─── Premade Map Catalog ─────────────────────────────────────────────────────

export type PremadeStatus = 'draft' | 'published' | 'archived'

export type PremadeCategory =
  | 'hikes'
  | 'trails'
  | 'runs'
  | 'marathons'
  | 'mountain-biking'
  | 'paddles'
  | 'rivers'
  | 'cityscapes'
  | 'cycling'
  | 'beaches'
  | 'wine-trails'

export interface PremadeMap extends LocationMetadata {
  id?: string
  source_map_id?: string | null
  slug: string                    // URL-safe unique identifier, e.g. 'john-muir-trail'
  title: string                   // Poster title
  subtitle: string                // Short secondary line for the poster / card
  region: string                  // Human-readable region (e.g. 'Sierra Nevada, California')
  country: string                 // ISO 3166 alpha-2 or short name
  category: PremadeCategory
  categories: PremadeCategory[]
  tagline: string                 // Short marketing blurb for card
  description: string             // Long-form product description
  badges?: string[]               // Optional badges like 'Iconic', 'New', 'Bestseller'
  stats: RouteStats
  bbox: [number, number, number, number]
  geojson: GeoJSON.FeatureCollection
  style_config: StyleConfig
  featured: boolean               // Show in featured strip
  status?: PremadeStatus
  homepage_visible?: boolean
  homepage_sort_order?: number
  needs_preview?: boolean
  base_price_cents: number        // Starting price (smallest size)
  // Visual presentation
  cover_gradient?: [string, string]
  // Pre-rendered assets (point these at Supabase Storage URLs in production)
  preview_image_url?: string      // High-quality JPG for card/detail hero
  render_url?: string             // 300 DPI print-ready file for Gelato
  distance_meters?: number        // Present when returned from a nearby search
}

// ─── Gelato Product Catalogue ─────────────────────────────────────────────────

export interface PrintProduct {
  product_uid: string
  name: string
  type: 'poster' | 'framed' | 'wall_hanging' | 'aluminum' | 'acrylic' | 'digital'
  size_label: string
  width_in: number
  height_in: number
  aspect_ratio: number            // width / height (2 / 3 for the current portrait family)
  price_cents: number
  recommended_px_w: number
  recommended_px_h: number
  format_label?: string
  material_key?: string
  material_label?: string
  material_description?: string
  material_warning?: string
  catalog_uid?: string
}

export type ProductMockupSourceType = 'map' | 'premade'

export interface ProductMockup {
  id: string
  provider: 'gelato_template_asset'
  source_type: ProductMockupSourceType
  source_id: string
  product_uid: string
  source_render_hash: string
  mockup_template_id: string
  mockup_template_version: string
  renderer_version: string
  mockup_hash: string
  artifact_path: string
  mockup_url: string
  mockup_url_expires_at?: string | null
  provider_product_id?: string | null
  provider_variant_id?: string | null
  provider_status?: string | null
  width_px: number
  height_px: number
  validation_result: Record<string, unknown>
  created_at: string
  updated_at: string
}

// ─── Product Selection State ─────────────────────────────────────────────────
// Used by ProductSelector component to pass map framing to the render worker

export interface ProductFraming {
  product_uid: string
  center: [number, number]        // [lng, lat] — map center after user adjustment
  zoom: number                    // map zoom level after user adjustment
  bearing: number
  pitch: number
}

// ─── Render Job ───────────────────────────────────────────────────────────────

export type RenderJobStatus = 'queued' | 'rendering' | 'complete' | 'failed'

export interface RenderJob {
  job_id: string
  map_id: string
  status: RenderJobStatus
  jpeg_url?: string
  pdf_url?: string
  error?: string
}

// ─── AI Agent ─────────────────────────────────────────────────────────────────

export type AgentStep =
  | 'preset'
  | 'colors'
  | 'typography'
  | 'labels'
  | 'border'
  | 'confirm'

export interface AgentMessage {
  role: 'user' | 'assistant'
  content: string
}
