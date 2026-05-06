import { describe, expect, it } from 'vitest'
import { DEFAULT_STYLE_CONFIG, type RouteStats } from '~/types'
import {
  draftPremadeFromMap,
  defaultPremadeBasePriceCents,
  missingPublishFields,
  previewUrlForSourceMap,
  slugifyPremadeTitle,
} from '~/utils/premadeCatalog'
import { getPublishedPremadeBySlug, listPublishedPremadeMaps } from '~/server/utils/premadeCatalog'
import { PREMADE_MAPS } from '~/data/premade-maps'

const stats: RouteStats = {
  distance_km: 12,
  elevation_gain_m: 450,
  elevation_loss_m: 440,
  max_elevation_m: 1800,
  min_elevation_m: 1200,
  location: 'Boulder, Colorado',
}

const geojson: GeoJSON.FeatureCollection = {
  type: 'FeatureCollection',
  features: [{
    type: 'Feature',
    properties: {},
    geometry: { type: 'LineString', coordinates: [[-105, 40], [-105.1, 40.1]] },
  }],
}

describe('premade catalog helpers', () => {
  it('slugifies titles for stable catalog URLs', () => {
    expect(slugifyPremadeTitle('Mount Fuji · Yoshida Trail!')).toBe('mount-fuji-yoshida-trail')
    expect(slugifyPremadeTitle('')).toBe('premade-map')
  })

  it('chooses preview assets in proof-thumbnail-render order', () => {
    expect(previewUrlForSourceMap({ proof_render_url: 'proof', thumbnail_url: 'thumb', render_url: 'render' })).toBe('proof')
    expect(previewUrlForSourceMap({ thumbnail_url: 'thumb', render_url: 'render' })).toBe('thumb')
    expect(previewUrlForSourceMap({ render_url: 'render' })).toBe('render')
    expect(previewUrlForSourceMap({})).toBeNull()
  })

  it('creates a draft premade map from only a source map and slug', () => {
    const draft = draftPremadeFromMap({
      id: 'map-1',
      title: 'Evening Ridge',
      subtitle: null,
      geojson,
      bbox: [-105.1, 40, -105, 40.1],
      stats,
      style_config: DEFAULT_STYLE_CONFIG,
      proof_render_url: 'https://example.com/proof.jpg',
    }, 'evening-ridge')

    expect(draft.slug).toBe('evening-ridge')
    expect(draft.source_map_id).toBe('map-1')
    expect(draft.region).toBe('Boulder, Colorado')
    expect(draft.category).toBe('adventure')
    expect(draft.preview_image_url).toBe('https://example.com/proof.jpg')
    expect(draft.needs_preview).toBe(false)
    expect(draft.base_price_cents).toBe(defaultPremadeBasePriceCents())
  })

  it('reports publish blockers for incomplete maps', () => {
    expect(missingPublishFields({ title: 'Only a title' })).toEqual([
      'slug',
      'category',
      'stats',
      'bbox',
      'geojson',
      'style_config',
      'preview_image_url',
      'render_url',
    ])
  })

  it('accepts a complete purchasable premade map for publishing', () => {
    expect(missingPublishFields({
      slug: 'evening-ridge',
      title: 'Evening Ridge',
      category: 'adventure',
      stats,
      bbox: [-105.1, 40, -105, 40.1],
      geojson,
      style_config: DEFAULT_STYLE_CONFIG,
      preview_image_url: 'https://example.com/preview.jpg',
      render_url: 'https://example.com/render.jpg',
    })).toEqual([])
  })

  it('marks drafts without source preview assets as needing preview generation', () => {
    const draft = draftPremadeFromMap({
      id: 'map-2',
      title: 'No Preview Yet',
      geojson,
      bbox: [-105.1, 40, -105, 40.1],
      stats,
      style_config: DEFAULT_STYLE_CONFIG,
    }, 'no-preview-yet')

    expect(draft.preview_image_url).toBeUndefined()
    expect(draft.needs_preview).toBe(true)
  })
})

function createMockClient(results: any[]) {
  let index = 0
  return {
    from() {
      const result = results[index++]
      const builder = {
        select: () => builder,
        eq: () => builder,
        order: () => builder,
        maybeSingle: () => Promise.resolve(result),
        then: (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject),
      }
      return builder
    },
  }
}

describe('database-backed premade catalog reads', () => {
  it('falls back to static seed data while the table is missing', async () => {
    const client = createMockClient([
      { data: null, error: { code: '42P01', message: 'relation "premade_maps" does not exist' } },
    ])

    await expect(listPublishedPremadeMaps(client)).resolves.toEqual(PREMADE_MAPS)
  })

  it('uses static seed data only while the premade table is empty', async () => {
    const client = createMockClient([
      { data: [], error: null },
      { count: 0, error: null },
    ])

    await expect(listPublishedPremadeMaps(client)).resolves.toEqual(PREMADE_MAPS)
  })

  it('does not expose static maps once draft database rows exist', async () => {
    const client = createMockClient([
      { data: [], error: null },
      { count: 1, error: null },
    ])

    await expect(listPublishedPremadeMaps(client)).resolves.toEqual([])
  })

  it('does not return static detail pages when the database catalog is populated', async () => {
    const client = createMockClient([
      { data: null, error: null },
      { count: 1, error: null },
    ])

    await expect(getPublishedPremadeBySlug(client, PREMADE_MAPS[0].slug)).resolves.toBeUndefined()
  })
})
