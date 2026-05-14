import { describe, expect, it } from 'vitest'
import { DEFAULT_STYLE_CONFIG, type RouteStats } from '~/types'
import {
  bboxCenter,
  draftPremadeFromMap,
  defaultPremadeBasePriceCents,
  hasValidLocationCoordinates,
  geojsonCenter,
  missingPublishFields,
  normalizePremadeCategories,
  premadeHasCategory,
  publishableLocationCoordinates,
  previewUrlForSourceMap,
  slugifyPremadeTitle,
} from '~/utils/premadeCatalog'
import { getPublishedPremadeBySlug, listNearbyPublishedPremadeMaps, listPublishedPremadeMaps, premadeRowToMap } from '~/server/utils/premadeCatalog'
import { parseNearbyPremadeQuery, parsePremadeSearchText, sortPremadeMapsByDistance } from '~/server/utils/premadeSearch'
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

  it('derives bbox centers for searchable location defaults', () => {
    expect(bboxCenter([-105.1, 40, -105, 40.1])).toEqual([-105.05, 40.05])
    expect(bboxCenter([-181, 40, -105, 40.1])).toBeNull()
  })

  it('derives route centers from GeoJSON when bbox metadata is missing', () => {
    expect(geojsonCenter(geojson)).toEqual([-105.05, 40.05])
    expect(publishableLocationCoordinates({
      location_lng: null,
      location_lat: null,
      geojson,
    })).toEqual([-105.05, 40.05])
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
    expect(draft.categories).toEqual(['adventure'])
    expect(draft.preview_image_url).toBe('https://example.com/proof.jpg')
    expect(draft.render_url).toBeUndefined()
    expect(draft.needs_preview).toBe(false)
    expect(draft.base_price_cents).toBe(defaultPremadeBasePriceCents())
    expect(draft.location_label).toBe('Boulder, Colorado')
    expect(draft.location_lng).toBe(-105.05)
    expect(draft.location_lat).toBe(40.05)
    expect(hasValidLocationCoordinates(draft)).toBe(true)
    expect(publishableLocationCoordinates(draft)).toEqual([-105.05, 40.05])
  })

  it('reports publish blockers for incomplete maps', () => {
    expect(missingPublishFields({ title: 'Only a title' })).toEqual([
      'slug',
      'category',
      'stats',
      'bbox',
      'location_coordinates',
      'geojson',
      'style_config',
      'preview_image_url',
    ])
  })

  it('normalizes multi-select categories without duplicates', () => {
    expect(normalizePremadeCategories(['hikes', 'parks', 'hikes', 'bogus'])).toEqual(['hikes', 'parks'])
    expect(premadeHasCategory({
      category: 'adventure',
      categories: ['adventure', 'hikes'],
    }, 'hikes')).toBe(true)
  })

  it('derives publishable location coordinates from a valid bbox', () => {
    expect(missingPublishFields({
      slug: 'evening-ridge',
      title: 'Evening Ridge',
      category: 'adventure',
      stats,
      bbox: [-105.1, 40, -105, 40.1],
      geojson,
      style_config: DEFAULT_STYLE_CONFIG,
      preview_image_url: 'https://example.com/preview.jpg',
    })).toEqual([])
  })

  it('accepts a complete previewed premade map for publishing without a final render URL', () => {
    const missing = missingPublishFields({
      slug: 'evening-ridge',
      title: 'Evening Ridge',
      category: 'adventure',
      stats,
      bbox: [-105.1, 40, -105, 40.1],
      location_lng: -105.05,
      location_lat: 40.05,
      geojson,
      style_config: DEFAULT_STYLE_CONFIG,
      preview_image_url: 'https://example.com/preview.jpg',
    })
    expect(missing).toEqual([])
    expect(missing).not.toContain('render_url')
  })

  it('requires a fresh preview before publishing after style edits', () => {
    expect(missingPublishFields({
      slug: 'evening-ridge',
      title: 'Evening Ridge',
      category: 'adventure',
      stats,
      bbox: [-105.1, 40, -105, 40.1],
      location_lng: -105.05,
      location_lat: 40.05,
      geojson,
      style_config: DEFAULT_STYLE_CONFIG,
      preview_image_url: 'https://example.com/preview.jpg',
      needs_preview: true,
    })).toEqual(['fresh_preview'])
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

function createMockClient(results: any[], rpcResults: any[] = []) {
  let index = 0
  let rpcIndex = 0
  return {
    rpc() {
      return Promise.resolve(rpcResults[rpcIndex++])
    },
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

  it('uses static seed data while the premade table is empty and fallback is enabled', async () => {
    const client = createMockClient([
      { data: [], error: null },
      { count: 0, error: null },
    ])

    await expect(listPublishedPremadeMaps(client, { staticFallbackWhenNoPublished: true })).resolves.toEqual(PREMADE_MAPS)
  })

  it('does not expose static maps when the table is empty and fallback is disabled', async () => {
    const client = createMockClient([
      { data: [], error: null },
      { count: 0, error: null },
    ])

    await expect(listPublishedPremadeMaps(client, { staticFallbackWhenNoPublished: false })).resolves.toEqual([])
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

  it('does not return static detail pages when the table is empty and fallback is disabled', async () => {
    const client = createMockClient([
      { data: null, error: null },
      { count: 0, error: null },
    ])

    await expect(
      getPublishedPremadeBySlug(client, PREMADE_MAPS[0].slug, { staticFallbackWhenNoPublished: false }),
    ).resolves.toBeUndefined()
  })

  it('maps location metadata and nearby distance from database rows', () => {
    const mapped = premadeRowToMap({
      ...PREMADE_MAPS[0],
      id: '00000000-0000-0000-0000-000000000001',
      homepage_visible: true,
      location_label: 'Yosemite Valley, California',
      location_city: 'Yosemite Valley',
      location_region: 'California',
      location_country: 'United States',
      location_lng: -119.59,
      location_lat: 37.74,
      distance_meters: 12345,
    })

    expect(mapped.location_label).toBe('Yosemite Valley, California')
    expect(mapped.location_city).toBe('Yosemite Valley')
    expect(mapped.location_lng).toBe(-119.59)
    expect(mapped.distance_meters).toBe(12345)
  })

  it('reads nearby published premades through the RPC', async () => {
    const client = createMockClient([], [
      {
        data: [{ ...PREMADE_MAPS[1], distance_meters: 1000 }],
        error: null,
      },
    ])

    const results = await listNearbyPublishedPremadeMaps(client, {
      lat: 40.73,
      lng: -73.98,
      radiusKm: 50,
    })

    expect(results).toHaveLength(1)
    expect(results[0].slug).toBe('nyc-marathon')
    expect(results[0].distance_meters).toBe(1000)
  })
})

describe('premade location search helpers', () => {
  it('parses nearby API query coordinates', () => {
    expect(parseNearbyPremadeQuery({ lat: '40.7', lng: '-73.9', radius_km: '25' })).toEqual({
      lat: 40.7,
      lng: -73.9,
      radiusKm: 25,
    })
    expect(parseNearbyPremadeQuery({ q: 'Yosemite' })).toBeNull()
    expect(parsePremadeSearchText({ q: '  Yosemite  ' })).toBe('Yosemite')
  })

  it('sorts fallback premade maps by in-memory distance', () => {
    const results = sortPremadeMapsByDistance(PREMADE_MAPS, {
      lat: 40.7359,
      lng: -73.9677,
      radiusKm: 50,
    })

    expect(results[0].slug).toBe('nyc-marathon')
    expect(results[0].distance_meters).toBeLessThan(1000)
  })
})
