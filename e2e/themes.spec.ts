import { test, expect } from './fixtures/test'
import * as path from 'path'

test.describe('Theme save/load', () => {
  test('save a theme and verify it appears in My Themes', async ({ createPage, styleEditorPage, page }) => {
    await createPage.goto()
    await createPage.uploadGpx(path.join(__dirname, 'fixtures/sample.gpx'))

    // Click "Save current theme"
    await page.getByText(/save current theme/i).click()
    const nameInput = page.getByPlaceholder(/theme name/i)
    await nameInput.fill('My E2E Theme')
    await page.getByRole('button', { name: /^save$/i }).click()

    // Should appear in "My Themes" section
    await expect(page.getByText('My E2E Theme')).toBeVisible()
  })

  test('saved themes persist after page refresh', async ({ createPage, page }) => {
    await createPage.goto()
    await createPage.uploadGpx(path.join(__dirname, 'fixtures/sample.gpx'))

    // Save
    await page.getByText(/save current theme/i).click()
    await page.getByPlaceholder(/theme name/i).fill('Persistent Theme')
    await page.getByRole('button', { name: /^save$/i }).click()
    await expect(page.getByText('Persistent Theme')).toBeVisible()

    // Reload and check
    await page.reload()
    await expect(page.getByText('Persistent Theme')).toBeVisible()
  })
})
