import { describe, expect, it } from 'vitest'
import {
  decodeTerrariumElevationMeters,
  enrichThemeLocationMetadata,
  normalizeReverseGeocodeResponse,
  terrariumTileForLngLat,
} from '../server/utils/themeDataEnrichment'

describe('theme data enrichment', () => {
  it('normalizes Mapbox reverse geocoding into cached location fields', () => {
    const normalized = normalizeReverseGeocodeResponse({
      features: [{
        properties: {
          name: 'Starved Rock State Park',
          full_address: 'Starved Rock State Park, Oglesby, Illinois 61348, United States',
          feature_type: 'poi',
          context: {
            place: { name: 'Oglesby' },
            region: { name: 'Illinois' },
            country: { name: 'United States' },
          },
        },
      }],
    })

    expect(normalized).toEqual({
      location_label: 'Starved Rock State Park, Oglesby, Illinois 61348, United States',
      location_city: 'Oglesby',
      location_region: 'Illinois',
      location_country: 'United States',
    })
  })

  it('decodes Terrarium RGB elevation samples', () => {
    expect(decodeTerrariumElevationMeters(128, 0, 0)).toBe(0)
    expect(decodeTerrariumElevationMeters(128, 10, 0)).toBe(10)
  })

  it('computes stable Terrarium tile and pixel coordinates', () => {
    expect(terrariumTileForLngLat(-88.98, 41.32, 12)).toEqual({
      z: 12,
      x: 1035,
      y: 1530,
      pixelX: 154,
      pixelY: 220,
    })
  })

  it('returns local cached defaults without external calls when coordinates are absent', async () => {
    const enriched = await enrichThemeLocationMetadata({
      stats: {
        distance_km: 0,
        elevation_gain_m: 0,
        elevation_loss_m: 0,
        max_elevation_m: 0,
        min_elevation_m: 0,
        location: 'Somewhere Honest',
      },
    })

    expect(enriched).toMatchObject({
      location_label: 'Somewhere Honest',
      location_lng: null,
      location_lat: null,
      location_elevation_m: null,
      location_metadata_source: null,
    })
  })
})
