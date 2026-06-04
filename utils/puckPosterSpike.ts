import type { RouteStats, StyleConfig } from '~/types'

export type PuckPosterBandId = 'header' | 'footer'
export type PuckPosterBlockKind = 'text' | 'image' | 'icon' | 'spacer'
export type PuckPosterAspect = '2:3' | '3:2'

export interface PuckPosterComponent {
  type: string
  props: Record<string, unknown>
}

export interface PuckPosterData {
  root?: {
    props?: Record<string, unknown>
    [key: string]: unknown
  }
  content?: PuckPosterComponent[]
  zones?: Record<string, PuckPosterComponent[]>
}

export interface RadMapsPosterDocumentBlock {
  id: string
  kind: PuckPosterBlockKind
  text?: string
  role?: string
  align?: 'left' | 'center' | 'right'
  icon?: 'mountain' | 'pin' | 'route'
  assetRole?: 'image' | 'logo'
  heightFr?: number
}

export interface RadMapsPosterDocumentCell {
  id: string
  widthFr: number
  blocks: RadMapsPosterDocumentBlock[]
}

export interface RadMapsPosterDocumentRow {
  id: string
  kind: 'content' | 'spacer'
  heightFr: number
  cells: RadMapsPosterDocumentCell[]
}

export interface RadMapsPosterDocument {
  version: 1
  source: 'puck-spike'
  aspect: PuckPosterAspect
  themeId: string
  bands: {
    header: { rows: RadMapsPosterDocumentRow[] }
    map: {
      locked: true
      renderer: 'MapPreview.vue'
      heightFr: number
    }
    footer: { rows: RadMapsPosterDocumentRow[] }
  }
}

const contentBlockTypes = new Set(['TextBlock', 'ImageBlock', 'IconBlock', 'SpacerBlock'])
const textAlignments = new Set(['left', 'center', 'right'])
const knownIcons = new Set(['mountain', 'pin', 'route'])

export function createInitialPuckPosterData(styleConfig: StyleConfig, stats?: RouteStats): PuckPosterData {
  const trailName = styleConfig.trail_name || 'Kickapoo Endurance Race'
  const location = styleConfig.location_text || stats?.location || 'Kickapoo State Park'
  const occasion = styleConfig.occasion_text || 'Complete trail network'
  const date = stats?.date ?? '2026-05-10'
  const distance = stats?.distance_km ? `${(stats.distance_km * 0.621371).toFixed(1)} miles` : '19.1 miles'
  const gain = stats?.elevation_gain_m ? `${Math.round(stats.elevation_gain_m * 3.28084).toLocaleString()} ft gain` : '4,331 ft gain'

  return {
    root: {
      props: {
        aspect: '2:3',
        themeId: styleConfig.color_theme ?? 'editorial-minimal',
      },
    },
    content: [
      {
        type: 'Row',
        props: {
          id: 'header-meta',
          band: 'header',
          label: 'Meta header',
          columns: 2,
          heightFr: 0.52,
          col1: [
            {
              type: 'TextBlock',
              props: {
                id: 'field-record',
                role: 'caption',
                text: 'NO. 01 - A FIELD RECORD',
                align: 'left',
              },
            },
          ],
          col2: [
            {
              type: 'TextBlock',
              props: {
                id: 'trail-meta',
                role: 'caption',
                text: `${location} - ${date}`,
                align: 'right',
              },
            },
          ],
          col3: [],
        },
      },
      {
        type: 'Row',
        props: {
          id: 'header-title',
          band: 'header',
          label: 'Title header',
          columns: 1,
          heightFr: 1.35,
          col1: [
            {
              type: 'TextBlock',
              props: {
                id: 'trail-title',
                role: 'title',
                text: trailName,
                align: 'left',
              },
            },
            {
              type: 'TextBlock',
              props: {
                id: 'trail-location',
                role: 'caption',
                text: location,
                align: 'left',
              },
            },
          ],
          col2: [],
          col3: [],
        },
      },
      {
        type: 'Row',
        props: {
          id: 'header-note',
          band: 'header',
          label: 'Note header',
          columns: 1,
          heightFr: 0.55,
          col1: [
            {
              type: 'TextBlock',
              props: {
                id: 'trail-occasion',
                role: 'caption',
                text: occasion,
                align: 'left',
              },
            },
          ],
          col3: [],
        },
      },
      {
        type: 'MapBand',
        props: {
          id: 'map-band',
          heightFr: 4.8,
        },
      },
      {
        type: 'Row',
        props: {
          id: 'footer-stats',
          band: 'footer',
          label: 'Stats footer',
          columns: 3,
          heightFr: 0.95,
          col1: [
            {
              type: 'TextBlock',
              props: {
                id: 'distance-stat',
                role: 'stat',
                text: distance,
                align: 'left',
              },
            },
          ],
          col2: [
            {
              type: 'TextBlock',
              props: {
                id: 'gain-stat',
                role: 'stat',
                text: gain,
                align: 'center',
              },
            },
          ],
          col3: [
            {
              type: 'IconBlock',
              props: {
                id: 'brand-icon',
                icon: 'mountain',
                label: 'RadMaps mark',
              },
            },
          ],
        },
      },
    ],
    zones: {},
  }
}

