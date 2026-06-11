import type { PosterTextSlot, StyleConfig, ThemeEditableField } from '~/types'
import { getThemeDefinition } from '~/utils/themes/refined'

export const TIER1_TEXT_SLOTS = [
  'trail_name',
  'location_text',
  'occasion_text',
  'distance',
  'elevation_gain',
  'date',
  'coordinates',
  'composition_kicker',
  'composition_meta',
  'composition_footer',
  'composition_side_rail',
] as const satisfies readonly PosterTextSlot[]

const FIELD_TEXT_SLOTS: Partial<Record<ThemeEditableField, readonly PosterTextSlot[]>> = {
  trail_name: ['trail_name'],
  location_text: ['location_text'],
  occasion_text: ['occasion_text'],
}

export interface PosterEditorAllowlist {
  styleFields: readonly ThemeEditableField[] | null
  textSlots: readonly PosterTextSlot[] | null
}

export function posterEditorAllowlistForStyle(config: StyleConfig): PosterEditorAllowlist {
  const theme = getThemeDefinition(config.color_theme ?? 'chalk')
  if (!theme?.editable_fields) {
    return { styleFields: null, textSlots: null }
  }

  const slots = new Set<PosterTextSlot>(TIER1_TEXT_SLOTS)
  for (const field of theme.editable_fields) {
    for (const slot of FIELD_TEXT_SLOTS[field] ?? []) slots.add(slot)
  }

  if (config.show_start_pin !== false) slots.add('start_pin_label')
  if (config.show_finish_pin !== false) slots.add('finish_pin_label')

  return {
    styleFields: theme.editable_fields,
    textSlots: Array.from(slots),
  }
}

export function slotIsTier1Editable(config: StyleConfig, slot: PosterTextSlot) {
  const allowlist = posterEditorAllowlistForStyle(config).textSlots
  return !allowlist || allowlist.includes(slot)
}
