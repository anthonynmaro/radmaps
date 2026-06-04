import { describe, expect, it } from 'vitest'
import { DEFAULT_STYLE_CONFIG, type RouteStats, type StyleConfig } from '../types'
import {
  createDraftBlock,
  createDraftCell,
  createDraftRow,
  draftToPosterLayout,
  moveDraftBlockBeside,
  posterLayoutToDraft,
  resizeDraftCell,
  resizeDraftRow,
  updateDraftBlockText,
  type PosterLayoutDraft,
} from '../utils/posterLayoutDraft'

const stats: RouteStats = {
  distance_km: 19.1,
  elevation_gain_m: 1320,
  elevation_loss_m: 1280,
  max_elevation_m: 390,
  min_elevation_m: 180,
  date: '2026-05-10',
  location: 'Kickapoo State Park',
}

const baseConfig: StyleConfig = {
  ...DEFAULT_STYLE_CONFIG,
  trail_name: 'Kickapoo Endurance Race',
  location_text: 'Kickapoo State Park',
  occasion_text: 'Complete trail network',
  composition: 'editorial-tall',
  labels: {
    ...DEFAULT_STYLE_CONFIG.labels,
    show_date: true,
  },
}

describe('poster layout draft adapter', () => {
  it('maps the current poster_layout chrome into a structured header/footer draft', () => {
    const draft = posterLayoutToDraft(baseConfig, stats)

    expect(draft.version).toBe(1)
    expect(draft.bands.header.rows.some(row => row.kind === 'spacer')).toBe(true)
    expect(draft.bands.footer.rows.some(row => row.kind === 'spacer')).toBe(true)
    expect(draft.bands.header.rows.flatMap(row => row.cells).flatMap(cell => cell.blocks).some(block => block.slot === 'trail_name')).toBe(true)
  })

  it('writes draft rows, cells, and blocks back to poster_layout without raw builder fields', () => {
    const unsafeBlock = {
      ...createDraftBlock('text', { id: 'unsafe-text', text: 'Inline only' }),
      html: '<script>alert(1)</script>',
      css: '.x{position:fixed}',
      style: { position: 'fixed' },
    } as ReturnType<typeof createDraftBlock> & Record<string, unknown>
    const draft: PosterLayoutDraft = {
      version: 1,
      bands: {
        header: {
          id: 'header',
          label: 'Header',
          rows: [{
            id: 'header-custom',
            kind: 'content',
            heightFr: 1.4,
            cells: [
              createDraftCell(unsafeBlock, { id: 'left-cell', widthFr: 1.25 }),
              createDraftCell(createDraftBlock('icon', { id: 'icon-block', icon: 'mountain' }), { id: 'right-cell', widthFr: 0.75 }),
            ],
          }],
        },
        footer: {
          id: 'footer',
          label: 'Footer',
          rows: [createDraftRow('spacer', [createDraftBlock('spacer', { id: 'footer-space' })], {
            id: 'footer-spacer',
            heightFr: 0.6,
          })],
        },
      },
    }

    const layout = draftToPosterLayout(draft)
    const serialized = JSON.stringify(layout)

    expect(layout.bands?.header?.rows?.[0]?.fr).toBe(1.4)
    expect(layout.bands?.header?.rows?.[0]?.cells[0]?.fr).toBe(1.25)
    expect(layout.bands?.footer?.rows?.[0]?.cells[0]?.block?.kind).toBe('spacer')
    expect(serialized).not.toContain('script')
    expect(serialized).not.toContain('position:fixed')
    expect(serialized).not.toContain('"style"')
  })

  it('updates inline text in the draft without changing row or cell geometry', () => {
    const draft = posterLayoutToDraft(baseConfig, stats)
    const titleBlock = draft.bands.header.rows
      .flatMap(row => row.cells)
      .flatMap(cell => cell.blocks)
      .find(block => block.slot === 'trail_name')
    expect(titleBlock).toBeTruthy()

    const titleRow = draft.bands.header.rows.find(row => row.cells.some(cell => cell.blocks.some(block => block.id === titleBlock!.id)))
    const before = {
      rowFr: titleRow?.heightFr,
      cellFr: titleRow?.cells[0]?.widthFr,
    }
    const next = updateDraftBlockText(draft, titleBlock!.id, 'New inline title')
    const nextTitleRow = next.bands.header.rows.find(row => row.cells.some(cell => cell.blocks.some(block => block.id === titleBlock!.id)))

    expect(nextTitleRow?.heightFr).toBe(before.rowFr)
    expect(nextTitleRow?.cells[0]?.widthFr).toBe(before.cellFr)
    expect(nextTitleRow?.cells[0]?.blocks[0]?.text).toBe('New inline title')
  })

  it('supports creating columns by moving a block beside another block and resizing fractions', () => {
    const first = createDraftBlock('text', { id: 'first', text: 'First' })
    const second = createDraftBlock('text', { id: 'second', text: 'Second' })
    const draft: PosterLayoutDraft = {
      version: 1,
      bands: {
        header: {
          id: 'header',
          label: 'Header',
          rows: [
            createDraftRow('content', [first], { id: 'row-one' }),
            createDraftRow('content', [second], { id: 'row-two' }),
          ],
        },
        footer: {
          id: 'footer',
          label: 'Footer',
          rows: [],
        },
      },
    }

    const columns = moveDraftBlockBeside(draft, 'second', 'first')
    expect(columns.bands.header.rows).toHaveLength(1)
    expect(columns.bands.header.rows[0]?.cells).toHaveLength(2)

    const resized = resizeDraftCell(columns, 'header', 'row-one', columns.bands.header.rows[0]!.cells[0]!.id, 0.4)
    expect(resized.bands.header.rows[0]?.cells[0]?.widthFr).toBeGreaterThan(columns.bands.header.rows[0]!.cells[0]!.widthFr)

    const taller = resizeDraftRow(resized, 'header', 'row-one', 0.5)
    expect(taller.bands.header.rows[0]?.heightFr).toBeGreaterThan(resized.bands.header.rows[0]!.heightFr)
  })
})
