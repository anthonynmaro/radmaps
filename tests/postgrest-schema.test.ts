import { describe, expect, it } from 'vitest'
import {
  THEME_LOCATION_METADATA_COLUMNS,
  isMissingPostgrestSchemaColumnError,
  omitColumns,
} from '../server/utils/postgrestSchema'

describe('postgrest schema fallback helpers', () => {
  it('detects stale schema cache errors for optional theme metadata columns', () => {
    expect(isMissingPostgrestSchemaColumnError({
      code: 'PGRST204',
      message: "Could not find the 'location_elevation_m' column of 'maps' in the schema cache",
    })).toBe(true)

    expect(isMissingPostgrestSchemaColumnError({
      code: 'PGRST204',
      message: "Could not find the 'price_cents' column of 'maps' in the schema cache",
    })).toBe(false)

    expect(isMissingPostgrestSchemaColumnError({
      code: '23505',
      message: 'duplicate key value violates unique constraint',
    })).toBe(false)
  })

  it('omits all optional theme metadata columns from an insert payload', () => {
    const payload = {
      title: 'Kickapoo',
      location_label: 'Kickapoo State Park',
      location_elevation_m: 187,
      location_metadata_source: 'terrarium-dem-z12',
      status: 'draft',
    }
    const stripped = omitColumns(payload, THEME_LOCATION_METADATA_COLUMNS)

    expect(stripped).toEqual({
      title: 'Kickapoo',
      status: 'draft',
    })
  })
})
