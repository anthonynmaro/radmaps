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

  test('loads contour-art waterway layers into the live MapLibre style', async ({ page }) => {
    await page.goto('/style-browser-fixture?composition=modernist-block&theme=bold-modern&editable=1')
    await page.locator('.maplibregl-canvas').waitFor({ state: 'visible', timeout: 15_000 })
    await expect.poll(async () => page.evaluate(() => {
      const win = window as unknown as {
        __RADMAPS_MAP_CAMERA__?: { getLayerIds?: () => string[] }
      }
      return win.__RADMAPS_MAP_CAMERA__?.getLayerIds?.().includes('contour-art-waterways') ?? false
    })).toBe(true)
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
