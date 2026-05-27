import { DEFAULT_STYLE_CONFIG, type FontFamily, type PosterTextOverride, type PosterTextOverrides, type StyleConfig, type ThemeDefinition } from '~/types'

const FONT_PAIRINGS: Record<FontFamily, FontFamily> = {
  'Big Shoulders Display': 'DM Sans',
  'Fjalla One': 'Work Sans',
  'Oswald': 'Work Sans',
  'Bebas Neue': 'DM Sans',
  'DM Sans': 'DM Sans',
  'Space Grotesk': 'Space Grotesk',
  'Outfit': 'Outfit',
  'Work Sans': 'Work Sans',
  'Playfair Display': 'Libre Baskerville',
  'Cormorant Garamond': 'Libre Baskerville',
  'Libre Baskerville': 'Libre Baskerville',
  'DM Serif Display': 'DM Sans',
}

const THEME_RESET_FIELDS = {
  roads_color: undefined,
  place_labels_color: undefined,
  poi_labels_color: undefined,
  pin_color: undefined,
  pin_font_family: undefined,
  leader_label_font_family: undefined,
  tile_shadow_color: undefined,
  tile_midtone_color: undefined,
  tile_highlight_color: undefined,
  atlas_layers: undefined,
  atlas_layer_settings: undefined,
  grid_color: undefined,
  grid_opacity: 0.2,
  grid_weight: 1,
  grid_scope: 'poster',
  title_scale: 1,
  occasion_scale: 1,
  subtitle_scale: 1,
  show_start_pin: false,
  show_finish_pin: false,
} satisfies Partial<StyleConfig>

function stripThemeOwnedTextOverride(override: PosterTextOverride): PosterTextOverride | undefined {
  const next: PosterTextOverride = {}
  if (override.text != null) next.text = override.text
  return Object.keys(next).length ? next : undefined
}

export function stripThemeOwnedTextOverrides(overrides?: PosterTextOverrides): PosterTextOverrides | undefined {
  if (!overrides) return undefined

  const next: PosterTextOverrides = {}
  for (const [slot, override] of Object.entries(overrides)) {
    if (!override) continue
    const textOnly = stripThemeOwnedTextOverride(override)
    if (textOnly) next[slot as keyof PosterTextOverrides] = textOnly
  }

  return Object.keys(next).length ? next : undefined
}

export function applyThemeToStyleConfig(current: StyleConfig, theme: ThemeDefinition): StyleConfig {
  const patch: Partial<StyleConfig> = {
    ...THEME_RESET_FIELDS,
    color_theme: theme.id,
    background_color: theme.background_color,
    label_bg_color: theme.label_bg_color,
    label_text_color: theme.label_text_color,
    route_color: theme.route_color,
    water_color: theme.water_color,
    land_color: theme.land_color,
    base_tile_style: theme.base_tile_style,
    contour_color: theme.contour_color,
    contour_major_color: theme.contour_major_color,
    composition: theme.composition,
    audience: theme.audience,
    dark: theme.dark,
    show_grid: theme.show_grid,
    poster_text_overrides: stripThemeOwnedTextOverrides(current.poster_text_overrides),
    title_size: DEFAULT_STYLE_CONFIG.title_size,
    subtitle_size: DEFAULT_STYLE_CONFIG.subtitle_size,
    ...theme.map_defaults,
  }

  if (theme.font_family) {
    patch.font_family = theme.font_family
    patch.body_font_family = theme.body_font_family ?? FONT_PAIRINGS[theme.font_family] ?? theme.font_family
  }
  if (theme.border_style !== undefined) patch.border_style = theme.border_style
  if (theme.tile_grain !== undefined) patch.tile_grain = theme.tile_grain

  return { ...current, ...patch }
}

export function pairedBodyFont(fontName: FontFamily): FontFamily {
  return FONT_PAIRINGS[fontName] ?? fontName
}
