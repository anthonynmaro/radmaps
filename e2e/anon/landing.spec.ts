import { test, expect } from '@playwright/test'

test.describe('Landing page — anonymous', () => {
  test('landing page loads with a CTA', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/radmaps/i)
    // At least one CTA button exists
    const cta = page.getByRole('link', { name: /get started|create|start/i }).first()
    await expect(cta).toBeVisible()
  })

  test('CTA navigates to /create', async ({ page }) => {
    await page.goto('/')
    const cta = page.getByRole('link', { name: /get started|create|start/i }).first()
    await cta.click()
    await expect(page).toHaveURL(/\/(create|login)/)
  })

  test('/create redirects unauthenticated user to login', async ({ page }) => {
    await page.goto('/create')
    await expect(page).toHaveURL(/login/, { timeout: 10_000 })
  })
})
