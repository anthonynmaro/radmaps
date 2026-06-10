import type {
  ChromeBand,
  ChromeBandId,
  ChromeBlock,
  ChromeBlockAlign,
  ChromeGridCell,
  ChromeGridRow,
  FontFamily,
  PartialPosterLayout,
  PosterTextSlot,
  RouteStats,
  StyleConfig,
} from '~/types'
import { effectivePosterLayout } from '~/utils/posterLayout'
import { buildThemeDataContext, type ThemeDataContextInput } from '~/utils/themeDataContract'
import { formatDistanceMiles, formatElevationGainFeet, formatPosterLocationLine } from '~/utils/render/posterFormatters'

export type PosterLayoutDraftBandId = 'header' | 'footer'
export type PosterLayoutDraftRowKind = 'content' | 'spacer'
export type PosterLayoutDraftBlockKind = 'text' | 'image' | 'icon' | 'spacer'

export interface PosterLayoutDraftBlock {
  id: string
  kind: PosterLayoutDraftBlockKind
  label?: string
  text?: string
  icon?: 'mountain' | 'pin' | 'route'
  source?: 'theme' | 'user'
  slot?: PosterTextSlot
  chromeKind?: ChromeBlock['kind']
  align?: ChromeBlockAlign
  bold?: boolean
  italic?: boolean
  color?: string
  bg_color?: string
  font_family?: FontFamily
  font_size_pt?: number
  opacity?: number
  scale?: number
}

export interface PosterLayoutDraftCell {
  id: string
  widthFr: number
  blocks: PosterLayoutDraftBlock[]
}

export interface PosterLayoutDraftRow {
  id: string
  kind: PosterLayoutDraftRowKind
  heightFr: number
  cells: PosterLayoutDraftCell[]
}

export interface PosterLayoutDraftBand {
  id: PosterLayoutDraftBandId
  label: string
  rows: PosterLayoutDraftRow[]
}

export interface PosterLayoutDraft {
  version: 1
  bands: Record<PosterLayoutDraftBandId, PosterLayoutDraftBand>
}

export interface PosterLayoutDraftBlockLocation {
  bandId: PosterLayoutDraftBandId
  rowIndex: number
  cellIndex: number
  blockIndex: number
}

export const POSTER_LAYOUT_DRAFT_BANDS: PosterLayoutDraftBandId[] = ['header', 'footer']

let draftIdCounter = 0

export function createPosterDraftId(prefix = 'draft') {
  draftIdCounter += 1
  return `${prefix}-${draftIdCounter}`
}

export function posterLayoutToDraft(styleConfig: StyleConfig, stats?: RouteStats, dataInput?: ThemeDataContextInput): PosterLayoutDraft {
  const layout = effectivePosterLayout(styleConfig, stats, dataInput)
  return {
    version: 1,
    bands: {
      header: bandToDraft('header', layout.bands.header, styleConfig, stats, dataInput),
      footer: bandToDraft('footer', layout.bands.footer, styleConfig, stats, dataInput),
    },
  }
}

export function draftToPosterLayout(draft: PosterLayoutDraft): PartialPosterLayout {
  const bands: Partial<Record<ChromeBandId, Partial<ChromeBand>>> = {}

  for (const bandId of POSTER_LAYOUT_DRAFT_BANDS) {
    bands[bandId] = {
      rows: draft.bands[bandId].rows.map(row => ({
        id: row.id,
        fr: roundFr(row.heightFr),
        cells: row.cells.map(cell => ({
          id: cell.id,
          fr: roundFr(cell.widthFr),
          block: draftBlockToChromeBlock(cell.blocks[0]),
        })),
      })),
    }
  }

  return { bands }
}

export function clonePosterLayoutDraft(draft: PosterLayoutDraft): PosterLayoutDraft {
  return {
    version: 1,
    bands: {
      header: cloneDraftBand(draft.bands.header),
      footer: cloneDraftBand(draft.bands.footer),
    },
  }
}

