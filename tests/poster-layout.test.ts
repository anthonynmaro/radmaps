import { describe, expect, it } from 'vitest'
import { DEFAULT_STYLE_CONFIG, type AnchorLength, type PartialPosterLayout, type RouteStats, type StyleConfig } from '../types'
import { CHROME_BLOCK_FIT_DEFAULTS, bandsToAnchorFrames, clampChromeBandHeight, defaultPosterLayout, effectivePosterLayout, mergePosterLayout, patchPosterLayout } from '../utils/posterLayout'
import { textFitFloorCqh } from '../utils/textFit'

const stats: RouteStats = {
  distance_km: 10,
  elevation_gain_m: 300,
  elevation_loss_m: 300,
  max_elevation_m: 1000,
  min_elevation_m: 700,
  date: '2025-05-01',
  location: 'Marin County',
}

const baseConfig: StyleConfig = {
  ...DEFAULT_STYLE_CONFIG,
  trail_name: 'Mount Tam',
  occasion_text: 'Morning route',
  location_text: 'Mill Valley',
  composition: 'modernist-block',
  labels: {
    ...DEFAULT_STYLE_CONFIG.labels,
    show_date: true,
  },
}

function blocksFor(layout: ReturnType<typeof defaultPosterLayout>, band: 'header' | 'footer' | 'railLeft' | 'railRight') {
  return layout.bands[band].rows.flatMap(row => row.cells.map(cell => cell.block).filter(Boolean))
}

type AnchorUnit = Extract<AnchorLength, { kind: 'unit' }>

function anchorUnit(value: number, unit: AnchorUnit['unit']): AnchorUnit {
  return { kind: 'unit', value, unit }
}

