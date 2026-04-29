import type { FullConfig } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

export default async function globalSetup(_config: FullConfig) {
  const supabaseUrl = process.env.E2E_SUPABASE_URL ?? process.env.SUPABASE_URL
  const serviceKey = process.env.E2E_SUPABASE_SERVICE_KEY ?? process.env.SUPABASE_SERVICE_KEY

  if (!supabaseUrl || !serviceKey) {
    console.warn('[e2e global-setup] Supabase env vars not set — skipping test user upsert')
    return
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const email = process.env.E2E_USER_EMAIL ?? 'e2e@radmaps-test.com'
  const password = process.env.E2E_USER_PASSWORD ?? 'e2e-test-password-123!'

  // Upsert the E2E test user (idempotent)
  const { error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (error && !error.message.includes('already been registered')) {
    throw new Error(`[e2e global-setup] Failed to create test user: ${error.message}`)
  }
}
