import { test, expect } from './fixtures/test'

test.describe('Map freeze/unfreeze', () => {
  test.beforeEach(async ({ createPage }) => {
    await createPage.goto()
    await createPage.uploadGpx()
  })

  test('freeze button is visible in the editor', async ({ page }) => {
    // FreezeControl button has visible text "Zoom" (accessible name), class .freeze-pill
    const freezeBtn = page.locator('.freeze-pill').first()
    await expect(freezeBtn).toBeVisible()
  })

  test('frozen badge appears in Base map card when map is frozen', async ({ styleEditorPage, page }) => {
    await styleEditorPage.switchTab('Map')
    const freezeBtn = page.locator('.freeze-pill').first()
    await freezeBtn.click()
    // Frozen badge shows up in Base map card area
    await expect(page.getByText(/view frozen|position locked/i)).toBeVisible({ timeout: 5_000 })
  })
})
