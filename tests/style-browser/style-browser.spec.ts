import { expect, test } from '@playwright/test'

const compositions = [
  ['editorial-tall', 'editorial-minimal'],
  ['park-quad', 'usgs-vintage'],
  ['travel-banner', 'midcentury-travel'],
  ['riso-stack', 'risograph'],
  ['blueprint-grid', 'blueprint'],
  ['blueprint-strava', 'blueprint-strava'],
  ['journal-spread', 'field-journal'],
  ['modernist-block', 'bold-modern'],
  ['splits-grid', 'splits-stats'],
  ['bib-numerals', 'marathon-bib'],
  ['darksky-stars', 'dark-sky'],
  ['botanical-plate', 'botanical'],
  ['brutalist-slab', 'brutalist'],
] as const

test.describe('style browser visual harness', () => {
  for (const [composition, theme] of compositions) {
    test(`renders ${composition}`, async ({ page }) => {
      const consoleErrors: string[] = []
      page.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(msg.text())
      })

      await page.goto(`/style-browser-fixture?composition=${composition}&theme=${theme}`)

      const poster = page.getByTestId('poster-canvas')
      await expect(poster).toBeVisible()
      await expect(poster).toHaveAttribute('data-composition', composition)
      await expect(poster).toHaveAttribute('data-theme', theme)
      await expect(page.getByTestId('poster-header')).toBeVisible()
      await expect(page.getByTestId('poster-map')).toBeVisible()
      await expect(page.getByTestId('poster-footer')).toBeVisible()
      await expect(page.getByTestId('composition-kicker')).toBeVisible()

      await expect.poll(() => consoleErrors.filter(error => !error.includes('Failed to load resource')).join('\n')).toBe('')
    })
  }

  test('moves bottom-title compositions below the map', async ({ page }) => {
    await page.goto('/style-browser-fixture?composition=travel-banner&theme=midcentury-travel')
    const mapBox = await page.getByTestId('poster-map').boundingBox()
    const headerBox = await page.getByTestId('poster-header').boundingBox()
    expect(mapBox).toBeTruthy()
    expect(headerBox).toBeTruthy()
    expect(headerBox!.y).toBeGreaterThan(mapBox!.y)
  })

  test('moves top-title compositions above the map', async ({ page }) => {
    await page.goto('/style-browser-fixture?composition=editorial-tall&theme=editorial-minimal')
    const mapBox = await page.getByTestId('poster-map').boundingBox()
    const headerBox = await page.getByTestId('poster-header').boundingBox()
    expect(mapBox).toBeTruthy()
    expect(headerBox).toBeTruthy()
    expect(headerBox!.y).toBeLessThan(mapBox!.y)
  })

  test('renders composition-specific overlays', async ({ page }) => {
    await page.goto('/style-browser-fixture?composition=blueprint-grid&theme=blueprint')
    await expect(page.getByTestId('composition-grid-overlay')).toBeVisible()

    await page.goto('/style-browser-fixture?composition=darksky-stars&theme=dark-sky')
    await expect(page.getByTestId('composition-star-field')).toBeVisible()

    await page.goto('/style-browser-fixture?composition=journal-spread&theme=field-journal')
    await expect(page.getByTestId('composition-side-rail')).toBeVisible()
  })

  test('renders composition-specific printed cues', async ({ page }) => {
    await page.goto('/style-browser-fixture?composition=park-quad&theme=usgs-vintage')
    await expect(page.getByTestId('composition-kicker')).toContainText('Department')
    await expect(page.getByTestId('composition-map-badges')).toContainText('SCALE')
    await expect(page.getByTestId('composition-footer-note')).toBeVisible()

    await page.goto('/style-browser-fixture?composition=brutalist-slab&theme=brutalist')
    await expect(page.getByTestId('composition-map-badges')).toContainText('CONCRETE')
    await expect(page.getByTestId('composition-footer-note')).toContainText('UNCOATED')
  })

  test('renders thumbnail and final-print geometries from the same poster component', async ({ page }) => {
    await page.setViewportSize({ width: 900, height: 1300 })
    await page.goto('/style-browser-fixture?composition=blueprint-grid&theme=blueprint&width=720&height=1080')
    const thumbnailBox = await page.getByTestId('poster-canvas').boundingBox()
    expect(thumbnailBox).toBeTruthy()
    expect(Math.round(thumbnailBox!.width)).toBe(720)
    expect(Math.round(thumbnailBox!.height)).toBe(1080)

    await page.goto('/style-browser-fixture?composition=blueprint-grid&theme=blueprint&print=final&printScale=10')
    const print = await page.evaluate(() => {
      const poster = document.querySelector<HTMLElement>('[data-testid="poster-canvas"]')
      const box = poster?.getBoundingClientRect()
      const styles = poster ? getComputedStyle(poster) : null
      return {
        width: box?.width,
        height: box?.height,
        composition: poster?.dataset.composition,
        theme: poster?.dataset.theme,
        bleed: styles?.getPropertyValue('--print-bleed').trim(),
      }
    })

    expect(print.composition).toBe('blueprint-grid')
    expect(print.theme).toBe('blueprint')
    expect(Math.round(print.width ?? 0)).toBeGreaterThan(700)
    expect(Math.round(print.height ?? 0)).toBeGreaterThan(1000)
    expect(print.bleed).not.toBe('0px')
  })

  test('can target the grid to poster or map only', async ({ page }) => {
    await page.goto('/style-browser-fixture?composition=blueprint-grid&theme=blueprint&gridScope=poster')
    await expect(page.getByTestId('composition-grid-overlay')).toBeVisible()
    await expect(page.getByTestId('composition-map-grid-overlay')).toHaveCount(0)

    await page.goto('/style-browser-fixture?composition=blueprint-grid&theme=blueprint&gridScope=map')
    await expect(page.getByTestId('composition-grid-overlay')).toHaveCount(0)
    await expect(page.getByTestId('composition-map-grid-overlay')).toBeVisible()
  })

  test('keeps side-rail inset frames aligned with the content area', async ({ page }) => {
    await page.goto('/style-browser-fixture?composition=modernist-block&theme=bold-modern')

    const boxes = await page.evaluate(() => {
      const rail = document.querySelector<HTMLElement>('[data-testid="composition-side-rail"]')
      const frame = document.querySelector<HTMLElement>('[data-testid="poster-inset-frame"]')
      return {
        rail: rail?.getBoundingClientRect().toJSON(),
        frame: frame?.getBoundingClientRect().toJSON(),
      }
    })

    expect(boxes.rail).toBeTruthy()
    expect(boxes.frame).toBeTruthy()
    expect(boxes.frame!.x).toBeGreaterThan(boxes.rail!.x + boxes.rail!.width)
  })

  test('keeps Modernist title band and side rail high contrast', async ({ page }) => {
    await page.goto('/style-browser-fixture?composition=modernist-block&theme=bold-modern')

    await expect(page.getByTestId('poster-canvas')).toHaveAttribute('data-composition', 'modernist-block')
    const contrast = await page.evaluate(() => {
      const header = document.querySelector<HTMLElement>('[data-testid="poster-header"]')
      const title = document.querySelector<HTMLElement>('.poster-trail-name')
      const rail = document.querySelector<HTMLElement>('[data-testid="composition-side-rail"]')
      return {
        headerBg: header ? getComputedStyle(header).backgroundColor : '',
        titleColor: title ? getComputedStyle(title).color : '',
        railBg: rail ? getComputedStyle(rail).backgroundColor : '',
      }
    })

    expect(contrast.headerBg).toBe('rgb(28, 25, 23)')
    expect(contrast.railBg).toBe('rgb(28, 25, 23)')
    expect(contrast.titleColor).toBe('rgb(241, 234, 224)')
  })

  test('keeps Mid-Century title band high contrast', async ({ page }) => {
    await page.goto('/style-browser-fixture?composition=travel-banner&theme=midcentury-travel')

    await expect(page.getByTestId('poster-canvas')).toHaveAttribute('data-composition', 'travel-banner')
    const contrast = await page.evaluate(() => {
      const header = document.querySelector<HTMLElement>('[data-testid="poster-header"]')
      const title = document.querySelector<HTMLElement>('.poster-trail-name')
      return {
        headerBg: header ? getComputedStyle(header).backgroundColor : '',
        titleColor: title ? getComputedStyle(title).color : '',
      }
    })

    expect(contrast.headerBg).toBe('rgb(31, 51, 37)')
    expect(contrast.titleColor).toBe('rgb(240, 229, 197)')
  })
})
