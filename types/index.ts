// ─── StyleConfig ─────────────────────────────────────────────────────────────
// Shared between MapLibre preview (client) and render worker (server)

export type StylePreset = 'minimalist' | 'topographic'
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
export type ColorTheme = 'chalk' | 'topaz' | 'dusk' | 'obsidian' | 'forest' | 'midnight'
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

export interface StyleConfig {
  preset: StylePreset
  background_color: string
  route_color: string
  route_width: number
  route_opacity: number
  // Contours (requires Mapbox Terrain v2 vector tiles)
  show_contours: boolean
  contour_color: string
  contour_major_color: string
  contour_opacity: number
  contour_detail: number   // 0–4 → maplibre-contour threshold level; higher = finer intervals
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
}

export const DEFAULT_STYLE_CONFIG: StyleConfig = {
  preset: 'minimalist',
  background_color: '#F7F4EF',
  route_color: '#C1121F',
  route_width: 3,
  route_opacity: 0.9,
  show_contours: false,
  contour_color: '#C8BDB0',
  contour_major_color: '#9E9082',
  contour_opacity: 0.75,
  contour_detail: 3,
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
  label_bg_color: '#F7F4EF',
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
}

export const COLOR_THEMES: ThemeDefinition[] = [
  // ── Light themes ──────────────────────────────────────────────────────────
  {
    id: 'chalk',
    label: 'Chalk',
    dark: false,
    background_color: '#F7F4EF',
    label_bg_color: '#F7F4EF',
    label_text_color: '#1C1917',
    route_color: '#C1121F',
    water_color: '#B8D8E8',
    land_color: '#EDE8DF',
    base_tile_style: 'carto-light',
    contour_color: '#C8BDB0',
    contour_major_color: '#9E9082',
  },
  {
    id: 'topaz',
    label: 'Topaz',
    dark: false,
    background_color: '#F0F4F2',
    label_bg_color: '#E8EEE9',
    label_text_color: '#1A2E24',
    route_color: '#2D6A4F',
    water_color: '#A8CDCA',
    land_color: '#E4EDE5',
    base_tile_style: 'carto-light',
    contour_color: '#B8CCBC',
    contour_major_color: '#7CA98C',
  },
  {
    id: 'dusk',
    label: 'Dusk',
    dark: false,
    background_color: '#FAF3E8',
    label_bg_color: '#FAF3E8',
    label_text_color: '#2C1810',
    route_color: '#C4622D',
    water_color: '#AECDD8',
    land_color: '#EEE4CC',
    base_tile_style: 'carto-light',
    contour_color: '#D4BCA0',
    contour_major_color: '#A8896A',
  },
  // ── Dark themes ───────────────────────────────────────────────────────────
  {
    id: 'obsidian',
    label: 'Obsidian',
    dark: true,
    background_color: '#121212',
    label_bg_color: '#1A1A1A',
    label_text_color: '#F0EDE8',
    route_color: '#FF6B6B',
    water_color: '#1A3A4A',
    land_color: '#1E1E1E',
    base_tile_style: 'carto-dark',
    contour_color: '#8A8A8A',
    contour_major_color: '#BABABA',
  },
  {
    id: 'forest',
    label: 'Forest',
    dark: true,
    background_color: '#0F1F17',
    label_bg_color: '#0F1F17',
    label_text_color: '#D4EDD9',
    route_color: '#74C69D',
    water_color: '#0D2B35',
    land_color: '#142A1C',
    base_tile_style: 'carto-dark',
    contour_color: '#4A9065',
    contour_major_color: '#78C490',
  },
  {
    id: 'midnight',
    label: 'Midnight',
    dark: true,
    background_color: '#0D1421',
    label_bg_color: '#0A1018',
    label_text_color: '#F0E8C8',
    route_color: '#C9A84C',
    water_color: '#0A1F35',
    land_color: '#111A25',
    base_tile_style: 'carto-dark',
    contour_color: '#4A80A8',
    contour_major_color: '#72B0D8',
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

export type MapStatus = 'draft' | 'rendered' | 'ordered'

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
  user_id: string
  map_id: string
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
  created_at: string
  updated_at: string
}

// ─── Gelato Product Catalogue ─────────────────────────────────────────────────

export interface PrintProduct {
  product_uid: string
  name: string
  type: 'poster' | 'framed' | 'canvas' | 'digital'
  size_label: string
  width_in: number
  height_in: number
  price_cents: number
  recommended_px_w: number
  recommended_px_h: number
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
