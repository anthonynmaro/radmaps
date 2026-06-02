import { describe, expect, it } from 'vitest'
import {
  CHECKOUT_COUNTRIES,
  checkoutAddressFingerprint,
  mapMapboxAutofillToAddressPatch,
  missingCheckoutAddressFields,
  normalizeCheckoutAddress,
} from '~/utils/checkoutAddress'

const address = {
  name: ' Trail Tester ',
  email: ' Rider@Example.COM ',
  address1: ' 1 Summit Way ',
  address2: ' Apt 2 ',
  city: ' Boulder ',
  state_code: ' co ',
  country_code: ' us ',
  zip: ' 80301 ',
  phone: ' (303) 555-0100 ',
}

describe('checkout address helpers', () => {
  it('keeps the supported checkout country list stable', () => {
    expect(CHECKOUT_COUNTRIES.map(country => country.code)).toEqual([
      'US',
      'CA',
      'GB',
      'AU',
      'DE',
      'FR',
      'NL',
      'SE',
      'NO',
      'ES',
      'IT',
      'IE',
      'DK',
      'FI',
      'NZ',
      'JP',
    ])
  })

  it('normalizes checkout addresses for client-side freshness checks', () => {
    expect(normalizeCheckoutAddress(address)).toEqual({
      name: 'Trail Tester',
      email: 'rider@example.com',
      address1: '1 Summit Way',
      address2: 'Apt 2',
      city: 'Boulder',
      state_code: 'CO',
      country_code: 'US',
      zip: '80301',
      phone: '(303) 555-0100',
    })
  })

  it('detects missing required address fields and invalid email', () => {
    expect(missingCheckoutAddressFields({
      name: 'Trail Tester',
      email: 'bad-email',
      address1: '1 Summit Way',
      city: '',
      state_code: 'CO',
      country_code: 'US',
      zip: '80301',
    })).toEqual(['email', 'city'])
  })

  it('keeps fingerprints stable across casing and whitespace', () => {
    const first = checkoutAddressFingerprint(address, 'poster-a', 1)
    const second = checkoutAddressFingerprint({
      ...address,
      name: 'trail tester',
      address1: '1 summit way',
      state_code: 'CO',
      country_code: 'US',
      email: 'rider@example.com',
      phone: '3035550100',
    }, 'poster-a', 1)

    expect(first).toBe(second)
    expect(checkoutAddressFingerprint(address, 'poster-a', 2)).not.toBe(first)
    expect(checkoutAddressFingerprint(address, 'poster-b', 1)).not.toBe(first)
  })

  it('maps Mapbox autofill direct fields into checkout address fields', () => {
    expect(mapMapboxAutofillToAddressPatch({
      properties: {
        address_line1: '197 Heritage Trace',
        address_line2: 'Unit 4',
        address_level2: 'Nashville',
        address_level1: 'TN',
        country_code: 'us',
        postcode: '37201',
      },
    })).toEqual({
      address1: '197 Heritage Trace',
      address2: 'Unit 4',
      city: 'Nashville',
      state_code: 'TN',
      country_code: 'US',
      zip: '37201',
    })
  })

  it('maps Mapbox autofill context fallback fields', () => {
    expect(mapMapboxAutofillToAddressPatch({
      properties: {
        feature_name: '197 Heritage Trace',
        metadata: { iso_3166_1: 'US-TN' },
        context: [
          { id: 'postcode.123', text: '37201' },
          { id: 'region.123', text: 'Tennessee' },
          { id: 'place.123', text: 'Nashville' },
        ],
      },
    })).toEqual({
      address1: '197 Heritage Trace',
      address2: '',
      city: 'Nashville',
      state_code: 'Tennessee',
      country_code: 'US',
      zip: '37201',
    })
  })
})
