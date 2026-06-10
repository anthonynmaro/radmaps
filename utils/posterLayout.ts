import type {
  AnchorFrame,
  AnchorLength,
  AnchorLengthUnit,
  ChromeBand,
  ChromeBandId,
  ChromeBlock,
  CompositionId,
  ChromeGridCell,
  ChromeGridRow,
  PartialPosterLayout,
  PartialAnchorFrame,
  PosterLayout,
  PosterTextSlot,
  RouteStats,
  StyleConfig,
} from '~/types'

export const CHROME_BANDS: ChromeBandId[] = ['header', 'footer', 'railLeft', 'railRight']
export const CHROME_BAND_HEIGHT_BOUNDS = { min: 8, max: 34 } as const

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
  spacer: 'Spacer',
  text: 'Text',
}

export const CHROME_BLOCK_FIT_DEFAULTS: Record<ChromeBlock['kind'], Required<Pick<NonNullable<ChromeBlock['fit']>, 'minScale' | 'overflow'>> & Pick<NonNullable<ChromeBlock['fit']>, 'maxLines'>> = {
  title: { minScale: 0.42, maxLines: 3, overflow: 'clip' },
  subtitle: { minScale: 0.66, maxLines: 1, overflow: 'clamp' },
  eyebrow: { minScale: 0.64, maxLines: 1, overflow: 'clamp' },
  occasion: { minScale: 0.64, maxLines: 1, overflow: 'clamp' },
  coords: { minScale: 0.72, maxLines: 2, overflow: 'clip' },
  stat: { minScale: 0.76, maxLines: 2, overflow: 'clip' },
  note: { minScale: 0.66, maxLines: 2, overflow: 'clip' },
  brand: { minScale: 0.7, maxLines: 1, overflow: 'clamp' },
  vlabel: { minScale: 0.7, maxLines: 1, overflow: 'clamp' },
  logo: { minScale: 1, overflow: 'clip' },
  image: { minScale: 1, overflow: 'clip' },
  spacer: { minScale: 1, overflow: 'clip' },
  text: { minScale: 0.62, maxLines: 2, overflow: 'clip' },
}