export function puckPosterDataToDocument(data: PuckPosterData): RadMapsPosterDocument {
  const rootProps = readProps(data.root)
  const content = Array.isArray(data.content) ? data.content : []
  const mapBand = content.find(component => component.type === 'MapBand')
  const document: RadMapsPosterDocument = {
    version: 1,
    source: 'puck-spike',
    aspect: readAspect(rootProps.aspect),
    themeId: readText(rootProps.themeId, 'editorial-minimal'),
    bands: {
      header: { rows: [] },
      map: {
        locked: true,
        renderer: 'MapPreview.vue',
        heightFr: clampNumber(readNumber(readProps(mapBand).heightFr, 4.8), 1, 8),
      },
      footer: { rows: [] },
    },
  }

  for (const component of content) {
    if (component.type === 'Row') {
      const row = componentToRow(component)
      if (row) document.bands[row.bandId].rows.push(row.row)
    }

    if (component.type === 'SpacerRow') {
      const row = spacerComponentToRow(component)
      document.bands[row.bandId].rows.push(row.row)
    }
  }

  return document
}

function componentToRow(component: PuckPosterComponent): { bandId: PuckPosterBandId; row: RadMapsPosterDocumentRow } | null {
  const props = readProps(component)
  const bandId = readBandId(props.band)
  if (!bandId) return null
  const columnCount = clampNumber(readNumber(props.columns, 1), 1, 3)
  const cells: RadMapsPosterDocumentCell[] = []

  for (let index = 1; index <= columnCount; index += 1) {
    const blocks = readSlotComponents(props[`col${index}`])
      .map(componentToBlock)
      .filter((block): block is RadMapsPosterDocumentBlock => Boolean(block))

    cells.push({
      id: `${readText(props.id, 'row')}-cell-${index}`,
      widthFr: 1,
      blocks,
    })
  }

  return {
    bandId,
    row: {
      id: readText(props.id, 'row'),
      kind: 'content',
      heightFr: clampNumber(readNumber(props.heightFr, 1), 0.25, 4),
      cells,
    },
  }
}

function spacerComponentToRow(component: PuckPosterComponent): { bandId: PuckPosterBandId; row: RadMapsPosterDocumentRow } {
  const props = readProps(component)
  const bandId = readBandId(props.band) ?? 'header'
  const id = readText(props.id, 'spacer-row')
  const heightFr = clampNumber(readNumber(props.heightFr, 0.75), 0.25, 4)
  return {
    bandId,
    row: {
      id,
      kind: 'spacer',
      heightFr,
      cells: [{
        id: `${id}-cell-1`,
        widthFr: 1,
        blocks: [{
          id: `${id}-block`,
          kind: 'spacer',
          heightFr,
        }],
      }],
    },
  }
}

function componentToBlock(component: PuckPosterComponent): RadMapsPosterDocumentBlock | null {
  if (!contentBlockTypes.has(component.type)) return null
  const props = readProps(component)
  const id = readText(props.id, `${component.type.toLowerCase()}-block`)

  if (component.type === 'TextBlock') {
    return {
      id,
      kind: 'text',
      text: plainText(props.text),
      role: readText(props.role, 'body'),
      align: readAlignment(props.align),
    }
  }

  if (component.type === 'ImageBlock') {
    return {
      id,
      kind: 'image',
      assetRole: props.assetRole === 'logo' ? 'logo' : 'image',
    }
  }

  if (component.type === 'IconBlock') {
    return {
      id,
      kind: 'icon',
      icon: knownIcons.has(String(props.icon)) ? props.icon as RadMapsPosterDocumentBlock['icon'] : 'mountain',
    }
  }

  return {
    id,
    kind: 'spacer',
    heightFr: clampNumber(readNumber(props.heightFr, 0.5), 0.25, 4),
  }
}

function readSlotComponents(value: unknown): PuckPosterComponent[] {
  if (Array.isArray(value)) return value.filter(isPuckComponent)
  if (value && typeof value === 'object' && Array.isArray((value as { content?: unknown }).content)) {
    return (value as { content: unknown[] }).content.filter(isPuckComponent)
  }
  return []
}

function isPuckComponent(value: unknown): value is PuckPosterComponent {
  return Boolean(value && typeof value === 'object' && typeof (value as PuckPosterComponent).type === 'string')
}

function readProps(component: PuckPosterComponent | PuckPosterData['root'] | undefined): Record<string, unknown> {
  if (!component || typeof component !== 'object') return {}
  const props = (component as { props?: unknown }).props
  return props && typeof props === 'object' ? props as Record<string, unknown> : {}
}

function readBandId(value: unknown): PuckPosterBandId | null {
  return value === 'footer' ? 'footer' : value === 'header' ? 'header' : null
}

function readAspect(value: unknown): PuckPosterAspect {
  return value === '3:2' ? '3:2' : '2:3'
}

function readAlignment(value: unknown): RadMapsPosterDocumentBlock['align'] {
  return textAlignments.has(String(value)) ? value as RadMapsPosterDocumentBlock['align'] : 'left'
}

function readText(value: unknown, fallback = '') {
  return typeof value === 'string' && value.trim() ? plainText(value) : fallback
}

function plainText(value: unknown) {
  if (typeof value !== 'string') return ''
  return value.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
}

function readNumber(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}
