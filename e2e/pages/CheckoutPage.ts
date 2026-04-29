import type { Page } from '@playwright/test'

export class CheckoutPage {
  constructor(private page: Page) {}

  async goto(mapId: string) {
    await this.page.goto(`/create/${mapId}/checkout`)
  }
}