describe('poster layout merge', () => {
  it('hydrates legacy chrome slots into default header and footer while keeping rail bands available', () => {
    const layout = defaultPosterLayout(baseConfig, stats)
    expect(blocksFor(layout, 'header').some(block => block?.slot === 'trail_name')).toBe(true)
    expect(blocksFor(layout, 'header').some(block => block?.slot === 'occasion_text')).toBe(false)
    expect(blocksFor(layout, 'footer').some(block => block?.slot === 'distance')).toBe(true)
    expect(blocksFor(layout, 'footer').some(block => block?.slot === 'date')).toBe(true)
    expect(blocksFor(layout, 'footer').some(block => block?.slot === 'composition_footer')).toBe(false)
    expect(layout.bands.railLeft.rows).toEqual([])
    expect(layout.bands.railRight.rows).toEqual([])
  })

  it('represents intentional vertical whitespace as spacer rows', () => {
    const layout = defaultPosterLayout(baseConfig, stats)
    expect(layout.bands.header.rows[0]?.id).toBe('header-spacer-top')
    expect(layout.bands.header.rows.at(-1)?.id).toBe('header-spacer-bottom')
    expect(layout.bands.header.rows[0]?.cells[0]?.block?.kind).toBe('spacer')
    expect(layout.bands.footer.rows[0]?.id).toBe('footer-spacer-top')
    expect(layout.bands.footer.rows.at(-1)?.id).toBe('footer-spacer-bottom')
    expect(layout.bands.footer.rows.at(-1)?.cells[0]?.block?.kind).toBe('spacer')
  })

  it('keeps editorial starter top whitespace compact', () => {
    const layout = defaultPosterLayout({
      ...baseConfig,
      composition: 'editorial-tall',
    }, stats)
    const topSpacer = layout.bands.header.rows.find(row => row.id === 'header-spacer-top')
    const titleRow = layout.bands.header.rows.find(row => row.id === 'header-title')

    expect(layout.bands.header.height).toBeLessThanOrEqual(23)
    expect(topSpacer?.fr).toBeLessThanOrEqual(0.4)
    expect(titleRow?.fr).toBeGreaterThan(2)
  })

  it('omits decorative footer notes from default compositions', () => {
    const editorial = defaultPosterLayout({
      ...baseConfig,
      composition: 'editorial-tall',
    }, stats)
    const performance = defaultPosterLayout({
      ...baseConfig,
      composition: 'splits-grid',
    }, stats)

    expect(blocksFor(editorial, 'footer').some(block => block?.slot === 'composition_footer')).toBe(false)
    expect(blocksFor(performance, 'footer').some(block => block?.slot === 'composition_footer')).toBe(false)
  })

  it('designs fixed-template footer stats as a weighted information strip', () => {
    const layout = defaultPosterLayout({
      ...baseConfig,
      color_theme: 'midcentury-travel',
      composition: 'travel-banner',
      show_branding: true,
      labels: {
        ...baseConfig.labels,
        show_date: true,
        show_distance: true,
        show_elevation_gain: true,
        show_location: true,
      },
    }, stats)
    const footerPrimary = layout.bands.footer.rows.find(row => row.id === 'footer-primary')
    expect(footerPrimary).toBeTruthy()

    const cells = footerPrimary!.cells
    const distance = cells.find(cell => cell.id === 'ft-distance')
    const gain = cells.find(cell => cell.id === 'ft-gain')
    const date = cells.find(cell => cell.id === 'ft-date')
    const coords = cells.find(cell => cell.id === 'ft-coords')
    const brand = cells.find(cell => cell.id === 'ft-brand')

    expect(cells.map(cell => cell.id)).toEqual(['ft-distance', 'ft-gain', 'ft-date', 'ft-coords', 'ft-brand'])
    expect(new Set(cells.map(cell => cell.fr)).size).toBeGreaterThan(1)
    expect(distance?.block?.kind).toBe('stat')
    expect(gain?.block?.kind).toBe('stat')
    expect(date?.block?.kind).toBe('stat')
    expect(coords?.block?.kind).toBe('coords')
    expect(brand?.block?.kind).toBe('brand')
    expect(coords?.fr).toBeGreaterThan(distance?.fr ?? 0)
    expect(brand?.fr).toBeLessThan(date?.fr ?? 0)
    expect(distance?.block?.scale).toBeGreaterThan(date?.block?.scale ?? 0)
    expect(coords?.block?.scale).toBeLessThan(distance?.block?.scale ?? 0)
  })

  it('keeps Night Ride map-forward with a compact title and footer stack', () => {
    const layout = defaultPosterLayout({
      ...baseConfig,
      color_theme: 'night-ride',
      composition: 'splits-grid',
      labels: {
        ...baseConfig.labels,
        show_date: true,
        show_distance: true,
        show_elevation_gain: true,
        show_location: true,
      },
    }, stats)

    expect(layout.bands.header.height).toBe(14)
    expect(layout.bands.footer.height).toBe(14)
    expect(layout.bands.header.rows.find(row => row.id === 'header-title')?.fr).toBe(1.72)
    expect(layout.bands.footer.rows.find(row => row.id === 'footer-primary')?.fr).toBe(1.32)
    expect(blocksFor(layout, 'footer').find(block => block?.slot === 'distance')?.scale).toBeGreaterThan(1.4)
  })

  it('keeps default occasion text only on roomier compositions', () => {
    const roomierCompositions = ['editorial-tall', 'journal-spread'] as const
    const denseCompositions = ['blueprint-grid', 'blueprint-strava', 'splits-grid', 'bib-numerals', 'brutalist-slab'] as const

    for (const composition of roomierCompositions) {
      const layout = defaultPosterLayout({ ...baseConfig, composition }, stats)
      expect(blocksFor(layout, 'header').some(block => block?.slot === 'occasion_text')).toBe(true)
    }

    for (const composition of denseCompositions) {
      const layout = defaultPosterLayout({ ...baseConfig, composition }, stats)
      expect(blocksFor(layout, 'header').some(block => block?.slot === 'occasion_text')).toBe(false)
    }
  })

  it('applies sparse row and cell edits by id without replacing the whole default layout', () => {
    const defaults = defaultPosterLayout(baseConfig, stats)
    const merged = mergePosterLayout(defaults, {
      bands: {
        header: {
          rows: [{
            id: 'header-title',
            cells: [{ id: 'hdr-title', block: { id: 'hdr-title-block', kind: 'title', slot: 'trail_name', scale: 1.25 } }],
          }],
        },
      },
    })
    const title = blocksFor(merged, 'header').find(block => block?.id === 'hdr-title-block')
    expect(title?.scale).toBe(1.25)
    expect(blocksFor(merged, 'header').some(block => block?.slot === 'location_text')).toBe(true)
  })

  it('honors tombstones for deleted cells', () => {
    const layout = effectivePosterLayout({
      ...baseConfig,
      poster_layout: {
        bands: {
          footer: {
            rows: [{
              id: 'footer-primary',
              cells: [{ id: 'ft-date', deleted: true }],
            }],
          },
        },
      },
    }, stats)
    expect(blocksFor(layout, 'footer').some(block => block?.slot === 'date')).toBe(false)
  })

  it('reflows footer metrics after a structural cell tombstone', () => {
    const defaults = defaultPosterLayout(baseConfig, stats)
    const defaultPrimary = defaults.bands.footer.rows.find(row => row.id === 'footer-primary')
    const defaultCells = defaultPrimary?.cells ?? []
    expect(defaultCells.length).toBeGreaterThan(2)

    const layout = effectivePosterLayout({
      ...baseConfig,
      poster_layout: {
        bands: {
          footer: {
            rows: [{
              id: 'footer-primary',
              cells: [{ id: 'ft-date', deleted: true }],
            }],
          },
        },
      },
    }, stats)
    const primary = layout.bands.footer.rows.find(row => row.id === 'footer-primary')

    expect(primary?.cells.map(cell => cell.id)).not.toContain('ft-date')
    expect(primary?.cells.length).toBe(defaultCells.length - 1)
    expect(primary?.cells.some(cell => cell.block?.slot === 'date')).toBe(false)
  })

  it('honors tombstones for deleted default rows', () => {
    const layout = effectivePosterLayout({
      ...baseConfig,
      poster_layout: {
        bands: {
          header: {
            rows: [{
              id: 'header-subtitle',
              deleted: true,
              cells: [{ id: 'hdr-location', deleted: true }],
            }],
          },
        },
      },
    }, stats)
    expect(layout.bands.header.rows.some(row => row.id === 'header-subtitle')).toBe(false)
    expect(blocksFor(layout, 'header').some(block => block?.slot === 'location_text')).toBe(false)
  })

  it('collapses the whole footer metrics row while preserving the footer band height', () => {
    const defaults = defaultPosterLayout(baseConfig, stats)
    const layout = effectivePosterLayout({
      ...baseConfig,
      poster_layout: {
        bands: {
          footer: {
            rows: [{
              id: 'footer-primary',
              deleted: true,
              cells: [
                { id: 'ft-distance', deleted: true },
                { id: 'ft-gain', deleted: true },
                { id: 'ft-date', deleted: true },
                { id: 'ft-coords', deleted: true },
                { id: 'ft-brand', deleted: true },
              ],
            }],
          },
        },
      },
    }, stats)

    expect(layout.bands.footer.height).toBe(defaults.bands.footer.height)
    expect(layout.bands.footer.rows.some(row => row.id === 'footer-primary')).toBe(false)
    expect(blocksFor(layout, 'footer').some(block => block?.kind === 'stat')).toBe(false)
  })

  it('restores a tombstoned theme cell when the sparse tombstone is cleared', () => {
    const layout = effectivePosterLayout({
      ...baseConfig,
      poster_layout: {
        bands: {
          footer: {
            rows: [{
              id: 'footer-primary',
              cells: [{ id: 'ft-date', deleted: false }],
            }],
          },
        },
      },
    }, stats)

    expect(blocksFor(layout, 'footer').some(block => block?.slot === 'date')).toBe(true)
  })

  it('does not create a gain stat when the route has no elevation data', () => {
    const layout = defaultPosterLayout(baseConfig, {
      ...stats,
      elevation_gain_m: 0,
      elevation_loss_m: 0,
    })
    expect(blocksFor(layout, 'footer').some(block => block?.slot === 'elevation_gain')).toBe(false)
  })

  it('keeps an explicit gain text override when elevation data is missing', () => {
    const layout = defaultPosterLayout({
      ...baseConfig,
      poster_text_overrides: {
        elevation_gain: { text: "5,448'\nGain" },
      },
    }, {
      ...stats,
      elevation_gain_m: 0,
      elevation_loss_m: 0,
    })
    expect(blocksFor(layout, 'footer').some(block => block?.slot === 'elevation_gain')).toBe(true)
  })

  it('keeps user-added rows when patching another sparse field', () => {
    const current: PartialPosterLayout = {
      bands: {
        header: {
          rows: [{ id: 'custom-row', cells: [{ id: 'custom', block: { id: 'custom-block', kind: 'text', text: 'Custom' } }] }],
        },
      },
    }
    const next = patchPosterLayout(current, { bands: { header: { height: 24 } } })
    expect(next.bands?.header?.rows?.[0]?.id).toBe('custom-row')
    expect(next.bands?.header?.height).toBe(24)
  })

  it('derives displacing band anchors from the current chrome bands', () => {
    const layout = defaultPosterLayout(baseConfig, stats)
    const anchors = bandsToAnchorFrames(layout)

    expect(anchors.map(anchor => anchor.id)).toEqual(['band-header', 'band-footer', 'band-railLeft', 'band-railRight'])
    expect(anchors.find(anchor => anchor.id === 'band-header')).toMatchObject({
      anchorTo: 'poster',
      edge: 'top',
      displacesMap: true,
      size: { height: { kind: 'unit', value: layout.bands.header.height, unit: '%' } },
    })
    expect(anchors.find(anchor => anchor.id === 'band-footer')).toMatchObject({
      anchorTo: 'poster',
      edge: 'bottom',
      displacesMap: true,
      size: { height: { kind: 'unit', value: layout.bands.footer.height, unit: '%' } },
    })
    expect(anchors.find(anchor => anchor.id === 'band-header')?.rows).toEqual(layout.bands.header.rows)
    expect(anchors.find(anchor => anchor.id === 'band-header')?.rows).not.toBe(layout.bands.header.rows)
  })

  it('keeps band anchors synced with sparse band-height edits', () => {
    const defaults = defaultPosterLayout(baseConfig, stats)
    const merged = mergePosterLayout(defaults, {
      bands: {
        header: { height: 52 },
      },
    })

    expect(merged.bands.header.height).toBe(34)
    expect(merged.anchors?.find(anchor => anchor.id === 'band-header')?.size).toEqual({
      height: { kind: 'unit', value: 34, unit: '%' },
    })
  })

  it('clamps deliberate band-height edits before they can move the map too far', () => {
    expect(clampChromeBandHeight(2)).toBe(8)
    expect(clampChromeBandHeight(19.94)).toBe(19.9)
    expect(clampChromeBandHeight(19.95)).toBe(20)
    expect(clampChromeBandHeight(52)).toBe(34)
  })

  it('defines bounded text-fit floors for every chrome block kind', () => {
    for (const [kind, fit] of Object.entries(CHROME_BLOCK_FIT_DEFAULTS)) {
      expect(fit.minScale, kind).toBeGreaterThanOrEqual(0.1)
      expect(fit.minScale, kind).toBeLessThanOrEqual(1)
      expect(textFitFloorCqh({ targetSizeCqh: 4, minScale: fit.minScale })).toBeLessThanOrEqual(4)
    }
    expect(CHROME_BLOCK_FIT_DEFAULTS.title).toMatchObject({ maxLines: 3, overflow: 'clip' })
    expect(CHROME_BLOCK_FIT_DEFAULTS.subtitle).toMatchObject({ maxLines: 1, overflow: 'clamp' })
    expect(CHROME_BLOCK_FIT_DEFAULTS.stat.minScale).toBeGreaterThan(CHROME_BLOCK_FIT_DEFAULTS.title.minScale)
  })

  it('merges additive free anchors without replacing legacy band layout', () => {
    const defaults = defaultPosterLayout(baseConfig, stats)
    const titleblockBox = {
      left: {
        kind: 'calc',
        terms: [
          { op: '+', value: anchorUnit(5.2, 'cqw') },
          { op: '+', value: { kind: 'var', token: 'print-bleed', fallback: anchorUnit(0, 'px') } },
        ],
      },
      width: {
        kind: 'min',
        values: [anchorUnit(82, 'cqw'), anchorUnit(54, 'cqh')],
      },
      padding: [anchorUnit(0, 'cqh'), anchorUnit(0, 'cqw'), anchorUnit(0, 'cqh'), anchorUnit(0, 'cqw')],
      transform: [{ kind: 'translateX', value: anchorUnit(-50, '%') }],
      decorations: ['sea-chart-titleblock'],
    } satisfies NonNullable<NonNullable<PartialPosterLayout['anchors']>[number]['box']>

    const merged = mergePosterLayout(defaults, {
      anchors: [{
        id: 'free-sea-chart-titleblock',
        anchorTo: 'map',
        edge: 'bottom',
        displacesMap: false,
        z: 18,
        box: titleblockBox,
      }],
    })

    expect(merged.bands.header.rows.some(row => row.id === 'header-title')).toBe(true)
    expect(merged.anchors?.some(anchor => anchor.id === 'band-header')).toBe(true)
    expect(merged.anchors?.find(anchor => anchor.id === 'free-sea-chart-titleblock')).toMatchObject({
      anchorTo: 'map',
      edge: 'bottom',
      displacesMap: false,
      z: 18,
      box: titleblockBox,
    })
  })

  it('patches sparse anchors by id while preserving existing band patches', () => {
    const current: PartialPosterLayout = {
      bands: {
        header: { height: 21 },
      },
      anchors: [{
        id: 'free-art-wash-titleblock',
        anchorTo: 'map',
        edge: 'bottom',
        displacesMap: false,
        z: 18,
      }],
    }
    const next = patchPosterLayout(current, {
      bands: {
        header: { height: 52 },
      },
      anchors: [{
        id: 'free-art-wash-titleblock',
        userPinned: true,
        box: { decorations: ['art-wash-titleblock'] },
      }],
    })

    expect(next.bands?.header?.height).toBe(34)
    expect(next.anchors).toEqual([{
      id: 'free-art-wash-titleblock',
      anchorTo: 'map',
      edge: 'bottom',
      displacesMap: false,
      z: 18,
      userPinned: true,
      box: { decorations: ['art-wash-titleblock'] },
    }])
  })

  it('models over-map titleblocks as non-displacing free anchors', () => {
    const cartouche = defaultPosterLayout({
      ...baseConfig,
      color_theme: 'cartouche-place',
      composition: 'place-frame',
    }, stats)
    const seaChart = defaultPosterLayout({
      ...baseConfig,
      color_theme: 'sea-chart',
      composition: 'sea-chart',
    }, stats)
    const contourWash = defaultPosterLayout({
      ...baseConfig,
      color_theme: 'contour-wash',
      composition: 'art-wash',
    }, stats)
    const pleinAir = defaultPosterLayout({
      ...baseConfig,
      color_theme: 'plein-air',
      composition: 'art-wash',
    }, stats)

    expect(cartouche.anchors?.find(anchor => anchor.id === 'free-place-frame-titleblock')).toMatchObject({
      anchorTo: 'map',
      edge: 'center',
      displacesMap: false,
      z: 18,
      box: {
        left: anchorUnit(13.5, 'cqw'),
        right: anchorUnit(13.5, 'cqw'),
        top: anchorUnit(50, '%'),
        transform: [{ kind: 'translateY', value: anchorUnit(-50, '%') }],
        decorations: ['cartouche-titleblock'],
      },
    })
    expect(seaChart.anchors?.find(anchor => anchor.id === 'free-sea-chart-titleblock')).toMatchObject({
      anchorTo: 'map',
      edge: 'bottom',
      displacesMap: false,
      box: {
        left: {
          kind: 'calc',
          terms: [
            { op: '+', value: anchorUnit(5.2, 'cqw') },
            { op: '+', value: { kind: 'var', token: 'print-bleed', fallback: anchorUnit(0, 'px') } },
          ],
        },
        width: { kind: 'min', values: [anchorUnit(82, 'cqw'), anchorUnit(54, 'cqh')] },
        decorations: ['sea-chart-titleblock'],
      },
    })
    expect(contourWash.anchors?.find(anchor => anchor.id === 'free-art-wash-titleblock')).toMatchObject({
      anchorTo: 'map',
      edge: 'bottom',
      displacesMap: false,
      box: {
        bottom: {
          kind: 'calc',
          terms: [
            { op: '+', value: anchorUnit(6.9, 'cqh') },
            { op: '+', value: { kind: 'var', token: 'print-bleed', fallback: anchorUnit(0, 'px') } },
          ],
        },
        transform: [{ kind: 'translateX', value: anchorUnit(-50, '%') }],
        decorations: ['art-wash-titleblock'],
      },
    })
    const pleinAirAnchor = pleinAir.anchors?.find(anchor => anchor.id === 'free-art-wash-titleblock')
    expect(pleinAirAnchor).toMatchObject({
      box: {
        left: {
          kind: 'calc',
          terms: [
            { op: '+', value: anchorUnit(6.9, 'cqw') },
            { op: '+', value: { kind: 'var', token: 'print-bleed', fallback: anchorUnit(0, 'px') } },
          ],
        },
        width: { kind: 'min', values: [anchorUnit(55, 'cqw'), anchorUnit(33, 'cqh')] },
        decorations: ['art-wash-titleblock'],
      },
    })
    expect(pleinAirAnchor?.box?.transform).toBeUndefined()
  })

  it('preserves default free titleblock anchors when sparse band edits are merged', () => {
    const defaults = defaultPosterLayout({
      ...baseConfig,
      color_theme: 'sea-chart',
      composition: 'sea-chart',
    }, stats)
    const merged = mergePosterLayout(defaults, {
      bands: {
        header: { height: 22 },
      },
    })

    expect(merged.bands.header.height).toBe(22)
    expect(merged.anchors?.find(anchor => anchor.id === 'free-sea-chart-titleblock')).toMatchObject({
      anchorTo: 'map',
      displacesMap: false,
      box: { decorations: ['sea-chart-titleblock'] },
    })
  })

  it('ephemerally omits route-only footer stats for place-only data without tombstones', () => {
    const placeStats: RouteStats = {
      distance_km: 0,
      elevation_gain_m: 0,
      elevation_loss_m: 0,
      max_elevation_m: 0,
      min_elevation_m: 0,
      location: 'Starved Rock',
    }
    const layout = defaultPosterLayout({
      ...baseConfig,
      composition: 'splits-grid',
      labels: {
        ...baseConfig.labels,
        show_distance: true,
        show_elevation_gain: true,
        show_date: true,
        show_location: true,
      },
    }, placeStats, {
      geojson: { type: 'FeatureCollection', features: [] },
      bbox: [-89.0, 41.2, -88.9, 41.3],
    })
    const footerPrimary = layout.bands.footer.rows.find(row => row.id === 'footer-primary')

    expect(footerPrimary?.cells.some(cell => cell.deleted)).toBe(false)
    expect(blocksFor(layout, 'footer').some(block => block?.slot === 'distance')).toBe(false)
    expect(blocksFor(layout, 'footer').some(block => block?.slot === 'elevation_gain')).toBe(false)
    expect(blocksFor(layout, 'footer').some(block => block?.slot === 'date')).toBe(false)
    expect(blocksFor(layout, 'footer').some(block => block?.slot === 'coordinates')).toBe(true)
  })

  it('lets user-owned text overrides re-add a route stat slot on place-only data', () => {
    const placeStats: RouteStats = {
      distance_km: 0,
      elevation_gain_m: 0,
      elevation_loss_m: 0,
      max_elevation_m: 0,
      min_elevation_m: 0,
      location: 'Starved Rock',
    }
    const layout = effectivePosterLayout({
      ...baseConfig,
      composition: 'splits-grid',
      poster_text_overrides: {
        distance: { text: 'Picnic loop' },
      },
      labels: {
        ...baseConfig.labels,
        show_distance: true,
      },
    }, placeStats, {
      geojson: { type: 'FeatureCollection', features: [] },
      bbox: [-89.0, 41.2, -88.9, 41.3],
    })

    expect(blocksFor(layout, 'footer').some(block => block?.slot === 'distance')).toBe(true)
  })

  it('keeps pending preview placeholders out of final layout until approved', () => {
    const placeStats: RouteStats = {
      distance_km: 0,
      elevation_gain_m: 0,
      elevation_loss_m: 0,
      max_elevation_m: 0,
      min_elevation_m: 0,
    }
    const pendingLayout = effectivePosterLayout({
      ...baseConfig,
      trail_name: '',
      location_text: '',
      poster_text_overrides: {
        trail_name: {
          text: 'Preview trail title',
          approved_placeholder: false,
        },
      },
    }, placeStats, {
      geojson: { type: 'FeatureCollection', features: [] },
      mode: 'final',
    })
    const approvedLayout = effectivePosterLayout({
      ...baseConfig,
      trail_name: '',
      location_text: '',
      poster_text_overrides: {
        trail_name: {
          text: 'Preview trail title',
          approved_placeholder: true,
          approved_placeholder_at: '2026-06-10T12:00:00.000Z',
        },
      },
    }, placeStats, {
      geojson: { type: 'FeatureCollection', features: [] },
      mode: 'final',
    })

    expect(blocksFor(pendingLayout, 'header').some(block => block?.slot === 'trail_name')).toBe(false)
    expect(blocksFor(approvedLayout, 'header').some(block => block?.slot === 'trail_name')).toBe(true)
  })
})
