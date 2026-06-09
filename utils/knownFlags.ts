export const FLAGS = {
  SCOUT_STYLE_AGENT: 'scout_style_agent',
  CHROME_DIRECT_EDIT: 'chrome_direct_edit',
  POSTER_ELEMENTS_EDITOR: 'poster_elements_editor',
  POSTER_TEMPLATE_EDITOR: 'poster_template_editor',
  POSTER_TIER2_EDITOR: 'poster_tier2_editor',
  RADMAPS_ATLAS_EDITOR: 'radmaps_atlas_editor',
  THEME_PICKER_STEP: 'theme_picker_step',
  SIMPLE_EDITOR_REFRESH: 'simple_editor_refresh',
  WATERCOLOR_GEOMETRY_RENDERER: 'watercolor_geometry_renderer',
  STRIPE_HARDENED_CHECKOUT: 'stripe_hardened_checkout',
  ORDER_SUPPORT_ACTIONS: 'order_support_actions',
  PRODUCT_MOCKUPS: 'product_mockups',
} as const

export type KnownFlagKey = typeof FLAGS[keyof typeof FLAGS]
