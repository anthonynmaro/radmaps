// Editor-v2 ACCEPTANCE (docs/EDITOR_UX_NORTH_STAR.md §Acceptance, D4 DoD).
//
// The north-star demo on editorial-minimal with a real route, all direct
// manipulation, ZERO side-panel opens: edit the title from its floating
// toolbar, drag the band divider and watch the title refit, drag an image
// over the map, add a data-bound stat chip from the + menu, recolor a band
// from an empty-space click, reset an element. Plus the drawer entry point
// (empty map click) and the flag-off guarantee (no editor-v2 chrome mounts).
//
// "Order a proof" from the demo is NOT executable headless — proof parity is
// covered by the render-hash/golden gates; geometry parity here is asserted
// through the shared poster_layout/style state both renderers consume.
//
// Runs against /style-browser-fixture?surface=1 (the full MapEditorSurface,
// auth-free, dev-only). Flag state is forced deterministically with the
// fixture's `?flags=` override (SSR + client), independent of the dev
// environment's Supabase flag rows. Desktop grammar only — mobile keeps the
// bottom-sheet pattern and is exercised elsewhere.

import { expect, test, type Locator, type Page } from '@playwright/test'

const FIXTURE = '/style-browser-fixture?surface=1&theme=editorial-minimal&composition=editorial-tall&asset=1&flags=editor_v2'
const FIXTURE_FLAG_OFF = FIXTURE.replace('&flags=editor_v2', '&flags=')

test.beforeEach(async ({ }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile', 'desktop selection grammar; mobile keeps the bottom sheet')
})

async function gotoEditorV2(page: Page, url = FIXTURE) {
  await page.goto(url)
  await expect(page.getByTestId('poster-canvas')).toBeVisible({ timeout: 30_000 })
  await expect(page.locator('.maplibregl-canvas')).toBeVisible({ timeout: 30_000 })
  await expect(page.getByTestId('poster-add-button')).toBeVisible({ timeout: 15_000 })
}

// Floating toolbars are position:fixed teleports; assert they sit inside the
// viewport, then click through the DOM (Playwright's auto-scroll retries
// forever on fixed-position targets in a scrollable fixture page).
async function clickFixed(locator: Locator) {
  const box = await locator.boundingBox()
  expect(box, 'fixed-position control should have a box').toBeTruthy()
  expect(box!.y).toBeGreaterThanOrEqual(0)
  expect(box!.x).toBeGreaterThanOrEqual(0)
  await locator.evaluate(el => (el as HTMLElement).click())
}

function advancedDrawerClosed(page: Page) {
  return expect(page.getByTestId('advanced-drawer-button')).toBeVisible()
}