export function createDraftBlock(kind: PosterLayoutDraftBlockKind, patch: Partial<PosterLayoutDraftBlock> = {}): PosterLayoutDraftBlock {
  const labels: Record<PosterLayoutDraftBlockKind, string> = {
    text: 'Text',
    image: 'Image',
    icon: 'Icon',
    spacer: 'Spacer',
  }
  return {
    id: patch.id ?? createPosterDraftId(kind),
    kind,
    source: patch.source ?? 'user',
    label: patch.label ?? labels[kind],
    text: patch.text ?? (kind === 'text' ? 'Write here...' : undefined),
    icon: patch.icon ?? (kind === 'icon' ? 'mountain' : undefined),
    chromeKind: patch.chromeKind,
    slot: patch.slot,
    align: patch.align ?? 'left',
    bold: patch.bold,
    italic: patch.italic,
    color: patch.color,
    bg_color: patch.bg_color,
    font_family: patch.font_family,
    font_size_pt: patch.font_size_pt,
    opacity: patch.opacity,
    scale: patch.scale,
  }
}

export function createDraftCell(block?: PosterLayoutDraftBlock, patch: Partial<PosterLayoutDraftCell> = {}): PosterLayoutDraftCell {
  return {
    id: patch.id ?? createPosterDraftId('cell'),
    widthFr: patch.widthFr ?? 1,
    blocks: patch.blocks ?? (block ? [block] : []),
  }
}

export function createDraftRow(
  kind: PosterLayoutDraftRowKind,
  blocks: PosterLayoutDraftBlock[] = [],
  patch: Partial<PosterLayoutDraftRow> = {},
): PosterLayoutDraftRow {
  return {
    id: patch.id ?? createPosterDraftId(kind === 'spacer' ? 'spacer-row' : 'row'),
    kind,
    heightFr: patch.heightFr ?? (kind === 'spacer' ? 0.7 : 1),
    cells: patch.cells ?? [createDraftCell(undefined, { blocks })],
  }
}

export function appendDraftRow(
  draft: PosterLayoutDraft,
  bandId: PosterLayoutDraftBandId,
  row: PosterLayoutDraftRow,
): PosterLayoutDraft {
  const next = clonePosterLayoutDraft(draft)
  next.bands[bandId].rows.push(row)
  return next
}

export function appendDraftBlock(
  draft: PosterLayoutDraft,
  bandId: PosterLayoutDraftBandId,
  kind: PosterLayoutDraftBlockKind,
  rowId?: string,
  cellId?: string,
): { draft: PosterLayoutDraft; blockId: string } {
  const next = clonePosterLayoutDraft(draft)
  const band = next.bands[bandId]
  const block = createDraftBlock(kind)
  if (kind === 'spacer') {
    band.rows.push(createDraftRow('spacer', [block], { heightFr: 0.75 }))
    return { draft: next, blockId: block.id }
  }

  const targetRow = rowId ? band.rows.find(row => row.id === rowId) : band.rows.find(row => row.kind === 'content')
  const targetCell = targetRow
    ? (cellId ? targetRow.cells.find(cell => cell.id === cellId) : targetRow.cells[0])
    : undefined

  if (targetCell && !targetCell.blocks.length) {
    targetCell.blocks = [block]
  } else {
    band.rows.push(createDraftRow('content', [block]))
  }
  return { draft: next, blockId: block.id }
}

export function updateDraftBlockText(
  draft: PosterLayoutDraft,
  blockId: string,
  text: string,
): PosterLayoutDraft {
  const next = clonePosterLayoutDraft(draft)
  const found = findDraftBlock(next, blockId)
  if (found) found.block.text = text
  return next
}

export function duplicateDraftBlock(draft: PosterLayoutDraft, blockId: string): { draft: PosterLayoutDraft; blockId: string | null } {
  const next = clonePosterLayoutDraft(draft)
  const found = findDraftBlock(next, blockId)
  if (!found) return { draft: next, blockId: null }
  const copy = {
    ...found.block,
    id: createPosterDraftId(found.block.kind),
    source: 'user' as const,
    slot: undefined,
    chromeKind: found.block.kind === 'spacer' ? 'spacer' as const : found.block.chromeKind,
  }
  const row = next.bands[found.location.bandId].rows[found.location.rowIndex]
  const cell = row.cells[found.location.cellIndex]
  if (cell.blocks.length <= 1) {
    row.cells.splice(found.location.cellIndex + 1, 0, createDraftCell(copy, {
      widthFr: Math.max(0.5, cell.widthFr),
    }))
  } else {
    cell.blocks.splice(found.location.blockIndex + 1, 0, copy)
  }
  return { draft: next, blockId: copy.id }
}

