export const FLAGS = {
  SCOUT_STYLE_AGENT: 'scout_style_agent',
  CHROME_DIRECT_EDIT: 'chrome_direct_edit',
  RADMAPS_ATLAS_EDITOR: 'radmaps_atlas_editor',
} as const

export type KnownFlagKey = typeof FLAGS[keyof typeof FLAGS]
