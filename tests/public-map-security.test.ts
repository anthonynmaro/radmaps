import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()

function read(path: string) {
  return readFileSync(resolve(root, path), 'utf8')
}

describe('public map security contracts', () => {
  it('reads shared maps through the request Supabase client, not service role bypass', () => {
    const source = read('server/api/maps/public/[id].get.ts')

    expect(source).toContain('serverSupabaseClient')
    expect(source).not.toContain('supabaseServiceKey')
    expect(source).not.toContain('serverSupabaseServiceRole')
    expect(source).toContain(".eq('is_public', true)")
  })

  it('clones only shared maps through RLS-visible source rows', () => {
    const source = read('server/api/maps/public/[id]/clone.post.ts')

    expect(source).toContain('serverSupabaseClient')
    expect(source).not.toContain('serverSupabaseServiceRole')
    expect(source).toContain(".eq('is_public', true)")
  })

  it('keeps public-share migration, rollback, and schema aligned', () => {
    const forward = read('supabase/migrations/20260611103000_public_map_share_rls_hardening.sql')
    const rollback = read('supabase/migrations/20260611103000_public_map_share_rls_hardening_down.sql')
    const schema = read('supabase/schema.sql')

    for (const sql of [forward, schema]) {
      expect(sql).toContain('is_public')
      expect(sql).toContain('CREATE POLICY "Public map share" ON public.maps')
      expect(sql).toContain('FOR SELECT TO anon, authenticated')
      expect(sql).toContain('USING (is_public = true)')
    }
    expect(rollback).toContain('DROP POLICY IF EXISTS "Public map share"')
    expect(rollback).toContain('FOR SELECT USING (is_public = true)')
  })
})