export function deleteDraftBlock(draft: PosterLayoutDraft, blockId: string): PosterLayoutDraft {
  const next = clonePosterLayoutDraft(draft)
  const found = findDraftBlock(next, blockId)
  if (!found) return next
  const row = next.bands[found.location.bandId].rows[found.location.rowIndex]
  const cell = row.cells[found.location.cellIndex]
  cell.blocks.splice(found.location.blockIndex, 1)
  if (!cell.blocks.length && row.cells.length > 1) row.cells.splice(found.location.cellIndex, 1)
  if (row.cells.every(candidate => candidate.blocks.length === 0)) {
    next.bands[found.location.bandId].rows.splice(found.location.rowIndex, 1)
  }
  return next
}

export function moveDraftBlockBeside(
  draft: PosterLayoutDraft,
  blockId: string,
  targetBlockId: string,
): PosterLayoutDraft {
  if (blockId === targetBlockId) return draft
  const next = clonePosterLayoutDraft(draft)
  const source = removeBlockFromDraft(next, blockId)
  const target = source ? findDraftBlock(next, targetBlockId) : null
  if (!source || !target) return clonePosterLayoutDraft(draft)

  const row = next.bands[target.location.bandId].rows[target.location.rowIndex]
  const targetCell = row.cells[target.location.cellIndex]
  row.kind = row.cells.some(cell => cell.blocks.some(block => block.kind !== 'spacer')) ? 'content' : row.kind
  row.cells.splice(target.location.cellIndex + 1, 0, createDraftCell(source, {
    widthFr: targetCell.widthFr,
  }))
  normalizeCellWidths(row)
  return next
}

export function moveDraftBlockBelow(
  draft: PosterLayoutDraft,
  blockId: string,
  targetRowId: string,
  bandId?: PosterLayoutDraftBandId,
): PosterLayoutDraft {
  const next = clonePosterLayoutDraft(draft)
  const source = removeBlockFromDraft(next, blockId)
  if (!source) return clonePosterLayoutDraft(draft)
  const target = findDraftRow(next, targetRowId, bandId)
  if (!target) return clonePosterLayoutDraft(draft)
  next.bands[target.bandId].rows.splice(target.rowIndex + 1, 0, createDraftRow(
    source.kind === 'spacer' ? 'spacer' : 'content',
    [source],
    { heightFr: source.kind === 'spacer' ? 0.75 : 1 },
  ))
  return next
}

export function resizeDraftCell(
  draft: PosterLayoutDraft,
  bandId: PosterLayoutDraftBandId,
  rowId: string,
  cellId: string,
  deltaFr: number,
): PosterLayoutDraft {
  const next = clonePosterLayoutDraft(draft)
  const row = next.bands[bandId].rows.find(candidate => candidate.id === rowId)
  if (!row || row.cells.length < 2) return next
  const cellIndex = row.cells.findIndex(candidate => candidate.id === cellId)
  const nextCell = row.cells[cellIndex + 1]
  const cell = row.cells[cellIndex]
  if (!cell || !nextCell) return next
  const available = cell.widthFr + nextCell.widthFr
  const nextWidth = clampFr(cell.widthFr + deltaFr, 0.35, available - 0.35)
  cell.widthFr = roundFr(nextWidth)
  nextCell.widthFr = roundFr(available - nextWidth)
  return next
}

export function resizeDraftRow(
  draft: PosterLayoutDraft,
  bandId: PosterLayoutDraftBandId,
  rowId: string,
  deltaFr: number,
): PosterLayoutDraft {
  const next = clonePosterLayoutDraft(draft)
  const row = next.bands[bandId].rows.find(candidate => candidate.id === rowId)
  if (row) row.heightFr = roundFr(clampFr(row.heightFr + deltaFr, 0.25, 4))
  return next
}