export function chromeBlockFitDefaults(kind: ChromeBlock['kind']): NonNullable<ChromeBlock['fit']> {
  return { ...CHROME_BLOCK_FIT_DEFAULTS[kind] }
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
  const fit = patch.fit === undefined
    ? chromeBlockFitDefaults(kind)
    : { ...chromeBlockFitDefaults(kind), ...patch.fit }
  return {
    id,
    kind,
    slot,
    source: 'theme',
    align: 'left',
    valign: 'center',
    ...patch,
    fit,
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

function spacerBlock(id: string, label: string): ChromeBlock {
  return block(id, 'spacer', undefined, {
    source: 'theme',
    label,
    align: 'center',
    valign: 'center',
  })
}

function spacerRow(id: string, label: string, fr: number): ChromeGridRow {
  return row(id, [
    cell(`${id}-cell`, spacerBlock(`${id}-block`, label), {
      align: 'center',
      valign: 'center',
    }),
  ], { fr })
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

type AnchorUnitLength = Extract<AnchorLength, { kind: 'unit' }>

function unit(value: number, unitValue: AnchorLengthUnit): AnchorUnitLength {
  return { kind: 'unit', value, unit: unitValue }
}

function printBleed(): AnchorLength {
  return { kind: 'var', token: 'print-bleed', fallback: unit(0, 'px') }
}

function plusPrintBleed(value: number, unitValue: AnchorLengthUnit): AnchorLength {
  return {
    kind: 'calc',
    terms: [
      { op: '+', value: unit(value, unitValue) },
      { op: '+', value: printBleed() },
    ],
  }
}

function minLength(a: AnchorLength, b: AnchorLength): AnchorLength {
  return { kind: 'min', values: [a, b] }
}

function boxPadding(top: number, right: number, bottom: number, left: number): [AnchorLength, AnchorLength, AnchorLength, AnchorLength] {
  return [unit(top, 'cqh'), unit(right, 'cqw'), unit(bottom, 'cqh'), unit(left, 'cqw')]
}

export function clampChromeBandHeight(height: number) {
  return Math.round(Math.min(CHROME_BAND_HEIGHT_BOUNDS.max, Math.max(CHROME_BAND_HEIGHT_BOUNDS.min, height)) * 10) / 10
}

type ChromeLayoutRecipe = {
  headerHeight: number
  footerHeight: number
  headerTopFr: number
  headerMetaFr: number
  headerTitleFr: number
  headerSubFr: number
  headerBottomFr: number
  footerTopFr: number
  footerPrimaryFr: number
  footerBottomFr: number
  kickerScale: number
  metaScale: number
  titleScale: number
  subtitleScale: number
  occasionScale: number
  statScale: number
  dateScale: number
  coordsScale: number
  noteScale: number
}

const BASE_CHROME_RECIPE: ChromeLayoutRecipe = {
  headerHeight: 22,
  footerHeight: 14,
  headerTopFr: 0.62,
  headerMetaFr: 0.45,
  headerTitleFr: 2.35,
  headerSubFr: 0.85,
  headerBottomFr: 0.72,
  footerTopFr: 0.5,
  footerPrimaryFr: 1,
  footerBottomFr: 0.5,
  kickerScale: 0.8,
  metaScale: 0.72,
  titleScale: 1,
  subtitleScale: 0.8,
  occasionScale: 0.75,
  statScale: 1.35,
  dateScale: 1.05,
  coordsScale: 0.9,
  noteScale: 0.68,
}

const HEADER_DECOR_COMPOSITIONS = new Set<CompositionId>([
  'blueprint-grid',
  'blueprint-strava',
  'brutalist-slab',
  'darksky-stars',
  'modernist-block',
  'place-frame',
  'sea-chart',
  'splits-grid',
])

const FOOTER_NOTE_COMPOSITIONS = new Set<CompositionId>([
  'brutalist-slab',
  'darksky-stars',
])

const OCCASION_COMPOSITIONS = new Set<CompositionId>([
  'editorial-tall',
  'park-quad',
  'travel-banner',
  'riso-stack',
  'journal-spread',
  'darksky-stars',
  'botanical-plate',
])

function compositionUsesHeaderDecor(composition?: CompositionId) {
  return Boolean(composition && HEADER_DECOR_COMPOSITIONS.has(composition))
}

function compositionUsesFooterNote(composition?: CompositionId) {
  return Boolean(composition && FOOTER_NOTE_COMPOSITIONS.has(composition))
}

function compositionUsesOccasion(composition?: CompositionId) {
  return !composition || OCCASION_COMPOSITIONS.has(composition)
}

type FooterSlot = 'distance' | 'elevation_gain' | 'date' | 'coordinates' | 'brand'

function footerCellPatch(slot: FooterSlot, composition?: CompositionId): Partial<ChromeGridCell> {
  const technical = composition === 'blueprint-grid' || composition === 'blueprint-strava' || composition === 'splits-grid'
  const travel = composition === 'travel-banner' || composition === 'darksky-stars'
  const modern = composition === 'modernist-block' || composition === 'brutalist-slab'
  const race = composition === 'bib-numerals'

  if (slot === 'brand') {
    return { fr: technical ? 0.58 : modern ? 0.52 : 0.64, align: 'right', valign: 'center' }
  }
  if (slot === 'coordinates') {
    return {
      fr: technical ? 1.34 : travel ? 1.64 : race ? 1.2 : 1.42,
      align: technical ? 'left' : 'center',
      valign: 'center',
    }
  }
  if (slot === 'date') {
    return {
      fr: technical ? 1.06 : travel ? 1.14 : modern ? 1.1 : 1.0,
      align: technical || modern ? 'left' : 'center',
      valign: 'center',
    }
  }
  return {
    fr: technical ? 1.0 : travel ? 1.22 : race ? 1.1 : 1.08,
    align: 'left',
    valign: 'center',
  }
}

function footerBlockPatch(
  slot: Exclude<FooterSlot, 'brand'>,
  composition: CompositionId | undefined,
  recipe: ChromeLayoutRecipe,
): Partial<ChromeBlock> {
  const technical = composition === 'blueprint-grid' || composition === 'blueprint-strava' || composition === 'splits-grid'
  const travel = composition === 'travel-banner' || composition === 'darksky-stars'
  const modern = composition === 'modernist-block' || composition === 'brutalist-slab'
  const race = composition === 'bib-numerals'

  if (slot === 'distance' || slot === 'elevation_gain') {
    return {
      scale: recipe.statScale * (race ? 1.18 : modern ? 1.08 : travel ? 1.06 : technical ? 0.96 : 1),
    }
  }
  if (slot === 'date') {
    return {
      scale: recipe.dateScale * (race ? 1.04 : travel ? 0.96 : technical ? 0.9 : 0.92),
    }
  }
  return {
    scale: recipe.coordsScale * (travel ? 0.78 : technical ? 0.82 : modern ? 0.74 : 0.86),
  }
}

function chromeRecipeForComposition(composition?: CompositionId): ChromeLayoutRecipe {
  switch (composition) {
    case 'editorial-tall':
      return { ...BASE_CHROME_RECIPE, headerHeight: 22, footerHeight: 13, headerTopFr: 0.26, headerTitleFr: 2.85, headerBottomFr: 0.72, statScale: 1.14, noteScale: 0.62 }
    case 'park-quad':
    case 'botanical-plate':
      return { ...BASE_CHROME_RECIPE, headerHeight: 22, footerHeight: 14, headerTopFr: 0.48, headerTitleFr: 2.28, headerBottomFr: 0.58, footerTopFr: 0.52, footerBottomFr: 0.52 }
    case 'travel-banner':
    case 'darksky-stars':
      return { ...BASE_CHROME_RECIPE, headerHeight: 17, footerHeight: 12.5, headerTopFr: 0.34, headerMetaFr: 0.34, headerTitleFr: 1.95, headerSubFr: 0.55, headerBottomFr: 0.36, footerTopFr: 0.42, footerBottomFr: 0.42, statScale: 1.14, noteScale: 0.56 }
    case 'riso-stack':
      return { ...BASE_CHROME_RECIPE, headerHeight: 23, footerHeight: 13, headerTopFr: 0.48, headerTitleFr: 2.5, headerBottomFr: 0.42, statScale: 1.24, noteScale: 0.58 }
    case 'blueprint-grid':
      return { ...BASE_CHROME_RECIPE, headerHeight: 17.5, footerHeight: 12.5, headerTopFr: 0.34, headerTitleFr: 1.78, headerBottomFr: 0.36, kickerScale: 0.7, metaScale: 0.62, statScale: 1.08, noteScale: 0.54 }
    case 'blueprint-strava':
    case 'splits-grid':
      return { ...BASE_CHROME_RECIPE, headerHeight: 19, footerHeight: 16, headerTopFr: 0.32, headerTitleFr: 1.98, headerBottomFr: 0.34, footerTopFr: 0.36, footerPrimaryFr: 1.26, footerBottomFr: 0.36, kickerScale: 0.7, metaScale: 0.62, statScale: 1.42, dateScale: 1.06, noteScale: 0.54 }
    case 'journal-spread':
      return { ...BASE_CHROME_RECIPE, headerHeight: 23, footerHeight: 13.5, headerTopFr: 0.62, headerTitleFr: 2.35, headerBottomFr: 0.74, subtitleScale: 0.72, statScale: 1.12, noteScale: 0.62 }
    case 'modernist-block':
      return { ...BASE_CHROME_RECIPE, headerHeight: 34.2, footerHeight: 0, headerTopFr: 0.34, headerMetaFr: 0.3, headerTitleFr: 2.9, headerSubFr: 0.48, headerBottomFr: 0.3, titleScale: 1.1, subtitleScale: 0.66, statScale: 1.5, dateScale: 1.14, coordsScale: 0.7, noteScale: 0.52 }
    case 'place-frame':
      return { ...BASE_CHROME_RECIPE, headerHeight: 18, footerHeight: 0, headerTopFr: 0.18, headerMetaFr: 0.38, headerTitleFr: 1.96, headerSubFr: 0.42, headerBottomFr: 0.22, kickerScale: 0.78, metaScale: 0.74, titleScale: 1.08, subtitleScale: 0.66 }
    case 'sea-chart':
      return { ...BASE_CHROME_RECIPE, headerHeight: 20, footerHeight: 0, headerTopFr: 0.12, headerMetaFr: 0.46, headerTitleFr: 2.15, headerSubFr: 0.52, headerBottomFr: 0.18, kickerScale: 0.9, metaScale: 0.76, titleScale: 1.2, subtitleScale: 0.76 }
    case 'bib-numerals':
      return { ...BASE_CHROME_RECIPE, headerHeight: 21, footerHeight: 15.5, headerTopFr: 0.38, headerTitleFr: 2.2, headerBottomFr: 0.42, footerTopFr: 0.42, footerPrimaryFr: 1.18, footerBottomFr: 0.42, titleScale: 0.95, statScale: 1.56, dateScale: 1.08 }
    case 'brutalist-slab':
      return { ...BASE_CHROME_RECIPE, headerHeight: 22, footerHeight: 14, headerTopFr: 0.24, headerTitleFr: 2.58, headerBottomFr: 0.25, titleScale: 1.06, subtitleScale: 0.64, statScale: 1.56, coordsScale: 0.7, noteScale: 0.52 }
    default:
      return BASE_CHROME_RECIPE
  }
}

export function defaultPosterLayout(styleConfig: StyleConfig, stats?: RouteStats): PosterLayout {
  const labels = styleConfig.labels
  const showDate = labels.show_date && hasVisibleText(stats?.date)
  const showLocation = labels.show_location !== false
  const showElevationGain =
    labels.show_elevation_gain &&
    (Boolean(stats?.elevation_gain_m) || hasVisibleText(styleConfig.poster_text_overrides?.elevation_gain?.text))
  const composition = styleConfig.composition
  const hasOccasion = compositionUsesOccasion(composition) && hasVisibleText(styleConfig.occasion_text)
  const isUsgsHeritage = styleConfig.color_theme === 'usgs-vintage'
  const isBlueprint = styleConfig.color_theme === 'blueprint' && composition === 'blueprint-grid'
  const isNightRide = styleConfig.color_theme === 'night-ride' && composition === 'splits-grid'
  const recipe = isUsgsHeritage
    ? {
        ...chromeRecipeForComposition(composition),
        headerHeight: 12.6,
        footerHeight: 5.05,
        headerTopFr: 0.08,
        headerMetaFr: 0,
        headerTitleFr: 1.45,
        headerSubFr: 0.42,
        headerBottomFr: 0.08,
        titleScale: 1.38,
        subtitleScale: 0.92,
      }
    : isNightRide
      ? {
          ...chromeRecipeForComposition(composition),
          headerHeight: 14,
          footerHeight: 14,
          headerTopFr: 0.2,
          headerMetaFr: 0.2,
          headerTitleFr: 1.72,
          headerSubFr: 0.42,
          headerBottomFr: 0.16,
          footerTopFr: 0.2,
          footerPrimaryFr: 1.32,
          footerBottomFr: 0.54,
          statScale: 1.52,
          dateScale: 1.12,
          coordsScale: 0.9,
        }
    : chromeRecipeForComposition(composition)

  const headerRows: ChromeGridRow[] = [
    spacerRow('header-spacer-top', 'Top spacer', recipe.headerTopFr),
  ]
  const usesHeaderDecor = compositionUsesHeaderDecor(composition) ||
    styleConfig.color_theme === 'relief-shaded' ||
    styleConfig.color_theme === 'contour-wash'

  if (usesHeaderDecor && !isUsgsHeritage) {
    headerRows.push(row('header-meta', [
      cell('hdr-kicker', block('hdr-kicker-block', 'eyebrow', 'composition_kicker', { scale: recipe.kickerScale })),
      cell('hdr-meta', block('hdr-meta-block', 'coords', 'composition_meta', { align: 'right', scale: recipe.metaScale })),
    ], { fr: recipe.headerMetaFr }))
  }
  if (labels.show_title !== false) {
    headerRows.push(row('header-title', [
      cell('hdr-title', block('hdr-title-block', 'title', 'trail_name', { scale: recipe.titleScale })),
    ], { fr: recipe.headerTitleFr }))
  }
  const headerSubCells: ChromeGridCell[] = []
  if (showLocation) {
    headerSubCells.push(cell('hdr-location', block('hdr-location-block', 'subtitle', 'location_text', { scale: recipe.subtitleScale })))
  }
  if (hasOccasion) {
    headerSubCells.push(cell('hdr-occasion', block('hdr-occasion-block', 'occasion', 'occasion_text', { align: 'right', scale: recipe.occasionScale })))
  }
  if (headerSubCells.length) headerRows.push(row('header-subtitle', headerSubCells, { fr: recipe.headerSubFr }))
  headerRows.push(spacerRow('header-spacer-bottom', 'Bottom spacer', recipe.headerBottomFr))

  const footerCells: ChromeGridCell[] = []
  if (labels.show_distance) {
    footerCells.push(cell(
      'ft-distance',
      block('ft-distance-block', 'stat', 'distance', footerBlockPatch('distance', composition, recipe)),
      isBlueprint
        ? { ...footerCellPatch('distance', composition), fr: 1.34, align: 'left' }
        : footerCellPatch('distance', composition),
    ))
  }
  if (showElevationGain) {
    footerCells.push(cell(
      'ft-gain',
      block('ft-gain-block', 'stat', 'elevation_gain', {
        ...footerBlockPatch('elevation_gain', composition, recipe),
        align: isBlueprint ? 'center' : undefined,
      }),
      isBlueprint
        ? { ...footerCellPatch('elevation_gain', composition), fr: 1.5, align: 'center' }
        : footerCellPatch('elevation_gain', composition),
    ))
  }
  if (showDate) {
    if (isBlueprint && footerCells.length) {
      footerCells.push(cell('ft-blueprint-titleblock-spacer', undefined, {
        fr: 0.82,
        align: 'center',
        valign: 'center',
      }))
    }
    footerCells.push(cell(
      'ft-date',
      block('ft-date-block', 'stat', 'date', footerBlockPatch('date', composition, recipe)),
      isBlueprint
        ? { ...footerCellPatch('date', composition), align: 'right', fr: 1.86 }
        : footerCellPatch('date', composition),
    ))
  }
  if (showLocation && !isBlueprint) {
    footerCells.push(cell(
      'ft-coords',
      block('ft-coords-block', 'coords', 'coordinates', footerBlockPatch('coordinates', composition, recipe)),
      footerCellPatch('coordinates', composition),
    ))
  }
  if (compositionUsesFooterNote(composition)) {
    footerCells.push(cell('ft-note', block('ft-note-block', 'note', 'composition_footer', { align: 'center', scale: recipe.noteScale })))
  }
  if (styleConfig.show_branding !== false && !isBlueprint) {
    footerCells.push(cell('ft-brand', block('ft-brand-block', 'brand', undefined, { align: 'right', text: 'RADMAPS', scale: 0.58 }), footerCellPatch('brand', composition)))
  }

  const layout: PosterLayout = {
    bands: {
      header: band({ height: recipe.headerHeight, rows: headerRows }),
      footer: band({ height: recipe.footerHeight, rows: [
        spacerRow('footer-spacer-top', 'Top spacer', recipe.footerTopFr),
        row('footer-primary', footerCells.length ? footerCells : [cell('ft-empty')], { fr: recipe.footerPrimaryFr }),
        spacerRow('footer-spacer-bottom', 'Bottom spacer', recipe.footerBottomFr),
      ] }),
      railLeft: band({
        width: 0,
        rows: [],
      }),
      railRight: band({
        width: 0,
        rows: [],
      }),
    },
  }
  return {
    ...layout,
    anchors: [
      ...bandsToAnchorFrames(layout),
      ...overMapTitleblockAnchorFrames(styleConfig),
    ],
  }
}

function overMapTitleblockAnchorFrames(styleConfig: StyleConfig): AnchorFrame[] {
  switch (styleConfig.composition) {
    case 'place-frame':
      return [{
        id: 'free-place-frame-titleblock',
        anchorTo: 'map',
        edge: 'center',
        displacesMap: false,
        z: 18,
        box: {
          left: unit(13.5, 'cqw'),
          right: unit(13.5, 'cqw'),
          top: unit(50, '%'),
          padding: boxPadding(2.65, 3.8, 2.65, 3.8),
          transform: [{ kind: 'translateY', value: unit(-50, '%') }],
          decorations: ['cartouche-titleblock'],
        },
      }]
    case 'sea-chart':
      return [{
        id: 'free-sea-chart-titleblock',
        anchorTo: 'map',
        edge: 'bottom',
        displacesMap: false,
        z: 18,
        box: {
          left: plusPrintBleed(5.2, 'cqw'),
          bottom: plusPrintBleed(4, 'cqh'),
          width: minLength(unit(82, 'cqw'), unit(54, 'cqh')),
          padding: boxPadding(0, 0, 0, 0),
          decorations: ['sea-chart-titleblock'],
        },
      }]
    case 'art-wash': {
      const pleinAir = styleConfig.color_theme === 'plein-air'
      const contourWash = styleConfig.color_theme === 'contour-wash'
      return [{
        id: 'free-art-wash-titleblock',
        anchorTo: 'map',
        edge: 'bottom',
        displacesMap: false,
        z: 18,
        box: pleinAir
          ? {
              left: plusPrintBleed(6.9, 'cqw'),
              bottom: plusPrintBleed(7.4, 'cqh'),
              width: minLength(unit(55, 'cqw'), unit(33, 'cqh')),
              padding: boxPadding(1.05, 2.1, 1.1, 2.1),
              decorations: ['art-wash-titleblock'],
            }
          : {
              left: unit(50, '%'),
              bottom: plusPrintBleed(contourWash ? 6.9 : 7, 'cqh'),
              width: minLength(unit(72, 'cqw'), unit(34, 'cqh')),
              padding: contourWash ? boxPadding(0.65, 2.2, 0.85, 2.2) : boxPadding(1.55, 3.5, 1.55, 3.5),
              transform: [{ kind: 'translateX', value: unit(-50, '%') }],
              decorations: ['art-wash-titleblock'],
            },
      }]
    }
    default:
      return []
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

function cloneAnchor(anchor: AnchorFrame): AnchorFrame {
  return {
    ...anchor,
    offset: anchor.offset ? { ...anchor.offset } : undefined,
    size: anchor.size ? { ...anchor.size } : undefined,
    fit: anchor.fit ? { ...anchor.fit } : undefined,
    rows: anchor.rows?.map(rowValue => ({
      ...rowValue,
      cells: rowValue.cells.map(cellValue => ({
        ...cellValue,
        block: cellValue.block ? { ...cellValue.block } : undefined,
      })),
    })),
    box: anchor.box
      ? {
          ...anchor.box,
          padding: anchor.box.padding ? [...anchor.box.padding] as typeof anchor.box.padding : undefined,
          transform: anchor.box.transform?.map(transform => ({ ...transform })),
          decorations: anchor.box.decorations ? [...anchor.box.decorations] : undefined,
        }
      : undefined,
  }
}

function mergeAnchors(defaultAnchors: AnchorFrame[] = [], editedAnchors?: PartialAnchorFrame[]) {
  if (!editedAnchors) return defaultAnchors.map(cloneAnchor)
  const byId = new Map<string, AnchorFrame>(defaultAnchors.map(anchor => [
    anchor.id,
    cloneAnchor(anchor),
  ]))
  const order = defaultAnchors.map(anchor => anchor.id)

  for (const edit of editedAnchors) {
    const existing = byId.get(edit.id)
    const next = {
      ...(existing ?? {}),
      ...edit,
      offset: edit.offset === undefined ? existing?.offset : { ...(existing?.offset ?? {}), ...edit.offset },
      size: edit.size === undefined ? existing?.size : { ...(existing?.size ?? {}), ...edit.size },
      fit: edit.fit === undefined ? existing?.fit : { ...(existing?.fit ?? {}), ...edit.fit },
      box: edit.box === undefined ? existing?.box : { ...(existing?.box ?? {}), ...edit.box },
      rows: edit.rows === undefined ? existing?.rows : mergeRows(existing?.rows ?? [], edit.rows),
    } as AnchorFrame
    byId.set(edit.id, next)
    if (!order.includes(edit.id)) order.push(edit.id)
  }

  return order
    .map(id => byId.get(id))
    .filter((anchor): anchor is AnchorFrame => Boolean(anchor && !anchor.deleted))
    .map(cloneAnchor)
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
  const defaultFreeAnchors = (defaultLayout.anchors ?? []).filter(anchor => !anchor.id.startsWith('band-'))
  if (!sparse) {
    const bands = {
      header: cloneBand(defaultLayout.bands.header),
      footer: cloneBand(defaultLayout.bands.footer),
      railLeft: cloneBand(defaultLayout.bands.railLeft),
      railRight: cloneBand(defaultLayout.bands.railRight),
    }
    return {
      bands,
      anchors: mergeAnchors([
        ...bandsToAnchorFrames({ bands }),
        ...defaultFreeAnchors,
      ]),
    }
  }

  const bands = {} as PosterLayout['bands']
  for (const bandId of CHROME_BANDS) {
    const defaults = defaultLayout.bands[bandId]
    const edits = sparse.bands?.[bandId]
    bands[bandId] = {
      ...cloneBand(defaults),
      ...edits,
      height: edits?.height == null ? defaults.height : clampChromeBandHeight(edits.height),
      padding: edits?.padding ? [...edits.padding] as [number, number, number, number] : defaults.padding,
      rows: mergeRows(defaults.rows, edits?.rows),
    }
  }
  return {
    bands: {
      header: cloneBand(bands.header),
      footer: cloneBand(bands.footer),
      railLeft: cloneBand(bands.railLeft),
      railRight: cloneBand(bands.railRight),
    },
    anchors: mergeAnchors([
      ...bandsToAnchorFrames({ bands }),
      ...defaultFreeAnchors,
    ], sparse.anchors),
  }
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
      height: bandPatch.height == null ? bands[bandId]?.height : clampChromeBandHeight(bandPatch.height),
    }
  }

  const anchorsById = new Map<string, NonNullable<PartialPosterLayout['anchors']>[number]>()
  for (const anchor of current?.anchors ?? []) anchorsById.set(anchor.id, { ...anchor })
  for (const anchor of patch.anchors ?? []) {
    anchorsById.set(anchor.id, {
      ...(anchorsById.get(anchor.id) ?? {}),
      ...anchor,
    })
  }

  return {
    ...(Object.keys(bands).length ? { bands } : {}),
    ...(anchorsById.size ? { anchors: Array.from(anchorsById.values()) } : {}),
  }
}

function bandAnchorEdge(bandId: ChromeBandId) {
  if (bandId === 'footer') return 'bottom'
  if (bandId === 'railLeft') return 'left'
  if (bandId === 'railRight') return 'right'
  return 'top'
}

function bandAnchorSize(bandId: ChromeBandId, bandValue: ChromeBand): AnchorFrame['size'] | undefined {
  if (bandId === 'railLeft' || bandId === 'railRight') {
    return bandValue.width != null ? { width: unit(bandValue.width, '%') } : undefined
  }
  return bandValue.height != null ? { height: unit(bandValue.height, '%') } : undefined
}

export function bandsToAnchorFrames(layout: Pick<PosterLayout, 'bands'>): AnchorFrame[] {
  return CHROME_BANDS.map((bandId) => {
    const bandValue = layout.bands[bandId]
    return {
      id: `band-${bandId}`,
      anchorTo: 'poster',
      edge: bandAnchorEdge(bandId),
      displacesMap: true,
      size: bandAnchorSize(bandId, bandValue),
      rows: cloneBand(bandValue).rows,
    }
  })
}
