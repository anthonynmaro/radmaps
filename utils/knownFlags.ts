export const FLAGS = {
  SCOUT_STYLE_AGENT: 'scout_style_agent',
  CHROME_DIRECT_EDIT: 'chrome_direct_edit',
  RADMAPS_ATLAS_EDITOR: 'radmaps_atlas_editor',
  THEME_PICKER_STEP: 'theme_picker_step',
  SIMPLE_EDITOR_REFRESH: 'simple_editor_refresh',
  WATERCOLOR_GEOMETRY_RENDERER: 'watercolor_geometry_renderer',
  STRIPE_HARDENED_CHECKOUT: 'stripe_hardened_checkout',
  ORDER_SUPPORT_ACTIONS: 'order_support_actions',
} as const

export type KnownFlagKey = typeof FLAGS[keyof typeof FLAGS]
