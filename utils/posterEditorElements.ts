import {
  DEFAULT_STYLE_CONFIG,
  type ChromeBandId,
  type IconOverlay,
  type MapAsset,
  type PosterIconId,
  type PosterTextSlot,
  type RouteStats,
  type StyleConfig,
  type TextOverlay,
} from '~/types'
import { CHROME_BLOCK_KIND_LABELS, effectivePosterLayout } from '~/utils/posterLayout'
import { getPosterIcon } from '~/utils/posterIcons'

export type PosterEditorElementKind =
  | 'theme-text'
  | 'free-text'
  | 'image'
  | 'logo'
  | 'icon'
  | 'map'
  | 'decor'

export type PosterEditorElementSource = 'theme' | 'user' | 'system'

export interface PosterEditorElement {
  id: string
  rawId?: string
  kind: PosterEditorElementKind
  label: string
  source: PosterEditorElementSource
  locked: boolean
  hidden: boolean
  canTransform: boolean
  canEditContent: boolean
  canDelete: boolean
  zIndex: number
  x?: number
  y?: number
  width?: number
  height?: number
  rotation?: number
  color?: string
  slot?: PosterTextSlot
  band?: ChromeBandId
}

export type PosterEditorElementPatch = Partial<{
  x: number
  y: number
  width: number
  height: number
  font_size: number
  font_size_pt: number
  rotation: number
  zIndex: number
  color: string
  opacity: number
  locked: boolean
  hidden: boolean
  allow_bleed: boolean
  constrain_to_safe_area: boolean
  content: string
  icon: PosterIconId
}>

const DEFAULT_TEXT_SIZE = 2
const DEFAULT_ICON_SIZE = 10

