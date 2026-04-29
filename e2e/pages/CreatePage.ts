import type { Page } from '@playwright/test'
import { fileURLToPath } from 'url'
import * as path from 'path'

const DEFAULT_GPX = path.join(path.dirname(fileURLToPath(import.meta.url)), '../fixtures/sample.gpx')

export class CreatePage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/create')
  }

  async uploadGpx(gpxPath = DEFAULT_GPX) {
    // Wait for the page to be fully interactive before clicking tabs.
    // On the first cold-server load, Playwright can click before Vue has
    // hydrated, in which case the onClick handler is never wired up.
    await this.page.waitForLoadState('networkidle')

    // Switch to the Upload tab (default view is Strava)
    await this.page.getByRole('button', { name: /upload a route/i }).click()

    // Confirm the upload panel is visible (proves Vue handled the click)
    // v-show hides with display:none, so waitFor visible = genuinely shown
    await this.page
      .getByText(/Drop your route here/i)
      .waitFor({ state: 'visible', timeout: 10_000 })

    const input = this.page.locator('input[type="file"]').first()
    await input.setInputFiles(gpxPath)

    // Wait for GPX parsing to finish — success banner confirms parsedGeojson is set
    await this.page.getByText('Route loaded').waitFor({ timeout: 15_000 })

    // Submit: create the map record and redirect to the style editor
    await this.page.getByRole('button', { name: /continue to styling/i }).click()
    await this.page.waitForURL(/\/create\/[^/]+\/style/, { timeout: 30_000 })
  }
}
