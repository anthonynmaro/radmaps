import {
  DEFAULT_STYLE_CONFIG,
  type AnchorBox,
  type AnchorFrame,
  type AnchorLength,
  type ChromeBandId,
  type ChromeGridCell,
  type ChromeGridRow,
  type IconOverlay,
  type MapAsset,
  type PartialPosterLayout,
  type PosterIconId,
  type PosterStatBinding,
  type PosterTextSlot,
  type RouteStats,
  type StyleConfig,
  type TextOverlay,
} from '~/types'
import { CHROME_BLOCK_KIND_LABELS, effectivePosterLayout } from '~/utils/posterLayout'
import { getPosterIcon } from '~/utils/posterIcons'
import type { ThemeDataContext } from '~/utils/themeDataContract'
import { formatCoordsFromPoint, formatCoordsFromBbox, formatDistanceMiles, formatElevationGainFeet } from '~/utils/posterFormatters'

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

function percentUnit(value: number): Extract<AnchorLength, { kind: 'unit' }> {
  return { kind: 'unit', value: clampPercent(value, -100, 100), unit: '%' }
}

function percentFromLength(length: AnchorLength | undefined): number | undefined {
  return length?.kind === 'unit' && length.unit === '%' ? length.value : undefined
}

export function freeTextAnchorId(id: string) {
  return `free-text:${id}`
}

export function freeAssetAnchorId(id: string) {
  return `free-asset:${id}`
}

function freeAnchorIdForElement(prefix: 'text' | 'asset', id: string) {
  return prefix === 'text' ? freeTextAnchorId(id) : freeAssetAnchorId(id)
}

function isFreeOverlayAnchorId(id: string) {
  return id.startsWith('free-text:') || id.startsWith('free-asset:')
}

function freeTextAnchor(overlay: TextOverlay): AnchorFrame {
  return {
    id: freeTextAnchorId(overlay.id),
    anchorTo: 'poster',
    edge: 'top',
    displacesMap: false,
    z: overlay.z_index ?? 30,
    userPinned: true,
    box: {
      left: percentUnit(overlay.x),
      top: percentUnit(overlay.y),
    },
  }
}

function freeAssetAnchor(asset: MapAsset): AnchorFrame {
  return {
    id: freeAssetAnchorId(asset.id),
    anchorTo: 'poster',
    edge: 'top',
    displacesMap: false,
    z: asset.z_index,
    userPinned: true,
    box: {
      left: percentUnit(asset.x),
      top: percentUnit(asset.y),
      width: percentUnit(asset.width),
      height: percentUnit(asset.height),
    },
  }
}

function freeOverlayAnchors(config: StyleConfig): AnchorFrame[] {
  return [
    ...(config.image_overlays ?? []).map(freeAssetAnchor),
    ...(config.text_overlays ?? []).map(freeTextAnchor),
  ]
}

export function resolveFreeOverlayBox(
  config: StyleConfig,
  elementId: string,
): { x?: number; y?: number; width?: number; height?: number; zIndex?: number } {
  const parsed = splitElementId(elementId)
  if (!parsed || (parsed.prefix !== 'text' && parsed.prefix !== 'asset')) return {}
  const anchorId = freeAnchorIdForElement(parsed.prefix, parsed.rawId)
  const anchor = config.poster_layout?.anchors?.find(item => item.id === anchorId && item.deleted !== true)
  const box = anchor?.box
  return {
    x: percentFromLength(box?.left),
    y: percentFromLength(box?.top),
    width: percentFromLength(box?.width),
    height: percentFromLength(box?.height),
    zIndex: anchor?.z,
  }
}

function mergeFreeAnchorBox(existing: AnchorBox | undefined, next: AnchorBox | undefined): AnchorBox | undefined {
  if (!existing) return next
  if (!next) return existing
  return { ...existing, ...next }
}

export function syncPosterOverlayAnchors(config: StyleConfig): StyleConfig {
  const nextFreeAnchors = freeOverlayAnchors(config)
  const liveFreeAnchorIds = new Set(nextFreeAnchors.map(anchor => anchor.id))
  const existingById = new Map((config.poster_layout?.anchors ?? []).map(anchor => [anchor.id, anchor]))
  const retained = (config.poster_layout?.anchors ?? [])
    .filter(anchor => !isFreeOverlayAnchorId(anchor.id) || liveFreeAnchorIds.has(anchor.id))
    .filter(anchor => !liveFreeAnchorIds.has(anchor.id))
  const mergedFree = nextFreeAnchors.map(anchor => {
    const existing = existingById.get(anchor.id)
    return {
      ...existing,
      ...anchor,
      box: mergeFreeAnchorBox(existing?.box, anchor.box),
      deleted: false,
    }
  })
  const posterLayout = {
    ...(config.poster_layout ?? {}),
    anchors: [...retained, ...mergedFree],
  }
  return {
    ...config,
    poster_layout: posterLayout.anchors.length || posterLayout.bands ? posterLayout : undefined,
  }
}