export function findDraftBlock(
  draft: PosterLayoutDraft,
  blockId: string,
): { block: PosterLayoutDraftBlock; location: PosterLayoutDraftBlockLocation } | null {
  for (const bandId of POSTER_LAYOUT_DRAFT_BANDS) {
    const rows = draft.bands[bandId].rows
    for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
      const row = rows[rowIndex]
      for (let cellIndex = 0; cellIndex < row.cells.length; cellIndex += 1) {
        const cell = row.cells[cellIndex]
        const blockIndex = cell.blocks.findIndex(block => block.id === blockId)
        if (blockIndex >= 0) {
          return {
            block: cell.blocks[blockIndex],
            location: { bandId, rowIndex, cellIndex, blockIndex },
          }
        }
      }
    }
  }
  return null
}

function bandToDraft(
  bandId: PosterLayoutDraftBandId,
  band: ChromeBand,
  styleConfig: StyleConfig,
  stats?: RouteStats,
  dataInput?: ThemeDataContextInput,
): PosterLayoutDraftBand {
  return {
    id: bandId,
    label: bandId === 'header' ? 'Header' : 'Footer',
    rows: band.rows.map(row => rowToDraft(row, styleConfig, stats, dataInput)),
  }
}

function rowToDraft(row: ChromeGridRow, styleConfig: StyleConfig, stats?: RouteStats, dataInput?: ThemeDataContextInput): PosterLayoutDraftRow {
  const cells = row.cells
    .filter(cell => !cell.deleted)
    .map(cell => cellToDraft(cell, styleConfig, stats, dataInput))
  const isSpacer = cells.length > 0 && cells.every(cell =>
    cell.blocks.length > 0 && cell.blocks.every(block => block.kind === 'spacer'),
  )
  return {
    id: row.id,
    kind: isSpacer ? 'spacer' : 'content',
    heightFr: row.fr ?? 1,
    cells,
  }
}

function cellToDraft(cell: ChromeGridCell, styleConfig: StyleConfig, stats?: RouteStats, dataInput?: ThemeDataContextInput): PosterLayoutDraftCell {
  return {
    id: cell.id,
    widthFr: cell.fr ?? 1,
    blocks: cell.block && !cell.block.deleted
      ? [chromeBlockToDraftBlock(cell.block, styleConfig, stats, dataInput)]
      : [],
  }
}

function chromeBlockToDraftBlock(block: ChromeBlock, styleConfig: StyleConfig, stats?: RouteStats, dataInput?: ThemeDataContextInput): PosterLayoutDraftBlock {
  return {
    id: block.id,
    kind: chromeKindToDraftKind(block.kind),
    label: block.label ?? chromeBlockLabel(block),
    text: resolveChromeBlockText(block, styleConfig, stats, dataInput),
    source: block.source ?? 'theme',
    slot: block.slot,
    chromeKind: block.kind,
    align: block.align,
    bold: block.bold,
    italic: block.italic,
    color: block.color,
    bg_color: block.bg_color,
    font_family: block.font_family,
    font_size_pt: block.font_size_pt,
    opacity: block.opacity,
    scale: block.scale,
  }
}

function draftBlockToChromeBlock(block?: PosterLayoutDraftBlock): ChromeBlock | undefined {
  if (!block) return undefined
  const chromeKind = block.chromeKind ?? draftKindToChromeKind(block.kind)
  const preserveSlotRenderer = Boolean(block.slot && block.source === 'theme')
  return {
    id: block.id,
    kind: chromeKind,
    source: block.source,
    slot: block.kind === 'text' ? block.slot : undefined,
    text: block.kind === 'spacer' || preserveSlotRenderer ? undefined : block.text,
    label: block.label,
    align: block.align,
    bold: block.bold,
    italic: block.italic,
    color: block.color,
    bg_color: block.bg_color,
    font_family: block.font_family,
    font_size_pt: block.font_size_pt,
    opacity: block.opacity,
    scale: block.scale,
  }
}

function cloneDraftBand(band: PosterLayoutDraftBand): PosterLayoutDraftBand {
  return {
    ...band,
    rows: band.rows.map(row => ({
      ...row,
      cells: row.cells.map(cell => ({
        ...cell,
        blocks: cell.blocks.map(block => ({ ...block })),
      })),
    })),
  }
}

