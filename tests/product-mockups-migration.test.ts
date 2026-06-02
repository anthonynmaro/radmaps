import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const root = process.cwd()

describe('product mockups migration', () => {
  it('keeps forward, rollback, RLS, and canonical schema in sync', () => {
    const forward = readFileSync(`${root}/supabase/migrations/20260529185930_product_mockups.sql`, 'utf8')
    const rollback = readFileSync(`${root}/supabase/migrations/20260529185930_product_mockups_down.sql`, 'utf8')
    const schema = readFileSync(`${root}/supabase/schema.sql`, 'utf8')

    for (const sql of [forward, schema]) {
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.product_mockups')
      expect(sql).toContain("provider                 TEXT NOT NULL DEFAULT 'gelato_template_asset' CHECK (provider IN ('gelato_template_asset'))")
      expect(sql).toContain("source_type              TEXT NOT NULL CHECK (source_type IN ('map', 'premade'))")
      expect(sql).toContain('source_id                TEXT NOT NULL')
      expect(sql).toContain('mockup_url_expires_at    TIMESTAMPTZ')
      expect(sql).toContain('provider_product_id      TEXT')
      expect(sql).toContain('UNIQUE (source_type, source_id, product_uid, mockup_hash)')
      expect(sql).toContain('ALTER TABLE public.product_mockups ENABLE ROW LEVEL SECURITY')
      expect(sql).toContain('Users read own map product mockups')
      expect(sql).toContain('Anyone reads published premade product mockups')
      expect(sql).toContain('m.id::text = product_mockups.source_id')
      expect(sql).toContain('(p.id::text = product_mockups.source_id OR p.slug = product_mockups.source_id)')
    }

    expect(rollback).toContain('DROP POLICY IF EXISTS "Users read own map product mockups"')
    expect(rollback).toContain('DROP TRIGGER IF EXISTS set_product_mockups_updated_at')
    expect(rollback).toContain('DROP TABLE IF EXISTS public.product_mockups')
  })
})
