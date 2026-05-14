import type {
  ChromeBand,
  ChromeBandId,
  ChromeBlock,
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

export const BLOCK_KINDS_FOR_BAND: Record<ChromeBandId, ChromeBlock['kind'][]> = {
  header: ['title', 'subtitle', 'eyebrow', 'occasion', 'coords', 'stat', 'brand', 'logo', 'text'],
  footer: ['stat', 'coords', 'note', 'brand', 'subtitle', 'logo', 'text'],
  railLeft: ['vlabel', 'note', 'image', 'text'],
  railRight: ['vlabel', 'note', 'image', 'text'],
}

function clampRows(rows?: number) {
  if (rows == null || Number.isNaN(rows)) return undefined
  return Math.max(1, Math.min(6, Math.round(rows)))
}

function normalizeBand(band: ChromeBand): ChromeBand {
  return {
    ...band,
    rows: clampRows(band.rows),
  }
}

function block(
  id: string,
  kind: ChromeBlock['kind'],
  slot: PosterTextSlot | undefined,
  col: number,
  row: number,
  span: number,
  patch: Partial<ChromeBlock> = {},
): ChromeBlock {
  return {
    id,
    kind,
    slot,
    col,
    row,
    span,
    rowSpan: 1,
    align: 'left',
    valign: 'top',
    ...patch,
  }
}

function hasVisibleText(value?: string) {
  return Boolean(value?.trim())
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

  const header: ChromeBlock[] = [
    block('hdr-kicker', 'eyebrow', 'composition_kicker', 1, 1, 5),
    block('hdr-meta', 'coords', 'composition_meta', 8, 1, 5, { align: 'right' }),
  ]
  if (labels.show_title !== false) {
    header.push(block('hdr-title', 'title', 'trail_name', 1, 2, 12, { rowSpan: 2, valign: 'center' }))
  }
  if (showLocation) {
    header.push(block('hdr-location', 'subtitle', 'location_text', 1, 4, 7))
  }
  if (hasOccasion) {
    header.push(block('hdr-occasion', 'occasion', 'occasion_text', 8, 4, 5, { align: 'right' }))
  }

  const footer: ChromeBlock[] = []
  let col = 1
  if (labels.show_distance) {
    footer.push(block('ft-distance', 'stat', 'distance', col, 1, 3, { rowSpan: 2, valign: 'bottom' }))
    col += 3
  }
  if (showElevationGain) {
    footer.push(block('ft-gain', 'stat', 'elevation_gain', col, 1, 3, { rowSpan: 2, valign: 'bottom' }))
    col += 3
  }
  if (showDate) {
    footer.push(block('ft-date', 'stat', 'date', col, 1, 2, { rowSpan: 2, valign: 'bottom' }))
    col += 2
  }
  if (showLocation) {
    footer.push(block('ft-coords', 'coords', 'coordinates', Math.min(col, 9), 1, 2, { rowSpan: 2, valign: 'bottom' }))
  }
  if (composition !== 'modernist-block') {
    footer.push(block('ft-note', 'note', 'composition_footer', 10, 1, 3, { align: 'right' }))
  }
  if (styleConfig.show_branding !== false) {
    footer.push(block('ft-brand', 'brand', undefined, 10, 2, 3, { align: 'right', text: 'RADMAPS' }))
  }

  return {
    bands: {
      header: { height: 22, cols: 12, rows: 4 },
      footer: { height: 14, cols: 12, rows: 2 },
      railLeft: { width: modernistRails ? 5 : 0, cols: 4, rows: 1 },
      railRight: { width: composition === 'modernist-block' ? 5 : 0, cols: 4, rows: 1 },
    },
    blocks: {
      header,
      footer,
      railLeft: modernistRails
        ? [block('rail-left-label', 'vlabel', 'composition_side_rail', 1, 1, 1, { text: 'RAD' })]
        : [],
      railRight: composition === 'modernist-block'
        ? [block('rail-right-label', 'vlabel', 'composition_side_rail', 1, 1, 1, { text: 'RAD' })]
        : [],
    },
  }
}

function mergeBlocks(defaults: ChromeBlock[], edits: ChromeBlock[] | undefined): ChromeBlock[] {
  if (!edits?.length) return defaults
  const byId = new Map(defaults.map(block => [block.id, { ...block }]))
  const order = defaults.map(block => block.id)

  for (const edit of edits) {
    const existing = byId.get(edit.id)
    if (edit.deleted) {
      byId.set(edit.id, { ...(existing ?? edit), ...edit, deleted: true })
      if (!order.includes(edit.id)) order.push(edit.id)
      continue
    }
    byId.set(edit.id, { ...(existing ?? {}), ...edit })
    if (!order.includes(edit.id)) order.push(edit.id)
  }

  return order
    .map(id => byId.get(id))
    .filter((block): block is ChromeBlock => block != null && block.deleted !== true)
}

export function mergePosterLayout(defaultLayout: PosterLayout, sparse?: PartialPosterLayout): PosterLayout {
  if (!sparse) return defaultLayout

  const bands = {} as PosterLayout['bands']
  const blocks = {} as PosterLayout['blocks']
  for (const band of CHROME_BANDS) {
    bands[band] = normalizeBand({
      ...defaultLayout.bands[band],
      ...(sparse.bands?.[band] ?? {}),
    })
    blocks[band] = mergeBlocks(defaultLayout.blocks[band] ?? [], sparse.blocks?.[band])
  }
  return { bands, blocks }
}

export function effectivePosterLayout(styleConfig: StyleConfig, stats?: RouteStats): PosterLayout {
  return mergePosterLayout(defaultPosterLayout(styleConfig, stats), styleConfig.poster_layout)
}

export function patchPosterLayout(
  current: PartialPosterLayout | undefined,
  patch: PartialPosterLayout,
): PartialPosterLayout {
  return {
    bands: {
      ...(current?.bands ?? {}),
      ...(patch.bands ?? {}),
    },
    blocks: {
      ...(current?.blocks ?? {}),
      ...(patch.blocks ?? {}),
    },
  }
}
