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
    await expect(page.getByTestId('composition-footer-note')).toBeVisible()

    await page.goto('/style-browser-fixture?composition=brutalist-slab&theme=brutalist')
    await expect(page.getByTestId('composition-footer-note')).toContainText('UNCOATED')
    await expect(page.getByTestId('composition-map-badges')).toHaveCount(0)
  })

  test('keeps footer divider aligned with the inset title rule', async ({ page }) => {
    await page.goto('/style-browser-fixture?composition=brutalist-slab&theme=brutalist')

    const boxes = await page.evaluate(() => {
      const titleRule = document.querySelector<HTMLElement>('.poster-rule')
      const footerRule = document.querySelector<HTMLElement>('[data-testid="poster-footer-rule"]')
      return {
        titleRule: titleRule?.getBoundingClientRect().toJSON(),
        footerRule: footerRule?.getBoundingClientRect().toJSON(),
        footerRuleStyle: footerRule ? getComputedStyle(footerRule).height : '',
      }
    })

    expect(boxes.titleRule).toBeTruthy()
    expect(boxes.footerRule).toBeTruthy()
    expect(Math.abs(boxes.footerRule!.x - boxes.titleRule!.x)).toBeLessThanOrEqual(1)
    expect(Math.abs(boxes.footerRule!.width - boxes.titleRule!.width)).toBeLessThanOrEqual(2)
    expect(boxes.footerRuleStyle).toBe('1px')
  })

  test('lets text overlays use a highlight background from the inline toolbar', async ({ page }) => {
    await page.goto('/style-browser-fixture?composition=brutalist-slab&theme=brutalist&editable=1&overlay=1')

    const overlay = page.locator('[data-overlay-id="fixture-overlay-label"]')
    await expect(overlay).toBeVisible()
    await expect.poll(async () => {
      await overlay.click({ position: { x: 8, y: 8 } })
      return page.locator('.inline-text-toolbar').count()
    }).toBe(1)
    await expect(page.getByTitle('Text highlight')).toBeVisible()
    await page.getByTitle('Text highlight').click()

    await expect.poll(async () => overlay.evaluate(el => getComputedStyle(el).backgroundColor)).toBe('rgb(232, 93, 117)')
    await page.getByTitle('Text highlight').click()
    await expect.poll(async () => overlay.evaluate(el => getComputedStyle(el).backgroundColor)).toBe('rgba(0, 0, 0, 0)')
  })

  test('makes every composition text cue editable and removable', async ({ page }) => {
    await page.goto('/style-browser-fixture?composition=journal-spread&theme=field-journal&editable=1')

    await expect(page.getByTestId('composition-kicker')).toHaveAttribute('contenteditable', 'true')
    await expect(page.getByTestId('composition-meta-line')).toHaveAttribute('contenteditable', 'true')
    await expect(page.getByTestId('composition-footer-note')).toHaveAttribute('contenteditable', 'true')
    await expect(page.getByTestId('composition-side-rail-label')).toHaveAttribute('contenteditable', 'true')
    await page.locator('.maplibregl-canvas').waitFor({ state: 'visible', timeout: 15_000 })
    await page.waitForTimeout(500)

    await page.getByTestId('composition-kicker').fill('Edited field label')
    await page.keyboard.press('Tab')
    await expect(page.getByTestId('composition-kicker')).toContainText('EDITED FIELD LABEL')

    await page.getByTestId('composition-footer-note').fill('')
    await page.keyboard.press('Tab')
    await expect(page.getByTestId('composition-footer-note')).toHaveCount(0)
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

  test('keeps side-rail compositions aligned with the content area', async ({ page }) => {
    await page.goto('/style-browser-fixture?composition=modernist-block&theme=bold-modern')

    const boxes = await page.evaluate(() => {
      const rail = document.querySelector<HTMLElement>('[data-testid="composition-side-rail"]')
      const rightRail = document.querySelector<HTMLElement>('[data-testid="composition-side-rail-right"]')
      const map = document.querySelector<HTMLElement>('[data-testid="poster-map"]')
      const poster = document.querySelector<HTMLElement>('[data-testid="poster-canvas"]')
      const titleRule = document.querySelector<HTMLElement>('.poster-rule')
      return {
        rail: rail?.getBoundingClientRect().toJSON(),
        rightRail: rightRail?.getBoundingClientRect().toJSON(),
        map: map?.getBoundingClientRect().toJSON(),
        poster: poster?.getBoundingClientRect().toJSON(),
        titleRule: titleRule?.getBoundingClientRect().toJSON(),
        frameCount: document.querySelectorAll('[data-testid="poster-inset-frame"]').length,
      }
    })

    expect(boxes.rail).toBeTruthy()
    expect(boxes.rightRail).toBeTruthy()
    expect(boxes.map).toBeTruthy()
    expect(boxes.poster).toBeTruthy()
    expect(boxes.titleRule).toBeTruthy()
    expect(Math.abs(boxes.rail!.x - boxes.map!.x)).toBeLessThanOrEqual(1)
    expect(Math.abs(boxes.rail!.y - boxes.map!.y)).toBeLessThanOrEqual(1)
    expect(Math.abs((boxes.rail!.y + boxes.rail!.height) - (boxes.map!.y + boxes.map!.height))).toBeLessThanOrEqual(1)
    expect(Math.abs(boxes.rail!.width - (boxes.titleRule!.x - boxes.poster!.x))).toBeLessThanOrEqual(1)
    expect(Math.abs((boxes.rightRail!.x + boxes.rightRail!.width) - (boxes.map!.x + boxes.map!.width))).toBeLessThanOrEqual(1)
    expect(Math.abs(boxes.rightRail!.x - (boxes.titleRule!.x + boxes.titleRule!.width))).toBeLessThanOrEqual(1)
    expect(Math.abs((boxes.map!.x + boxes.map!.width) - (boxes.poster!.x + boxes.poster!.width))).toBeLessThanOrEqual(1)
    expect(boxes.frameCount).toBe(0)
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

  test('keeps Modernist map framed inside the content column with visible topo detail', async ({ page }) => {
    await page.goto('/style-browser-fixture?composition=modernist-block&theme=bold-modern')
    await page.locator('.maplibregl-canvas').waitFor({ state: 'visible', timeout: 15_000 })

    const layout = await page.evaluate(() => {
      const poster = document.querySelector<HTMLElement>('[data-testid="poster-canvas"]')
      const rail = document.querySelector<HTMLElement>('[data-testid="composition-side-rail"]')
      const rightRail = document.querySelector<HTMLElement>('[data-testid="composition-side-rail-right"]')
      const map = document.querySelector<HTMLElement>('[data-testid="poster-map"]')
      const route = document.querySelector<HTMLElement>('.maplibregl-canvas')
      const posterBox = poster?.getBoundingClientRect()
      const railBox = rail?.getBoundingClientRect()
      const rightRailBox = rightRail?.getBoundingClientRect()
      const mapBox = map?.getBoundingClientRect()
      return {
        poster: posterBox?.toJSON(),
        rail: railBox?.toJSON(),
        rightRail: rightRailBox?.toJSON(),
        map: mapBox?.toJSON(),
        hasCanvas: !!route,
      }
    })

    expect(layout.poster).toBeTruthy()
    expect(layout.rail).toBeTruthy()
    expect(layout.rightRail).toBeTruthy()
    expect(layout.map).toBeTruthy()
    expect(layout.hasCanvas).toBe(true)
    expect(Math.abs(layout.rail!.x - layout.map!.x)).toBeLessThanOrEqual(1)
    expect(Math.abs(layout.rail!.y - layout.map!.y)).toBeLessThanOrEqual(1)
    expect(Math.abs((layout.rail!.y + layout.rail!.height) - (layout.map!.y + layout.map!.height))).toBeLessThanOrEqual(1)
    expect(Math.abs((layout.rightRail!.x + layout.rightRail!.width) - (layout.map!.x + layout.map!.width))).toBeLessThanOrEqual(1)
    expect(Math.abs((layout.map!.x + layout.map!.width) - (layout.poster!.x + layout.poster!.width))).toBeLessThanOrEqual(1)

    const styleSummary = await page.evaluate(() => {
      const nuxt = document.querySelector<HTMLElement>('[data-testid="poster-canvas"]')
      return {
        theme: nuxt?.dataset.theme,
        layers: (window as unknown as { __RADMAPS_RENDER_STATUS?: unknown }).__RADMAPS_RENDER_STATUS,
      }
    })
    expect(styleSummary.theme).toBe('bold-modern')
  })

  test('keeps the Modernist editable side rail label fixed inside the rail', async ({ page }) => {
    await page.goto('/style-browser-fixture?composition=modernist-block&theme=bold-modern&editable=1')

    const label = page.getByTestId('composition-side-rail-label')
    await label.fill('RADMAPS ROUTE OBJECT FIELD ARCHIVE')
    await page.keyboard.press('Tab')

    const boxes = await page.evaluate(() => {
      const rail = document.querySelector<HTMLElement>('[data-testid="composition-side-rail"]')
      const labelEl = document.querySelector<HTMLElement>('[data-testid="composition-side-rail-label"]')
      return {
        rail: rail?.getBoundingClientRect().toJSON(),
        label: labelEl?.getBoundingClientRect().toJSON(),
        writingMode: labelEl ? getComputedStyle(labelEl).writingMode : '',
      }
    })

    expect(boxes.rail).toBeTruthy()
    expect(boxes.label).toBeTruthy()
    expect(boxes.writingMode).toBe('vertical-rl')
    expect(boxes.label!.x).toBeGreaterThanOrEqual(boxes.rail!.x - 1)
    expect(boxes.label!.x + boxes.label!.width).toBeLessThanOrEqual(boxes.rail!.x + boxes.rail!.width + 1)
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