function removeFreeOverlayAnchor(config: StyleConfig, elementId: string): StyleConfig {
  const parsed = splitElementId(elementId)
  if (!parsed || (parsed.prefix !== 'text' && parsed.prefix !== 'asset')) return config
  const anchorId = freeAnchorIdForElement(parsed.prefix, parsed.rawId)
  const anchors = (config.poster_layout?.anchors ?? []).filter(anchor => anchor.id !== anchorId)
  const posterLayout = {
    ...(config.poster_layout ?? {}),
    anchors,
  }
  return {
    ...config,
    poster_layout: anchors.length || posterLayout.bands ? posterLayout : undefined,
  }
}

function nextZIndex(config: StyleConfig, base = 30) {
  const values = [
    ...(config.text_overlays ?? []).map(item => item.z_index ?? 30),
    ...(config.image_overlays ?? []).map(item => item.z_index),
    ...(config.icon_overlays ?? []).map(item => item.z_index ?? 35),
  ].filter(value => Number.isFinite(value))
  return Math.max(base, ...values) + 1
}

function textElement(overlay: TextOverlay, config: StyleConfig): PosterEditorElement {
  const anchorBox = resolveFreeOverlayBox(config, elementId('text', overlay.id))
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
    x: anchorBox.x ?? overlay.x,
    y: anchorBox.y ?? overlay.y,
    width: undefined,
    height: undefined,
    rotation: overlay.rotation ?? 0,
    color: overlay.color,
    zIndex: overlay.z_index ?? 30,
  }
}

function assetElement(asset: MapAsset, config: StyleConfig): PosterEditorElement {
  const anchorBox = resolveFreeOverlayBox(config, elementId('asset', asset.id))
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
    x: anchorBox.x ?? asset.x,
    y: anchorBox.y ?? asset.y,
    width: anchorBox.width ?? asset.width,
    height: anchorBox.height ?? asset.height,
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
          canDelete: editableSlot,
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
    ...(config.image_overlays ?? []).filter(item => opts.includeHidden || !item.hidden).map(item => assetElement(item, config)),
    ...(config.text_overlays ?? []).filter(item => opts.includeHidden || !item.hidden).map(item => textElement(item, config)),
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
    return syncPosterOverlayAnchors({
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
    })
  }

  if (parsed.prefix === 'asset') {
    return syncPosterOverlayAnchors({
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
    })
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
    config: syncPosterOverlayAnchors({
      ...config,
      text_overlays: [...(config.text_overlays ?? []), overlay],
    }),
  }
}

// ── Data-bound stat overlays (editor-v2 D3 + menu) ──────────────────────────
// North-star gesture 4: the Stat picker offers ONLY values the theme data
// contract has real data for — no fabricated values are insertable. Display
// text derives from the same ThemeDataContext the footer stats consume, with
// the same formatters, so editor and print agree by construction.

export interface PosterStatOption {
  binding: PosterStatBinding
  label: string
  value: string
}

export function formatPosterStatBinding(
  binding: PosterStatBinding,
  context: ThemeDataContext,
  opts: { distanceUnit?: 'mi' | 'km' } = {},
): string {
  switch (binding) {
    case 'distance': {
      if (!context.hasDistance || context.distanceKm == null) return ''
      if (opts.distanceUnit === 'km') return `${context.distanceKm.toFixed(1)} KM`
      const miles = formatDistanceMiles({ distance_km: context.distanceKm })
      return miles ? `${miles} MI` : ''
    }
    case 'elevation_gain': {
      if (context.elevationGainM == null) return ''
      const feet = formatElevationGainFeet({ elevation_gain_m: context.elevationGainM })
      return feet ? `${feet} FT GAIN` : ''
    }
    case 'date':
      return context.date ?? ''
    case 'coordinates': {
      const coords = formatCoordsFromPoint(context.coords) ?? formatCoordsFromBbox(context.bbox)
      return coords ? `${coords.lat} ${coords.lng}` : ''
    }
  }
}

/** The stat picker's options: only bindings whose formatted value is real. */
export function availablePosterStatBindings(
  context: ThemeDataContext,
  opts: { distanceUnit?: 'mi' | 'km' } = {},
): PosterStatOption[] {
  const LABELS: Record<PosterStatBinding, string> = {
    distance: 'Distance',
    elevation_gain: 'Elevation gain',
    date: 'Date',
    coordinates: 'Coordinates',
  }
  return (Object.keys(LABELS) as PosterStatBinding[])
    .map(binding => ({ binding, label: LABELS[binding], value: formatPosterStatBinding(binding, context, opts) }))
    .filter(option => option.value !== '')
}

