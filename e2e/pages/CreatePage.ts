import type { Page } from '@playwright/test'
import * as path from 'path'

export class CreatePage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/create')
  }

  async uploadGpx(gpxPath = path.join(__dirname, '../fixtures/sample.gpx')) {
    const input = this.page.locator('input[type="file"]')
    await input.setInputFiles(gpxPath)
    // Wait for redirect to style editor
    await this.page.waitForURL(/\/create\/[^/]+\/style/, { timeout: 30_000 })
  }
}
