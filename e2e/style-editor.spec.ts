import { test, expect } from './fixtures/test'
import * as path from 'path'

test.describe('Style editor — core path', () => {
  test.beforeEach(async ({ createPage }) => {
    await createPage.goto()
  })

  test('GPX upload redirects to style editor', async ({ createPage, page }) => {
    await createPage.uploadGpx(path.join(__dirname, 'fixtures/sample.gpx'))
    await expect(page).toHaveURL(/\/create\/[^/]+\/style/)
  })

  test('style editor has all 4 tabs', async ({ createPage, styleEditorPage }) => {
    await createPage.uploadGpx(path.join(__dirname, 'fixtures/sample.gpx'))
    for (const tab of ['Quick', 'Map', 'Style', 'Text'] as const) {
      await expect(styleEditorPage.tab(tab)).toBeVisible()
    }
  })

  test('applying a theme shows saving indicator then saved', async ({ createPage, styleEditorPage, page }) => {
    await createPage.uploadGpx(path.join(__dirname, 'fixtures/sample.gpx'))
    // Click any theme button in Quick tab
    const themeButton = page.locator('button').filter({ hasText: /chalk|topaz|dusk|obsidian|forest|midnight/i }).first()
    await themeButton.click()
    // Should show saving, then saved
    await styleEditorPage.waitForSave()
    await expect(styleEditorPage.savedIndicator()).toBeVisible()
  })

  test('order button is present on style editor', async ({ createPage, styleEditorPage }) => {
    await createPage.uploadGpx(path.join(__dirname, 'fixtures/sample.gpx'))
    await expect(styleEditorPage.orderButton()).toBeVisible()
  })
})
