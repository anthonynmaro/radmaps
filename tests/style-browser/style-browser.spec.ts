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
    await page.goto('/style-browser-fixture?composition=blueprint-grid&theme=blueprint&gridScope=poster')
    await expect(page.getByTestId('composition-grid-overlay')).toBeVisible()

    await page.goto('/style-browser-fixture?composition=darksky-stars&theme=dark-sky')
    await expect(page.getByTestId('composition-star-field')).toBeVisible()

    await page.goto('/style-browser-fixture?composition=journal-spread&theme=field-journal')
    await expect(page.getByTestId('composition-side-rail')).toBeVisible()
  })

  test('theme picker previews themes before mutating saved style', async ({ page }, testInfo) => {
    await page.goto('/style-browser-fixture?themePicker=1&width=1180&height=820')

    await expect(page.getByTestId('theme-lineup-step')).toBeVisible()
    expect(await page.getByTestId('theme-preview-card').count()).toBeGreaterThan(10)
    await expect(page.locator('.theme-lineup-grid-head')).toHaveCount(0)
    await expect(page.locator('.theme-lineup-icon-action')).toHaveCount(0)

    await expect.poll(async () => page.evaluate(() => {
      const fixture = (window as any).__RADMAPS_STYLE_FIXTURE__
      return fixture?.getStyle()?.color_theme ?? null
    })).toBe('editorial-minimal')

    await page.locator('[data-testid="theme-preview-card"][data-theme-id="blueprint"]').click()
    const heroPoster = page.locator('[data-testid="theme-picker-hero"] [data-testid="poster-canvas"]').first()
    await expect(heroPoster).toHaveAttribute('data-theme', 'blueprint')
    const heroPosterBox = await heroPoster.boundingBox()
    expect(heroPosterBox?.width).toBeGreaterThan(240)
    expect(heroPosterBox?.height).toBeGreaterThan(360)

    const afterSelectStyle = await page.evaluate(() => {
      const fixture = (window as any).__RADMAPS_STYLE_FIXTURE__
      return fixture?.getStyle()
    })
    expect(afterSelectStyle.color_theme).toBe('editorial-minimal')

    if (testInfo.project.name === 'mobile') {
      const applyBox = await page.getByTestId('theme-picker-apply-mobile').boundingBox()
      const designBox = await page.getByTestId('theme-picker-design-myself-mobile').boundingBox()
      expect(applyBox).toBeTruthy()
      expect(designBox).toBeTruthy()
      expect(designBox!.x + designBox!.width).toBeLessThanOrEqual(applyBox!.x)
    }

    await page.getByTestId(testInfo.project.name === 'mobile' ? 'theme-picker-apply-mobile' : 'theme-picker-apply').click()
    await expect(page.getByTestId('theme-lineup-step')).toHaveCount(0)

    const appliedStyle = await page.evaluate(() => {
      const fixture = (window as any).__RADMAPS_STYLE_FIXTURE__
      return fixture?.getStyle()
    })
    expect(appliedStyle.color_theme).toBe('blueprint')
    expect(appliedStyle.composition).toBe('blueprint-grid')
  })

  test('theme picker design-myself exits without applying the selected preview', async ({ page }, testInfo) => {
    await page.goto('/style-browser-fixture?themePicker=1&width=1180&height=820')
    await expect(page.getByTestId('theme-lineup-step')).toBeVisible()
    await expect.poll(async () => page.evaluate(() => Boolean((window as any).__RADMAPS_STYLE_FIXTURE__))).toBe(true)

    await page.locator('[data-testid="theme-preview-card"][data-theme-id="blueprint"]').click()
    await page.getByTestId(testInfo.project.name === 'mobile' ? 'theme-picker-design-myself-mobile' : 'theme-picker-design-myself').click()
    await expect(page.getByTestId('theme-lineup-step')).toHaveCount(0)

    const style = await page.evaluate(() => {
      const fixture = (window as any).__RADMAPS_STYLE_FIXTURE__
      return fixture?.getStyle()
    })
    expect(style.color_theme).toBe('editorial-minimal')
  })

  test('renders composition-specific printed cues', async ({ page }) => {
    await page.goto('/style-browser-fixture?composition=park-quad&theme=usgs-vintage')
    await expect(page.getByTestId('composition-kicker')).toContainText('Department')
    await expect(page.getByTestId('composition-footer-note')).toBeVisible()

    await page.goto('/style-browser-fixture?composition=riso-stack&theme=risograph')
    await expect(page.getByTestId('composition-kicker')).toContainText('Edition')
    await expect(page.getByTestId('composition-footer-note')).toHaveCount(0)

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

  test('lets image assets drag across header, map, and footer regions', async ({ page }) => {
    const fixtureUrl = '/style-browser-fixture?composition=editorial-tall&theme=editorial-minimal&editable=1&asset=1'
    const assetY = () => page.evaluate(() => {
      const fixture = (window as any).__RADMAPS_STYLE_FIXTURE__
      return fixture?.getStyle().image_overlays?.find((asset: { id: string }) => asset.id === 'fixture-logo-asset')?.y ?? 48
    })
    await page.goto(fixtureUrl)

    let asset = page.locator('[data-asset-id="fixture-logo-asset"]')
    await expect(asset).toBeVisible()
    await page.locator('.maplibregl-canvas').waitFor({ state: 'visible', timeout: 15_000 })
    await page.waitForTimeout(500)
    await asset.click()
    await expect(asset).toHaveClass(/is-selected/)

    const headerBox = await page.getByTestId('poster-header').boundingBox()
    expect(headerBox).toBeTruthy()

    let assetBox = await asset.boundingBox()
    expect(assetBox).toBeTruthy()
    await page.mouse.move(assetBox!.x + assetBox!.width / 2, assetBox!.y + assetBox!.height / 2)
    await page.mouse.down()
    await page.mouse.move(headerBox!.x + headerBox!.width / 2, headerBox!.y + 2, { steps: 20 })
    await page.mouse.up()

    await expect.poll(assetY).toBeLessThan(35)

    await page.goto(fixtureUrl)
    asset = page.locator('[data-asset-id="fixture-logo-asset"]')
    await expect(asset).toBeVisible()
    await page.locator('.maplibregl-canvas').waitFor({ state: 'visible', timeout: 15_000 })
    await page.waitForTimeout(500)
    await asset.click()
    await expect(asset).toHaveClass(/is-selected/)

    const freshFooterBox = await page.getByTestId('poster-footer').boundingBox()
    expect(freshFooterBox).toBeTruthy()

    assetBox = await asset.boundingBox()
    expect(assetBox).toBeTruthy()
    await page.mouse.move(assetBox!.x + assetBox!.width / 2, assetBox!.y + assetBox!.height / 2)
    await page.mouse.down()
    await page.mouse.move(freshFooterBox!.x + freshFooterBox!.width / 2, freshFooterBox!.y + freshFooterBox!.height - 2, { steps: 20 })
    await page.mouse.up()

    await expect.poll(assetY).toBeGreaterThan(50)
  })

  test('keeps image overlay chrome quiet and supports precise edge and keyboard placement', async ({ page }) => {
    const fixtureUrl = '/style-browser-fixture?composition=editorial-tall&theme=editorial-minimal&editable=1&asset=1'
    const assetPosition = () => page.evaluate(() => {
      const fixture = (window as any).__RADMAPS_STYLE_FIXTURE__
      const asset = fixture?.getStyle().image_overlays?.find((asset: { id: string }) => asset.id === 'fixture-logo-asset')
      return { x: asset?.x ?? 42, y: asset?.y ?? 48 }
    })
    await page.goto(fixtureUrl)

    const asset = page.locator('[data-asset-id="fixture-logo-asset"]')
    await expect(asset).toBeVisible()
    await page.locator('.maplibregl-canvas').waitFor({ state: 'visible', timeout: 15_000 })
    await page.waitForTimeout(500)

    await asset.click()
    await expect(asset).toHaveClass(/is-selected/)
    await expect(page.locator('.asset-quality-badge')).toHaveCount(0)

    await page.mouse.move(2, 2)
    await expect.poll(async () => asset.locator('.overlay-delete-btn').evaluate(el => getComputedStyle(el).opacity)).toBe('0')

    const assetBox = await asset.boundingBox()
    const posterBox = await page.locator('.poster-canvas').boundingBox()
    expect(assetBox).toBeTruthy()
    expect(posterBox).toBeTruthy()
    await page.mouse.move(assetBox!.x + assetBox!.width / 2, assetBox!.y + assetBox!.height / 2)
    await page.mouse.down()
    await page.mouse.move(posterBox!.x - posterBox!.width * 0.75, assetBox!.y + assetBox!.height / 2, { steps: 24 })
    await page.mouse.up()

    await expect.poll(async () => (await assetPosition()).x).toBeLessThan(0)

    const beforeKey = await assetPosition()
    await page.keyboard.press('ArrowRight')
    await expect.poll(async () => (await assetPosition()).x).toBeGreaterThan(beforeKey.x)

    await page.mouse.click(posterBox!.x + posterBox!.width - 4, posterBox!.y + posterBox!.height - 4)
    await expect(asset).not.toHaveClass(/is-selected/)
    const afterDeselect = await assetPosition()
    await page.keyboard.press('ArrowRight')
    await expect.poll(async () => (await assetPosition()).x).toBe(afterDeselect.x)
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

  test('applies inline point size and alignment edits to themed composition text', async ({ page }) => {
    await page.goto('/style-browser-fixture?composition=blueprint-grid&theme=blueprint&editable=1')

    const meta = page.getByTestId('composition-meta-line')
    await expect(meta).toBeVisible()
    const before = await meta.evaluate(el => Number.parseFloat(getComputedStyle(el).fontSize))

    await expect.poll(async () => {
      await meta.click({ force: true })
      return page.getByTestId('text-size-input').count()
    }).toBe(1)
    const sizeInput = page.getByTestId('text-size-input')
    await expect(sizeInput).toBeVisible()
    await sizeInput.fill('96')
    await sizeInput.evaluate((input) => {
      const el = input as HTMLInputElement
      el.dispatchEvent(new Event('change', { bubbles: true }))
    })

    await expect.poll(async () => meta.evaluate(el => Number.parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThan(before * 4)
    await page.getByTestId('text-align-right').click()
    await expect.poll(async () => meta.evaluate(el => getComputedStyle(el).textAlign)).toBe('right')
    await expect.poll(async () => page.evaluate(() => {
      const fixture = (window as any).__RADMAPS_STYLE_FIXTURE__
      return fixture?.getStyle().poster_text_overrides?.composition_meta
    })).toMatchObject({ font_size_pt: 96, align: 'right' })

    const opacity = page.locator('.inline-text-toolbar .opacity-slider')
    await expect(opacity).toBeVisible()
    await opacity.evaluate((input) => {
      const el = input as HTMLInputElement
      el.value = '1'
      el.dispatchEvent(new Event('input', { bubbles: true }))
    })

    await expect.poll(async () => meta.evaluate(el => Number.parseFloat(getComputedStyle(el).opacity))).toBeGreaterThan(0.98)
  })

  test('applies absolute point sizes to SVG pin labels', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'desktop SVG pin-label toolbar coverage')

    await page.goto('/style-browser-fixture?composition=travel-banner&theme=midcentury-travel&editable=1&pins=1')

    const finishLabel = page.getByTestId('pin-label-finish')
    await expect(finishLabel).toBeVisible()
    const before = await finishLabel.evaluate(el => Number.parseFloat(el.getAttribute('font-size') || '0'))

    await finishLabel.click({ force: true })
    const sizeInput = page.getByTestId('text-size-input')
    await expect(sizeInput).toBeVisible()
    await sizeInput.fill('120')
    await sizeInput.evaluate((input) => {
      const el = input as HTMLInputElement
      el.dispatchEvent(new Event('change', { bubbles: true }))
    })

    await expect.poll(async () => finishLabel.evaluate(el => Number.parseFloat(el.getAttribute('font-size') || '0'))).toBeGreaterThan(before * 2)
    await expect.poll(async () => page.evaluate(() => {
      const fixture = (window as any).__RADMAPS_STYLE_FIXTURE__
      return fixture?.getStyle().poster_text_overrides?.finish_pin_label
    })).toMatchObject({ font_size_pt: 120 })
  })

  test('edits chrome as rows with columns on desktop', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'desktop chrome grid coverage')

    await page.goto('/style-browser-fixture?composition=modernist-block&theme=bold-modern&editable=1&chrome=1')
    await page.locator('.maplibregl-canvas').waitFor({ state: 'visible', timeout: 15_000 })

    const headerGrid = page.getByTestId('chrome-band-header')
    const footerGrid = page.getByTestId('chrome-band-footer')
    await expect(headerGrid).toBeVisible()
    await expect(footerGrid).toBeVisible()
    await expect(page.locator('.poster-trail-name')).toBeHidden()
    await expect(page.locator('.inline-text-toolbar')).toHaveCount(0)

    const firstHeaderCell = headerGrid.locator('.chrome-grid-cell').first()
    await firstHeaderCell.click()
    const structurePopover = page.getByTestId('chrome-structure-popover')
    await expect(structurePopover).toBeVisible()
    const rowCountBefore = await headerGrid.locator('.chrome-grid-row').count()
    await structurePopover.getByText('+ Row').click()
    await expect(headerGrid.locator('.chrome-grid-row')).toHaveCount(rowCountBefore + 1)

    await expect.poll(async () => page.evaluate(() => {
      const fixture = (window as any).__RADMAPS_STYLE_FIXTURE__
      return fixture?.getStyle().poster_layout?.bands?.header?.rows?.length ?? 0
    })).toBeGreaterThan(rowCountBefore)

    const firstFooterCell = footerGrid.locator('.chrome-grid-cell').first()
    const footerCellCountBefore = await footerGrid.locator('.chrome-grid-cell').count()
    await firstFooterCell.click()
    await structurePopover.getByText('+ Col').click()
    await expect(footerGrid.locator('.chrome-grid-cell')).toHaveCount(footerCellCountBefore + 1)

    await firstFooterCell.click()
    await structurePopover.getByText('Clear').click()
    await expect(firstFooterCell.locator('.chrome-empty-cell-btn')).toBeVisible()
    await expect.poll(async () => page.evaluate(() => {
      const fixture = (window as any).__RADMAPS_STYLE_FIXTURE__
      const firstCell = fixture?.getStyle().poster_layout?.bands?.footer?.rows?.[0]?.cells?.[0]
      return firstCell?.block?.empty === true
    })).toBe(true)

    await firstFooterCell.locator('.chrome-empty-cell-btn').click()
    await expect(firstFooterCell.locator('.chrome-grid-block')).toContainText('Your text')

    const subtitleCell = headerGrid.locator('[data-chrome-cell-id="hdr-location"]')
    await expect(subtitleCell).toBeVisible()
    await subtitleCell.click()
    await structurePopover.getByText('Remove').click()
    await expect(headerGrid.locator('[data-chrome-cell-id="hdr-location"]')).toHaveCount(0)
    await expect.poll(async () => page.evaluate(() => {
      const fixture = (window as any).__RADMAPS_STYLE_FIXTURE__
      return fixture?.getStyle().poster_layout?.bands?.header?.rows?.find((row: any) => row.id === 'header-subtitle')?.deleted === true
    })).toBe(true)
  })

  test('wires chrome grid edits through the map editor surface', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'desktop editor-surface chrome coverage')

    await page.goto('/style-browser-fixture?surface=1&composition=modernist-block&theme=bold-modern&chrome=1&width=1180&height=820')
    await page.locator('.maplibregl-canvas').waitFor({ state: 'visible', timeout: 15_000 })

    const surface = page.getByTestId('map-editor-surface')
    await expect(surface).toHaveAttribute('data-chrome-editing', 'true')

    const footerGrid = page.getByTestId('chrome-band-footer')
    const coordinateCell = footerGrid.locator('[data-chrome-cell-id="ft-coords"]')
    await expect(coordinateCell).toBeVisible()
    await coordinateCell.click()

    const textToolbar = page.getByTestId('chrome-selection-toolbar')
    const structurePopover = page.getByTestId('chrome-structure-popover')
    await expect(textToolbar).toBeVisible()
    await expect(structurePopover).toBeVisible()
    await expect.poll(async () => {
      const textBox = await textToolbar.boundingBox()
      const structureBox = await structurePopover.boundingBox()
      if (!textBox || !structureBox) return false
      const horizontalOverlap = textBox.x < structureBox.x + structureBox.width && structureBox.x < textBox.x + textBox.width
      const verticalOverlap = textBox.y < structureBox.y + structureBox.height && structureBox.y < textBox.y + textBox.height
      return !(horizontalOverlap && verticalOverlap)
    }).toBe(true)

    const headerGrid = page.getByTestId('chrome-band-header')
    const subtitleCell = headerGrid.locator('[data-chrome-cell-id="hdr-location"]')
    await expect(subtitleCell).toBeVisible()
    await subtitleCell.click()

    await expect(structurePopover).toBeVisible()
    await structurePopover.getByText('Remove').click()

    await expect(headerGrid.locator('[data-chrome-cell-id="hdr-location"]')).toHaveCount(0)
    await expect.poll(async () => page.evaluate(() => {
      const fixture = (window as any).__RADMAPS_STYLE_FIXTURE__
      return fixture?.getStyle().poster_layout?.bands?.header?.rows?.find((row: any) => row.id === 'header-subtitle')?.deleted === true
    })).toBe(true)
  })

  test('renders the chrome grid editor on mobile without floating text toolbar', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'mobile chrome grid coverage')

    await page.goto('/style-browser-fixture?composition=modernist-block&theme=bold-modern&editable=1&chrome=1&width=390&height=585')
    await page.locator('.maplibregl-canvas').waitFor({ state: 'visible', timeout: 15_000 })

    const footerGrid = page.getByTestId('chrome-band-footer')
    await expect(footerGrid).toBeVisible()
    await footerGrid.locator('.chrome-grid-cell').first().click()
    await expect(page.getByTestId('chrome-mobile-drawer')).toBeVisible()
    await expect(footerGrid.locator('.chrome-inline-popover')).toHaveCount(0)
    await expect(page.locator('.inline-text-toolbar')).toHaveCount(0)
  })

  test('preserves map camera when label toggles rebuild the style', async ({ page }) => {
    await page.goto('/style-browser-fixture?composition=journal-spread&theme=field-journal&editable=1')
    await page.locator('.maplibregl-canvas').waitFor({ state: 'visible', timeout: 15_000 })
    await expect.poll(async () => page.evaluate(() => {
      const win = window as unknown as {
        __RADMAPS_MAP_CAMERA__?: { get: () => unknown; jumpTo: (camera: unknown) => void }
        __RADMAPS_STYLE_FIXTURE__?: { getStyle: () => { show_place_labels?: boolean }; setStyle: (patch: unknown) => void }
      }
      return Boolean(win.__RADMAPS_MAP_CAMERA__ && win.__RADMAPS_STYLE_FIXTURE__)
    })).toBe(true)

    await page.evaluate(() => {
      const win = window as unknown as {
        __RADMAPS_MAP_CAMERA__: { jumpTo: (camera: { center: [number, number]; zoom: number }) => void }
      }
      win.__RADMAPS_MAP_CAMERA__.jumpTo({ center: [-87.66, 41.875], zoom: 12.25 })
    })
    await page.waitForTimeout(100)
    const before = await page.evaluate(() => {
      const win = window as unknown as {
        __RADMAPS_MAP_CAMERA__: { get: () => { center: [number, number]; zoom: number } }
      }
      return win.__RADMAPS_MAP_CAMERA__.get()
    })

    await page.evaluate(() => {
      const win = window as unknown as {
        __RADMAPS_STYLE_FIXTURE__: { getStyle: () => { show_place_labels?: boolean }; setStyle: (patch: { show_place_labels: boolean }) => void }
      }
      win.__RADMAPS_STYLE_FIXTURE__.setStyle({ show_place_labels: !(win.__RADMAPS_STYLE_FIXTURE__.getStyle().show_place_labels !== false) })
    })
    await page.waitForTimeout(1_000)

    const after = await page.evaluate(() => {
      const win = window as unknown as {
        __RADMAPS_MAP_CAMERA__: { get: () => { center: [number, number]; zoom: number } }
      }
      return win.__RADMAPS_MAP_CAMERA__.get()
    })
    expect(after.zoom).toBeCloseTo(before.zoom, 3)
    expect(after.center[0]).toBeCloseTo(before.center[0], 5)
    expect(after.center[1]).toBeCloseTo(before.center[1], 5)
  })

  test('loads owned Atlas contour-wash waterway layers into the live MapLibre style', async ({ page }) => {
    await page.goto('/style-browser-fixture?composition=modernist-block&theme=contour-wash&editable=1')
    await page.locator('.maplibregl-canvas').waitFor({ state: 'visible', timeout: 15_000 })
    await expect.poll(async () => page.evaluate(() => {
      const win = window as unknown as {
        __RADMAPS_MAP_CAMERA__?: { getLayerIds?: () => string[] }
      }
      return win.__RADMAPS_MAP_CAMERA__?.getLayerIds?.().includes('radmaps-contour-wash-waterway') ?? false
    })).toBe(true)
  })

  test('updates Dark Sky contour weights live even with Atlas contour defaults', async ({ page }) => {
    await page.goto('/style-browser-fixture?composition=darksky-stars&theme=dark-sky&editable=1')
    await page.locator('.maplibregl-canvas').waitFor({ state: 'visible', timeout: 15_000 })
    await expect.poll(async () => page.evaluate(() => {
      const win = window as unknown as {
        __RADMAPS_STYLE_FIXTURE__?: { getStyle: () => { atlas_layer_settings?: { contour?: unknown } } }
        __RADMAPS_MAP_CAMERA__?: { getPaintProperty?: (layerId: string, property: string) => unknown }
      }
      return Boolean(
        win.__RADMAPS_STYLE_FIXTURE__?.getStyle().atlas_layer_settings?.contour
        && win.__RADMAPS_MAP_CAMERA__?.getPaintProperty?.('contours-minor', 'line-width'),
      )
    })).toBe(true)

    await page.evaluate(() => {
      const win = window as unknown as {
        __RADMAPS_STYLE_FIXTURE__: { setStyle: (patch: { contour_minor_width: number; contour_major_width: number }) => void }
      }
      win.__RADMAPS_STYLE_FIXTURE__.setStyle({
        contour_minor_width: 2,
        contour_major_width: 1.75,
      })
    })

    await expect.poll(async () => page.evaluate(() => {
      const win = window as unknown as {
        __RADMAPS_MAP_CAMERA__?: { getPaintProperty?: (layerId: string, property: string) => unknown }
      }
      return {
        minor: win.__RADMAPS_MAP_CAMERA__?.getPaintProperty?.('contours-minor', 'line-width'),
        major: win.__RADMAPS_MAP_CAMERA__?.getPaintProperty?.('contours-major', 'line-width'),
      }
    }), { timeout: 10_000 }).toEqual({
      minor: ['interpolate', ['linear'], ['zoom'], 5, 1.6, 14, 2],
      major: ['interpolate', ['linear'], ['zoom'], 5, 2.625, 14, 4.375],
    })
  })

  test('renders elevation profile as overlay or below-map band with literal opacity', async ({ page }) => {
    await page.goto('/style-browser-fixture?composition=editorial-tall&theme=editorial-minimal&editable=1&elevation=1')
    await page.locator('.maplibregl-canvas').waitFor({ state: 'visible', timeout: 15_000 })
    await expect.poll(async () => page.evaluate(() => {
      const win = window as unknown as {
        __RADMAPS_STYLE_FIXTURE__?: unknown
      }
      return Boolean(win.__RADMAPS_STYLE_FIXTURE__)
    })).toBe(true)

    await page.evaluate(() => {
      const win = window as unknown as {
        __RADMAPS_STYLE_FIXTURE__: { setStyle: (patch: Record<string, unknown>) => void }
      }
      win.__RADMAPS_STYLE_FIXTURE__.setStyle({
        show_elevation_profile: true,
        elevation_profile_position: 'map-overlay',
        elevation_profile_opacity: 1,
        elevation_profile_height: 24,
        elevation_profile_relief: 0.5,
      })
    })

    await expect(page.getByTestId('elevation-profile')).toBeVisible()
    await expect.poll(async () => page.evaluate(() => {
      const profile = document.querySelector<HTMLElement>('[data-testid="elevation-profile"]')
      if (!profile) return null
      return {
        position: window.getComputedStyle(profile).position,
        bottomStopOpacity: profile.querySelector('stop[offset="100%"]')?.getAttribute('stop-opacity'),
        strokeWidth: profile.querySelector('path[stroke]')?.getAttribute('stroke-width'),
        bandCount: document.querySelectorAll('[data-testid="elevation-profile-band"]').length,
      }
    })).toEqual({
      position: 'absolute',
      bottomStopOpacity: '1',
      strokeWidth: '1.15',
      bandCount: 0,
    })

    await page.evaluate(() => {
      const win = window as unknown as {
        __RADMAPS_STYLE_FIXTURE__: { setStyle: (patch: Record<string, unknown>) => void }
      }
      win.__RADMAPS_STYLE_FIXTURE__.setStyle({
        elevation_profile_position: 'separate-band',
        elevation_profile_height: 12,
      })
    })

    await expect(page.getByTestId('elevation-profile-band')).toBeVisible()
    await expect.poll(async () => page.evaluate(() => {
      const map = document.querySelector<HTMLElement>('[data-testid="poster-map"]')
      const band = document.querySelector<HTMLElement>('[data-testid="elevation-profile-band"]')
      const footer = document.querySelector<HTMLElement>('[data-testid="poster-footer"]')
      const profile = document.querySelector<HTMLElement>('[data-testid="elevation-profile"]')
      if (!map || !band || !footer || !profile) return null
      const mapBox = map.getBoundingClientRect()
      const bandBox = band.getBoundingClientRect()
      const footerBox = footer.getBoundingClientRect()
      return {
        profilePosition: window.getComputedStyle(profile).position,
        bandTopAfterMap: bandBox.top >= mapBox.bottom - 1,
        footerAfterBand: footerBox.top >= bandBox.bottom - 1,
        bandHeight: Math.round(bandBox.height),
        bottomStopOpacity: profile.querySelector('stop[offset="100%"]')?.getAttribute('stop-opacity'),
      }
    })).toMatchObject({
      profilePosition: 'relative',
      bandTopAfterMap: true,
      footerAfterBand: true,
      bottomStopOpacity: '1',
    })
  })

  test('renders first-party Toner light and dark presets with generated dot texture', async ({ page }) => {
    for (const { preset, variant } of [
      { preset: 'radmaps-toner-light', variant: 'light' },
      { preset: 'radmaps-toner-dark', variant: 'dark' },
    ] as const) {
      await page.goto(`/style-browser-fixture?preset=${preset}&roads=1&labels=1`)
      await page.locator('.maplibregl-canvas').waitFor({ state: 'visible', timeout: 15_000 })
      await expect.poll(async () => page.evaluate(() => {
        const win = window as unknown as {
          __RADMAPS_STYLE_FIXTURE__?: { getStyle: () => { preset?: string; show_roads?: boolean; show_place_labels?: boolean } }
          __RADMAPS_MAP_CAMERA__?: {
            getLayerIds?: () => string[]
            hasImage?: (id: string) => boolean
            getPaintProperty?: (layerId: string, property: string) => unknown
          }
        }
        const style = win.__RADMAPS_STYLE_FIXTURE__?.getStyle()
        const camera = win.__RADMAPS_MAP_CAMERA__
        const layerIds = win.__RADMAPS_MAP_CAMERA__?.getLayerIds?.() ?? []
        return {
          preset: style?.preset,
          roads: style?.show_roads,
          labels: style?.show_place_labels,
          hasDotsLayer: layerIds.includes(`${style?.preset}-park-dots`),
          hasDotsImage: camera?.hasImage?.(`radmaps-toner-dot-${style?.preset === 'radmaps-toner-dark' ? 'dark' : 'light'}-soft`) ?? false,
          background: camera?.getPaintProperty?.('background', 'background-color'),
          majorRoad: camera?.getPaintProperty?.(`${style?.preset}-roads-major`, 'line-color'),
          parkPattern: camera?.getPaintProperty?.(`${style?.preset}-park-dots`, 'fill-pattern'),
        }
      }), { timeout: 20_000 }).toMatchObject({
        preset,
        roads: true,
        labels: true,
        hasDotsLayer: true,
        hasDotsImage: true,
        background: variant === 'dark' ? '#000000' : '#FFFFFF',
        majorRoad: variant === 'dark' ? '#FFFFFF' : '#000000',
        parkPattern: `radmaps-toner-dot-${variant}-soft`,
      })
    }
  })

  test('preserves 3D map camera when paint-only map settings change', async ({ page }) => {
    await page.goto('/style-browser-fixture?composition=journal-spread&theme=field-journal&editable=1')
    await page.locator('.maplibregl-canvas').waitFor({ state: 'visible', timeout: 15_000 })
    await expect.poll(async () => page.evaluate(() => {
      const win = window as unknown as {
        __RADMAPS_MAP_CAMERA__?: { get: () => unknown; jumpTo: (camera: unknown) => void }
        __RADMAPS_STYLE_FIXTURE__?: { setStyle: (patch: unknown) => void }
      }
      return Boolean(win.__RADMAPS_MAP_CAMERA__ && win.__RADMAPS_STYLE_FIXTURE__)
    })).toBe(true)

    await page.evaluate(() => {
      const win = window as unknown as {
        __RADMAPS_STYLE_FIXTURE__: { setStyle: (patch: Record<string, unknown>) => void }
      }
      win.__RADMAPS_STYLE_FIXTURE__.setStyle({
        preset: 'contour-art',
        map_3d: true,
        show_hillshade: true,
        show_roads: true,
        show_place_labels: true,
        show_poi_labels: true,
        map_pitch: 45,
        map_bearing: 12,
        terrain_exaggeration: 1.6,
        hillshade_intensity: 0.25,
        roads_opacity: 0.45,
        contour_opacity: 0.5,
      })
    })
    await page.waitForTimeout(1_000)
    await page.evaluate(() => {
      const win = window as unknown as {
        __RADMAPS_MAP_CAMERA__: { jumpTo: (camera: { center: [number, number]; zoom: number; pitch: number; bearing: number }) => void }
      }
      win.__RADMAPS_MAP_CAMERA__.jumpTo({ center: [-87.66, 41.875], zoom: 12.25, pitch: 45, bearing: 12 })
    })
    await page.waitForTimeout(100)
    const before = await page.evaluate(() => {
      const win = window as unknown as {
        __RADMAPS_MAP_CAMERA__: { get: () => { center: [number, number]; zoom: number; pitch: number; bearing: number } }
      }
      return win.__RADMAPS_MAP_CAMERA__.get()
    })

    await page.evaluate(() => {
      const win = window as unknown as {
        __RADMAPS_STYLE_FIXTURE__: { setStyle: (patch: Record<string, unknown>) => void }
      }
      win.__RADMAPS_STYLE_FIXTURE__.setStyle({
        hillshade_intensity: 0.5,
        roads_color: '#243B53',
        roads_opacity: 0.2,
        place_labels_color: '#102A43',
        place_labels_opacity: 0.35,
        poi_labels_color: '#334E68',
        poi_labels_opacity: 0.3,
        water_color: '#9CCFD8',
        contour_color: '#52738B',
        contour_major_color: '#1F425B',
        contour_opacity: 0.25,
        tile_contrast: 0.2,
        tile_saturation: -0.25,
        tile_hue_rotate: 15,
      })
    })
    await page.waitForTimeout(1_000)

    const after = await page.evaluate(() => {
      const win = window as unknown as {
        __RADMAPS_MAP_CAMERA__: { get: () => { center: [number, number]; zoom: number; pitch: number; bearing: number } }
      }
      return win.__RADMAPS_MAP_CAMERA__.get()
    })
    expect(after.zoom).toBeCloseTo(before.zoom, 3)
    expect(after.center[0]).toBeCloseTo(before.center[0], 5)
    expect(after.center[1]).toBeCloseTo(before.center[1], 5)
    expect(after.pitch).toBeCloseTo(before.pitch, 2)
    expect(after.bearing).toBeCloseTo(before.bearing, 2)
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

  test('poster editor v2 shows selectable text, image, icon layers with guides', async ({ page }) => {
    const consoleErrors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text())
    })

    await page.goto('/style-browser-fixture?composition=editorial-tall&theme=editorial-minimal&editable=1&overlay=1&asset=1&icon=1&posterEditor=1&posterMode=select&guides=1&selectedPosterElement=text:fixture-overlay-label')
    await expect(page.getByTestId('poster-canvas')).toBeVisible()
    await expect(page.getByTestId('poster-editor-guides')).toBeVisible()
    await expect(page.locator('[data-poster-element-id="text:fixture-overlay-label"]')).toHaveClass(/is-selected/)
    await expect(page.locator('[data-poster-element-id^="asset:"]')).toHaveCount(1)
    await expect(page.locator('[data-poster-element-id^="icon:"]')).toHaveCount(1)
    await expect(page.locator('.poster-element-moveable .moveable-control')).toHaveCount(9)
    await expect.poll(() => consoleErrors.filter(error => !error.includes('Failed to load resource')).join('\n')).toBe('')
  })

  test('poster editor guides are non-printing while printed grid remains printable', async ({ page }) => {
    await page.goto('/style-browser-fixture?composition=blueprint-grid&theme=blueprint&gridScope=poster&posterEditor=1&posterMode=guides&guides=1&print=final&printScale=10')
    await expect(page.getByTestId('poster-canvas')).toBeVisible()
    await expect(page.getByTestId('poster-editor-guides')).toHaveCount(0)
    await expect(page.getByTestId('composition-grid-overlay')).toBeVisible()
  })

  test('layout spike supports Framer/Puck-style structured poster editing on desktop', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'desktop layout-spike coverage')

    await page.goto('/style-browser-fixture?layoutSpike=1&width=1180&height=820')
    await expect(page.getByTestId('layout-spike')).toBeVisible()
    await expect.poll(() => page.evaluate(() => Boolean((window as any).__RADMAPS_POSTER_LAYOUT_SPIKE__))).toBe(true)
    await expect(page.getByTestId('layout-spike-left-rail')).toBeVisible()
    await expect(page.getByTestId('layout-spike-left-drawer')).toBeVisible()
    await expect(page.getByTestId('layout-spike-right-panel')).toBeVisible()
    await expect(page.getByTestId('layout-spike-mobile-bar')).toBeHidden()
    await expect(page.getByTestId('poster-canvas')).toBeVisible()
    await expect(page.getByTestId('layout-spike-library-notes')).toContainText('Puck')
    await expect(page.getByTestId('layout-spike-library-notes')).toContainText('Native Vue')

    await page.getByTestId('layout-spike-add-text').click()
    await expect(page.getByTestId('layout-spike-placement-layer')).toBeVisible()
    await expect(page.getByTestId('layout-spike-place-header')).toContainText('Add text to header')
    await page.getByTestId('layout-spike-place-header').click()
    const editableText = page.locator('[data-testid="layout-spike-block"].is-selected [data-testid^="layout-spike-text-"]')
    await expect(editableText).toBeVisible()
    await expect(page.getByTestId('layout-spike-selected-card')).toBeVisible()
    await expect(page.getByTestId('layout-spike-selected-delete')).toBeVisible()
    const boxBeforeTextEdit = await editableText.boundingBox()
    await editableText.click()
    const boxAfterFocus = await editableText.boundingBox()
    expect(boxBeforeTextEdit).toBeTruthy()
    expect(boxAfterFocus).toBeTruthy()
    expect(Math.abs(boxAfterFocus!.y - boxBeforeTextEdit!.y)).toBeLessThan(2)
    await editableText.fill('Inline trail note')
    await expect(editableText).toContainText('Inline trail note')

    const rowsBeforeSpacer = await page.getByTestId('layout-spike-row').count()
    await page.getByTestId('layout-spike-add-spacer').click()
    await expect(page.getByTestId('layout-spike-row')).toHaveCount(rowsBeforeSpacer + 1)
    const selectedSpacerBlock = page.locator('[data-testid="layout-spike-block"].is-selected')
    await expect(selectedSpacerBlock).toHaveClass(/layout-spike-block--spacer/)
    const spacerRow = selectedSpacerBlock.locator('xpath=ancestor::*[@data-testid="layout-spike-row"][1]')
    const spacerHeightBefore = await spacerRow.evaluate(row => (row as HTMLElement).getBoundingClientRect().height)
    const spacerDraftHeightBefore = await page.evaluate(() => {
      const spike = (window as any).__RADMAPS_POSTER_LAYOUT_SPIKE__
      const selected = document.querySelector<HTMLElement>('[data-testid="layout-spike-block"].is-selected')
      const row = selected?.closest<HTMLElement>('[data-testid="layout-spike-row"]')
      const rowId = row?.dataset.rowId
      return spike?.getDraft()?.bands.header.rows.find((candidate: any) => candidate.id === rowId)?.heightFr ?? 0
    })
    const spacerGrip = spacerRow.getByTestId('layout-spike-row-resize')
    const spacerGripBox = await spacerGrip.boundingBox()
    expect(spacerGripBox).toBeTruthy()
    await page.mouse.move(spacerGripBox!.x + spacerGripBox!.width / 2, spacerGripBox!.y + spacerGripBox!.height / 2)
    await page.mouse.down()
    await page.mouse.move(spacerGripBox!.x + spacerGripBox!.width / 2, spacerGripBox!.y + spacerGripBox!.height / 2 + 34, { steps: 4 })
    await page.mouse.up()
    await expect.poll(() => page.evaluate(() => {
      const spike = (window as any).__RADMAPS_POSTER_LAYOUT_SPIKE__
      const selected = document.querySelector<HTMLElement>('[data-testid="layout-spike-block"].is-selected')
      const row = selected?.closest<HTMLElement>('[data-testid="layout-spike-row"]')
      const rowId = row?.dataset.rowId
      return spike?.getDraft()?.bands.header.rows.find((candidate: any) => candidate.id === rowId)?.heightFr ?? 0
    })).toBeGreaterThan(spacerDraftHeightBefore)
    await expect.poll(() => spacerRow.evaluate(row => (row as HTMLElement).getBoundingClientRect().height)).toBeGreaterThanOrEqual(spacerHeightBefore)

    await page.getByTestId('layout-spike-add-row').click()
    await page.evaluate(() => {
      const blocks = Array.from(document.querySelectorAll<HTMLElement>('[data-testid="layout-spike-block"]'))
      const source = document.querySelector<HTMLElement>('[data-testid="layout-spike-block"].is-selected')
      const target = blocks.find(block => block !== source && !block.classList.contains('layout-spike-block--spacer'))
      const drop = target?.querySelector<HTMLElement>('[data-testid="layout-spike-drop-beside"]')
      if (!source || !target || !drop) throw new Error('Missing drag targets')
      const data = new DataTransfer()
      data.setData('text/plain', source.dataset.blockId ?? '')
      drop.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: data }))
      drop.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: data }))
    })
    await expect.poll(() => page.evaluate(() => {
      const spike = (window as any).__RADMAPS_POSTER_LAYOUT_SPIKE__
      const draft = spike?.getDraft()
      return draft?.bands.header.rows.some((row: any) => row.cells.length > 1) ?? false
    })).toBe(true)

    const firstColumnGrip = page.getByTestId('layout-spike-column-resize').first()
    const columnBefore = await page.evaluate(() => {
      const spike = (window as any).__RADMAPS_POSTER_LAYOUT_SPIKE__
      const row = spike?.getDraft()?.bands.header.rows.find((candidate: any) => candidate.cells.length > 1)
      return row?.cells[0]?.widthFr ?? 0
    })
    const columnGripBox = await firstColumnGrip.boundingBox()
    expect(columnGripBox).toBeTruthy()
    await page.mouse.move(columnGripBox!.x + columnGripBox!.width / 2, columnGripBox!.y + columnGripBox!.height / 2)
    await page.mouse.down()
    await page.mouse.move(columnGripBox!.x + columnGripBox!.width / 2 + 42, columnGripBox!.y + columnGripBox!.height / 2, { steps: 4 })
    await page.mouse.up()
    await expect.poll(() => page.evaluate(() => {
      const spike = (window as any).__RADMAPS_POSTER_LAYOUT_SPIKE__
      const row = spike?.getDraft()?.bands.header.rows.find((candidate: any) => candidate.cells.length > 1)
      return row?.cells[0]?.widthFr ?? 0
    })).toBeGreaterThan(columnBefore)

    await page.getByTestId('layout-spike-add-row').click()
    await page.locator('[data-testid="layout-spike-block"].is-selected [data-testid^="layout-spike-text-"]').fill('Reorder block')
    await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll<HTMLElement>('[data-testid="layout-spike-row"]'))
      const source = document.querySelector<HTMLElement>('[data-testid="layout-spike-block"].is-selected')
      const drop = rows[0]?.querySelector<HTMLElement>('[data-testid="layout-spike-drop-below"]')
      if (!source || !drop) throw new Error('Missing reorder targets')
      const data = new DataTransfer()
      data.setData('text/plain', source.dataset.blockId ?? '')
      drop.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: data }))
      drop.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: data }))
    })
    await expect.poll(() => page.evaluate(() => {
      const spike = (window as any).__RADMAPS_POSTER_LAYOUT_SPIKE__
      const rows = spike?.getDraft()?.bands.header.rows ?? []
      return rows.findIndex((row: any) => row.cells.some((cell: any) => cell.blocks.some((block: any) => block.text === 'Reorder block')))
    })).toBeGreaterThan(0)

    const blockCountBeforeDuplicate = await page.getByTestId('layout-spike-block').count()
    await page.getByTestId('layout-spike-block').last().click()
    await expect(page.getByTestId('layout-spike-context-toolbar')).toBeVisible()
    const toolbarIntersectsSelection = await page.evaluate(() => {
      const toolbar = document.querySelector<HTMLElement>('[data-testid="layout-spike-context-toolbar"]')
      const selected = document.querySelector<HTMLElement>('[data-testid="layout-spike-block"].is-selected')
      if (!toolbar || !selected) return true
      const a = toolbar.getBoundingClientRect()
      const b = selected.getBoundingClientRect()
      return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top
    })
    expect(toolbarIntersectsSelection).toBe(false)
    await page.getByTestId('layout-spike-duplicate-block').click()
    await expect(page.getByTestId('layout-spike-block')).toHaveCount(blockCountBeforeDuplicate + 1)
    await page.getByTestId('layout-spike-delete-block').click()
    await expect(page.getByTestId('layout-spike-block')).toHaveCount(blockCountBeforeDuplicate)

    const layoutBeforeRouteChange = await page.evaluate(() => JSON.stringify((window as any).__RADMAPS_POSTER_LAYOUT_SPIKE__?.getPosterLayout()))
    await page.getByTestId('layout-spike-route-color').locator('button').nth(1).click()
    await expect.poll(() => page.evaluate(() => (window as any).__RADMAPS_POSTER_LAYOUT_SPIKE__?.getStyle()?.route_color)).toBe('#2D6A4F')
    const layoutAfterRouteChange = await page.evaluate(() => JSON.stringify((window as any).__RADMAPS_POSTER_LAYOUT_SPIKE__?.getPosterLayout()))
    expect(layoutAfterRouteChange).toBe(layoutBeforeRouteChange)
  })

  test('layout spike switches to bottom sheets on mobile', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'mobile layout-spike coverage')

    await page.goto('/style-browser-fixture?layoutSpike=1&width=390&height=680')
    await expect(page.getByTestId('layout-spike')).toBeVisible()
    await expect.poll(() => page.evaluate(() => Boolean((window as any).__RADMAPS_POSTER_LAYOUT_SPIKE__))).toBe(true)
    await expect(page.getByTestId('layout-spike-left-rail')).toBeHidden()
    await expect(page.getByTestId('layout-spike-left-drawer')).toBeHidden()
    await expect(page.getByTestId('layout-spike-right-panel')).toBeHidden()
    await expect(page.getByTestId('layout-spike-mobile-bar')).toBeVisible()

    await page.getByTestId('layout-spike-mobile-insert').click()
    await expect(page.getByTestId('layout-spike-mobile-sheet')).toBeVisible()
    await page.getByTestId('layout-spike-mobile-add-text').click()
    const mobileText = page.locator('[data-testid^="layout-spike-text-"]').last()
    await expect(mobileText).toBeVisible()
    await mobileText.fill('Mobile inline note')
    await expect(mobileText).toContainText('Mobile inline note')
    await mobileText.evaluate(element => (element as HTMLElement).blur())

    await page.getByTestId('layout-spike-mobile-selected').dispatchEvent('click')
    await expect(page.getByTestId('layout-spike-mobile-duplicate')).toBeVisible()
    const mobileCountBeforeDuplicate = await page.getByTestId('layout-spike-block').count()
    await page.getByTestId('layout-spike-mobile-duplicate').click()
    await expect(page.getByTestId('layout-spike-block')).toHaveCount(mobileCountBeforeDuplicate + 1)
    await page.getByTestId('layout-spike-mobile-delete').click()
    await expect(page.getByTestId('layout-spike-block')).toHaveCount(mobileCountBeforeDuplicate)
  })

  test('fixed poster template editor keeps the map locked and edits chrome bands', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'desktop fixed-template editor coverage')

    await page.goto('/style-browser-fixture?surface=1&posterEditor=1&surfaceTemplateEditor=1&width=1180&height=820')
    await expect(page.getByTestId('fixed-template-editor')).toBeVisible()
    const fixedTemplateLeft = page.locator('.fixed-template-left')
    await expect(fixedTemplateLeft).not.toContainText('Poster')
    const fixedTemplateLeftBox = await fixedTemplateLeft.boundingBox()
    expect(fixedTemplateLeftBox).toBeTruthy()
    expect(fixedTemplateLeftBox!.width).toBeLessThanOrEqual(220)
    await expect(page.locator('[data-testid="puck-poster-spike"]')).toHaveCount(0)
    await expect.poll(() => page.evaluate(() => Boolean((window as any).__RADMAPS_FIXED_TEMPLATE_EDITOR__))).toBe(true)
    await expect(page.getByTestId('fixed-template-map-band')).toContainText('Map locked')
    await expect.poll(() => page.evaluate(() => {
      const win = window as unknown as {
        __RADMAPS_FIXED_TEMPLATE_EDITOR__?: { getPreviewStyle?: () => { map_frozen?: boolean } }
        __RADMAPS_MAP_CAMERA__?: { get?: () => { center: [number, number]; zoom: number } | null }
      }
      return Boolean(win.__RADMAPS_FIXED_TEMPLATE_EDITOR__?.getPreviewStyle?.().map_frozen && win.__RADMAPS_MAP_CAMERA__?.get?.())
    })).toBe(true)
    await expect(page.getByTestId('chrome-editor-app-bar')).toHaveCount(0)
    await expect(page.getByTestId('chrome-layout-builder')).toHaveCount(0)
    await page.getByTestId('template-preview-toggle').click()
    await expect(page.getByTestId('template-preview-toggle')).toContainText('Edit')
    await expect(page.locator('.fixed-template-map-preview .chrome-grid-band')).toHaveCount(0)
    await expect(page.getByTestId('fixed-template-map-band')).toHaveCount(0)
    await page.getByTestId('template-preview-toggle').click()
    await expect(page.getByTestId('template-preview-toggle')).toContainText('Preview')
    await expect(page.locator('.fixed-template-map-preview .chrome-grid-band')).toHaveCount(2)
    await expect(page.getByTestId('fixed-template-map-band')).toContainText('Map locked')

    await page.evaluate(() => {
      const win = window as unknown as {
        __RADMAPS_MAP_CAMERA__: {
          jumpTo: (camera: { center: [number, number]; zoom: number }) => void
        }
      }
      win.__RADMAPS_MAP_CAMERA__.jumpTo({ center: [-87.66, 41.875], zoom: 12.25 })
    })
    await page.waitForTimeout(100)
    const lockedCameraBefore = await page.evaluate(() => {
      const win = window as unknown as {
        __RADMAPS_MAP_CAMERA__: { get: () => { center: [number, number]; zoom: number } }
      }
      return win.__RADMAPS_MAP_CAMERA__.get()
    })
    const lockedMapBox = await page.getByTestId('poster-map').boundingBox()
    expect(lockedMapBox).toBeTruthy()
    await page.mouse.move(lockedMapBox!.x + lockedMapBox!.width / 2, lockedMapBox!.y + lockedMapBox!.height / 2)
    await page.mouse.wheel(0, -700)
    await page.mouse.down()
    await page.mouse.move(lockedMapBox!.x + lockedMapBox!.width / 2 + 70, lockedMapBox!.y + lockedMapBox!.height / 2 + 40)
    await page.mouse.up()
    await page.waitForTimeout(300)
    const lockedCameraAfter = await page.evaluate(() => {
      const win = window as unknown as {
        __RADMAPS_MAP_CAMERA__: { get: () => { center: [number, number]; zoom: number } }
      }
      return win.__RADMAPS_MAP_CAMERA__.get()
    })
    expect(lockedCameraAfter.zoom).toBeCloseTo(lockedCameraBefore.zoom, 5)
    expect(lockedCameraAfter.center[0]).toBeCloseTo(lockedCameraBefore.center[0], 5)
    expect(lockedCameraAfter.center[1]).toBeCloseTo(lockedCameraBefore.center[1], 5)

    const posterBox = await page.getByTestId('fixed-template-poster').boundingBox()
    expect(posterBox).toBeTruthy()
    expect(posterBox!.width / posterBox!.height).toBeCloseTo(2 / 3, 2)
    await expect(page.getByTestId('poster-canvas')).toBeVisible()
    await expect.poll(() => page.getByTestId('poster-header').evaluate((element) => {
      const style = window.getComputedStyle(element)
      return `${style.paddingTop} ${style.paddingBottom}`
    })).toBe('0px 0px')
    const chromeHeaderPadding = await page.getByTestId('poster-header').evaluate((element) => {
      const style = window.getComputedStyle(element)
      return {
        left: Number.parseFloat(style.paddingLeft),
        right: Number.parseFloat(style.paddingRight),
      }
    })
    expect(chromeHeaderPadding.left).toBeGreaterThan(posterBox!.width * 0.04)
    expect(chromeHeaderPadding.right).toBeGreaterThan(posterBox!.width * 0.04)

    const firstTextBlock = page.locator('.fixed-template-map-preview .chrome-grid-block[contenteditable="true"]').first()
    await expect(firstTextBlock).toBeVisible()
    const boxBeforeHover = await firstTextBlock.boundingBox()
    expect(boxBeforeHover).toBeTruthy()
    for (let index = 0; index < 4; index += 1) {
      await firstTextBlock.hover()
      await page.mouse.move(boxBeforeHover!.x + boxBeforeHover!.width + 12, boxBeforeHover!.y + 8)
    }
    const boxAfterHover = await firstTextBlock.boundingBox()
    expect(boxAfterHover).toBeTruthy()
    expect(Math.abs(boxAfterHover!.y - boxBeforeHover!.y)).toBeLessThan(2)
    expect(Math.abs(boxAfterHover!.height - boxBeforeHover!.height)).toBeLessThan(2)

    await firstTextBlock.click()
    await expect(page.getByTestId('template-delete-selected')).toBeVisible()
    await expect(page.getByTestId('template-duplicate-selected')).toBeVisible()
    await expect(page.getByTestId('template-font-select')).toBeVisible()
    await expect(page.getByTestId('template-text-size')).toBeVisible()
    await page.getByTestId('template-font-select').selectOption('Space Grotesk')
    await expect.poll(() => firstTextBlock.evaluate(element => window.getComputedStyle(element).fontFamily)).toContain('Space Grotesk')
    const boxBeforeEdit = await firstTextBlock.boundingBox()
    await firstTextBlock.fill('Kickapoo Endurance Race')
    await expect(firstTextBlock).toContainText('Kickapoo Endurance Race')
    const boxAfterEdit = await firstTextBlock.boundingBox()
    expect(boxBeforeEdit).toBeTruthy()
    expect(boxAfterEdit).toBeTruthy()
    expect(Math.abs(boxAfterEdit!.y - boxBeforeEdit!.y)).toBeLessThan(2)

    const cellCountBeforeColumn = await page.locator('.fixed-template-map-preview .chrome-grid-cell').count()
    await page.getByTestId('template-add-column').click()
    await expect(page.locator('.fixed-template-map-preview .chrome-grid-cell')).toHaveCount(cellCountBeforeColumn + 1)

    const blockCountBeforeDuplicate = await page.locator('.fixed-template-map-preview .chrome-grid-block').count()
    await page.getByTestId('template-duplicate-selected').click()
    await expect(page.locator('.fixed-template-map-preview .chrome-grid-block')).toHaveCount(blockCountBeforeDuplicate + 1)
    await page.getByTestId('template-delete-selected').click()
    await expect(page.locator('.fixed-template-map-preview .chrome-grid-block')).toHaveCount(blockCountBeforeDuplicate)

    await expect(page.getByTestId('template-map-height')).toHaveCount(0)
    await expect(page.locator('.fixed-template-two-controls')).toHaveCount(0)

    await page.getByTestId('template-tab-layers').click()
    const headerLayerGroup = page.locator('[data-testid="template-layer-group"][data-band-id="header"]')
    const footerLayerGroup = page.locator('[data-testid="template-layer-group"][data-band-id="footer"]')
    await expect(headerLayerGroup).toContainText('Eyebrow')
    await expect(headerLayerGroup).toContainText('Title')
    await expect(footerLayerGroup).not.toContainText('Eyebrow')
    await expect(footerLayerGroup).toContainText('Distance')

    const bottomHeaderSpacer = page.locator('.fixed-template-map-preview .chrome-grid-row[data-chrome-row-id="header-spacer-bottom"]')
    const headerTitleRow = page.locator('.fixed-template-map-preview .chrome-grid-row[data-chrome-row-id="header-title"]')
    await expect(bottomHeaderSpacer).toHaveCount(1)
    const spacerHeightBefore = await bottomHeaderSpacer.evaluate(element => element.getBoundingClientRect().height)
    const titleHeightBeforeRowDrag = await headerTitleRow.evaluate(element => element.getBoundingClientRect().height)
    await bottomHeaderSpacer.click()
    await expect(bottomHeaderSpacer.locator('.chrome-grid-cell.is-selected')).toHaveCount(1)
    await expect(bottomHeaderSpacer.locator('[data-testid="chrome-cell-trash"]')).toBeVisible()
    await expect(bottomHeaderSpacer.locator('[data-testid="chrome-cell-add-column"]')).toBeVisible()
    await expect(page.getByTestId('template-left-selection')).toContainText('Padding')
    await expect(page.getByTestId('template-left-selection')).not.toContainText('fr')
    const selectedPanelBox = await page.getByTestId('template-left-selection').boundingBox()
    const deleteRowBox = await page.getByTestId('template-delete-row').boundingBox()
    expect(selectedPanelBox).toBeTruthy()
    expect(deleteRowBox).toBeTruthy()
    expect(Math.abs(deleteRowBox!.x - (selectedPanelBox!.x + 8))).toBeLessThan(2)
    expect(await page.evaluate(() => {
      const row = document.querySelector<HTMLElement>('.fixed-template-map-preview .chrome-grid-row[data-chrome-row-id="header-spacer-bottom"]')
      if (!row) return false

      const controls = [
        row.querySelector<HTMLElement>('[data-testid="chrome-cell-trash"]'),
        row.querySelector<HTMLElement>('[data-testid="chrome-cell-add-column"]'),
      ]

      return controls.every((control) => {
        if (!control) return false
        const box = control.getBoundingClientRect()
        const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2)
        return hit === control || Boolean(hit && control.contains(hit))
      })
    })).toBe(true)
    await expect(page.getByTestId('template-left-selection')).toContainText('Gap')
    await expect(page.getByTestId('template-row-height')).toBeVisible()
    await bottomHeaderSpacer.hover()
    const rowResizeGrip = bottomHeaderSpacer.locator('[data-testid="chrome-row-resize-row"]')
    await expect(rowResizeGrip).toBeVisible()
    const rowGripBox = await rowResizeGrip.boundingBox()
    expect(rowGripBox).toBeTruthy()
    await page.mouse.move(rowGripBox!.x + rowGripBox!.width / 2, rowGripBox!.y + rowGripBox!.height / 2)
    await page.mouse.down()
    await page.mouse.move(rowGripBox!.x + rowGripBox!.width / 2, rowGripBox!.y + rowGripBox!.height / 2 + 26, { steps: 5 })
    await page.mouse.up()
    await expect.poll(() => bottomHeaderSpacer.evaluate(element => element.getBoundingClientRect().height)).toBeGreaterThan(spacerHeightBefore)
    const titleHeightAfterRowDrag = await headerTitleRow.evaluate(element => element.getBoundingClientRect().height)
    expect(Math.abs(titleHeightAfterRowDrag - titleHeightBeforeRowDrag)).toBeLessThan(6)
    await page.getByTestId('template-row-height').evaluate((input) => {
      const range = input as HTMLInputElement
      range.value = '1.7'
      range.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await expect.poll(() => bottomHeaderSpacer.evaluate(element => element.getBoundingClientRect().height)).toBeGreaterThan(spacerHeightBefore)
  })

  test('Puck poster spike renders a structured builder reference on desktop', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'desktop Puck reference coverage')

    await page.goto('/style-browser-fixture?puckReference=1&width=1180&height=820')
    await expect(page.locator('[data-testid="puck-poster-spike"]')).toBeVisible()
    await expect(page.locator('[data-testid="radmaps-puck-root"]')).toBeVisible()
    await expect(page.locator('[data-testid="radmaps-puck-map-band"]')).toContainText('MapPreview.vue stays render truth')
    await expect.poll(() => page.locator('[data-testid="radmaps-puck-text-block"]').count()).toBeGreaterThan(0)
    await expect(page.locator('body')).not.toContainText('[object Object]')

    const exported = await page.locator('[data-testid="puck-poster-spike-json"]').textContent()
    expect(exported).toBeTruthy()
    const document = JSON.parse(exported!)
    expect(document.source).toBe('puck-spike')
    expect(document.bands.map.renderer).toBe('MapPreview.vue')
    expect(document.bands.header.rows.length).toBeGreaterThan(0)
    expect(document.bands.footer.rows.length).toBeGreaterThan(0)
  })

  test('editor surface can mount the fixed template editor behind the template gate', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'desktop fixed-template surface coverage')

    await page.goto('/style-browser-fixture?surface=1&posterEditor=1&surfaceTemplateEditor=1&width=1180&height=820')
    await expect(page.getByTestId('map-editor-surface')).toBeVisible()
    await expect(page.getByTestId('map-editor-surface')).toHaveAttribute('data-chrome-editing', 'false')
    await expect(page.getByTestId('fixed-template-editor')).toBeVisible()
    await expect(page.getByTestId('chrome-editor-app-bar')).toHaveCount(0)
    await expect(page.getByTestId('chrome-layout-builder')).toHaveCount(0)
    await expect(page.getByTestId('template-map-height')).toHaveCount(0)
    await page.getByTestId('template-tab-layers').click()
    await expect(page.locator('[data-testid="template-layer-group"][data-band-id="header"]')).toContainText('Title')
    await expect(page.locator('[data-testid="template-layer-group"][data-band-id="footer"]')).toContainText('Distance')
    await page.locator('.fixed-template-map-preview .chrome-grid-block[contenteditable="true"]').first().click()
    await expect(page.getByTestId('template-left-selection')).toBeVisible()
    await expect(page.getByTestId('template-delete-selected')).toBeVisible()
    await expect(page.getByTestId('template-duplicate-selected')).toBeVisible()
    await expect(page.locator('.fixed-template-right')).toHaveCount(0)

    const stylePanel = page.getByTestId('style-panel')
    await expect(stylePanel).toBeVisible()
    await expect(stylePanel).toContainText('Style your map')
    await stylePanel.getByRole('button', { name: 'Quick', exact: true }).click()
    await expect(stylePanel).toContainText('Theme')
    await expect(stylePanel).toContainText('Route line')
    await stylePanel.getByRole('button', { name: 'Design', exact: true }).click()
    await expect(stylePanel).toContainText('Poster tools')
    await expect(stylePanel).toContainText('Guides')
    await expect(stylePanel).toContainText('Layers')
    await page.getByTestId('poster-tool-guides').click()
    await expect(page.getByTestId('map-editor-surface')).toHaveAttribute('data-chrome-editing', 'false')
    await stylePanel.getByRole('button', { name: 'Map', exact: true }).click()
    await expect(stylePanel).toContainText('Classic / provider maps')
    await expect(stylePanel).toContainText('Viewpoint')
    await stylePanel.getByRole('button', { name: 'Style', exact: true }).click()
    await expect(stylePanel).toContainText('Colors')
    await expect(stylePanel).toContainText('Grid')
    await expect(stylePanel).toContainText('Typography')
    await stylePanel.getByRole('button', { name: 'Text', exact: true }).click()
    await expect(stylePanel).toContainText('Global typography')
    await expect(stylePanel).toContainText('Stats & labels')
  })

  test('poster editor v2 defaults to chrome layout editing in the editor surface', async ({ page }, testInfo) => {
    await page.goto('/style-browser-fixture?surface=1&posterEditor=1&width=1180&height=820')
    await expect(page.getByTestId('map-editor-surface')).toHaveAttribute('data-chrome-editing', 'true')
    if (testInfo.project.name === 'mobile') {
      await expect(page.getByTestId('chrome-editor-app-bar')).toHaveCount(0)
      await expect(page.getByTestId('chrome-layout-builder')).toHaveCount(0)
      await expect(page.getByTestId('chrome-structure-popover')).toHaveCount(0)
      return
    }
    await expect(page.getByTestId('chrome-editor-app-bar')).toBeVisible()
    await expect(page.getByTestId('chrome-layout-builder')).toHaveCount(0)
    await expect(page.getByTestId('chrome-structure-popover')).toHaveCount(0)
    await expect(page.getByTestId('poster-editor-guides')).toHaveCount(0)
    const metrics = await page.evaluate(() => {
      const frame = document.querySelector<HTMLElement>('.mx-auto.bg-stone-100')
      const surface = document.querySelector<HTMLElement>('[data-testid="map-editor-surface"]')
      const poster = document.querySelector<HTMLElement>('[data-testid="poster-canvas"]')
      const box = (el: HTMLElement | null) => el?.getBoundingClientRect().toJSON() ?? null
      return {
        frame: box(frame),
        surface: box(surface),
        poster: box(poster),
        scrollHeight: document.documentElement.scrollHeight,
        viewportHeight: window.innerHeight,
      }
    })
    expect(metrics.frame).toBeTruthy()
    expect(metrics.surface).toBeTruthy()
    expect(metrics.poster).toBeTruthy()
    expect(metrics.surface!.bottom).toBeLessThanOrEqual(metrics.frame!.bottom + 1)
    expect(metrics.poster!.bottom).toBeLessThanOrEqual(metrics.frame!.bottom + 1)
    expect(metrics.poster!.width / metrics.poster!.height).toBeCloseTo(2 / 3, 2)
    expect(metrics.scrollHeight).toBeLessThanOrEqual(metrics.viewportHeight + 2)
    await page.getByText('Design', { exact: true }).click()
    await expect(page.getByRole('button', { name: 'Layout' })).toHaveCSS('background-color', 'rgb(220, 235, 226)')
    await page.getByTestId('poster-tool-text').click()
    await expect(page.getByTestId('map-editor-surface')).toHaveAttribute('data-chrome-editing', 'true')
    const freeTextElement = page.locator('[data-poster-element-id^="text:"]')
    await expect(freeTextElement).toHaveCount(1)
    await expect(page.locator('.poster-element-moveable .moveable-control')).toHaveCount(9)

    const beforeDragStyle = await freeTextElement.evaluate(el => `${(el as HTMLElement).style.left}|${(el as HTMLElement).style.top}`)
    const box = await freeTextElement.boundingBox()
    expect(box).toBeTruthy()
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2)
    await page.mouse.down()
    await page.mouse.move(box!.x + box!.width / 2 + 48, box!.y + box!.height / 2 + 32, { steps: 6 })
    await page.mouse.up()
    await expect.poll(() => freeTextElement.evaluate(el => `${(el as HTMLElement).style.left}|${(el as HTMLElement).style.top}`)).not.toBe(beforeDragStyle)
  })

  test('poster editor v2 layout builder manages chrome grid content and spacing', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'desktop layout-builder coverage')
    await page.goto('/style-browser-fixture?surface=1&posterEditor=1&width=1180&height=820')
    await expect(page.getByTestId('map-editor-surface')).toHaveAttribute('data-chrome-editing', 'true')
    await expect(page.getByTestId('chrome-editor-app-bar')).toBeVisible()
    await expect(page.getByTestId('chrome-layout-builder')).toHaveCount(0)

    const initial = await page.evaluate(() => ({
      cells: document.querySelectorAll('.chrome-grid-cell').length,
      rows: document.querySelectorAll('.chrome-grid-row').length,
    }))

    await page.getByTestId('chrome-editor-add-block').click()
    await expect(page.getByTestId('chrome-add-block-panel')).toBeVisible()
    await page.getByTestId('chrome-builder-add-column').click()
    await expect.poll(() => page.evaluate(() => document.querySelectorAll('.chrome-grid-cell').length)).toBe(initial.cells + 1)
    await expect.poll(() => page.evaluate(() => document.querySelectorAll('.chrome-grid-cell.is-selected').length)).toBe(1)
    await expect(page.getByTestId('chrome-add-block-panel')).toHaveCount(0)
    await expect(page.getByTestId('chrome-layout-builder')).toBeVisible()
    await expect(page.getByTestId('chrome-builder-cell-padding-top-increase')).toBeHidden()
    await expect.poll(() => page.evaluate(() => {
      const builder = document.querySelector<HTMLElement>('[data-testid="chrome-layout-builder"]')
      return builder ? Math.round(builder.getBoundingClientRect().width) : 0
    })).toBeLessThan(560)
    await expect(page.locator('.chrome-grid-cell.is-selected [data-testid="chrome-cell-add-column"]')).toBeVisible()
    await page.locator('.chrome-grid-cell.is-selected [data-testid="chrome-cell-add-column"]').click()
    await expect.poll(() => page.evaluate(() => document.querySelectorAll('.chrome-grid-cell').length)).toBe(initial.cells + 2)

    await page.getByTestId('chrome-builder-add-text-primary').click()
    await expect(page.getByTestId('chrome-builder-text-input')).toHaveCount(0)
    const inlineChromeText = page.locator('.chrome-grid-cell.is-selected .chrome-grid-block[contenteditable="true"]')
    await expect(inlineChromeText).toBeVisible()
    await expect(inlineChromeText).toBeFocused()
    await expect.poll(() => page.evaluate(() => {
      const toolbar = document.querySelector<HTMLElement>('[data-testid="chrome-layout-builder"]')
      const selectedText = document.querySelector<HTMLElement>('.chrome-grid-cell.is-selected .chrome-grid-block')
      const selectedCell = document.querySelector<HTMLElement>('.chrome-grid-cell.is-selected')
      if (!toolbar || !selectedText || !selectedCell) return false
      const toolbarBox = toolbar.getBoundingClientRect()
      const intersects = (a: DOMRect, b: DOMRect) =>
        a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top
      const blocks = Array.from(document.querySelectorAll<HTMLElement>('.chrome-grid-block'))
        .filter(el => {
          const box = el.getBoundingClientRect()
          const style = window.getComputedStyle(el)
          return box.width > 0 && box.height > 0 && style.display !== 'none' && style.visibility !== 'hidden'
        })
      const trash = document.querySelector<HTMLElement>('[data-testid="chrome-cell-trash"]')
      return !intersects(toolbarBox, selectedCell.getBoundingClientRect()) &&
        (!trash || !intersects(toolbarBox, trash.getBoundingClientRect())) &&
        blocks.every(block => {
          const textBox = block.getBoundingClientRect()
          return toolbarBox.right <= textBox.left ||
            toolbarBox.left >= textBox.right ||
            toolbarBox.bottom <= textBox.top ||
            toolbarBox.top >= textBox.bottom
        })
    })).toBe(true)
    const toolbarBeforeDrag = await page.evaluate(() => {
      const toolbar = document.querySelector<HTMLElement>('[data-testid="chrome-layout-builder"]')
      const handle = document.querySelector<HTMLElement>('[data-testid="chrome-context-toolbar-handle"]')
      if (!toolbar || !handle) return null
      const toolbarBox = toolbar.getBoundingClientRect()
      const handleBox = handle.getBoundingClientRect()
      const targetLeft = 24
      const targetTop = window.innerHeight - toolbarBox.height - 24
      return {
        toolbarLeft: toolbarBox.left,
        toolbarTop: toolbarBox.top,
        handleX: handleBox.left + handleBox.width / 2,
        handleY: handleBox.top + handleBox.height / 2,
        dragX: targetLeft - toolbarBox.left,
        dragY: targetTop - toolbarBox.top,
      }
    })
    expect(toolbarBeforeDrag).toBeTruthy()
    await page.mouse.move(toolbarBeforeDrag!.handleX, toolbarBeforeDrag!.handleY)
    await page.mouse.down()
    await page.mouse.move(toolbarBeforeDrag!.handleX + toolbarBeforeDrag!.dragX, toolbarBeforeDrag!.handleY + toolbarBeforeDrag!.dragY, { steps: 5 })
    await page.mouse.up()
    await expect.poll(() => page.evaluate(() => {
      const toolbar = document.querySelector<HTMLElement>('[data-testid="chrome-layout-builder"]')
      if (!toolbar) return null
      const box = toolbar.getBoundingClientRect()
      return `${Math.round(box.left)}|${Math.round(box.top)}`
    })).not.toBe(`${Math.round(toolbarBeforeDrag!.toolbarLeft)}|${Math.round(toolbarBeforeDrag!.toolbarTop)}`)
    await inlineChromeText.fill('Grid Label Test')
    await expect(page.getByText('Grid Label Test')).toBeVisible()

    await page.getByTestId('chrome-builder-style-toggle').click()
    await expect(page.getByTestId('chrome-builder-cell-padding-top-increase')).toBeVisible()
    await page.getByTestId('chrome-builder-cell-padding-top-increase').click()
    await expect.poll(() => page.evaluate(() => {
      const block = Array.from(document.querySelectorAll<HTMLElement>('.chrome-grid-block'))
        .find(el => el.innerText.includes('Grid Label Test'))
      return block?.closest<HTMLElement>('.chrome-grid-cell')?.getAttribute('style') ?? ''
    })).toContain('padding: 1cqh')
    await page.getByTestId('chrome-builder-style-toggle').click()
    await expect(page.getByTestId('chrome-cell-trash')).toBeVisible()
    await page.getByTestId('chrome-cell-trash').click()
    await expect.poll(() => page.evaluate(() =>
      Array.from(document.querySelectorAll<HTMLElement>('.chrome-grid-block'))
        .some(el => el.innerText.includes('Grid Label Test')),
    )).toBe(false)
    await expect(page.getByTestId('chrome-builder-add-text-primary')).toBeVisible()

    const resizableCells = page.locator('.chrome-grid-cell:has([data-testid="chrome-cell-resize-column"])')
    await expect.poll(() => resizableCells.count()).toBeGreaterThan(0)
    const hoverRow = page.locator('.chrome-grid-row:has([data-testid="chrome-cell-resize-column"])').first()
    await hoverRow.hover()
    await expect(hoverRow.locator('[data-testid="chrome-cell-resize-column"]').first()).toBeVisible()
    await expect(hoverRow.locator('[data-testid="chrome-row-add-row"]').first()).toBeVisible()
    await expect(hoverRow.locator('[data-testid="chrome-row-resize-row"]').first()).toBeVisible()
    const widthBeforeResize = await resizableCells.first().evaluate(el => (el as HTMLElement).getBoundingClientRect().width)
    await resizableCells.first().click()
    const resizeGrip = resizableCells.first().locator('[data-testid="chrome-cell-resize-column"]')
    await expect(resizeGrip).toBeVisible()
    const gripBox = await resizeGrip.boundingBox()
    expect(gripBox).toBeTruthy()
    await page.mouse.move(gripBox!.x + gripBox!.width / 2, gripBox!.y + gripBox!.height / 2)
    await page.mouse.down()
    await page.mouse.move(gripBox!.x + gripBox!.width / 2 + 42, gripBox!.y + gripBox!.height / 2, { steps: 5 })
    await page.mouse.up()
    await expect.poll(() => resizableCells.first().evaluate(el => (el as HTMLElement).getBoundingClientRect().width)).toBeGreaterThan(widthBeforeResize)

    const resizableRows = page.locator('.chrome-grid-row:has([data-testid="chrome-row-resize-row"])')
    await expect.poll(() => resizableRows.count()).toBeGreaterThan(0)
    const heightBeforeResize = await resizableRows.first().evaluate(el => (el as HTMLElement).getBoundingClientRect().height)
    await resizableRows.first().hover()
    const rowResizeGrip = resizableRows.first().locator('[data-testid="chrome-row-resize-row"]')
    await expect(rowResizeGrip).toBeVisible()
    const rowGripBox = await rowResizeGrip.boundingBox()
    expect(rowGripBox).toBeTruthy()
    await page.mouse.move(rowGripBox!.x + rowGripBox!.width / 2, rowGripBox!.y + rowGripBox!.height / 2)
    await page.mouse.down()
    await page.mouse.move(rowGripBox!.x + rowGripBox!.width / 2, rowGripBox!.y + rowGripBox!.height / 2 + 28, { steps: 5 })
    await page.mouse.up()
    await expect.poll(() => resizableRows.first().evaluate(el => (el as HTMLElement).getBoundingClientRect().height)).toBeGreaterThan(heightBeforeResize)

    await page.getByTestId('chrome-editor-add-block').click()
    await expect(page.getByTestId('chrome-add-block-panel')).toBeVisible()
    await page.getByTestId('chrome-builder-add-row').click()
    await expect.poll(() => page.evaluate(() => document.querySelectorAll('.chrome-grid-row').length)).toBe(initial.rows + 1)
    await expect(page.getByTestId('chrome-builder-add-text-primary')).toBeVisible()
    await expect(page.getByTestId('chrome-structure-popover')).toHaveCount(0)
    await page.getByTestId('chrome-editor-add-block').click()
    await expect(page.getByTestId('chrome-add-block-panel')).toBeVisible()
    await page.getByTestId('chrome-builder-add-spacer').click()
    await expect.poll(() => page.evaluate(() => document.querySelectorAll('.chrome-grid-row').length)).toBe(initial.rows + 2)
    await expect(page.locator('.chrome-grid-cell.is-selected.is-spacer')).toBeVisible()
    await expect(page.locator('.chrome-grid-cell.is-selected .chrome-grid-spacer')).toContainText('Spacer')
  })

  test('poster editor v2 focuses chrome text without resizing the grid', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'desktop chrome focus stability coverage')
    await page.goto('/style-browser-fixture?surface=1&posterEditor=1&width=1180&height=680')
    await expect(page.getByTestId('map-editor-surface')).toHaveAttribute('data-chrome-editing', 'true')

    const blocks = page.locator('.chrome-grid-block[data-chrome-block-id]')
    await expect.poll(() => blocks.count()).toBeGreaterThan(0)
    expect(await blocks.count()).toBeGreaterThan(0)
    const blockId = await blocks.first().getAttribute('data-chrome-block-id')
    expect(blockId).toBeTruthy()

    const before = await page.evaluate((id) => {
      const block = document.querySelector<HTMLElement>(`[data-chrome-block-id="${CSS.escape(id)}"]`)
      const cell = block?.closest<HTMLElement>('.chrome-grid-cell')
      const header = document.querySelector<HTMLElement>('[data-testid="poster-header"]')
      return {
        block: block?.getBoundingClientRect().toJSON(),
        cell: cell?.getBoundingClientRect().toJSON(),
        header: header?.getBoundingClientRect().toJSON(),
      }
    }, blockId!)

    await page.locator(`[data-chrome-block-id="${blockId}"]`).click()

    const after = await page.evaluate((blockId) => {
      const block = document.querySelector<HTMLElement>(`[data-chrome-block-id="${CSS.escape(blockId)}"]`)
      const cell = block?.closest<HTMLElement>('.chrome-grid-cell')
      const header = document.querySelector<HTMLElement>('[data-testid="poster-header"]')
      return {
        block: block?.getBoundingClientRect().toJSON(),
        cell: cell?.getBoundingClientRect().toJSON(),
        header: header?.getBoundingClientRect().toJSON(),
      }
    }, blockId!)

    for (const key of ['block', 'cell', 'header'] as const) {
      expect(Math.abs((after[key]?.width ?? 0) - (before[key]?.width ?? 0))).toBeLessThanOrEqual(0.5)
      expect(Math.abs((after[key]?.height ?? 0) - (before[key]?.height ?? 0))).toBeLessThanOrEqual(0.5)
    }
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

  test('does not render Modernist filler occasion or footer-note text', async ({ page }) => {
    await page.goto('/style-browser-fixture?composition=modernist-block&theme=bold-modern&editable=1')

    await expect(page.locator('.poster-occasion')).toHaveCount(0)
    await expect(page.getByTestId('composition-footer-note')).toHaveCount(0)
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