export function addPosterEditorStat(
  config: StyleConfig,
  binding: PosterStatBinding,
  context: ThemeDataContext,
  patch: Partial<TextOverlay> = {},
): { config: StyleConfig; id: string } | null {
  const content = formatPosterStatBinding(binding, context, {
    distanceUnit: config.composition_footer_distance_unit === 'km' ? 'km' : 'mi',
  })
  // Contract: no real data, no insert. Callers should already have hidden
  // the option via availablePosterStatBindings.
  if (!content) return null
  return addPosterEditorText(config, {
    content,
    data_binding: binding,
    bold: true,
    ...patch,
  })
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

/** D3 + menu: add an icon whose BOX CENTER lands on the given poster percent. */
export function addPosterEditorIconCentered(
  config: StyleConfig,
  icon: PosterIconId,
  center: { x: number; y: number },
): { config: StyleConfig; id: string } {
  return addPosterEditorIcon(config, icon, {
    x: clampPercent(center.x - DEFAULT_ICON_SIZE / 2, 0, 100 - DEFAULT_ICON_SIZE),
    y: clampPercent(center.y - DEFAULT_ICON_SIZE / 2, 0, 100 - DEFAULT_ICON_SIZE),
  })
}

function cloneSparsePosterLayout(layout: PartialPosterLayout | undefined): PartialPosterLayout {
  return {
    ...(layout ?? {}),
    bands: Object.fromEntries(
      Object.entries(layout?.bands ?? {}).map(([bandId, band]) => [
        bandId,
        {
          ...band,
          padding: band.padding ? [...band.padding] as [number, number, number, number] : undefined,
          rows: band.rows?.map(row => ({
            ...row,
            cells: row.cells.map(cell => ({
              ...cell,
              padding: cell.padding ? [...cell.padding] as [number, number, number, number] : undefined,
              block: cell.block ? { ...cell.block } : undefined,
            })),
          })),
        },
      ]),
    ) as PartialPosterLayout['bands'],
    anchors: layout?.anchors?.map(anchor => ({ ...anchor })),
  }
}

function tombstoneCell(cell: ChromeGridCell): ChromeGridCell {
  return {
    ...cell,
    padding: cell.padding ? [...cell.padding] as [number, number, number, number] : undefined,
    deleted: true,
    block: undefined,
  }
}

function removeSlotElement(config: StyleConfig, slot: PosterTextSlot): StyleConfig {
  const layout = effectivePosterLayout(config)
  for (const [bandId, band] of Object.entries(layout.bands) as Array<[ChromeBandId, typeof layout.bands[ChromeBandId]]>) {
    for (const row of band.rows) {
      const cell = row.cells.find(candidate => candidate.block?.slot === slot)
      if (!cell) continue

      const nextLayout = cloneSparsePosterLayout(config.poster_layout)
      nextLayout.bands ??= {}
      const sparseBand = nextLayout.bands[bandId] ?? {}
      const sparseRows = sparseBand.rows ? sparseBand.rows.map(existing => ({ ...existing, cells: existing.cells.map(existingCell => ({ ...existingCell })) })) : []
      let sparseRow = sparseRows.find(candidate => candidate.id === row.id)
      if (!sparseRow) {
        sparseRow = { id: row.id, fr: row.fr, cells: [] } as ChromeGridRow
        sparseRows.push(sparseRow)
      }
      const tombstone = tombstoneCell(cell)
      const existingCellIndex = sparseRow.cells.findIndex(candidate => candidate.id === cell.id)
      if (existingCellIndex >= 0) sparseRow.cells[existingCellIndex] = tombstone
      else sparseRow.cells.push(tombstone)
      nextLayout.bands[bandId] = { ...sparseBand, rows: sparseRows }
      return { ...config, poster_layout: nextLayout }
    }
  }
  return config
}

export function removePosterEditorElement(config: StyleConfig, id: string): StyleConfig {
  const parsed = splitElementId(id)
  if (!parsed) return config
  if (parsed.prefix === 'slot') return removeSlotElement(config, parsed.rawId as PosterTextSlot)
  if (parsed.prefix === 'text') return removeFreeOverlayAnchor({ ...config, text_overlays: (config.text_overlays ?? []).filter(item => item.id !== parsed.rawId) }, id)
  if (parsed.prefix === 'asset') return removeFreeOverlayAnchor({ ...config, image_overlays: (config.image_overlays ?? []).filter(item => item.id !== parsed.rawId) }, id)
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
    return { id: elementId('text', copy.id), config: syncPosterOverlayAnchors({ ...config, text_overlays: [...(config.text_overlays ?? []), copy] }) }
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
    return { id: elementId('asset', copy.id), config: syncPosterOverlayAnchors({ ...config, image_overlays: [...(config.image_overlays ?? []), copy] }) }
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