test.describe('editor-v2 acceptance — the north-star demo', () => {
  test('every common customization by direct manipulation, zero panel opens', async ({ page }) => {
    await gotoEditorV2(page)

    // The panel is the Advanced drawer and starts collapsed (D4).
    await advancedDrawerClosed(page)

    // ── 1. Click the title → floating toolbar → change its color ───────────
    const title = page.locator('.poster-trail-name')
    await title.click()
    const textToolbar = page.getByTestId('poster-element-toolbar')
    await expect(textToolbar).toBeVisible()
    await textToolbar.locator('.toolbar-color input[type="color"]').first().evaluate((input: HTMLInputElement) => {
      input.value = '#b91c1c'
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await expect.poll(async () =>
      title.evaluate(el => getComputedStyle(el).color),
    ).toBe('rgb(185, 28, 28)')
    await clickFixed(textToolbar.getByTestId('element-toolbar-close'))
    await expect(page.getByTestId('poster-element-toolbar')).toHaveCount(0)

    // ── 2. Drag the band divider → the band trades height with the map and
    //       the title refits live ───────────────────────────────────────────
    const poster = page.getByTestId('poster-canvas')
    const headerPct = async () => {
      const posterBox = (await poster.boundingBox())!
      const headerBox = (await page.locator('.poster-header').boundingBox())!
      return (headerBox.height / posterBox.height) * 100
    }
    const titleSize = () => title.evaluate(el => Number.parseFloat(getComputedStyle(el).fontSize))
    const beforePct = await headerPct()
    const sizeBefore = await titleSize()
    const divider = page.getByTestId('band-divider-bottom')
    const dividerBox = (await divider.boundingBox())!
    const startX = dividerBox.x + dividerBox.width / 2
    const startY = dividerBox.y + dividerBox.height / 2
    await page.mouse.move(startX, startY)
    await page.mouse.down()
    for (let step = 1; step <= 10; step++) {
      await page.mouse.move(startX, startY - step * 10)
      await page.waitForTimeout(30) // let the rAF-coalesced flush keep up
    }
    await page.mouse.up()
    await expect.poll(headerPct).toBeGreaterThan(beforePct + 2)
    // Band grew upward → the title block refits; on editorial-minimal's
    // display title the fitted size must not exceed the pre-drag size.
    await expect.poll(titleSize).toBeLessThanOrEqual(sizeBefore)

    // No title selection happened mid-drag (the D2 hit-zone contract).
    await expect(page.getByTestId('poster-element-toolbar')).toHaveCount(0)
    // Let the post-drag text refits settle (serialized rAF-spanning passes) —
    // a re-render mid-pointerdown would make interact drop the next drag.
    await page.waitForTimeout(900)

    // ── 3. Drag the image over the map ──────────────────────────────────────
    const asset = page.locator('.image-asset').first()
    const mapBox = (await page.getByTestId('poster-map').boundingBox())!
    const assetBox = (await asset.boundingBox())!
    await page.mouse.move(assetBox.x + assetBox.width / 2, assetBox.y + assetBox.height / 2)
    await page.mouse.down()
    await page.mouse.move(mapBox.x + mapBox.width / 2, mapBox.y + mapBox.height / 2, { steps: 8 })
    await page.mouse.up()
    await expect.poll(async () => {
      const moved = (await asset.boundingBox())!
      const dx = Math.abs((moved.x + moved.width / 2) - (assetBox.x + assetBox.width / 2))
      const dy = Math.abs((moved.y + moved.height / 2) - (assetBox.y + assetBox.height / 2))
      return dx + dy
    }).toBeGreaterThan(20)

    // ── 4. + menu → data-bound stat chip over the map ───────────────────────
    await clickFixed(page.getByTestId('poster-add-button'))
    await clickFixed(page.getByTestId('poster-add-stat'))
    await clickFixed(page.getByTestId('poster-add-stat-elevation_gain'))
    const statOverlay = page.locator('.text-overlay').last()
    await expect(statOverlay).toContainText('FT GAIN')
    // Dropped centered over the map area, selected, toolbar open, read-only.
    const statBox = (await statOverlay.boundingBox())!
    expect(Math.abs((statBox.x + statBox.width / 2) - (mapBox.x + mapBox.width / 2))).toBeLessThan(24)
    await expect(page.getByTestId('poster-element-toolbar')).toBeVisible()
    await expect(page.getByTestId('element-toolbar-kind')).toHaveText('Stat')
    await expect(page.getByTestId('element-toolbar-text')).toHaveAttribute('readonly', '')
    await clickFixed(page.getByTestId('element-toolbar-close'))

    // ── 5. Recolor the band from an empty-space click (gesture 5) ───────────
    const headerBand = page.locator('.poster-header')
    const headerBox = (await headerBand.boundingBox())!
    // Bottom-left corner of the band: away from the title/meta slots.
    await page.mouse.click(headerBox.x + 24, headerBox.y + headerBox.height - 10)
    const bandToolbar = page.getByTestId('poster-band-toolbar')
    await expect(bandToolbar).toBeVisible()
    await expect(bandToolbar.getByTestId('element-toolbar-kind')).toHaveText('Header band')
    await bandToolbar.getByTestId('band-background-color').evaluate((input: HTMLInputElement) => {
      input.value = '#dcebe2'
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await expect.poll(() =>
      headerBand.evaluate(el => getComputedStyle(el).backgroundColor),
    ).toBe('rgb(220, 235, 226)')

    // ── 6. Per-band reset-to-template (the safety that makes exploration
    //       free) ────────────────────────────────────────────────────────────
    await clickFixed(bandToolbar.getByTestId('band-reset'))
    await expect.poll(() =>
      headerBand.evaluate(el => getComputedStyle(el).backgroundColor),
    ).not.toBe('rgb(220, 235, 226)')

    // ── The whole demo ran with the side panel CLOSED ───────────────────────
    await advancedDrawerClosed(page)
  })

  test('empty map-space click opens the Advanced drawer (gesture 5 entry point)', async ({ page }) => {
    await gotoEditorV2(page)
    await advancedDrawerClosed(page)
    const mapBox = (await page.getByTestId('poster-map').boundingBox())!
    // Top-left corner of the map: no route/segments there on the chicago
    // fixture. The map-selection handler attaches on MapLibre's load event,
    // which can land after first paint — retry the click until it takes.
    await expect.poll(async () => {
      await page.mouse.click(mapBox.x + 24, mapBox.y + 24)
      await page.waitForTimeout(400)
      return page.getByTestId('advanced-drawer-button').count()
    }, { timeout: 20_000 }).toBe(0)
  })

  test('viewpoint affordance replaces the buried panel card', async ({ page }) => {
    await gotoEditorV2(page)
    const map = page.getByTestId('poster-map')
    await map.hover()
    const pill = page.getByTestId('viewpoint-pill')
    await expect(pill).toBeVisible()
    await clickFixed(pill.getByTestId('viewpoint-lock'))
    await expect(pill.getByTestId('viewpoint-lock')).toContainText('Locked')
    await clickFixed(pill.getByTestId('viewpoint-lock'))
    await expect(pill.getByTestId('viewpoint-lock')).toContainText('Lock framing')
  })

  test('flag-off mounts none of the editor-v2 chrome', async ({ page }) => {
    await page.goto(FIXTURE_FLAG_OFF)
    await expect(page.getByTestId('poster-canvas')).toBeVisible({ timeout: 30_000 })
    await page.waitForTimeout(1500)
    await expect(page.getByTestId('poster-add-menu')).toHaveCount(0)
    await expect(page.getByTestId('band-divider-bottom')).toHaveCount(0)
    await expect(page.getByTestId('viewpoint-pill')).toHaveCount(0)
    await expect(page.getByTestId('poster-band-toolbar')).toHaveCount(0)
  })

  // Live-testing refinements (2026-06-12). Found driving the real editor:
  // a selected element could only be deselected by selecting something else —
  // Escape was swallowed by the contenteditable guard in onKeyDown.
  test('Escape deselects the active element (title slot and band)', async ({ page }) => {
    await gotoEditorV2(page)

    // Title slot: select, Escape, gone.
    await page.locator('.poster-trail-name').click()
    await expect(page.getByTestId('poster-element-toolbar')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('poster-element-toolbar')).toHaveCount(0)
    await expect(page.locator('.moveable-control-box')).toHaveCount(0)

    // Band selection: empty band space → band toolbar → Escape closes it.
    const header = page.locator('.poster-header')
    const point = await header.evaluate((el) => {
      const r = el.getBoundingClientRect()
      for (let fx = 0.08; fx <= 0.92; fx += 0.06) {
        const x = r.x + r.width * fx, y = r.y + r.height * 0.18
        if (document.elementFromPoint(x, y) === el) return { x, y }
      }
      return null
    })
    if (point) {
      await page.mouse.click(point.x, point.y)
      await expect(page.getByTestId('poster-band-toolbar')).toBeVisible()
      await page.keyboard.press('Escape')
      await expect(page.getByTestId('poster-band-toolbar')).toHaveCount(0)
    }
  })

  // A theme whose band background is transparent (paper shows through from the
  // poster) used to make the band-property swatch read solid black, because
  // rgba(0,0,0,0) parsed to #000000. The swatch must reflect the effective
  // visible color instead. usgs-vintage / park-quad has a transparent header.
  test('band background swatch reflects the effective color, never phantom black', async ({ page }) => {
    await gotoEditorV2(page, '/style-browser-fixture?surface=1&theme=usgs-vintage&composition=park-quad&flags=editor_v2')
    const header = page.locator('.poster-header')
    // The band must actually be transparent for this to be a meaningful test.
    const bandBg = await header.evaluate(el => getComputedStyle(el).backgroundColor)
    expect(bandBg).toBe('rgba(0, 0, 0, 0)')
    const point = await header.evaluate((el) => {
      const r = el.getBoundingClientRect()
      for (let fx = 0.08; fx <= 0.92; fx += 0.06) {
        const x = r.x + r.width * fx, y = r.y + r.height * 0.18
        if (document.elementFromPoint(x, y) === el) return { x, y }
      }
      return null
    })
    expect(point, 'expected empty header band space').toBeTruthy()
    await page.mouse.click(point!.x, point!.y)
    const swatch = page.getByTestId('poster-band-toolbar').getByTestId('band-background-color')
    await expect(swatch).toBeVisible()
    const value = await swatch.inputValue()
    expect(value.toLowerCase()).not.toBe('#000000')
  })
})