function makeId(prefix: string) {
  return `${prefix}-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.round(Math.random() * 1_000_000)}`}`
}

const POSTER_TEXT_SLOTS = new Set<PosterTextSlot>([
  'trail_name',
  'occasion_text',
  'location_text',
  'distance',
  'elevation_gain',
  'date',
  'coordinates',
  'start_pin_label',
  'finish_pin_label',
  'composition_kicker',
  'composition_meta',
  'composition_footer',
  'composition_side_rail',
])

function elementId(prefix: 'text' | 'asset' | 'icon' | 'slot', id: string) {
  return `${prefix}:${id}`
}

function splitElementId(id: string): { prefix: 'text' | 'asset' | 'icon'; rawId: string } | { prefix: 'slot'; rawId: PosterTextSlot } | null {
  const [prefix, ...parts] = id.split(':')
  if ((prefix === 'text' || prefix === 'asset' || prefix === 'icon') && parts.length) {
    return { prefix, rawId: parts.join(':') }
  }
  if (prefix === 'slot' && parts.length) {
    const slot = parts.join(':') as PosterTextSlot
    return POSTER_TEXT_SLOTS.has(slot) ? { prefix, rawId: slot } : null
  }
  return null
}

function clampPercent(value: number, min = 0, max = 100) {
  if (!Number.isFinite(value)) return min
  return Number(Math.min(max, Math.max(min, value)).toFixed(2))
}

function clampOpacity(value: number) {
  if (!Number.isFinite(value)) return 1
  return Number(Math.min(1, Math.max(0.1, value)).toFixed(2))
}

function nextZIndex(config: StyleConfig, base = 30) {
  const values = [
    ...(config.text_overlays ?? []).map(item => item.z_index ?? 30),
    ...(config.image_overlays ?? []).map(item => item.z_index),
    ...(config.icon_overlays ?? []).map(item => item.z_index ?? 35),
  ].filter(value => Number.isFinite(value))
  return Math.max(base, ...values) + 1
}

function textElement(overlay: TextOverlay): PosterEditorElement {
  return {
    id: elementId('text', overlay.id),
    rawId: overlay.id,
    kind: 'free-text',
    label: overlay.content.trim() || 'Text',
    source: 'user',
    locked: overlay.locked === true,
    hidden: overlay.hidden === true,
    canTransform: overlay.locked !== true,
    canEditContent: true,
    canDelete: true,
    x: overlay.x,
    y: overlay.y,
    width: undefined,
    height: undefined,
    rotation: overlay.rotation ?? 0,
    color: overlay.color,
    zIndex: overlay.z_index ?? 30,
  }
}

function assetElement(asset: MapAsset): PosterEditorElement {
  return {
    id: elementId('asset', asset.id),
    rawId: asset.id,
    kind: asset.kind,
    label: asset.kind === 'logo' ? 'Logo' : 'Image',
    source: 'user',
    locked: asset.locked === true,
    hidden: asset.hidden === true,
    canTransform: asset.locked !== true,
    canEditContent: false,
    canDelete: true,
    x: asset.x,
    y: asset.y,
    width: asset.width,
    height: asset.height,
    rotation: asset.rotation,
    zIndex: asset.z_index,
  }
}

function iconElement(icon: IconOverlay): PosterEditorElement {
  const definition = getPosterIcon(icon.icon)
  return {
    id: elementId('icon', icon.id),
    rawId: icon.id,
    kind: 'icon',
    label: definition.label,
    source: 'user',
    locked: icon.locked === true,
    hidden: icon.hidden === true,
    canTransform: icon.locked !== true,
    canEditContent: false,
    canDelete: true,
    x: icon.x,
    y: icon.y,
    width: icon.width,
    height: icon.height,
    rotation: icon.rotation,
    color: icon.color,
    zIndex: icon.z_index,
  }
}

export function createTextOverlay(config: StyleConfig, patch: Partial<TextOverlay> = {}): TextOverlay {
  return {
    id: makeId('text'),
    content: 'Your text',
    x: 50,
    y: 50,
    font_size: DEFAULT_TEXT_SIZE,
    color: config.label_text_color,
    font_family: config.body_font_family ?? config.font_family,
    alignment: 'center',
    opacity: 1,
    bold: false,
    italic: false,
    rotation: 0,
    z_index: nextZIndex(config, 30),
    constrain_to_safe_area: true,
    ...patch,
  }
}

export function createIconOverlay(config: StyleConfig, icon: PosterIconId = 'mountain', patch: Partial<IconOverlay> = {}): IconOverlay {
  return {
    id: makeId('icon'),
    icon,
    x: 45,
    y: 45,
    width: DEFAULT_ICON_SIZE,
    height: DEFAULT_ICON_SIZE,
    color: config.label_text_color,
    opacity: 1,
    rotation: 0,
    z_index: nextZIndex(config, 35),
    constrain_to_safe_area: true,
    ...patch,
  }
}

export function getPosterEditorElements(
  config: StyleConfig,
  stats?: RouteStats,
  opts: { includeHidden?: boolean; editableTextSlots?: readonly PosterTextSlot[] | null } = {},
): PosterEditorElement[] {
  const layout = effectivePosterLayout(config, stats)
  const themeElements: PosterEditorElement[] = []
  const slotEditable = (slot: PosterTextSlot) => !opts.editableTextSlots || opts.editableTextSlots.includes(slot)

  for (const [bandId, band] of Object.entries(layout.bands) as Array<[ChromeBandId, typeof layout.bands[ChromeBandId]]>) {
    for (const row of band.rows) {
      for (const cell of row.cells) {
        const block = cell.block
        if (!block || block.empty || block.deleted || block.removed) continue
        if (block.kind === 'spacer') continue
        const editableSlot = block.slot ? slotEditable(block.slot) : false
        themeElements.push({
          id: editableSlot && block.slot ? elementId('slot', block.slot) : `theme:${bandId}:${row.id}:${cell.id}:${block.id}`,
          rawId: block.id,
          kind: 'theme-text',
          label: block.label ?? (block.slot ? CHROME_BLOCK_KIND_LABELS[block.kind] : block.text ?? CHROME_BLOCK_KIND_LABELS[block.kind]),
          source: 'theme',
          locked: !editableSlot,
          hidden: false,
          canTransform: editableSlot,
          canEditContent: editableSlot && block.kind !== 'brand' && block.kind !== 'logo' && block.kind !== 'image',
          canDelete: false,
          zIndex: 10,
          slot: block.slot,
          band: bandId,
        })
      }
    }
  }

  const systemElements: PosterEditorElement[] = [{
    id: 'system:map',
    kind: 'map',
    label: 'Map',
    source: 'system',
    locked: true,
    hidden: false,
    canTransform: false,
    canEditContent: false,
    canDelete: false,
    zIndex: 0,
  }]

  if (config.show_grid) {
    systemElements.push({
      id: 'system:printed-grid',
      kind: 'decor',
      label: `${config.grid_scope === 'map' ? 'Map' : 'Poster'} printed grid`,
      source: 'system',
      locked: true,
      hidden: false,
      canTransform: false,
      canEditContent: false,
      canDelete: false,
      zIndex: 4,
    })
  }

  return [
    ...systemElements,
    ...themeElements,
    ...(config.image_overlays ?? []).filter(item => opts.includeHidden || !item.hidden).map(assetElement),
    ...(config.text_overlays ?? []).filter(item => opts.includeHidden || !item.hidden).map(textElement),
    ...(config.icon_overlays ?? []).filter(item => opts.includeHidden || !item.hidden).map(iconElement),
  ].sort((a, b) => a.zIndex - b.zIndex || a.label.localeCompare(b.label))
}

export function patchPosterEditorElement(config: StyleConfig, id: string, patch: PosterEditorElementPatch): StyleConfig {
  const parsed = splitElementId(id)
  if (!parsed) return config

  if (parsed.prefix === 'slot') {
    const current = config.poster_text_overrides ?? {}
    const existing = current[parsed.rawId] ?? {}
    const next = {
      ...existing,
      ...(patch.content != null ? { text: patch.content } : {}),
      ...(patch.color != null ? { color: patch.color } : {}),
      ...(patch.opacity != null ? { opacity: clampOpacity(patch.opacity) } : {}),
      ...(patch.font_size_pt != null ? { font_size_pt: Math.min(240, Math.max(6, patch.font_size_pt)) } : {}),
    }
    return {
      ...config,
      poster_text_overrides: {
        ...current,
        [parsed.rawId]: next,
      },
    }
  }

  if (parsed.prefix === 'text') {
    return {
      ...config,
      text_overlays: (config.text_overlays ?? []).map(item => item.id === parsed.rawId
        ? {
            ...item,
            ...(patch.x != null ? { x: clampPercent(patch.x) } : {}),
            ...(patch.y != null ? { y: clampPercent(patch.y) } : {}),
            ...(patch.font_size != null ? { font_size: clampPercent(patch.font_size, 0.5, 12) } : {}),
            ...(patch.rotation != null ? { rotation: Number(patch.rotation.toFixed(1)) } : {}),
            ...(patch.zIndex != null ? { z_index: patch.zIndex } : {}),
            ...(patch.color != null ? { color: patch.color } : {}),
            ...(patch.opacity != null ? { opacity: clampOpacity(patch.opacity) } : {}),
            ...(patch.locked != null ? { locked: patch.locked } : {}),
            ...(patch.hidden != null ? { hidden: patch.hidden } : {}),
            ...(patch.constrain_to_safe_area != null ? { constrain_to_safe_area: patch.constrain_to_safe_area } : {}),
            ...(patch.content != null ? { content: patch.content } : {}),
          }
        : item),
    }
  }

  if (parsed.prefix === 'asset') {
    return {
      ...config,
      image_overlays: (config.image_overlays ?? []).map(item => item.id === parsed.rawId
        ? {
            ...item,
            ...(patch.x != null ? { x: clampPercent(patch.x, patch.allow_bleed ?? item.allow_bleed ? -item.width : 0, 100) } : {}),
            ...(patch.y != null ? { y: clampPercent(patch.y, patch.allow_bleed ?? item.allow_bleed ? -item.height : 0, 100) } : {}),
            ...(patch.width != null ? { width: clampPercent(patch.width, 2, 100) } : {}),
            ...(patch.height != null ? { height: clampPercent(patch.height, 2, 100) } : {}),
            ...(patch.rotation != null ? { rotation: Number(patch.rotation.toFixed(1)) } : {}),
            ...(patch.zIndex != null ? { z_index: patch.zIndex } : {}),
            ...(patch.opacity != null ? { opacity: clampOpacity(patch.opacity) } : {}),
            ...(patch.locked != null ? { locked: patch.locked } : {}),
            ...(patch.hidden != null ? { hidden: patch.hidden } : {}),
            ...(patch.allow_bleed != null ? { allow_bleed: patch.allow_bleed } : {}),
          }
        : item),
    }
  }

  return {
    ...config,
    icon_overlays: (config.icon_overlays ?? []).map(item => item.id === parsed.rawId
      ? {
          ...item,
          ...(patch.x != null ? { x: clampPercent(patch.x) } : {}),
          ...(patch.y != null ? { y: clampPercent(patch.y) } : {}),
          ...(patch.width != null ? { width: clampPercent(patch.width, 2, 80) } : {}),
          ...(patch.height != null ? { height: clampPercent(patch.height, 2, 80) } : {}),
          ...(patch.rotation != null ? { rotation: Number(patch.rotation.toFixed(1)) } : {}),
          ...(patch.zIndex != null ? { z_index: patch.zIndex } : {}),
          ...(patch.color != null ? { color: patch.color } : {}),
          ...(patch.opacity != null ? { opacity: clampOpacity(patch.opacity) } : {}),
          ...(patch.locked != null ? { locked: patch.locked } : {}),
          ...(patch.hidden != null ? { hidden: patch.hidden } : {}),
          ...(patch.constrain_to_safe_area != null ? { constrain_to_safe_area: patch.constrain_to_safe_area } : {}),
          ...(patch.icon != null ? { icon: patch.icon } : {}),
        }
      : item),
  }
}

export function addPosterEditorText(config: StyleConfig, patch: Partial<TextOverlay> = {}): { config: StyleConfig; id: string } {
  const overlay = createTextOverlay(config, patch)
  return {
    id: elementId('text', overlay.id),
    config: {
      ...config,
      text_overlays: [...(config.text_overlays ?? []), overlay],
    },
  }
}

export function addPosterEditorIcon(config: StyleConfig, icon: PosterIconId = 'mountain', patch: Partial<IconOverlay> = {}): { config: StyleConfig; id: string } {
  const overlay = createIconOverlay(config, icon, patch)
  return {
    id: elementId('icon', overlay.id),
    config: {
      ...config,
      icon_overlays: [...(config.icon_overlays ?? []), overlay],
    },
  }
}

export function removePosterEditorElement(config: StyleConfig, id: string): StyleConfig {
  const parsed = splitElementId(id)
  if (!parsed) return config
  if (parsed.prefix === 'text') return { ...config, text_overlays: (config.text_overlays ?? []).filter(item => item.id !== parsed.rawId) }
  if (parsed.prefix === 'asset') return { ...config, image_overlays: (config.image_overlays ?? []).filter(item => item.id !== parsed.rawId) }
  return { ...config, icon_overlays: (config.icon_overlays ?? []).filter(item => item.id !== parsed.rawId) }
}

export function duplicatePosterEditorElement(config: StyleConfig, id: string): { config: StyleConfig; id: string | null } {
  const parsed = splitElementId(id)
  if (!parsed) return { config, id: null }

  if (parsed.prefix === 'text') {
    const existing = config.text_overlays?.find(item => item.id === parsed.rawId)
    if (!existing) return { config, id: null }
    const copy = createTextOverlay(config, {
      ...existing,
      id: makeId('text'),
      content: `${existing.content} copy`,
      x: clampPercent(existing.x + 4),
      y: clampPercent(existing.y + 4),
      z_index: nextZIndex(config, existing.z_index ?? 30),
    })
    return { id: elementId('text', copy.id), config: { ...config, text_overlays: [...(config.text_overlays ?? []), copy] } }
  }

  if (parsed.prefix === 'asset') {
    const existing = config.image_overlays?.find(item => item.id === parsed.rawId)
    if (!existing) return { config, id: null }
    const copy: MapAsset = {
      ...existing,
      id: makeId(existing.kind),
      x: clampPercent(existing.x + 4, existing.allow_bleed ? -existing.width : 0, 100),
      y: clampPercent(existing.y + 4, existing.allow_bleed ? -existing.height : 0, 100),
      z_index: nextZIndex(config, existing.z_index),
    }
    return { id: elementId('asset', copy.id), config: { ...config, image_overlays: [...(config.image_overlays ?? []), copy] } }
  }

  const existing = config.icon_overlays?.find(item => item.id === parsed.rawId)
  if (!existing) return { config, id: null }
  const copy = createIconOverlay(config, existing.icon, {
    ...existing,
    id: makeId('icon'),
    x: clampPercent(existing.x + 4),
    y: clampPercent(existing.y + 4),
    z_index: nextZIndex(config, existing.z_index),
  })
  return { id: elementId('icon', copy.id), config: { ...config, icon_overlays: [...(config.icon_overlays ?? []), copy] } }
}

export function normalizePosterEditorConfig(config: StyleConfig): StyleConfig {
  return {
    ...config,
    grid_spacing: config.grid_spacing ?? DEFAULT_STYLE_CONFIG.grid_spacing,
    text_overlays: config.text_overlays ?? [],
    image_overlays: config.image_overlays ?? [],
    icon_overlays: config.icon_overlays ?? [],
  }
}
