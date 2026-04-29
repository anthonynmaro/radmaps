import { test, expect } from './fixtures/test'

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
    await createPage.uploadGpx()
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
    // Wait for loading to finish, then expand the product selector
    await page.locator('.product-selector').waitFor({ state: 'visible', timeout: 15_000 })
    // Use evaluate to trigger the Vue click handler reliably (avoids DevTools overlay on mobile)
    await page.locator('.product-selector').getByRole('button').first().evaluate(el => (el as HTMLButtonElement).click())
    // Scroll the Digital button into view (panel expands below the fold on mobile)
    const digitalBtn = page.locator('.product-selector').getByRole('button', { name: /digital/i })
    await digitalBtn.scrollIntoViewIfNeeded()
    await expect(digitalBtn).toBeVisible({ timeout: 5_000 })
  })
})
