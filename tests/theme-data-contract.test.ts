import { describe, expect, it } from 'vitest'
import { DEFAULT_STYLE_CONFIG, type RouteStats, type StyleConfig } from '../types'
import {
  THEME_DATA_CONTRACT_VERSION,
  buildThemeDataContext,
  resolveThemeDataContract,
  themeDataContextSignature,
} from '../utils/themeDataContract'

const emptyGeojson: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] }
const routeGeojson: GeoJSON.FeatureCollection = {
  type: 'FeatureCollection',
  features: [{
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'LineString',
      coordinates: [
        [-87.7, 41.9, 180],
        [-87.8, 42.0, 220],
      ],
    },
  }],
}

const placeStats: RouteStats = {
  distance_km: 0,
  elevation_gain_m: 0,
  elevation_loss_m: 0,
  max_elevation_m: 0,
  min_elevation_m: 0,
  location: 'Starved Rock State Park',
}

const routeStats: RouteStats = {
  distance_km: 12,
  elevation_gain_m: 400,
  elevation_loss_m: 390,
  max_elevation_m: 620,
  min_elevation_m: 220,
  date: '2026-06-09',
  location: 'Illinois River',
}

describe('theme data contract', () => {
  it('classifies place-only maps without route or elevation data', () => {
    const context = buildThemeDataContext({
      geojson: emptyGeojson,
      stats: placeStats,
      bbox: [-89.0, 41.2, -88.9, 41.3],
      location_label: 'Starved Rock',
      location_region: 'Illinois',
      location_country: 'United States',
      location_elevation_m: 187,
      location_metadata_source: 'mapbox-geocoding-v6-reverse+terrarium-dem-z12',
      location_metadata_enriched_at: '2026-06-10T12:00:00.000Z',
    })

    expect(context.version).toBe(THEME_DATA_CONTRACT_VERSION)
    expect(context.purpose).toBe('place')
    expect(context.hasRoute).toBe(false)
    expect(context.hasElevation).toBe(false)
    expect(context.hasLocation).toBe(true)
    expect(context.hasPointElevation).toBe(true)
    expect(context.region).toBe('Illinois')
    expect(context.pointElevationM).toBe(187)
    expect(context.recommendedBaseMapMode).toBe('minimal')
    expect(themeDataContextSignature(context)).toMatchObject({
      version: THEME_DATA_CONTRACT_VERSION,
      purpose: 'place',
      region: 'Illinois',
      pointElevationM: 187,
      locationMetadataSource: 'mapbox-geocoding-v6-reverse+terrarium-dem-z12',
      recommendedBaseMapMode: 'minimal',
    })
  })

  it('recommends Minimal for flat uncovered routes and Streets for flat Atlas-covered routes', () => {
    const flatStats: RouteStats = {
      distance_km: 42,
      elevation_gain_m: 24,
      elevation_loss_m: 20,
      max_elevation_m: 184,
      min_elevation_m: 150,
    }

    expect(buildThemeDataContext({ stats: flatStats }).recommendedBaseMapMode).toBe('minimal')
    expect(buildThemeDataContext({ stats: flatStats, atlas_coverage_status: 'base' }).recommendedBaseMapMode).toBe('streets')
    expect(buildThemeDataContext({ stats: routeStats, geojson: routeGeojson }).recommendedBaseMapMode).toBe('terrain')
  })

  it('omits route-only slots and map features for proof rendering of place data', () => {
    const context = buildThemeDataContext({
      geojson: emptyGeojson,
      stats: placeStats,
      bbox: [-89.0, 41.2, -88.9, 41.3],
      styleConfig: { ...DEFAULT_STYLE_CONFIG, composition: 'splits-grid' },
    })
    const resolved = resolveThemeDataContract('splits-stats', 'splits-grid', context, 'proof')

    expect(resolved.omittedSlotIds).toEqual(expect.arrayContaining([
      'distance',
      'elevation_gain',
      'date',
      'composition_meta',
      'composition_footer',
    ]))
    expect(resolved.omittedMapFeatures).toEqual(expect.arrayContaining([
      'route',
      'pins',
      'splits',
      'elevation_profile',
    ]))
    expect(resolved.warnings.some(warning => warning.includes('placeholder'))).toBe(false)
  })

  it('keeps route stats available when a real GPX route is present', () => {
    const config: StyleConfig = { ...DEFAULT_STYLE_CONFIG, composition: 'splits-grid' }
    const context = buildThemeDataContext({
      geojson: routeGeojson,
      stats: routeStats,
      styleConfig: config,
    })
    const resolved = resolveThemeDataContract('splits-stats', 'splits-grid', context, 'proof')

    expect(context.purpose).toBe('route-terrain')
    expect(context.hasRoute).toBe(true)
    expect(context.hasElevation).toBe(true)
    expect(resolved.omittedSlotIds).not.toContain('distance')
    expect(resolved.omittedSlotIds).not.toContain('elevation_gain')
    expect(resolved.omittedMapFeatures).not.toContain('elevation_profile')
  })

  it('treats explicit empty route geometry as missing route data even when stale stats exist', () => {
    const context = buildThemeDataContext({
      geojson: emptyGeojson,
      stats: routeStats,
      location_label: 'Starved Rock',
      location_region: 'Illinois',
    })

    expect(context.hasRoute).toBe(false)
    expect(context.hasDistance).toBe(false)
    expect(context.hasElevation).toBe(false)
    expect(context.purpose).toBe('place')
    expect(context.recommendedBaseMapMode).toBe('minimal')
  })
})
