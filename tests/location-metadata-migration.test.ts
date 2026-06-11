import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  'supabase/migrations/20260507150514_location_metadata_search.sql',
  'utf8',
)
const enrichmentMigration = readFileSync(
  'supabase/migrations/20260610120000_theme_data_cached_enrichment.sql',
  'utf8',
)
const enrichmentRollback = readFileSync(
  'supabase/migrations/20260610120000_theme_data_cached_enrichment_down.sql',
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

  it('adds cached theme data enrichment columns with a paired rollback', () => {
    for (const table of ['public.maps', 'public.premade_maps', 'public.order_snapshots']) {
      expect(enrichmentMigration).toContain(`ALTER TABLE ${table}`)
    }
    for (const column of ['location_elevation_m', 'location_metadata_source', 'location_metadata_enriched_at']) {
      expect(enrichmentMigration).toContain(column)
      expect(enrichmentRollback).toContain(`DROP COLUMN IF EXISTS ${column}`)
    }
    expect(enrichmentMigration).toContain('ADD COLUMN IF NOT EXISTS location_label TEXT')
    expect(enrichmentRollback).toContain('DROP COLUMN IF EXISTS location_label')
  })
})