function removeBlockFromDraft(draft: PosterLayoutDraft, blockId: string): PosterLayoutDraftBlock | null {
  const found = findDraftBlock(draft, blockId)
  if (!found) return null
  const row = draft.bands[found.location.bandId].rows[found.location.rowIndex]
  const cell = row.cells[found.location.cellIndex]
  const [block] = cell.blocks.splice(found.location.blockIndex, 1)
  if (!cell.blocks.length && row.cells.length > 1) row.cells.splice(found.location.cellIndex, 1)
  if (row.cells.every(candidate => candidate.blocks.length === 0)) {
    draft.bands[found.location.bandId].rows.splice(found.location.rowIndex, 1)
  }
  return block
}

function findDraftRow(
  draft: PosterLayoutDraft,
  rowId: string,
  bandId?: PosterLayoutDraftBandId,
): { bandId: PosterLayoutDraftBandId; rowIndex: number } | null {
  const bands = bandId ? [bandId] : POSTER_LAYOUT_DRAFT_BANDS
  for (const candidateBandId of bands) {
    const rowIndex = draft.bands[candidateBandId].rows.findIndex(row => row.id === rowId)
    if (rowIndex >= 0) return { bandId: candidateBandId, rowIndex }
  }
  return null
}

function normalizeCellWidths(row: PosterLayoutDraftRow) {
  if (row.cells.length < 2) return
  const total = row.cells.reduce((sum, cell) => sum + cell.widthFr, 0)
  if (total <= 0) return
  for (const cell of row.cells) {
    cell.widthFr = roundFr((cell.widthFr / total) * row.cells.length)
  }
}

function chromeKindToDraftKind(kind: ChromeBlock['kind']): PosterLayoutDraftBlockKind {
  if (kind === 'spacer') return 'spacer'
  if (kind === 'image' || kind === 'logo') return 'image'
  return 'text'
}

function draftKindToChromeKind(kind: PosterLayoutDraftBlockKind): ChromeBlock['kind'] {
  if (kind === 'spacer') return 'spacer'
  if (kind === 'image') return 'image'
  return 'text'
}

function chromeBlockLabel(block: ChromeBlock) {
  if (block.label) return block.label
  if (block.slot === 'trail_name') return 'Title'
  if (block.slot === 'location_text') return 'Location'
  if (block.slot === 'occasion_text') return 'Description'
  if (block.slot === 'distance') return 'Distance'
  if (block.slot === 'elevation_gain') return 'Gain'
  if (block.slot === 'date') return 'Date'
  if (block.slot === 'coordinates') return 'Coordinates'
  if (block.slot === 'composition_kicker') return 'Eyebrow'
  if (block.slot === 'composition_meta') return 'Coordinates'
  if (block.slot === 'composition_footer') return 'Note'
  if (block.slot === 'composition_side_rail') return 'Brand'
  if (block.kind === 'stat') return 'Stat'
  if (block.kind === 'coords') return 'Coordinates'
  return block.kind.replace(/^\w/, value => value.toUpperCase())
}

function resolveChromeBlockText(block: ChromeBlock, styleConfig: StyleConfig, stats?: RouteStats, dataInput?: ThemeDataContextInput) {
  if (block.text || block.value) return block.text ?? block.value
  const context = buildThemeDataContext({ ...dataInput, styleConfig, stats })
  const slotText: Partial<Record<PosterTextSlot, string>> = {
    trail_name: styleConfig.trail_name,
    location_text: styleConfig.location_text,
    occasion_text: styleConfig.occasion_text,
    distance: context.hasDistance && stats ? `${formatDistanceMiles(stats)} miles` : undefined,
    elevation_gain: context.hasElevation && stats ? `${formatElevationGainFeet(stats)} ft gain` : undefined,
    date: stats?.date,
    coordinates: formatPosterLocationLine(context),
    composition_kicker: 'NO. 01 - A FIELD RECORD',
    composition_meta: stats?.date ? `${styleConfig.location_text} - ${stats.date}` : styleConfig.location_text,
    composition_footer: 'Drawn from route telemetry and terrain data',
    composition_side_rail: 'RADMAPS',
  }
  return block.slot ? slotText[block.slot] : block.label
}

function roundFr(value: number) {
  return Math.round(value * 100) / 100
}

function clampFr(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}
