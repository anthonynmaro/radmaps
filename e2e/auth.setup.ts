import { test as setup, expect } from '@playwright/test'
import * as path from 'path'
import * as fs from 'fs'

const authFile = 'e2e/.auth/user.json'

setup('authenticate', async ({ page }) => {
  const supabaseUrl = process.env.SUPABASE_URL!
  const supabaseKey = process.env.SUPABASE_ANON_KEY!
  const email = process.env.E2E_USER_EMAIL ?? 'e2e@radmaps-test.com'
  const password = process.env.E2E_USER_PASSWORD ?? 'e2e-test-password-123!'

  // Sign in via Supabase password API — bypasses the magic-link-only UI
  const res = await page.request.post(
    `${supabaseUrl}/auth/v1/token?grant_type=password`,
    {
      data: { email, password },
      headers: { apikey: supabaseKey, 'Content-Type': 'application/json' },
    }
  )
  if (!res.ok()) {
    throw new Error(`Supabase auth failed ${res.status()}: ${await res.text()}`)
  }
  const session = await res.json()

  const projectRef = new URL(supabaseUrl).hostname.split('.')[0]
  const storageKey = `sb-${projectRef}-auth-token`
  const sessionJson = JSON.stringify(session)

  // With useSsrCookies: true the SSR server-plugin reads the session from a cookie
  // whose value is "base64-" + base64url(JSON.stringify(session)) — the format
  // @supabase/ssr uses internally (createBrowserClient / createServerClient).
  const cookieValue = 'base64-' + Buffer.from(sessionJson).toString('base64url')

  await page.context().addCookies([
    {
      name: storageKey,
      value: cookieValue,
      domain: 'localhost',
      path: '/',
      httpOnly: false,
      secure: false,
      sameSite: 'Lax',
    },
  ])

  // Navigate to a protected route; SSR reads the cookie, grants access
  await page.goto('/create')
  await expect(page).toHaveURL(/\/create/, { timeout: 15_000 })

  fs.mkdirSync(path.dirname(authFile), { recursive: true })
  await page.context().storageState({ path: authFile })
})
