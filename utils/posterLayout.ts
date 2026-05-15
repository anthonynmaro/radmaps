import type {
  ChromeBand,
  ChromeBandId,
  ChromeBlock,
  ChromeGridCell,
  ChromeGridRow,
  PartialPosterLayout,
  PosterLayout,
  PosterTextSlot,
  RouteStats,
  StyleConfig,
} from '~/types'

export const CHROME_BANDS: ChromeBandId[] = ['header', 'footer', 'railLeft', 'railRight']

export const CHROME_BLOCK_KIND_LABELS: Record<ChromeBlock['kind'], string> = {
  title: 'Title',
  subtitle: 'Subtitle',
  eyebrow: 'Eyebrow',
  occasion: 'Occasion',
  coords: 'Coordinates',
  stat: 'Stat',
  note: 'Note',
  brand: 'Brand',
  vlabel: 'Vertical label',
  logo: 'Logo',
  image: 'Image',
  text: 'Text',
}

function hasVisibleText(value?: string) {
  return Boolean(value?.trim())
}

function block(
  id: string,
  kind: ChromeBlock['kind'],
  slot: PosterTextSlot | undefined,
  patch: Partial<ChromeBlock> = {},
): ChromeBlock {
  return {
    id,
    kind,
    slot,
    source: 'theme',
    align: 'left',
    valign: 'center',
    ...patch,
  }
}

function cell(id: string, blockValue?: ChromeBlock, patch: Partial<ChromeGridCell> = {}): ChromeGridCell {
  return {
    id,
    fr: 1,
    align: blockValue?.align ?? 'left',
    valign: blockValue?.valign ?? 'center',
    block: blockValue,
    ...patch,
  }
}

function row(id: string, cells: ChromeGridCell[], patch: Partial<ChromeGridRow> = {}): ChromeGridRow {
  return {
    id,
    fr: 1,
    cells,
    ...patch,
  }
}

function band(patch: Omit<ChromeBand, 'rows'> & { rows: ChromeGridRow[] }): ChromeBand {
  return patch
}

export function defaultPosterLayout(styleConfig: StyleConfig, stats?: RouteStats): PosterLayout {
  const labels = styleConfig.labels
  const showDate = labels.show_date && hasVisibleText(stats?.date)
  const showLocation = labels.show_location !== false
  const showElevationGain =
    labels.show_elevation_gain &&
    (Boolean(stats?.elevation_gain_m) || hasVisibleText(styleConfig.poster_text_overrides?.elevation_gain?.text))
  const composition = styleConfig.composition
  const hasOccasion = composition !== 'modernist-block' && hasVisibleText(styleConfig.occasion_text)
  const modernistRails = composition === 'modernist-block' || composition === 'journal-spread'

  const headerRows: ChromeGridRow[] = [
    row('header-meta', [
      cell('hdr-kicker', block('hdr-kicker-block', 'eyebrow', 'composition_kicker', { scale: 0.8 })),
      cell('hdr-meta', block('hdr-meta-block', 'coords', 'composition_meta', { align: 'right', scale: 0.72 })),
    ], { fr: 0.55 }),
  ]
  if (labels.show_title !== false) {
    headerRows.push(row('header-title', [
      cell('hdr-title', block('hdr-title-block', 'title', 'trail_name', { scale: 1 })),
    ], { fr: 2.6 }))
  }
  const headerSubCells: ChromeGridCell[] = []
  if (showLocation) {
    headerSubCells.push(cell('hdr-location', block('hdr-location-block', 'subtitle', 'location_text', { scale: 0.8 })))
  }
  if (hasOccasion) {
    headerSubCells.push(cell('hdr-occasion', block('hdr-occasion-block', 'occasion', 'occasion_text', { align: 'right', scale: 0.75 })))
  }
  if (headerSubCells.length) headerRows.push(row('header-subtitle', headerSubCells, { fr: 0.85 }))

  const footerCells: ChromeGridCell[] = []
  if (labels.show_distance) {
    footerCells.push(cell('ft-distance', block('ft-distance-block', 'stat', 'distance', { scale: 1.35 })))
  }
  if (showElevationGain) {
    footerCells.push(cell('ft-gain', block('ft-gain-block', 'stat', 'elevation_gain', { scale: 1.35 })))
  }
  if (showDate) {
    footerCells.push(cell('ft-date', block('ft-date-block', 'stat', 'date', { scale: 1.05 })))
  }
  if (showLocation) {
    footerCells.push(cell('ft-coords', block('ft-coords-block', 'coords', 'coordinates', { scale: 0.9 })))
  }
  if (composition !== 'modernist-block') {
    footerCells.push(cell('ft-note', block('ft-note-block', 'note', 'composition_footer', { align: 'center', scale: 0.68 })))
  }
  if (styleConfig.show_branding !== false) {
    footerCells.push(cell('ft-brand', block('ft-brand-block', 'brand', undefined, { align: 'right', text: 'RADMAPS', scale: 0.72 })))
  }

  return {
    bands: {
      header: band({ height: 22, rows: headerRows }),
      footer: band({ height: 14, rows: [row('footer-primary', footerCells.length ? footerCells : [cell('ft-empty')])] }),
      railLeft: band({
        width: modernistRails ? 5 : 0,
        rows: modernistRails
          ? [row('rail-left-primary', [cell('rail-left-label', block('rail-left-label-block', 'vlabel', 'composition_side_rail', { text: 'RAD', align: 'center' }))])]
          : [],
      }),
      railRight: band({
        width: composition === 'modernist-block' ? 5 : 0,
        rows: composition === 'modernist-block'
          ? [row('rail-right-primary', [cell('rail-right-label', block('rail-right-label-block', 'vlabel', 'composition_side_rail', { text: 'RAD', align: 'center' }))])]
          : [],
      }),
    },
  }
}

