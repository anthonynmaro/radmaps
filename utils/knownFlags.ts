export const FLAGS = {
  SCOUT_STYLE_AGENT: 'scout_style_agent',
} as const

export type KnownFlagKey = typeof FLAGS[keyof typeof FLAGS]
