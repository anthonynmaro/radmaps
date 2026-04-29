import { test, expect } from './fixtures/test'
import * as path from 'path'

test.describe('Map freeze/unfreeze', () => {
  test.beforeEach(async ({ createPage }) => {
    await createPage.goto()
    await createPage.uploadGpx(path.join(__dirname, 'fixtures/sample.gpx'))
  })

  test('freeze button is visible in the editor', async ({ page }) => {
    // FreezeControl is in the map area
    const freezeBtn = page.getByRole('button', { name: /freeze|lock/i }).first()
    await expect(freezeBtn).toBeVisible()
  })

  test('frozen badge appears in Base map card when map is frozen', async ({ styleEditorPage, page }) => {
    await styleEditorPage.switchTab('Map')
    const freezeBtn = page.getByRole('button', { name: /freeze|lock/i }).first()
    await freezeBtn.click()
    // Frozen badge shows up in Base map card area
    await expect(page.getByText(/view frozen|position locked/i)).toBeVisible({ timeout: 5_000 })
  })
})
