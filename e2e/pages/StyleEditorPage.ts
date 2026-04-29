import type { Page, Locator } from '@playwright/test'

export class StyleEditorPage {
  constructor(private page: Page) {}

  tab(name: 'Quick' | 'Map' | 'Style' | 'Text'): Locator {
    return this.page.getByRole('button', { name, exact: true })
  }

  async switchTab(name: 'Quick' | 'Map' | 'Style' | 'Text') {
    await this.tab(name).click()
  }

  savingIndicator(): Locator {
    return this.page.getByText(/saving…/i)
  }

  savedIndicator(): Locator {
    return this.page.getByText(/all changes saved/i)
  }

  async waitForSave() {
    await this.savedIndicator().waitFor({ state: 'visible', timeout: 10_000 })
  }

  orderButton(): Locator {
    return this.page.getByRole('link', { name: /order|checkout/i })
  }
}
