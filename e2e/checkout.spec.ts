import { test, expect } from './fixtures/test'
import * as path from 'path'

test.describe('Checkout — mocked Stripe', () => {
  test.beforeEach(async ({ createPage, page }) => {
    // Mock the checkout API to return a dummy URL instead of hitting Stripe
    await page.route('/api/orders/checkout', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ url: 'https://checkout.stripe.com/mock-session' }),
      })
    })

    await createPage.goto()
    await createPage.uploadGpx(path.join(__dirname, 'fixtures/sample.gpx'))
  })

  test('checkout page loads with product options', async ({ styleEditorPage, page }) => {
    await styleEditorPage.orderButton().click()
    await page.waitForURL(/checkout/, { timeout: 15_000 })
    // At least one size or product type visible
    const sizeOrType = page.getByText(/poster|canvas|framed|digital/i).first()
    await expect(sizeOrType).toBeVisible()
  })

  test('digital path is available', async ({ styleEditorPage, page }) => {
    await styleEditorPage.orderButton().click()
    await page.waitForURL(/checkout/, { timeout: 15_000 })
    const digital = page.getByText(/digital/i).first()
    await expect(digital).toBeVisible()
  })
})
