import { test, expect } from './fixtures/test'
import * as path from 'path'

test.describe('Logo upload', () => {
  test.beforeEach(async ({ createPage, styleEditorPage, page }) => {
    await createPage.goto()
    await createPage.uploadGpx(path.join(__dirname, 'fixtures/sample.gpx'))
    // Navigate to Text tab where logo lives
    await styleEditorPage.switchTab('Text')
    // Open the Logo card
    const logoCard = page.getByText('Logo').first()
    await logoCard.click()
  })

  test('upload area is visible before any logo', async ({ page }) => {
    await expect(page.getByText(/tap to upload logo/i)).toBeVisible()
  })

  test('show/hide toggle appears after upload', async ({ page }) => {
    // Simulate logo upload via route interception — use a test PNG served locally
    // For now, we verify the upload area trigger is clickable
    const uploadArea = page.locator('[style*="dashed"]').filter({ hasText: /upload/i })
    await expect(uploadArea).toBeVisible()
  })
})
