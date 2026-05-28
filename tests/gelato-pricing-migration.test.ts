import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const root = process.cwd()

describe('Gelato pricing migration', () => {
  it('keeps forward, rollback, and canonical schema in sync', () => {
    const forward = readFileSync(`${root}/supabase/migrations/20260528154120_gelato_product_pricing.sql`, 'utf8')
    const rollback = readFileSync(`${root}/supabase/migrations/20260528154120_gelato_product_pricing_down.sql`, 'utf8')
    const schema = readFileSync(`${root}/supabase/schema.sql`, 'utf8')

    for (const sql of [forward, schema]) {
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.gelato_product_prices')
      expect(sql).toContain('retail_price_cents INT NOT NULL')
      expect(sql).toContain('markup_bps INT NOT NULL DEFAULT 5000')
      expect(sql).toContain('retail_unit_price_cents')
      expect(sql).toContain('pricing_snapshot_id')
    }

    expect(rollback).toContain('DROP TABLE IF EXISTS public.gelato_product_prices')
    expect(rollback).toContain('DROP COLUMN IF EXISTS retail_unit_price_cents')
    expect(rollback).toContain('DROP COLUMN IF EXISTS pricing_snapshot_id')
  })
})
