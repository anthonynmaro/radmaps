import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  'supabase/migrations/20260507150514_location_metadata_search.sql',
  'utf8',
)

describe('location metadata migration', () => {
  it('enables PostGIS and adds spatial indexes', () => {
    expect(migration).toContain('CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA extensions')
    expect(migration).toContain('USING GIST (location)')
    expect(migration).toContain('premade_maps_location_published_gist_idx')
  })

  it('backfills location points from bbox centers', () => {
    expect(migration).toContain('location_lng = coalesce(location_lng, (bbox[1] + bbox[3]) / 2)')
    expect(migration).toContain('location_lat = coalesce(location_lat, (bbox[2] + bbox[4]) / 2)')
    expect(migration).toContain('extensions.st_makepoint(location_lng, location_lat)')
  })

  it('restricts nearby premade search to published maps', () => {
    expect(migration).toContain('public.nearby_published_premade_maps')
    expect(migration).toContain("WHERE p.status = 'published'")
    expect(migration).toContain('distance_meters DOUBLE PRECISION')
    expect(migration).toContain('TO service_role')
  })
})
