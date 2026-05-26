export const FLAGS = {
  SCOUT_STYLE_AGENT: 'scout_style_agent',
  CHROME_DIRECT_EDIT: 'chrome_direct_edit',
  RADMAPS_ATLAS_EDITOR: 'radmaps_atlas_editor',
  STRIPE_HARDENED_CHECKOUT: 'stripe_hardened_checkout',
  ORDER_SUPPORT_ACTIONS: 'order_support_actions',
} as const

export type KnownFlagKey = typeof FLAGS[keyof typeof FLAGS]
