import { test as setup, expect } from '@playwright/test'
import * as path from 'path'
import * as fs from 'fs'

const authFile = 'e2e/.auth/user.json'

setup('authenticate', async ({ page }) => {
  const email = process.env.E2E_USER_EMAIL ?? 'e2e@radmaps-test.com'
  const password = process.env.E2E_USER_PASSWORD ?? 'e2e-test-password-123!'

  await page.goto('/login')
  await page.getByLabel(/email/i).fill(email)
  await page.getByLabel(/password/i).fill(password)
  await page.getByRole('button', { name: /sign in|log in/i }).click()

  // Wait for redirect to dashboard after login
  await page.waitForURL(/\/(dashboard|create)/, { timeout: 15_000 })

  // Ensure the auth dir exists
  fs.mkdirSync(path.dirname(authFile), { recursive: true })
  await page.context().storageState({ path: authFile })
})
