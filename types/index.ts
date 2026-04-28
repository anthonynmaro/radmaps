// ─── StyleConfig ─────────────────────────────────────────────────────────────
// Shared between MapLibre preview (client) and render worker (server)

export type StylePreset = 'minimalist' | 'topographic' | 'route-only' | 'road-network' | 'contour-art' | 'natural-topo' | 'stadia-watercolor' | 'stadia-toner'
export type LabelPosition = 'bottom' | 'top' | 'overlay'
export type BorderStyle = 'thin' | 'thick' | 'none'
export type FontFamily =
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
export type PrintSize = '18x24' | '24x36' | '16x20' | '11x14' | '8x10'
export type BaseTileStyle =
  | 'carto-light'
  | 'carto-dark'
  | 'maptiler-outdoor'
  | 'maptiler-topo'
  | 'maptiler-winter'

export interface StyleLabels {
  show_title: boolean
  show_distance: boolean
  show_elevation_gain: boolean
  show_date: boolean
  show_location: boolean
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
  bg_color?: string               // optional frosted pill background
}

// ─── Trail Segments ───────────────────────────────────────────────────────────

export interface TrailSegment {
  id: string
  name: string
  color: string
  visible: boolean
  section_start: number           // 0–100, % of primary route coordinate array
  section_end: number             // 0–100
  width?: number                  // line width in px, defaults to route_width
  opacity?: number                // default: 0.9
  dash?: boolean                  // dashed line style
}

export interface TrailLegend {
  show: boolean
  position: 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right'
}

export interface StyleConfig {
  preset: StylePreset
  background_color: string
  route_color: string
  route_width: number
  route_opacity: number
  route_smooth: number
  // Contours (requires Mapbox Terrain v2 vector tiles)
  show_contours: boolean
  contour_color: string
  contour_major_color: string
  contour_opacity: number
  contour_detail: number       // 0–5 → maplibre-contour threshold level; higher = finer intervals
  contour_minor_width: number  // line width multiplier for minor contours (default 1.0)
  contour_major_width: number  // line width multiplier for major contours (default 1.0)
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
  // Poster text
  trail_name: string        // overrides map.title in the poster label band
  occasion_text: string     // e.g. "Anthony's 40th", "Summit Ridge 2024"
  location_text: string     // overrides stats.location
  label_text_color: string  // poster label band text colour
  label_bg_color: string    // poster label band background colour
  // Branding
  show_branding?: boolean         // show "radmaps.studio" credit in footer (default: true)
  // Logo
  show_logo?: boolean
  logo_url?: string
  logo_position?: 'map-top-right' | 'header-right' | 'footer-left'
  logo_size?: number              // 5–20 cqh units, default: 8
  // Roads overlay (Mapbox Streets v8, requires mapbox token)
  show_roads?: boolean
  // Route pins (start / finish markers)
  show_start_pin?: boolean
  show_finish_pin?: boolean
  // Text overlays (floating text on map)
  text_overlays?: TextOverlay[]
  // Trail segments (named slices of the primary route)
  trail_segments?: TrailSegment[]
  trail_legend?: TrailLegend
  // Tile post-processing effects
  tile_effect?: 'none' | 'duotone' | 'posterize' | 'layer-color'
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
  // 3D terrain — applies MapLibre terrain extrusion and 45° pitch
  map_3d?: boolean
  // Frozen view state — locks zoom + center for deterministic tile processing
  map_zoom?: number                 // locked zoom level (undefined = auto-fit from bounds)
  map_center?: [number, number]     // locked center [lng, lat] (undefined = auto-fit)
  map_frozen?: boolean              // when true: non-interactive, processing-ready
}