function cloneBand(bandValue: ChromeBand): ChromeBand {
  return {
    ...bandValue,
    padding: bandValue.padding ? [...bandValue.padding] as [number, number, number, number] : undefined,
    rows: bandValue.rows.map(rowValue => ({
      ...rowValue,
      cells: rowValue.cells.map(cellValue => ({
        ...cellValue,
        block: cellValue.block ? { ...cellValue.block } : undefined,
      })),
    })),
  }
}

function mergeCells(defaultCells: ChromeGridCell[], editedCells?: ChromeGridCell[]) {
  if (!editedCells) return defaultCells
  const byId = new Map<string, ChromeGridCell>(defaultCells.map(cellValue => [
    cellValue.id,
    { ...cellValue, block: cellValue.block ? { ...cellValue.block } : undefined },
  ]))
  const order = defaultCells.map(cellValue => cellValue.id)

  for (const edit of editedCells) {
    const existing = byId.get(edit.id)
    const next = {
      ...(existing ?? {}),
      ...edit,
      block: edit.block === undefined
        ? existing?.block
        : edit.block ? { ...(existing?.block ?? {}), ...edit.block } : undefined,
    } as ChromeGridCell
    byId.set(edit.id, next)
    if (!order.includes(edit.id)) order.push(edit.id)
  }

  return order
    .map(id => byId.get(id))
    .filter((cellValue): cellValue is ChromeGridCell => Boolean(cellValue && !cellValue.deleted))
}

function mergeRows(defaultRows: ChromeGridRow[], editedRows?: ChromeGridRow[]) {
  if (!editedRows) return defaultRows
  const byId = new Map<string, ChromeGridRow>(defaultRows.map(rowValue => [
    rowValue.id,
    { ...rowValue, cells: mergeCells(rowValue.cells) },
  ]))
  const order = defaultRows.map(rowValue => rowValue.id)

  for (const edit of editedRows) {
    const existing = byId.get(edit.id)
    const next = {
      ...(existing ?? {}),
      ...edit,
      cells: mergeCells(existing?.cells ?? [], edit.cells),
    } as ChromeGridRow
    byId.set(edit.id, next)
    if (!order.includes(edit.id)) order.push(edit.id)
  }

  return order
    .map(id => byId.get(id))
    .filter((rowValue): rowValue is ChromeGridRow => Boolean(rowValue && !rowValue.deleted))
}

export function mergePosterLayout(defaultLayout: PosterLayout, sparse?: PartialPosterLayout): PosterLayout {
  if (!sparse) return {
    bands: {
      header: cloneBand(defaultLayout.bands.header),
      footer: cloneBand(defaultLayout.bands.footer),
      railLeft: cloneBand(defaultLayout.bands.railLeft),
      railRight: cloneBand(defaultLayout.bands.railRight),
    },
  }

  const bands = {} as PosterLayout['bands']
  for (const bandId of CHROME_BANDS) {
    const defaults = defaultLayout.bands[bandId]
    const edits = sparse.bands?.[bandId]
    bands[bandId] = {
      ...cloneBand(defaults),
      ...edits,
      padding: edits?.padding ? [...edits.padding] as [number, number, number, number] : defaults.padding,
      rows: mergeRows(defaults.rows, edits?.rows),
    }
  }
  return { bands }
}

export function effectivePosterLayout(styleConfig: StyleConfig, stats?: RouteStats): PosterLayout {
  return mergePosterLayout(defaultPosterLayout(styleConfig, stats), styleConfig.poster_layout)
}

export function patchPosterLayout(
  current: PartialPosterLayout | undefined,
  patch: PartialPosterLayout,
): PartialPosterLayout {
  const bands = { ...(current?.bands ?? {}) }
  for (const bandId of CHROME_BANDS) {
    const bandPatch = patch.bands?.[bandId]
    if (!bandPatch) continue
    bands[bandId] = {
      ...(bands[bandId] ?? {}),
      ...bandPatch,
    }
  }
  return {
    bands,
  }
}
