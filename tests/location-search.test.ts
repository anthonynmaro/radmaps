import { describe, expect, it } from 'vitest'
import {
  normalizeLocationFeature,
  normalizeLocationSuggestion,
  parseBboxParam,
  parseLngLatParam,
  rankLocationSuggestions,
} from '~/server/utils/locationSearch'

describe('location search helpers', () => {
  it('parses valid coordinate and bbox params', () => {
    expect(parseLngLatParam('-87.7,40.15')).toEqual([-87.7, 40.15])
    expect(parseBboxParam('-88,40,-87,41')).toEqual([-88, 40, -87, 41])
  })

  it('rejects invalid coordinate and bbox params', () => {
    expect(() => parseLngLatParam('-187,40')).toThrow()
    expect(() => parseLngLatParam('-87,40,12')).toThrow()
    expect(() => parseBboxParam('-87,41,-88,40')).toThrow()
  })

  it('normalizes a trailhead suggestion', () => {
    const suggestion = normalizeLocationSuggestion({
      mapbox_id: 'dXJuOm1ieHBvaToxMjM',
      name: 'Kickapoo Mountain Bike Main Trailhead',
      feature_type: 'poi',
      full_address: '12001 County Rd 1950 N, Oakwood, Illinois 61858, United States',
      poi_category: ['sports', 'sports club'],
      context: {
        place: { name: 'Oakwood' },
        region: { name: 'Illinois' },
        country: { name: 'United States' },
      },
    })

    expect(suggestion).toEqual({
      id: 'dXJuOm1ieHBvaToxMjM',
      name: 'Kickapoo Mountain Bike Main Trailhead',
      label: '12001 County Rd 1950 N, Oakwood, Illinois 61858, United States',
      featureType: 'poi',
      categories: ['sports', 'sports club'],
      context: {
        country: 'United States',
        region: 'Illinois',
        place: 'Oakwood',
        locality: undefined,
        neighborhood: undefined,
        postcode: undefined,
      },
    })
  })

  it('normalizes park, address, and malformed retrieve features', () => {
    expect(normalizeLocationFeature({
      type: 'Feature',
      bbox: [-87.75, 40.12, -87.7, 40.17],
      geometry: { type: 'Point', coordinates: [-87.73820503, 40.1382762] },
      properties: {
        mapbox_id: 'park-id',
        name: 'Kickapoo State Recreation Area',
        feature_type: 'poi',
        full_address: '10906 Kickapoo Park Rd, Oakwood, Illinois 61858, United States',
        poi_category: ['outdoors', 'park'],
      },
    })?.bbox).toEqual([-87.75, 40.12, -87.7, 40.17])

    expect(normalizeLocationFeature({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [-87.71627305, 40.15229184] },
      properties: {
        mapbox_id: 'address-id',
        name: '12001 County Rd 1950 N',
        feature_type: 'address',
        full_address: '12001 County Rd 1950 N, Oakwood, Illinois 61858, United States',
      },
    })?.suggestedZoom).toBe(15)

    expect(normalizeLocationFeature({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [Number.NaN, 40.15] },
      properties: {
        mapbox_id: 'bad-id',
        name: 'Bad Location',
        feature_type: 'poi',
      },
    })).toBeNull()
  })

  it('boosts outdoor trailhead matches above generic results', () => {
    const generic = normalizeLocationSuggestion({
      mapbox_id: 'generic-id',
      name: 'Kickapoo Coffee',
      feature_type: 'poi',
      full_address: 'Oakwood, Illinois',
      poi_category: ['food_and_drink'],
    })!
    const trailhead = normalizeLocationSuggestion({
      mapbox_id: 'trailhead-id',
      name: 'Kickapoo Mountain Bike Main Trailhead',
      feature_type: 'poi',
      full_address: 'Oakwood, Illinois',
      poi_category: ['sports'],
    })!

    const ranked = rankLocationSuggestions('kickapoo mountain bike trailhead', [generic, trailhead])

    expect(ranked[0].id).toBe('trailhead-id')
  })
})