export const DEFAULT_STYLE_CONFIG: StyleConfig = {
  preset: 'minimalist',
  background_color: '#F4EFE6',
  route_color: '#C1121F',
  route_width: 3,
  route_opacity: 0.9,
  route_smooth: 0,
  show_contours: true,
  contour_color: '#C8BDB0',
  contour_major_color: '#9E9082',
  contour_opacity: 0.75,
  contour_detail: 3,
  contour_minor_width: 1.0,
  contour_major_width: 1.0,
  show_elevation_labels: false,
  show_hillshade: false,
  hillshade_intensity: 0.5,
  hillshade_highlight: 0.3,
  water_color: '#B8D8E8',
  land_color: '#EDE8DF',
  font_family: 'Big Shoulders Display',
  body_font_family: 'DM Sans',
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
  print_size: '18x24',
  base_tile_style: 'carto-light',
  trail_name: '',
  occasion_text: '',
  location_text: '',
  label_text_color: '#1C1917',
  label_bg_color: '#F4EFE6',
  show_branding: true,
  show_roads: false,
  tile_effect: 'none',
  tile_duotone_strength: 0.9,
  tile_posterize_levels: 4,
  tile_grain: 0,
  tile_contrast: 0,
  tile_saturation: 0,
  tile_hue_rotate: 0,
  show_vignette: false,
  vignette_intensity: 0.45,
  map_frozen: false,
  show_start_pin: true,
  show_finish_pin: true,
  show_logo: false,
  logo_position: 'map-top-right',
  logo_size: 8,
  text_overlays: [],
  trail_segments: [],
  trail_legend: { show: true, position: 'bottom-left' },
}

// ─── Themes ──────────────────────────────────────────────────────────────────

export interface ThemeDefinition {
  id: ColorTheme
  label: string
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
  border_style?: BorderStyle
  tile_grain?: number
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
  { id: '18x24', label: '18×24"', width_in: 18, height_in: 24 },
  { id: '24x36', label: '24×36"', width_in: 24, height_in: 36 },
  { id: '16x20', label: '16×20"', width_in: 16, height_in: 20 },
  { id: '11x14', label: '11×14"', width_in: 11, height_in: 14 },
  { id: '8x10',  label: '8×10"',  width_in: 8,  height_in: 10 },
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

// ─── Map Record ───────────────────────────────────────────────────────────────

export type MapStatus = 'draft' | 'rendering' | 'rendered' | 'ordered'

export interface TrailMap {
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
  pdf_url?: string
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
  gelato_order_id?: string
  product_uid: string
  print_size: string
  quantity: number
  shipping_address: ShippingAddress
  total_cents: number
  currency: string
  status: OrderStatus
  tracking_code?: string
  carrier?: string
  digital_url?: string
  // Guest / premade purchase fields
  guest_email?: string | null
  premade_slug?: string | null
  premade_title?: string | null
  created_at: string
  updated_at: string
}

// ─── Premade Map Catalog ─────────────────────────────────────────────────────

export type PremadeCategory =
  | 'national-park'
  | 'long-distance'
  | 'marathon'
  | 'peak'
  | 'pilgrimage'
  | 'adventure'

export interface PremadeMap {
  slug: string                    // URL-safe unique identifier, e.g. 'john-muir-trail'
  title: string                   // Poster title
  subtitle: string                // Short secondary line for the poster / card
  region: string                  // Human-readable region (e.g. 'Sierra Nevada, California')
  country: string                 // ISO 3166 alpha-2 or short name
  category: PremadeCategory
  tagline: string                 // Short marketing blurb for card
  description: string             // Long-form product description
  badges?: string[]               // Optional badges like 'Iconic', 'New', 'Bestseller'
  stats: RouteStats
  bbox: [number, number, number, number]
  geojson: GeoJSON.FeatureCollection
  style_config: StyleConfig
  featured: boolean               // Show in featured strip
  base_price_cents: number        // Starting price (smallest size)
  // Visual presentation
  cover_gradient?: [string, string]
  // Pre-rendered assets (point these at Supabase Storage URLs in production)
  preview_image_url?: string      // High-quality JPG for card/detail hero
  render_url?: string             // 300 DPI print-ready file for Gelato
}

// ─── Gelato Product Catalogue ─────────────────────────────────────────────────

export interface PrintProduct {
  product_uid: string
  name: string
  type: 'poster' | 'framed' | 'canvas' | 'digital'
  size_label: string
  width_in: number
  height_in: number
  aspect_ratio: number            // width / height (e.g. 0.75 for 3:4 portrait)
  price_cents: number
  recommended_px_w: number
  recommended_px_h: number
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
