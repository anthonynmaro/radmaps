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
  ['art-wash', 'contour-wash'],
  ['place-frame', 'cartouche-place'],
  ['sea-chart', 'sea-chart'],
  ['transit-diagram', 'transit-diagram'],
] as const

const headerDecorCompositions = new Set([
  'editorial-tall',
  'darksky-stars',
  'botanical-plate',
  'brutalist-slab',
  'art-wash',
  'place-frame',
  'sea-chart',
])
const hiddenFooterCompositions = new Set([
  'travel-banner',
  'journal-spread',
  'modernist-block',
  'botanical-plate',
  'art-wash',
  'place-frame',
  'sea-chart',
  'transit-diagram',
])
const hiddenKickerCompositions = new Set([
  'modernist-block',
])

const finalPrintForbiddenSelectors = [
  '[contenteditable="true"]',
  '.poster-controls',
  '[data-testid="poster-editor-guides"]',
  '[data-testid="chrome-cell-trash"]',
  '[data-testid="chrome-cell-add-column"]',
  '[data-testid="chrome-cell-resize-column"]',
  '[data-testid="chrome-row-add-row"]',
  '[data-testid="chrome-row-resize-row"]',
  '[data-testid="chrome-band-add-row"]',
  '[data-testid="chrome-editor-add-block"]',
  '[data-testid="chrome-add-block-panel"]',
  '[data-testid="chrome-context-toolbar-handle"]',
  '[data-testid="composition-blueprint-drafting"]',
]

const specThemeRecipes = [
  ['editorial-minimal', 'editorial-tall'],
  ['usgs-vintage', 'park-quad'],
  ['classic-trail', 'park-quad'],
  ['midcentury-travel', 'travel-banner'],
  ['ranch-ochre', 'travel-banner'],
  ['daybreak-trace', 'travel-banner'],
  ['risograph', 'riso-stack'],
  ['blueprint', 'blueprint-grid'],
  ['moonstone', 'blueprint-grid'],
  ['blueprint-strava', 'blueprint-strava'],
  ['electric-atlas', 'blueprint-strava'],
  ['field-journal', 'journal-spread'],
  ['botanical', 'botanical-plate'],
  ['bold-modern', 'modernist-block'],
  ['blackline', 'modernist-block'],
  ['contour-wash', 'art-wash'],
  ['splits-stats', 'splits-grid'],
  ['night-ride', 'splits-grid'],
  ['marathon-bib', 'bib-numerals'],
  ['dark-sky', 'darksky-stars'],
  ['copper-night', 'darksky-stars'],
  ['brutalist', 'brutalist-slab'],
  ['cartouche-place', 'place-frame'],
  ['sea-chart', 'sea-chart'],
  ['relief-shaded', 'editorial-tall'],
  ['transit-diagram', 'transit-diagram'],
  ['plein-air', 'art-wash'],
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
      if (hiddenFooterCompositions.has(composition)) {
        await expect(page.getByTestId('poster-footer')).toBeHidden()
      } else {
        await expect(page.getByTestId('poster-footer')).toBeVisible()
      }
      if (headerDecorCompositions.has(composition)) {
        await expect(page.getByTestId('composition-kicker')).toBeVisible()
      } else if (hiddenKickerCompositions.has(composition)) {
        await expect(page.getByTestId('composition-kicker')).toBeHidden()
      } else {
        await expect(page.getByTestId('composition-kicker')).toHaveCount(0)
      }

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

  test('keeps editorial compositions in the image-first parity layout', async ({ page }) => {
    await page.goto('/style-browser-fixture?composition=editorial-tall&theme=editorial-minimal')
    const mapBox = await page.getByTestId('poster-map').boundingBox()
    const headerBox = await page.getByTestId('poster-header').boundingBox()
    expect(mapBox).toBeTruthy()
    expect(headerBox).toBeTruthy()
    expect(headerBox!.y).toBeGreaterThan(mapBox!.y)
  })

  test('renders composition-specific overlays', async ({ page }) => {
    test.setTimeout(90_000)
    await page.goto('/style-browser-fixture?composition=editorial-tall&theme=editorial-minimal')
    await expect.poll(async () => page.evaluate(() => {
      const win = window as unknown as {
        __RADMAPS_MAP_CAMERA__?: { getLayerIds?: () => string[] }
      }
      return win.__RADMAPS_MAP_CAMERA__?.getLayerIds?.() ?? []
    })).toContain('route-line-editorial-gallery-shadow')
    await expect.poll(async () => page.evaluate(() => {
      const win = window as unknown as {
        __RADMAPS_MAP_CAMERA__?: { getLayerIds?: () => string[] }
      }
      return win.__RADMAPS_MAP_CAMERA__?.getLayerIds?.() ?? []
    })).toContain('route-line-editorial-collector-cuts')
    await expect.poll(async () => page.locator('.poster-composition--editorial-tall[data-theme="editorial-minimal"] .poster-trail-name').evaluate(el => getComputedStyle(el).maxWidth)).not.toBe('none')

    await page.goto('/style-browser-fixture?composition=blueprint-grid&theme=blueprint&gridScope=poster')
    await expect(page.getByTestId('composition-grid-overlay')).toBeVisible()
    await expect.poll(async () => page.evaluate(() => {
      const win = window as unknown as {
        __RADMAPS_MAP_CAMERA__?: { getLayerIds?: () => string[] }
      }
      return win.__RADMAPS_MAP_CAMERA__?.getLayerIds?.() ?? []
    })).toContain('route-line-blueprint-construction-glow')
    await expect.poll(async () => page.evaluate(() => {
      const win = window as unknown as {
        __RADMAPS_MAP_CAMERA__?: { getLayerIds?: () => string[] }
      }
      return win.__RADMAPS_MAP_CAMERA__?.getLayerIds?.() ?? []
    })).toContain('route-line-blueprint-station-crosses')

    await page.goto('/style-browser-fixture?composition=blueprint-grid&theme=moonstone')
    await expect(page.getByTestId('composition-blueprint-drafting')).toHaveCount(0)
    await expect.poll(async () => page.evaluate(() => {
      const win = window as unknown as {
        __RADMAPS_MAP_CAMERA__?: { getLayerIds?: () => string[] }
      }
      return win.__RADMAPS_MAP_CAMERA__?.getLayerIds?.() ?? []
    })).toContain('route-line-moonstone-engraved-channel')
    await expect.poll(async () => page.evaluate(() => {
      const win = window as unknown as {
        __RADMAPS_MAP_CAMERA__?: { getLayerIds?: () => string[] }
      }
      return win.__RADMAPS_MAP_CAMERA__?.getLayerIds?.() ?? []
    })).toContain('route-line-moonstone-survey-ticks')
    await expect.poll(async () => page.locator('.poster-composition--blueprint-grid[data-theme="moonstone"] .poster-trail-name').evaluate(el => getComputedStyle(el).fontFamily)).toContain('Space Grotesk')

    await page.goto('/style-browser-fixture?composition=park-quad&theme=classic-trail')
    await expect(page.getByTestId('composition-classic-trail-markers')).toHaveCount(0)
    await expect(page.locator('.classic-trail-blaze, .classic-trail-quad')).toHaveCount(0)
    await expect.poll(async () => page.evaluate(() => {
      const win = window as unknown as {
        __RADMAPS_MAP_CAMERA__?: { getLayerIds?: () => string[] }
      }
      return win.__RADMAPS_MAP_CAMERA__?.getLayerIds?.() ?? []
    })).toContain('route-line-classic-trail-paper-channel')
    await expect.poll(async () => page.evaluate(() => {
      const win = window as unknown as {
        __RADMAPS_MAP_CAMERA__?: { getLayerIds?: () => string[] }
      }
      return win.__RADMAPS_MAP_CAMERA__?.getLayerIds?.() ?? []
    })).not.toContain('route-line-classic-trail-blaze-cuts')
    await expect.poll(async () => page.locator('.poster-composition--park-quad[data-theme="classic-trail"] .poster-trail-name').evaluate(el => getComputedStyle(el).letterSpacing)).not.toBe('normal')

    await page.goto('/style-browser-fixture?composition=park-quad&theme=usgs-vintage')
    await expect.poll(async () => page.evaluate(() => {
      const win = window as unknown as {
        __RADMAPS_MAP_CAMERA__?: { getLayerIds?: () => string[] }
      }
      return win.__RADMAPS_MAP_CAMERA__?.getLayerIds?.() ?? []
    })).toContain('route-line-usgs-paper-channel')
    await expect.poll(async () => page.evaluate(() => {
      const win = window as unknown as {
        __RADMAPS_MAP_CAMERA__?: { getLayerIds?: () => string[] }
      }
      return win.__RADMAPS_MAP_CAMERA__?.getLayerIds?.() ?? []
    })).not.toContain('route-line-usgs-survey-hachures')
    await expect.poll(async () => page.locator('.poster-composition--park-quad[data-theme="usgs-vintage"] .poster-trail-name').evaluate(el => getComputedStyle(el).fontFamily)).toContain('Libre Baskerville')
    await expect(page.getByTestId('usgs-coordinate-ticks')).toBeVisible()
    await expect(page.getByTestId('usgs-coordinate-tick')).toHaveCount(4)

    await page.goto('/style-browser-fixture?composition=darksky-stars&theme=dark-sky')
    await expect(page.getByTestId('composition-star-field')).toBeVisible()
    await expect(page.getByTestId('composition-darksky-ridge')).toBeVisible()
    await expect.poll(async () => page.evaluate(() => {
      const win = window as unknown as {
        __RADMAPS_MAP_CAMERA__?: { getLayerIds?: () => string[] }
      }
      return win.__RADMAPS_MAP_CAMERA__?.getLayerIds?.() ?? []
    })).toContain('route-line-darksky-glow-wide')
    await expect.poll(async () => page.evaluate(() => {
      const win = window as unknown as {
        __RADMAPS_MAP_CAMERA__?: { getLayerIds?: () => string[] }
      }
      return win.__RADMAPS_MAP_CAMERA__?.getLayerIds?.() ?? []
    })).toContain('route-line-darksky-constellation')
    await expect.poll(async () => page.evaluate(() => {
      const win = window as unknown as {
        __RADMAPS_MAP_CAMERA__?: { getLayerIds?: () => string[] }
      }
      return win.__RADMAPS_MAP_CAMERA__?.getLayerIds?.() ?? []
    })).toContain('route-line-darksky-star-crosses')

    await page.goto('/style-browser-fixture?composition=darksky-stars&theme=copper-night')
    await expect(page.getByTestId('composition-star-field')).toBeVisible()
    await expect(page.getByTestId('composition-darksky-ridge')).toBeVisible()
    await expect.poll(async () => page.evaluate(() => {
      const win = window as unknown as {
        __RADMAPS_MAP_CAMERA__?: { getLayerIds?: () => string[] }
      }
      return win.__RADMAPS_MAP_CAMERA__?.getLayerIds?.() ?? []
    })).toContain('route-line-darksky-star-crosses')

    await page.goto('/style-browser-fixture?composition=modernist-block&theme=bold-modern')
    await expect(page.getByTestId('composition-modernist-accent')).toBeVisible()
    await expect(page.getByTestId('composition-side-rail')).toHaveCount(0)
    await expect(page.getByTestId('composition-modernist-bleed')).toHaveCount(0)
    await expect.poll(async () => page.evaluate(() => {
      const win = window as unknown as {
        __RADMAPS_MAP_CAMERA__?: { getLayerIds?: () => string[] }
      }
      return win.__RADMAPS_MAP_CAMERA__?.getLayerIds?.() ?? []
    })).toContain('route-line')
    await expect.poll(async () => page.evaluate(() => {
      const win = window as unknown as {
        __RADMAPS_MAP_CAMERA__?: { getLayerIds?: () => string[] }
      }
      return win.__RADMAPS_MAP_CAMERA__?.getLayerIds?.() ?? []
    })).not.toContain('route-line-modernist-trap')
    await expect.poll(async () => page.evaluate(() => {
      const win = window as unknown as {
        __RADMAPS_MAP_CAMERA__?: { getLayerIds?: () => string[] }
      }
      return win.__RADMAPS_MAP_CAMERA__?.getLayerIds?.() ?? []
    })).not.toContain('route-line-modernist-register')

    await page.goto('/style-browser-fixture?composition=modernist-block&theme=blackline')
    await expect.poll(async () => page.evaluate(() => {
      const win = window as unknown as {
        __RADMAPS_MAP_CAMERA__?: { getLayerIds?: () => string[] }
      }
      return win.__RADMAPS_MAP_CAMERA__?.getLayerIds?.() ?? []
    })).toContain('route-line-blackline-plate')
    await expect.poll(async () => page.evaluate(() => {
      const win = window as unknown as {
        __RADMAPS_MAP_CAMERA__?: { getLayerIds?: () => string[] }
      }
      return win.__RADMAPS_MAP_CAMERA__?.getLayerIds?.() ?? []
    })).not.toContain('route-line-blackline-register-cuts')

    await page.goto('/style-browser-fixture?composition=riso-stack&theme=risograph')
    await expect(page.getByTestId('composition-riso-caption')).toBeVisible()

    await page.goto('/style-browser-fixture?composition=travel-banner&theme=midcentury-travel')
    await expect(page.getByTestId('composition-travel-sun')).toBeVisible()
    await expect.poll(async () => page.evaluate(() => {
      const win = window as unknown as {
        __RADMAPS_MAP_CAMERA__?: { getLayerIds?: () => string[] }
      }
      return win.__RADMAPS_MAP_CAMERA__?.getLayerIds?.() ?? []
    })).not.toContain('route-line-travel-shadow')
    await expect.poll(async () => page.evaluate(() => {
      const win = window as unknown as {
        __RADMAPS_MAP_CAMERA__?: { getLayerIds?: () => string[] }
      }
      return win.__RADMAPS_MAP_CAMERA__?.getLayerIds?.() ?? []
    })).not.toContain('route-line-travel-highlight')
    await expect.poll(async () => page.evaluate(() => {
      const win = window as unknown as {
        __RADMAPS_MAP_CAMERA__?: { getLayerIds?: () => string[] }
      }
      return win.__RADMAPS_MAP_CAMERA__?.getLayerIds?.() ?? []
    })).not.toContain('route-line-travel-register-cuts')
    await expect.poll(async () => page.evaluate(() => {
      const win = window as unknown as {
        __RADMAPS_MAP_CAMERA__?: { getLayerIds?: () => string[] }
      }
      return win.__RADMAPS_MAP_CAMERA__?.getLayerIds?.() ?? []
    })).not.toContain('route-line-travel-waypoints')

    await page.goto('/style-browser-fixture?composition=blueprint-strava&theme=electric-atlas')
    await expect(page.getByTestId('composition-electric-trace')).toBeVisible()
    await expect(page.getByTestId('composition-electric-chip')).toBeVisible()
    await expect.poll(async () => page.evaluate(() => {
      const win = window as unknown as {
        __RADMAPS_MAP_CAMERA__?: { getLayerIds?: () => string[] }
      }
      return win.__RADMAPS_MAP_CAMERA__?.getLayerIds?.() ?? []
    })).toContain('route-line-electric-glow-wide')
    await expect.poll(async () => page.evaluate(() => {
      const win = window as unknown as {
        __RADMAPS_MAP_CAMERA__?: { getLayerIds?: () => string[] }
      }
      return win.__RADMAPS_MAP_CAMERA__?.getLayerIds?.() ?? []
    })).toContain('route-line-electric-pulse')
    await expect.poll(async () => page.locator('.poster-composition--blueprint-strava .poster-trail-name').evaluate(el => getComputedStyle(el).fontFamily)).toContain('Big Shoulders Display')
    await expect(page.locator('.poster-composition--blueprint-strava .poster-location-line')).toHaveText('Kickapoo State Park')
    await expect(page.locator('.poster-composition--blueprint-strava .composition-technical-data-item').filter({ hasText: 'Location' }).locator('strong')).toHaveText('ILLINOIS')

    await page.goto('/style-browser-fixture?composition=splits-grid&theme=splits-stats&elevation=1')
    await expect(page.getByTestId('elevation-profile-band')).toBeVisible()
    await expect.poll(async () => page.evaluate(() => {
      const win = window as unknown as {
        __RADMAPS_MAP_CAMERA__?: { getLayerIds?: () => string[] }
      }
      return win.__RADMAPS_MAP_CAMERA__?.getLayerIds?.() ?? []
    })).toContain('route-line-performance-glow')
    await expect.poll(async () => page.evaluate(() => {
      const win = window as unknown as {
        __RADMAPS_MAP_CAMERA__?: { getLayerIds?: () => string[] }
      }
      return win.__RADMAPS_MAP_CAMERA__?.getLayerIds?.() ?? []
    })).toContain('route-line-performance-checkpoints')

    await page.goto('/style-browser-fixture?composition=bib-numerals&theme=marathon-bib')
    await expect(page.getByTestId('composition-bib-ghost')).toBeVisible()
    await expect(page.getByTestId('composition-bib-paper')).toBeVisible()
    await expect(page.getByTestId('composition-bib-pin-hole')).toHaveCount(4)
    await expect(page.getByTestId('composition-bib-tear-strip')).toBeVisible()
    await expect(page.getByTestId('composition-bib-finish-headline')).toBeVisible()
    await expect(page.getByTestId('composition-bib-finish-headline')).toContainText('4:07:12')
    await expect.poll(async () => page.evaluate(() => {
      const win = window as unknown as {
        __RADMAPS_MAP_CAMERA__?: { getLayerIds?: () => string[] }
      }
      return win.__RADMAPS_MAP_CAMERA__?.getLayerIds?.() ?? []
    })).toContain('route-line-bib-knockout')
    await expect.poll(async () => page.evaluate(() => {
      const win = window as unknown as {
        __RADMAPS_MAP_CAMERA__?: { getLayerIds?: () => string[] }
      }
      return win.__RADMAPS_MAP_CAMERA__?.getLayerIds?.() ?? []
    })).toContain('route-line-bib-mile-ticks')
    await expect.poll(async () => page.evaluate(() => {
      const win = window as unknown as {
        __RADMAPS_MAP_CAMERA__?: { getLayerIds?: () => string[] }
      }
      return win.__RADMAPS_MAP_CAMERA__?.getLayerIds?.() ?? []
    })).toContain('route-line-bib-checkpoint-dots')

    await page.goto('/style-browser-fixture?composition=journal-spread&theme=field-journal')
    await expect(page.getByTestId('composition-journal-notes')).toBeVisible()
    await expect(page.getByTestId('composition-journal-route-sketch')).toBeVisible()
    await expect(page.getByTestId('composition-journal-tape')).toBeVisible()
    await expect.poll(async () => page.evaluate(() => {
      const win = window as unknown as {
        __RADMAPS_MAP_CAMERA__?: { getLayerIds?: () => string[] }
      }
      return win.__RADMAPS_MAP_CAMERA__?.getLayerIds?.() ?? []
    })).toContain('route-line-journal-wash')
    await expect.poll(async () => page.evaluate(() => {
      const win = window as unknown as {
        __RADMAPS_MAP_CAMERA__?: { getLayerIds?: () => string[] }
      }
      return win.__RADMAPS_MAP_CAMERA__?.getLayerIds?.() ?? []
    })).toContain('route-line-journal-drybrush')

    await page.goto('/style-browser-fixture?composition=botanical-plate&theme=botanical')
    await expect(page.getByTestId('composition-botanical-frame')).toBeVisible()
    await expect(page.getByTestId('composition-botanical-caption')).toHaveCount(0)
    await expect.poll(async () => page.evaluate(() => {
      const win = window as unknown as {
        __RADMAPS_MAP_CAMERA__?: { getLayerIds?: () => string[] }
      }
      return win.__RADMAPS_MAP_CAMERA__?.getLayerIds?.() ?? []
    })).toContain('route-line-botanical-pressed')
    await expect.poll(async () => page.evaluate(() => {
      const win = window as unknown as {
        __RADMAPS_MAP_CAMERA__?: { getLayerIds?: () => string[] }
      }
      return win.__RADMAPS_MAP_CAMERA__?.getLayerIds?.() ?? []
    })).toContain('route-line-botanical-ink-vein')
    await expect.poll(async () => page.evaluate(() => {
      const win = window as unknown as {
        __RADMAPS_MAP_CAMERA__?: { getLayerIds?: () => string[] }
      }
      return win.__RADMAPS_MAP_CAMERA__?.getLayerIds?.() ?? []
    })).toContain('route-line-botanical-leaf-cuts')
    await expect.poll(async () => page.evaluate(() => {
      const win = window as unknown as {
        __RADMAPS_MAP_CAMERA__?: { getLayerIds?: () => string[] }
      }
      return win.__RADMAPS_MAP_CAMERA__?.getLayerIds?.() ?? []
    })).toContain('route-line-botanical-specimen-dots')
    await expect.poll(async () => page.locator('.poster-composition--botanical-plate .poster-trail-name').evaluate(el => getComputedStyle(el).fontFamily)).toContain('Cormorant Garamond')

    await page.goto('/style-browser-fixture?composition=place-frame&theme=cartouche-place')
    await expect(page.getByTestId('composition-plate-frame')).toBeVisible()
    await expect(page.getByTestId('composition-cartouche-hills')).toBeVisible()

    await page.goto('/style-browser-fixture?composition=sea-chart&theme=sea-chart')
    await expect(page.getByTestId('composition-plate-frame')).toHaveCount(0)
    await expect(page.getByTestId('composition-sea-chart-art')).toBeVisible()
    await expect(page.getByTestId('sea-chart-rose')).toBeVisible()
    await expect(page.locator('.sea-chart-graticule, .sea-chart-depth-bands, .sea-chart-rose, .sea-chart-soundings, .sea-chart-rhumb-lines')).toHaveCount(5)
    await expect.poll(async () => page.evaluate(() => {
      const win = window as unknown as {
        __RADMAPS_MAP_CAMERA__?: { getLayerIds?: () => string[] }
      }
      return win.__RADMAPS_MAP_CAMERA__?.getLayerIds?.() ?? []
    })).toContain('route-line-sea-course')
    await expect.poll(async () => page.evaluate(() => {
      const win = window as unknown as {
        __RADMAPS_MAP_CAMERA__?: { getLayerIds?: () => string[] }
      }
      return win.__RADMAPS_MAP_CAMERA__?.getLayerIds?.() ?? []
    })).toContain('route-line-sea-waypoints')

    await page.goto('/style-browser-fixture?composition=editorial-tall&theme=relief-shaded')
    await expect(page.getByTestId('composition-relief-bands')).toBeVisible()
    await expect(page.getByTestId('composition-relief-legend')).toBeVisible()
    await expect(page.getByTestId('composition-relief-stamp')).toBeVisible()

    await page.goto('/style-browser-fixture?composition=transit-diagram&theme=transit-diagram')
    await expect(page.getByTestId('composition-transit-diagram-art')).toBeVisible()
    await expect(page.getByTestId('transit-diagram-legend')).toBeVisible()
    await expect(page.getByTestId('transit-diagram-station-key')).toBeVisible()

    await page.goto('/style-browser-fixture?composition=brutalist-slab&theme=brutalist')
    await expect(page.getByTestId('composition-brutalist-baseline-grid')).toHaveCount(0)
    await expect(page.getByTestId('composition-brutalist-registration-marks')).toBeVisible()
    await expect.poll(async () => page.evaluate(() => {
      const win = window as unknown as {
        __RADMAPS_MAP_CAMERA__?: { getLayerIds?: () => string[] }
      }
      return win.__RADMAPS_MAP_CAMERA__?.getLayerIds?.() ?? []
    })).toContain('route-line-brutalist-slab-shadow')
    await expect.poll(async () => page.evaluate(() => {
      const win = window as unknown as {
        __RADMAPS_MAP_CAMERA__?: { getLayerIds?: () => string[] }
      }
      return win.__RADMAPS_MAP_CAMERA__?.getLayerIds?.() ?? []
    })).not.toContain('route-line-brutalist-proof-dashes')

    await page.goto('/style-browser-fixture?composition=art-wash&theme=contour-wash')
    await expect.poll(async () => page.evaluate(() => {
      const win = window as unknown as {
        __RADMAPS_MAP_CAMERA__?: { getLayerIds?: () => string[] }
      }
      return win.__RADMAPS_MAP_CAMERA__?.getLayerIds?.() ?? []
    })).toContain('route-line')
    await expect.poll(async () => page.evaluate(() => {
      const win = window as unknown as {
        __RADMAPS_MAP_CAMERA__?: { getLayerIds?: () => string[] }
      }
      return win.__RADMAPS_MAP_CAMERA__?.getLayerIds?.() ?? []
    })).not.toContain('route-line-contour-wash-echo-high')

    await page.goto('/style-browser-fixture?composition=art-wash&theme=plein-air')
    await expect(page.getByTestId('composition-plein-air-deckle')).toBeVisible()
    await expect(page.getByTestId('composition-plein-air-palette')).toBeVisible()
    await expect(page.locator('.plein-air-palette-swatch')).toHaveCount(3)
    await expect.poll(async () => page.evaluate(() => {
      const win = window as unknown as {
        __RADMAPS_MAP_CAMERA__?: { getLayerIds?: () => string[] }
      }
      return win.__RADMAPS_MAP_CAMERA__?.getLayerIds?.() ?? []
    })).not.toContain('route-line-pigment-bleed')
    await expect.poll(async () => page.evaluate(() => {
      const win = window as unknown as {
        __RADMAPS_MAP_CAMERA__?: { getLayerIds?: () => string[] }
      }
      return win.__RADMAPS_MAP_CAMERA__?.getLayerIds?.() ?? []
    })).not.toContain('route-line-pigment-offset')
    await expect.poll(async () => page.evaluate(() => {
      const win = window as unknown as {
        __RADMAPS_MAP_CAMERA__?: { getLayerIds?: () => string[] }
      }
      return win.__RADMAPS_MAP_CAMERA__?.getLayerIds?.() ?? []
    })).toContain('route-line-plein-air-drybrush')
  })

  test('renders Transit stops from the GPX-derived diagram', async ({ page }) => {
    await page.goto('/style-browser-fixture?composition=transit-diagram&theme=transit-diagram')
    await expect(page.getByTestId('composition-transit-diagram-art')).toBeVisible()
    await expect.poll(async () => page.evaluate(() => {
      const win = window as unknown as {
        __RADMAPS_MAP_CAMERA__?: { getLayerIds?: () => string[] }
      }
      return win.__RADMAPS_MAP_CAMERA__?.getLayerIds?.() ?? []
    })).toEqual(expect.arrayContaining(['transit-station-halo', 'transit-station-dot', 'transit-station-label']))
  })

  test('adapts route-derived poster artwork to non-default GPX regions', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'desktop-only multi-region route-art stress pass')
    test.setTimeout(90_000)
    const regions = ['banff', 'patagonia', 'fuji', 'newzealand'] as const

    const transitShapes = new Set<string>()
    for (const region of regions) {
      await page.goto(`/style-browser-fixture?region=${region}&composition=transit-diagram&theme=transit-diagram`, { waitUntil: 'domcontentloaded' })
      await expect(page.getByTestId('composition-transit-diagram-art')).toBeVisible()
      await expect.poll(async () => page.evaluate(() => {
        const win = window as unknown as {
          __RADMAPS_MAP_CAMERA__?: { getLayerIds?: () => string[] }
        }
        return win.__RADMAPS_MAP_CAMERA__?.getLayerIds?.() ?? []
      }), { message: region }).toEqual(expect.arrayContaining(['transit-station-halo', 'transit-station-dot', 'transit-station-label']))
      transitShapes.add(region)
    }
    expect(transitShapes.size).toBe(regions.length)

    for (const region of regions) {
      await page.goto(`/style-browser-fixture?region=${region}&composition=journal-spread&theme=field-journal`, { waitUntil: 'domcontentloaded' })
      await expect(page.getByTestId('composition-journal-route-sketch')).toBeVisible()
      await expect.poll(async () => page.evaluate(() => {
        const win = window as unknown as {
          __RADMAPS_MAP_CAMERA__?: { getLayerIds?: () => string[] }
        }
        return win.__RADMAPS_MAP_CAMERA__?.getLayerIds?.() ?? []
      })).toContain('route-line-journal-wash')
    }

  })

  test('adapts Cartouche title plate for route maps and no-route place portraits', async ({ page }) => {
    await page.goto('/style-browser-fixture?surface=1&composition=place-frame&theme=cartouche-place&posterEditor=1&surfaceTemplateEditor=1&width=1180&height=820')
    await expect(page.getByTestId('poster-canvas')).toHaveClass(/poster-place-map/)
    await expect(page.getByTestId('composition-plate-frame')).toBeVisible()
    await expect(page.getByTestId('composition-cartouche-hills')).toBeVisible()
    await expect(page.getByTestId('composition-cartouche-seal')).toHaveCount(0)
    await expect(page.locator('.cartouche-corner')).toHaveCount(0)
    const routeBoxes = await page.evaluate(() => {
      const poster = document.querySelector<HTMLElement>('[data-testid="poster-canvas"]')
      const header = document.querySelector<HTMLElement>('[data-testid="poster-header"]')
      return {
        poster: poster?.getBoundingClientRect().toJSON(),
        header: header?.getBoundingClientRect().toJSON(),
      }
    })
    expect(routeBoxes.poster).toBeTruthy()
    expect(routeBoxes.header).toBeTruthy()
    expect(routeBoxes.header!.width).toBeGreaterThan(routeBoxes.poster!.width * 0.60)
    expect(routeBoxes.header!.width).toBeLessThan(routeBoxes.poster!.width * 0.64)
    const routePosterCenter = routeBoxes.poster!.x + (routeBoxes.poster!.width / 2)
    const routeHeaderCenter = routeBoxes.header!.x + (routeBoxes.header!.width / 2)
    expect(Math.abs(routeHeaderCenter - routePosterCenter)).toBeLessThan(routeBoxes.poster!.width * 0.04)

    await page.goto('/style-browser-fixture?surface=1&composition=place-frame&theme=cartouche-place&posterEditor=1&surfaceTemplateEditor=1&width=1180&height=820&route=0')
    await expect(page.getByTestId('poster-canvas')).toHaveClass(/poster-place-map/)
    await expect(page.getByTestId('composition-plate-frame')).toBeVisible()
    await expect(page.getByTestId('composition-cartouche-hills')).toBeVisible()
    await expect(page.getByTestId('composition-cartouche-seal')).toHaveCount(0)
    await expect(page.locator('.cartouche-corner')).toHaveCount(0)
    const placeBoxes = await page.evaluate(() => {
      const poster = document.querySelector<HTMLElement>('[data-testid="poster-canvas"]')
      const header = document.querySelector<HTMLElement>('[data-testid="poster-header"]')
      return {
        poster: poster?.getBoundingClientRect().toJSON(),
        header: header?.getBoundingClientRect().toJSON(),
      }
    })
    expect(placeBoxes.poster).toBeTruthy()
    expect(placeBoxes.header).toBeTruthy()
    expect(placeBoxes.header!.width).toBeGreaterThan(placeBoxes.poster!.width * 0.58)
    const posterCenter = placeBoxes.poster!.x + (placeBoxes.poster!.width / 2)
    const headerCenter = placeBoxes.header!.x + (placeBoxes.header!.width / 2)
    expect(Math.abs(headerCenter - posterCenter)).toBeLessThan(placeBoxes.poster!.width * 0.04)
  })

  test('keeps Transit fixed-template title inside the bottom title band', async ({ page }) => {
    await page.goto('/style-browser-fixture?surface=1&composition=transit-diagram&theme=transit-diagram&posterEditor=1&surfaceTemplateEditor=1&width=1180&height=820')
    await expect(page.getByTestId('poster-canvas')).toBeVisible()

    const boxes = await page.evaluate(() => {
      const header = document.querySelector<HTMLElement>('[data-testid="poster-header"]')
      const map = document.querySelector<HTMLElement>('[data-testid="poster-map"]')
      const footer = document.querySelector<HTMLElement>('[data-testid="poster-footer"]')
      const poster = document.querySelector<HTMLElement>('[data-testid="poster-canvas"]')
      const title = document.querySelector<HTMLElement>('.poster-composition--transit-diagram .chrome-grid-block--title')
      return {
        poster: poster?.getBoundingClientRect().toJSON(),
        map: map?.getBoundingClientRect().toJSON(),
        header: header?.getBoundingClientRect().toJSON(),
        footer: footer?.getBoundingClientRect().toJSON(),
        title: title?.getBoundingClientRect().toJSON(),
      }
    })
    expect(boxes.poster).toBeTruthy()
    expect(boxes.map).toBeTruthy()
    expect(boxes.header).toBeTruthy()
    expect(boxes.footer).toBeTruthy()
    expect(boxes.title).toBeTruthy()
    expect(boxes.map!.height / boxes.poster!.height).toBeGreaterThan(0.82)
    expect(boxes.map!.height / boxes.poster!.height).toBeLessThan(0.84)
    expect(boxes.header!.height / boxes.poster!.height).toBeLessThan(0.2)
    expect(boxes.footer!.height / boxes.poster!.height).toBeLessThan(0.1)
    expect(boxes.title!.y).toBeGreaterThanOrEqual(boxes.header!.y - 1)
    expect(boxes.title!.y + boxes.title!.height).toBeLessThanOrEqual(boxes.header!.y + boxes.header!.height + 1)
  })

  test('keeps Risograph fixed-template chrome invisible while preserving misregistered title ink', async ({ page }) => {
    await page.goto('/style-browser-fixture?surface=1&composition=riso-stack&theme=risograph&posterEditor=1&surfaceTemplateEditor=1&width=1180&height=820')
    await expect(page.getByTestId('poster-canvas')).toBeVisible()

    const risoChrome = await page.evaluate(() => {
      const header = document.querySelector<HTMLElement>('.poster-composition--riso-stack [data-testid="poster-header"]')
      const footer = document.querySelector<HTMLElement>('.poster-composition--riso-stack [data-testid="poster-footer"]')
      const title = document.querySelector<HTMLElement>('.poster-composition--riso-stack .poster-trail-name')
      const titleBefore = title ? getComputedStyle(title, '::before') : null
      const titleStyle = title ? getComputedStyle(title) : null
      const caption = document.querySelector<HTMLElement>('.poster-composition--riso-stack [data-testid="composition-riso-caption"]')
      const meta = document.querySelector<HTMLElement>('.poster-composition--riso-stack [data-testid="composition-riso-meta"]')
      return {
        headerOutline: header ? getComputedStyle(header).outlineStyle : null,
        footerOutline: footer ? getComputedStyle(footer).outlineStyle : null,
        titleBeforeContent: titleBefore?.content ?? '',
        titleBeforeColor: titleBefore?.color ?? '',
        titleColor: titleStyle?.color ?? '',
        titleBlend: titleStyle?.mixBlendMode ?? '',
        titleOverflow: titleStyle?.overflow ?? '',
        titleLineHeight: titleStyle?.lineHeight ?? '',
        captionText: caption?.textContent ?? '',
        metaText: meta?.textContent ?? '',
      }
    })

    expect(risoChrome.headerOutline).toBe('none')
    expect(risoChrome.footerOutline).toBe('none')
    expect(risoChrome.titleBeforeContent).toContain('Kickapoo Endurance Race')
    expect(risoChrome.titleBeforeColor).not.toBe(risoChrome.titleColor)
    expect(risoChrome.titleBlend).toBe('multiply')
    expect(risoChrome.titleOverflow).toBe('visible')
    expect(Number.parseFloat(risoChrome.titleLineHeight)).toBeGreaterThan(40)
    expect(risoChrome.captionText).toContain('Kickapoo Endurance Race')
    expect(risoChrome.metaText).toContain('mi')
  })

  test('exposes owned Beta map themes in the Quick panel', async ({ page }) => {
    await page.goto('/style-browser-fixture?surface=1&width=1180&height=820', { waitUntil: 'domcontentloaded' })

    const posterThemeIds = await page.getByTestId('quick-poster-theme').evaluateAll(buttons =>
      buttons.map(button => button.getAttribute('data-theme-id')),
    )
    expect(posterThemeIds).toEqual(expect.arrayContaining(specThemeRecipes.map(([theme]) => theme)))

    await expect(page.getByText('Beta owned map themes')).toBeVisible()
    const ownedThemeIds = await page.getByTestId('quick-owned-map-theme').evaluateAll(buttons =>
      buttons.map(button => button.getAttribute('data-preset-id')),
    )
    expect(ownedThemeIds).toEqual([
      'radmaps-minimalist',
      'radmaps-topographic',
      'radmaps-natural',
      'radmaps-toner-light',
      'radmaps-toner-dark',
      'radmaps-contour-wash',
      'radmaps-watercolor',
      'radmaps-night-relief',
      'radmaps-simple-contour',
      'radmaps-alidade',
      'radmaps-alidade-dark',
    ])

    const ownedThumbKeys = await page.getByTestId('quick-owned-map-theme').evaluateAll(buttons =>
      buttons.map(button => button.querySelector('[data-thumb-key]')?.getAttribute('data-thumb-key')),
    )
    expect(ownedThumbKeys).toEqual([
      'atlas-minimal',
      'atlas-topographic',
      'atlas-natural',
      'atlas-toner-light',
      'atlas-toner-dark',
      'atlas-contour-wash',
      'atlas-watercolor',
      'atlas-night-relief',
      'atlas-simple-contour',
      'atlas-alidade',
      'atlas-alidade-dark',
    ])

    const uniqueThumbnailMarkup = await page.getByTestId('quick-owned-map-theme').evaluateAll(buttons => {
      const signatures = buttons.map(button => button.querySelector('svg')?.innerHTML.trim() ?? '')
      return new Set(signatures).size
    })
    expect(uniqueThumbnailMarkup).toBe(ownedThemeIds.length)
  })

  test('keeps long route titles inside title bands for expressive layouts', async ({ page }) => {
    test.skip(true, 'deferred text-fit work per docs/GO_TO_MARKET_COURSE_CORRECTION.md')
    test.setTimeout(60_000)
    const cases = [
      ['transit-diagram', 'transit-diagram'],
      ['travel-banner', 'midcentury-travel'],
      ['riso-stack', 'risograph'],
      ['botanical-plate', 'botanical'],
    ] as const
    const longTitle = 'Mount Washington Presidential Traverse Ultra Loop'

    for (const [composition, theme] of cases) {
      await page.goto(`/style-browser-fixture?composition=${composition}&theme=${theme}&width=720&height=1080&title=${encodeURIComponent(longTitle)}`, { waitUntil: 'domcontentloaded' })
      await expect(page.getByTestId('poster-canvas')).toBeVisible()

      const boxes = await page.evaluate(() => {
        const poster = document.querySelector<HTMLElement>('[data-testid="poster-canvas"]')
        const header = document.querySelector<HTMLElement>('[data-testid="poster-header"]')
        const title = document.querySelector<HTMLElement>('.poster-trail-name')
        return {
          poster: poster?.getBoundingClientRect().toJSON(),
          header: header?.getBoundingClientRect().toJSON(),
          title: title?.getBoundingClientRect().toJSON(),
        }
      })
      expect(boxes.poster).toBeTruthy()
      expect(boxes.header).toBeTruthy()
      expect(boxes.title).toBeTruthy()
      expect(boxes.title!.x).toBeGreaterThanOrEqual(boxes.poster!.x - 1)
      expect(boxes.title!.x + boxes.title!.width).toBeLessThanOrEqual(boxes.poster!.x + boxes.poster!.width + 1)
      expect(boxes.title!.y).toBeGreaterThanOrEqual(boxes.header!.y - 1)
      expect(boxes.title!.y + boxes.title!.height).toBeLessThanOrEqual(boxes.header!.y + boxes.header!.height + 1)
    }
  })

  test('renders every design-spec poster recipe at a stable 2:3 aspect', async ({ context }) => {
    test.setTimeout(180_000)

    for (const [theme, composition] of specThemeRecipes) {
      const page = await context.newPage()
      const consoleErrors: string[] = []
      page.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(msg.text())
      })
      await page.goto(`/style-browser-fixture?theme=${theme}&composition=${composition}&width=360&height=540`, { waitUntil: 'domcontentloaded' })
      const poster = page.getByTestId('poster-canvas')
      await expect(poster).toBeVisible()
      await expect(poster).toHaveAttribute('data-theme', theme)
      await expect(poster).toHaveAttribute('data-composition', composition)
      await expect(page.getByTestId('poster-map')).toBeVisible()
      await page.locator('.maplibregl-canvas').first().waitFor({ state: 'visible', timeout: 20_000 })

      const box = await poster.boundingBox()
      expect(box, theme).toBeTruthy()
      expect(Math.abs((box!.width / box!.height) - (2 / 3)), theme).toBeLessThan(0.02)
      await expect.poll(() => {
        const hasBlobWorkerNoise = consoleErrors.some(error => error.includes('Cannot load blob:http://localhost'))
        return consoleErrors
          .filter(error => !error.includes('Failed to load resource'))
          .filter(error => !error.includes('Cannot load blob:http://localhost'))
          .filter(error => !(hasBlobWorkerNoise && error === 'Error'))
          .join('\n')
      }, { message: theme }).toBe('')
      await page.close()
    }
  })

  test('renders every design-spec poster recipe in final-print geometry with bleed', async ({ context }) => {
    test.setTimeout(300_000)

    for (const [theme, composition] of specThemeRecipes) {
      const page = await context.newPage()
      const consoleErrors: string[] = []
      page.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(msg.text())
      })

      await page.goto(`/style-browser-fixture?print=final&printScale=20&theme=${theme}&composition=${composition}`, { waitUntil: 'domcontentloaded' })
      const poster = page.getByTestId('poster-canvas')
      await expect(poster).toBeVisible()
      await expect(poster).toHaveAttribute('data-theme', theme)
      await expect(poster).toHaveAttribute('data-composition', composition)
      await expect(page.getByTestId('poster-map')).toBeVisible()
      await page.locator('.maplibregl-canvas').first().waitFor({ state: 'visible', timeout: 20_000 })
      await expect.poll(async () => page.evaluate(() => {
        const win = window as unknown as { __RENDER_READY?: boolean }
        return win.__RENDER_READY === true
      }), { message: theme, timeout: 30_000 }).toBe(true)

      const print = await page.evaluate((forbiddenSelectors) => {
        const poster = document.querySelector<HTMLElement>('[data-testid="poster-canvas"]')
        const map = document.querySelector<HTMLElement>('[data-testid="poster-map"]')
        const canvas = document.querySelector<HTMLCanvasElement>('.maplibregl-canvas')
        const box = poster?.getBoundingClientRect()
        const mapBox = map?.getBoundingClientRect()
        const canvasBox = canvas?.getBoundingClientRect()
        const styles = poster ? getComputedStyle(poster) : null
        const win = window as unknown as {
          __RENDER_READY?: boolean
          __RADMAPS_RENDER_STATUS?: { ready?: boolean; routeContentPresent?: boolean; error?: string }
        }
        return {
          width: box?.width ?? 0,
          height: box?.height ?? 0,
          mapWidth: mapBox?.width ?? 0,
          mapHeight: mapBox?.height ?? 0,
          canvasWidth: canvasBox?.width ?? 0,
          canvasHeight: canvasBox?.height ?? 0,
          bleed: styles?.getPropertyValue('--print-bleed').trim() ?? '',
          renderReady: win.__RENDER_READY === true,
          renderStatusReady: win.__RADMAPS_RENDER_STATUS?.ready === true,
          routeContentPresent: win.__RADMAPS_RENDER_STATUS?.routeContentPresent !== false,
          renderError: win.__RADMAPS_RENDER_STATUS?.error ?? '',
          forbidden: forbiddenSelectors.flatMap((selector) => (
            Array.from(document.querySelectorAll(selector)).map(el => selector)
          )),
        }
      }, finalPrintForbiddenSelectors)

      expect(print.width, theme).toBeGreaterThan(300)
      expect(print.height, theme).toBeGreaterThan(450)
      expect(print.mapWidth, theme).toBeGreaterThan(100)
      expect(print.mapHeight, theme).toBeGreaterThan(100)
      expect(print.canvasWidth, theme).toBeGreaterThan(100)
      expect(print.canvasHeight, theme).toBeGreaterThan(100)
      expect(print.width / print.height, theme).toBeGreaterThan(0.64)
      expect(print.width / print.height, theme).toBeLessThan(0.69)
      expect(print.bleed, theme).not.toBe('0px')
      expect(print.renderReady, theme).toBe(true)
      expect(print.renderStatusReady, theme).toBe(true)
      expect(print.routeContentPresent, theme).toBe(true)
      expect(print.renderError, theme).toBe('')
      expect(print.forbidden, theme).toEqual([])
      await expect.poll(() => {
        const hasBlobWorkerNoise = consoleErrors.some(error => error.includes('Cannot load blob:http://localhost'))
        const hasDemoGlyphCorsNoise = consoleErrors.some(error => error.includes('https://demotiles.maplibre.org/font/'))
        return consoleErrors
          .filter(error => !error.includes('Failed to load resource'))
          .filter(error => !error.includes('Cannot load blob:http://localhost'))
          .filter(error => !error.includes('https://demotiles.maplibre.org/font/'))
          .filter(error => !(hasDemoGlyphCorsNoise && error === 'Error'))
          .filter(error => !(hasBlobWorkerNoise && error === 'Error'))
          .join('\n')
      }, { message: theme }).toBe('')
      await page.close()
    }
  })

  test('keeps every design-spec poster recipe stable when route geometry is missing', async ({ context }) => {
    test.setTimeout(180_000)

    for (const [theme, composition] of specThemeRecipes) {
      const page = await context.newPage()
      const consoleErrors: string[] = []
      page.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(msg.text())
      })

      await page.goto(`/style-browser-fixture?route=0&theme=${theme}&composition=${composition}&width=360&height=540`, { waitUntil: 'domcontentloaded' })
      const poster = page.getByTestId('poster-canvas')
      await expect(poster).toBeVisible()
      await expect(poster).toHaveAttribute('data-theme', theme)
      await expect(poster).toHaveAttribute('data-composition', composition)
      await expect(page.getByTestId('poster-map')).toBeVisible()

      const summary = await page.evaluate(() => {
        const poster = document.querySelector<HTMLElement>('[data-testid="poster-canvas"]')
        const map = document.querySelector<HTMLElement>('[data-testid="poster-map"]')
        const title = document.querySelector<HTMLElement>('.poster-trail-name,.chrome-grid-block--title')
        return {
          poster: poster?.getBoundingClientRect().toJSON(),
          map: map?.getBoundingClientRect().toJSON(),
          title: title?.getBoundingClientRect().toJSON(),
          hasRouteClass: poster?.classList.contains('poster-has-route') ?? false,
          hasPlaceClass: poster?.classList.contains('poster-place-map') ?? false,
        }
      })

      expect(summary.poster, theme).toBeTruthy()
      expect(summary.map, theme).toBeTruthy()
      expect(summary.title, theme).toBeTruthy()
      expect(summary.hasRouteClass, theme).toBe(false)
      expect(summary.hasPlaceClass, theme).toBe(true)
      await expect.poll(() => {
        const hasBlobWorkerNoise = consoleErrors.some(error => error.includes('Cannot load blob:http://localhost'))
        return consoleErrors
          .filter(error => !error.includes('Failed to load resource'))
          .filter(error => !error.includes('Cannot load blob:http://localhost'))
          .filter(error => !(hasBlobWorkerNoise && error === 'Error'))
          .join('\n')
      }, { message: theme }).toBe('')
      await page.close()
    }
  })

  test('keeps fixed-template design-spec recipes resilient to long route names', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'desktop-only full recipe stress pass')
    test.setTimeout(180_000)
    const shortTitle = 'HH'
    const longTitle = 'Mount Washington Presidential Traverse Ultra Loop'

    for (const [theme, composition] of specThemeRecipes) {
      const inspectTitle = async (titleText: string) => {
        await page.goto(`/style-browser-fixture?surface=1&theme=${theme}&composition=${composition}&posterEditor=1&surfaceTemplateEditor=1&width=1180&height=820&title=${encodeURIComponent(titleText)}`, { waitUntil: 'domcontentloaded' })
        await expect(page.getByTestId('poster-canvas')).toBeVisible()
        await page.waitForTimeout(50)
        return await page.evaluate((expectedTitle) => {
        const poster = document.querySelector<HTMLElement>('[data-testid="poster-canvas"]')?.getBoundingClientRect()
        const map = document.querySelector<HTMLElement>('[data-testid="poster-map"]')?.getBoundingClientRect()
        const normalizedTitle = expectedTitle.replace(/\s+/g, ' ').trim().toLowerCase()
        const visibleTitles = [...document.querySelectorAll<HTMLElement>('.poster-trail-name,.chrome-grid-block--title')]
          .filter((element) => {
            const rect = element.getBoundingClientRect()
            const elementTitle = (element.textContent ?? '').replace(/\s+/g, ' ').trim().toLowerCase()
            return elementTitle === normalizedTitle &&
              getComputedStyle(element).display !== 'none' &&
              rect.width > 0 &&
              rect.height > 0
          })

        if (!poster || !map || visibleTitles.length === 0) {
          return { map: map?.toJSON() ?? null, issues: ['missing visible route title'] }
        }

        const issues = visibleTitles.flatMap((element) => {
          const rect = element.getBoundingClientRect()
          const failures: string[] = []
          if (
            rect.x < poster.x - 1 ||
            rect.y < poster.y - 1 ||
            rect.right > poster.right + 1 ||
            rect.bottom > poster.bottom + 1
          ) {
            failures.push(`${element.getAttribute('class') ?? 'title'} escapes poster`)
          }
          return failures
        })
        return { map: map.toJSON(), issues }
        }, titleText)
      }

      const shortState = await inspectTitle(shortTitle)
      const longState = await inspectTitle(longTitle)
      expect(shortState.issues, `${theme}/${composition} short title`).toEqual([])
      expect(longState.issues, `${theme}/${composition} long title`).toEqual([])
      expect(longState.map, `${theme}/${composition} long title map`).toBeTruthy()
      expect(shortState.map, `${theme}/${composition} short title map`).toBeTruthy()
      for (const key of ['x', 'y', 'width', 'height'] as const) {
        expect(Math.abs((longState.map?.[key] ?? 0) - (shortState.map?.[key] ?? 0)), `${theme}/${composition} map ${key}`).toBeLessThanOrEqual(0.75)
      }
    }
  })

  test('theme picker previews themes before mutating saved style', async ({ page }, testInfo) => {
    test.setTimeout(60_000)
    await page.goto('/style-browser-fixture?themePicker=1&width=1180&height=820')

    await expect(page.getByTestId('theme-lineup-step')).toBeVisible()
    await expect(page.getByTestId('theme-base-mode-picker')).toBeVisible()
    await expect(page.getByTestId('theme-base-mode-auto')).toContainText('Terrain')
    await expect(page.getByTestId('theme-base-mode-minimal')).toHaveCount(0)
    expect(await page.getByTestId('theme-preview-card').count()).toBeGreaterThan(10)
    await expect(page.locator('.theme-lineup-grid-head')).toHaveCount(0)
    await expect(page.locator('.theme-lineup-icon-action')).toHaveCount(0)

    await expect.poll(async () => page.evaluate(() => {
      const fixture = (window as any).__RADMAPS_STYLE_FIXTURE__
      return fixture?.getStyle()?.color_theme ?? null
    })).toBe('editorial-minimal')

    await page.getByTestId('theme-base-mode-terrain').click()
    await page.locator('[data-testid="theme-preview-card"][data-theme-id="blueprint"]').click()
    const heroPoster = page.locator('[data-testid="theme-picker-hero"] [data-testid="poster-canvas"][data-theme="blueprint"]').first()
    await expect(heroPoster).toBeVisible()
    await expect(heroPoster).toHaveAttribute('data-base-map-mode', 'terrain')
    await expect(page.locator('[data-testid="theme-preview-card"][data-theme-id="blueprint"] [data-testid="poster-canvas"]').first())
      .toHaveAttribute('data-base-map-mode', 'terrain')
    const heroPosterBox = await heroPoster.boundingBox()
    expect(heroPosterBox?.width).toBeGreaterThan(240)
    expect(heroPosterBox?.height).toBeGreaterThan(360)

    const interactionState = await page.evaluate(() => {
      const win = window as unknown as {
        __RADMAPS_MAP_CAMERA__?: {
          getInteractionState: () => {
            dragPan: boolean
            scrollZoom: boolean
            doubleClickZoom: boolean
            touchZoomRotate: boolean
          }
        }
      }
      return win.__RADMAPS_MAP_CAMERA__?.getInteractionState?.() ?? null
    })
    expect(interactionState).toEqual({
      dragPan: false,
      scrollZoom: false,
      doubleClickZoom: false,
      touchZoomRotate: false,
    })

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
    expect(appliedStyle.base_map_mode).toBe('terrain')
    await expect(page.getByTestId('poster-canvas')).toHaveAttribute('data-base-map-mode', 'terrain')
  })

  test('route-first POI themes drop route stats and keep the map rect stable', async ({ page }) => {
    for (const [theme, composition] of [
      ['splits-stats', 'splits-grid'],
      ['marathon-bib', 'bib-numerals'],
    ] as const) {
      await page.goto(`/style-browser-fixture?route=0&theme=${theme}&composition=${composition}&width=520&height=780&distanceKm=42&gainM=900`, { waitUntil: 'domcontentloaded' })

      const poster = page.getByTestId('poster-canvas')
      const map = page.getByTestId('poster-map')
      await expect(poster).toBeVisible()
      await expect(poster).toHaveClass(/poster-place-map/)
      await expect(map).toBeVisible()
      await expect(page.getByTestId('elevation-profile')).toHaveCount(0)
      await expect(page.getByTestId('elevation-profile-band')).toHaveCount(0)
      await expect(page.getByTestId('composition-technical-data-footer')).toHaveCount(0)
      await expect(page.getByTestId('composition-bib-data-footer')).toHaveCount(0)

      const boxes = await page.evaluate(() => {
        const posterEl = document.querySelector<HTMLElement>('[data-testid="poster-canvas"]')
        const mapEl = document.querySelector<HTMLElement>('[data-testid="poster-map"]')
        return {
          poster: posterEl?.getBoundingClientRect().toJSON(),
          map: mapEl?.getBoundingClientRect().toJSON(),
        }
      })
      expect(boxes.poster, theme).toBeTruthy()
      expect(boxes.map, theme).toBeTruthy()
      expect(boxes.map!.width, theme).toBeGreaterThan(boxes.poster!.width * 0.82)
      expect(boxes.map!.height, theme).toBeGreaterThan(boxes.poster!.height * 0.52)
    }
  })

  test('theme picker design-myself exits without applying the selected preview', async ({ page }, testInfo) => {
    test.setTimeout(60_000)
    await page.goto('/style-browser-fixture?themePicker=1&width=1180&height=820')
    await expect(page.getByTestId('theme-lineup-step')).toBeVisible()
    await expect.poll(async () => page.evaluate(() => Boolean((window as any).__RADMAPS_STYLE_FIXTURE__))).toBe(true)

    await page.locator('[data-testid="theme-preview-card"][data-theme-id="blueprint"]').click()
    await page.getByTestId(testInfo.project.name === 'mobile' ? 'theme-picker-design-myself-mobile' : 'theme-picker-design-myself').click({ force: true })
    await expect(page.getByTestId('theme-lineup-step')).toHaveCount(0)

    const style = await page.evaluate(() => {
      const fixture = (window as any).__RADMAPS_STYLE_FIXTURE__
      return fixture?.getStyle()
    })
    expect(style.color_theme).toBe('editorial-minimal')
  })

  test('keeps composition-specific printed cues restrained', async ({ page }) => {
    await page.goto('/style-browser-fixture?composition=park-quad&theme=usgs-vintage')
    await expect(page.getByTestId('composition-kicker')).toHaveCount(0)
    await expect(page.getByTestId('composition-footer-note')).toHaveCount(0)

    await page.goto('/style-browser-fixture?composition=blueprint-grid&theme=blueprint')
    await expect(page.getByTestId('composition-kicker')).toHaveCount(0)
    await expect(page.getByTestId('composition-meta-line')).toHaveCount(0)
    await expect(page.locator('.poster-stats')).toContainText('DIST')
    await expect(page.getByTestId('composition-footer-note')).toHaveCount(0)

    await page.goto('/style-browser-fixture?composition=brutalist-slab&theme=brutalist')
    await expect(page.getByTestId('composition-footer-note')).toContainText('Complete trail network')
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
    expect(Number.parseFloat(boxes.footerRuleStyle)).toBeGreaterThanOrEqual(1)
    expect(Number.parseFloat(boxes.footerRuleStyle)).toBeLessThanOrEqual(3)
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

    await expect.poll(assetY).toBeGreaterThan(60)
    await expect.poll(assetY).toBeLessThan(75)

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

    await expect.poll(async () => (await assetPosition()).x).toBeLessThanOrEqual(42)

    const beforeKey = await assetPosition()
    await page.keyboard.press('ArrowRight')
    await expect.poll(async () => (await assetPosition()).x).toBeGreaterThan(beforeKey.x)

    await page.mouse.click(posterBox!.x + posterBox!.width - 4, posterBox!.y + posterBox!.height - 4)
    await expect(asset).not.toHaveClass(/is-selected/)
    const afterDeselect = await assetPosition()
    await page.keyboard.press('ArrowRight')
    await expect.poll(async () => (await assetPosition()).x).toBe(afterDeselect.x)
  })

  test('makes restrained composition header cues editable', async ({ page }) => {
    await page.goto('/style-browser-fixture?composition=brutalist-slab&theme=brutalist&editable=1')

    await expect(page.getByTestId('composition-kicker')).toHaveAttribute('contenteditable', 'true')
    await expect(page.getByTestId('composition-meta-line')).toHaveAttribute('contenteditable', 'true')
    await expect(page.getByTestId('composition-side-rail-label')).toHaveCount(0)
    await page.locator('.maplibregl-canvas').waitFor({ state: 'visible', timeout: 15_000 })
    await page.waitForTimeout(500)

    await page.getByTestId('composition-kicker').fill('Edited field label')
    await page.keyboard.press('Tab')
    await expect(page.getByTestId('composition-kicker')).toContainText('EDITED FIELD LABEL')
  })

  test('applies inline point size and alignment edits to themed composition text', async ({ page }) => {
    await page.goto('/style-browser-fixture?composition=brutalist-slab&theme=brutalist&editable=1')

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

    await page.getByTestId('text-align-right').click()
    await expect.poll(async () => page.evaluate(() => {
      const fixture = (window as any).__RADMAPS_STYLE_FIXTURE__
      return fixture?.getStyle().poster_text_overrides?.composition_meta
    })).toMatchObject({ font_size_pt: 96, align: 'right' })
    await expect.poll(async () => meta.evaluate(el => Number.parseFloat(getComputedStyle(el).fontSize))).toBe(before)

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

    await page.goto('/style-browser-fixture?composition=blueprint-strava&theme=blueprint-strava&editable=1&pins=1')

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
    await expect(footerGrid).toHaveCSS('height', '0px')
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

    const firstHeaderCellAfterRowAdd = headerGrid.locator('.chrome-grid-cell').first()
    const headerCellCountBefore = await headerGrid.locator('.chrome-grid-cell').count()
    await firstHeaderCellAfterRowAdd.click()
    await structurePopover.getByText('+ Col').click()
    await expect(headerGrid.locator('.chrome-grid-cell')).toHaveCount(headerCellCountBefore + 1)

    await firstHeaderCellAfterRowAdd.click()
    await structurePopover.getByText('Clear').click()
    await expect(firstHeaderCellAfterRowAdd.locator('.chrome-empty-cell-btn')).toBeVisible()
    await expect.poll(async () => page.evaluate(() => {
      const fixture = (window as any).__RADMAPS_STYLE_FIXTURE__
      const firstCell = fixture?.getStyle().poster_layout?.bands?.header?.rows?.[0]?.cells?.[0]
      return firstCell?.block?.empty === true
    })).toBe(true)

    await firstHeaderCellAfterRowAdd.locator('.chrome-empty-cell-btn').click()
    await expect(firstHeaderCellAfterRowAdd.locator('.chrome-grid-block')).toContainText('Your text')

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

  test('keeps the map rect stable for content and free-anchor edits', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'desktop anchor layout contract coverage')

    await page.goto('/style-browser-fixture?editable=1&chrome=1&width=720&height=1080')
    await page.locator('.maplibregl-canvas').waitFor({ state: 'visible', timeout: 15_000 })
    await expect.poll(async () => page.evaluate(() => Boolean((window as any).__RADMAPS_STYLE_FIXTURE__))).toBe(true)

    const mapRect = async () => page.getByTestId('poster-map').evaluate((el) => {
      const rect = el.getBoundingClientRect()
      return {
        top: Math.round(rect.top * 10) / 10,
        left: Math.round(rect.left * 10) / 10,
        width: Math.round(rect.width * 10) / 10,
        height: Math.round(rect.height * 10) / 10,
      }
    })
    const initial = await mapRect()

    await page.evaluate(() => {
      const fixture = (window as any).__RADMAPS_STYLE_FIXTURE__
      const current = fixture.getStyle()
      fixture.setStyle({
        poster_text_overrides: {
          ...(current.poster_text_overrides ?? {}),
          trail_name: { ...(current.poster_text_overrides?.trail_name ?? {}), text: 'AN INTENTIONALLY LONG SEA CHART ROUTE NAME' },
        },
      })
    })
    await page.waitForTimeout(200)
    expect(await mapRect()).toEqual(initial)

    await page.evaluate(() => {
      const fixture = (window as any).__RADMAPS_STYLE_FIXTURE__
      const current = fixture.getStyle()
      fixture.setStyle({
        poster_layout: {
          ...(current.poster_layout ?? {}),
          anchors: [
            ...((current.poster_layout?.anchors ?? []).filter((anchor: any) => anchor.id !== 'free-floating-contract-anchor')),
            {
              id: 'free-floating-contract-anchor',
              anchorTo: 'map',
              edge: 'bottom',
              displacesMap: false,
              z: 18,
              box: {
                bottom: { kind: 'unit', value: 8, unit: 'cqh' },
                width: { kind: 'unit', value: 60, unit: 'cqw' },
              },
            },
          ],
        },
      })
    })
    await page.waitForTimeout(200)
    expect(await mapRect()).toEqual(initial)

    await expect.poll(mapRect).toEqual(initial)
  })

  test('wires chrome grid edits through the map editor surface', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'desktop editor-surface chrome coverage')

    await page.goto('/style-browser-fixture?surface=1&composition=modernist-block&theme=bold-modern&chrome=1&width=1180&height=820')
    await page.locator('.maplibregl-canvas').waitFor({ state: 'visible', timeout: 15_000 })

    const surface = page.getByTestId('map-editor-surface')
    await expect(surface).toHaveAttribute('data-chrome-editing', 'true')

    const headerGrid = page.getByTestId('chrome-band-header')
    const coordinateCell = headerGrid.locator('[data-chrome-cell-id="hdr-location"]')
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

    const headerGrid = page.getByTestId('chrome-band-header')
    await expect(headerGrid).toBeVisible()
    await headerGrid.locator('.chrome-grid-cell').first().click()
    await expect(page.getByTestId('chrome-mobile-drawer')).toBeVisible()
    await expect(headerGrid.locator('.chrome-inline-popover')).toHaveCount(0)
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

  test('adapts generated contour density to the loaded map location relief', async ({ page }) => {
    async function contourProfileFor(region: string) {
      await page.goto(`/style-browser-fixture?composition=modernist-block&theme=blackline&region=${region}&editable=1&elevation=1`)
      await page.locator('.maplibregl-canvas').waitFor({ state: 'visible', timeout: 15_000 })
      const readProfile = () => page.evaluate(() => {
        const win = window as unknown as {
          __RADMAPS_MAP_CAMERA__?: {
            getContourProfile?: () => {
              source: string
              detail: number
              thresholds: Record<string, [number, number]>
              relief: { band: string }
            }
          }
        }
        const profile = win.__RADMAPS_MAP_CAMERA__?.getContourProfile?.()
        if (!profile || profile.source !== 'visible-route') return null
        return {
          detail: profile.detail,
          band: profile.relief.band,
          zoom10: profile.thresholds['10'],
          zoom14: profile.thresholds['14'],
        }
      })
      await expect.poll(readProfile, { timeout: 15_000 }).not.toBeNull()
      return await readProfile()
    }

    const bostonProfile = await contourProfileFor('boston')
    expect(bostonProfile).toMatchObject({
      detail: 5,
      band: 'low',
      zoom10: [5, 25],
      zoom14: [5, 25],
    })

    const whitneyProfile = await contourProfileFor('whitney')
    expect(whitneyProfile).toMatchObject({
      detail: 0,
      band: 'extreme',
      zoom10: [200, 1000],
      zoom14: [50, 200],
    })
  })

  test('updates Dark Sky contour weights live even with Atlas contour defaults', async ({ page }) => {
    await page.goto('/style-browser-fixture?composition=darksky-stars&theme=dark-sky&editable=1')
    await page.locator('.maplibregl-canvas').waitFor({ state: 'visible', timeout: 15_000 })
    await expect.poll(async () => page.evaluate(() => {
      const win = window as unknown as {
        __RADMAPS_STYLE_FIXTURE__?: { getStyle: () => { atlas_layer_settings?: { contour?: unknown } } }
        __RADMAPS_MAP_CAMERA__?: {
          getLayerIds?: () => string[]
          getPaintProperty?: (layerId: string, property: string) => unknown
        }
      }
      if (!win.__RADMAPS_MAP_CAMERA__?.getLayerIds?.().includes('contours-minor')) return false
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
        __RADMAPS_MAP_CAMERA__?: {
          getLayerIds?: () => string[]
          getPaintProperty?: (layerId: string, property: string) => unknown
        }
      }
      const layerIds = win.__RADMAPS_MAP_CAMERA__?.getLayerIds?.() ?? []
      if (!layerIds.includes('contours-minor') || !layerIds.includes('contours-major')) return null
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

    await page.goto('/style-browser-fixture?composition=splits-grid&theme=splits-stats&editable=1&elevation=1')
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
        elevation_profile_position: 'separate-band',
        elevation_profile_opacity: 1,
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

  test('poster editor v2 shows guided slot layers with guides', async ({ page }) => {
    const consoleErrors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text())
    })

    await page.goto('/style-browser-fixture?composition=editorial-tall&theme=editorial-minimal&editable=1&overlay=1&asset=1&icon=1&posterEditor=1&posterMode=select&guides=1&selectedPosterElement=slot:trail_name')
    await expect(page.getByTestId('poster-canvas')).toBeVisible()
    await expect(page.getByTestId('poster-editor-guides')).toBeVisible()
    const titleSlot = page.locator('[data-poster-element-id="slot:trail_name"]').first()
    await expect(titleSlot).toBeVisible()
    await expect(page.locator('[data-poster-element-id^="text:"]')).toHaveCount(0)
    await expect(page.locator('[data-poster-element-id^="asset:"]')).toHaveCount(0)
    await expect(page.locator('[data-poster-element-id^="icon:"]')).toHaveCount(0)
    await expect(titleSlot).toHaveAttribute('data-poster-element-id', 'slot:trail_name')
    await expect.poll(() => consoleErrors.filter(error => !error.includes('Failed to load resource')).join('\n')).toBe('')
  })

  test('poster tier 2 exposes free text and image anchors without moving the map', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'desktop moveable coverage')

    await page.goto('/style-browser-fixture?composition=editorial-tall&theme=editorial-minimal&editable=1&overlay=1&asset=1&icon=1&posterEditor=1&posterTier2=1&posterMode=select&guides=1&selectedPosterElement=text:fixture-overlay-label')
    await expect(page.getByTestId('poster-canvas')).toBeVisible()
    const textOverlay = page.locator('[data-poster-element-id="text:fixture-overlay-label"]')
    const assetOverlay = page.locator('[data-poster-element-id="asset:fixture-logo-asset"]')
    await expect(textOverlay).toBeVisible()
    await expect(assetOverlay).toBeVisible()
    await expect(page.locator('[data-poster-element-id^="icon:"]')).toHaveCount(0)

    const beforeMap = await page.getByTestId('poster-map').boundingBox()
    expect(beforeMap).toBeTruthy()
    await expect.poll(() => page.evaluate(() => Boolean((window as unknown as { __RADMAPS_STYLE_FIXTURE__?: unknown }).__RADMAPS_STYLE_FIXTURE__))).toBe(true)
    await page.evaluate(() => {
      (window as unknown as {
        __RADMAPS_STYLE_FIXTURE__?: {
          patchPosterElement: (id: string, patch: { x: number; y: number; zIndex: number }) => void
        }
      }).__RADMAPS_STYLE_FIXTURE__?.patchPosterElement('text:fixture-overlay-label', { x: 22, y: 54, zIndex: 62 })
    })

    await expect.poll(() => page.evaluate(() => {
      const style = (window as unknown as { __RADMAPS_STYLE_FIXTURE__?: { getStyle: () => any } }).__RADMAPS_STYLE_FIXTURE__?.getStyle()
      const anchor = style?.poster_layout?.anchors?.find((item: any) => item.id === 'free-text:fixture-overlay-label')
      return {
        left: anchor?.box?.left?.value,
        top: anchor?.box?.top?.value,
        displacesMap: anchor?.displacesMap,
      }
    })).toMatchObject({
      left: 22,
      top: 54,
      displacesMap: false,
    })
    await expect.poll(() => textOverlay.evaluate(element => ({
      left: element.style.left,
      top: element.style.top,
    }))).toEqual({ left: '22%', top: '54%' })

    const afterMap = await page.getByTestId('poster-map').boundingBox()
    expect(afterMap).toBeTruthy()
    expect(afterMap!.x).toBeCloseTo(beforeMap!.x, 0)
    expect(afterMap!.y).toBeCloseTo(beforeMap!.y, 0)
    expect(afterMap!.width).toBeCloseTo(beforeMap!.width, 0)
    expect(afterMap!.height).toBeCloseTo(beforeMap!.height, 0)
  })

  test('poster tier 2 print guards reject unsafe overlay fixtures', async ({ page }) => {
    await page.goto('/style-browser-fixture?composition=editorial-tall&theme=editorial-minimal&overlay=1&unsafeOverlay=1&posterEditor=1&posterTier2=1&print=final&printScale=20')
    await expect.poll(() => page.evaluate(() => (window as unknown as { __RENDER_ERROR?: string }).__RENDER_ERROR ?? '')).toContain('Poster print guards failed')
  })

  test('poster editor guides are non-printing while printed grid remains printable', async ({ page }) => {
    await page.goto('/style-browser-fixture?composition=blueprint-grid&theme=blueprint&gridScope=poster&posterEditor=1&posterMode=guides&guides=1&print=final&printScale=10')
    await expect(page.getByTestId('poster-canvas')).toBeVisible()
    await expect(page.getByTestId('poster-editor-guides')).toHaveCount(0)
    await expect(page.getByTestId('composition-grid-overlay')).toBeVisible()
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
    await expect(page.getByTestId('fixed-template-map-band')).toHaveCount(0)
    await expect.poll(() => page.evaluate(() => {
      const win = window as unknown as {
        __RADMAPS_FIXED_TEMPLATE_EDITOR__?: { getPreviewStyle?: () => { map_frozen?: boolean } }
        __RADMAPS_MAP_CAMERA__?: { get?: () => { center: [number, number]; zoom: number } | null }
      }
      return Boolean(win.__RADMAPS_FIXED_TEMPLATE_EDITOR__?.getPreviewStyle?.().map_frozen && win.__RADMAPS_MAP_CAMERA__?.get?.())
    })).toBe(true)
    await expect(page.getByTestId('chrome-editor-app-bar')).toHaveCount(0)
    await expect(page.getByTestId('chrome-layout-builder')).toHaveCount(0)
    const titleBlock = page.locator('.fixed-template-map-preview .chrome-grid-block--title')
    await expect(titleBlock).toHaveCount(1)
    await expect.poll(() => titleBlock.evaluate(element => Number.parseFloat(window.getComputedStyle(element).fontSize))).toBeGreaterThan(0)
    await expect.poll(async () => {
      const box = await titleBlock.boundingBox()
      return box?.height ?? 0
    }).toBeLessThan(110)
    await expect.poll(() => page.locator('.fixed-template-map-preview').getByTestId('poster-header').evaluate((element) => {
      const style = window.getComputedStyle(element)
      return `${style.paddingTop} ${style.paddingBottom}`
    })).toBe('0px 0px')
    const titleBoxBeforePreview = await titleBlock.boundingBox()
    expect(titleBoxBeforePreview).toBeTruthy()
    await page.getByTestId('template-preview-toggle').click()
    await expect(page.getByTestId('template-preview-toggle')).toContainText('Edit')
    await expect(page.locator('.fixed-template-map-preview .chrome-grid-band')).toHaveCount(2)
    await expect(page.locator('.fixed-template-map-preview .chrome-grid-band.is-editable')).toHaveCount(0)
    await expect(page.locator('.fixed-template-map-preview .chrome-grid-block[contenteditable="true"]')).toHaveCount(0)
    await expect(page.getByTestId('chrome-cell-trash')).toHaveCount(0)
    await expect(page.getByTestId('chrome-cell-add-column')).toHaveCount(0)
    await expect(page.getByTestId('chrome-row-resize-row')).toHaveCount(0)
    await expect(page.getByTestId('fixed-template-map-band')).toHaveCount(0)
    const titleBoxInPreview = await titleBlock.boundingBox()
    expect(titleBoxInPreview).toBeTruthy()
    expect(Math.abs(titleBoxInPreview!.x - titleBoxBeforePreview!.x)).toBeLessThan(1)
    expect(Math.abs(titleBoxInPreview!.y - titleBoxBeforePreview!.y)).toBeLessThan(18)
    expect(Math.abs(titleBoxInPreview!.width - titleBoxBeforePreview!.width)).toBeLessThan(1)
    expect(Math.abs(titleBoxInPreview!.height - titleBoxBeforePreview!.height)).toBeLessThan(36)
    await page.getByTestId('template-preview-toggle').click()
    await expect(page.getByTestId('template-preview-toggle')).toContainText('Preview')
    await expect(page.locator('.fixed-template-map-preview .chrome-grid-band')).toHaveCount(2)
    await expect(page.locator('.fixed-template-map-preview .chrome-grid-band.is-editable')).toHaveCount(2)
    expect(await page.locator('.fixed-template-map-preview .chrome-grid-block[contenteditable="true"]').count()).toBeGreaterThan(0)
    await expect(page.getByTestId('fixed-template-map-band')).toHaveCount(0)

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
    const fixedPreview = page.locator('.fixed-template-map-preview')
    const lockedMapBox = await fixedPreview.getByTestId('poster-map').boundingBox()
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
    await expect(fixedPreview.getByTestId('poster-canvas')).toBeVisible()
    await expect.poll(() => fixedPreview.getByTestId('poster-header').evaluate((element) => {
      const style = window.getComputedStyle(element)
      return `${style.paddingTop} ${style.paddingBottom}`
    })).toBe('0px 0px')
    const chromeHeaderPadding = await fixedPreview.getByTestId('poster-header').evaluate((element) => {
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
    expect(Math.abs(boxAfterHover!.y - boxBeforeHover!.y)).toBeLessThan(18)
    expect(Math.abs(boxAfterHover!.height - boxBeforeHover!.height)).toBeLessThan(36)

    await firstTextBlock.click()
    await expect(page.getByTestId('template-delete-selected')).toBeVisible()
    await expect(page.getByTestId('template-duplicate-selected')).toBeVisible()
    await expect(page.getByTestId('template-font-select')).toBeVisible()
    await expect(page.getByTestId('template-text-size')).toHaveCount(0)
    await expect(page.getByTestId('template-text-size-decrease')).toBeVisible()
    await expect(page.getByTestId('template-text-size-increase')).toBeVisible()
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
    await expect(headerLayerGroup).toContainText('Title')
    await expect(headerLayerGroup).toContainText('Location')
    await expect(footerLayerGroup).not.toContainText('Title')
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
    await expect.poll(() => bottomHeaderSpacer.locator('[data-testid="chrome-cell-trash"]').evaluate(element => window.getComputedStyle(element).opacity)).toBe('1')
    await expect.poll(() => bottomHeaderSpacer.locator('[data-testid="chrome-cell-add-column"]').evaluate(element => window.getComputedStyle(element).opacity)).toBe('1')
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
        row.querySelector<HTMLElement>('[data-testid="chrome-row-add-row"]'),
        row.querySelector<HTMLElement>('[data-testid="chrome-row-resize-row"][data-edge="top"]'),
        row.querySelector<HTMLElement>('[data-testid="chrome-row-resize-row"][data-edge="bottom"]'),
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
    const topRowResizeGrip = bottomHeaderSpacer.locator('[data-testid="chrome-row-resize-row"][data-edge="top"]')
    const rowResizeGrip = bottomHeaderSpacer.locator('[data-testid="chrome-row-resize-row"][data-edge="bottom"]')
    await expect(topRowResizeGrip).toBeVisible()
    await expect(rowResizeGrip).toBeVisible()
    const rowBox = await bottomHeaderSpacer.boundingBox()
    const topRowGripBox = await topRowResizeGrip.boundingBox()
    const rowGripBox = await rowResizeGrip.boundingBox()
    expect(rowBox).toBeTruthy()
    expect(topRowGripBox).toBeTruthy()
    expect(rowGripBox).toBeTruthy()
    const rowCenterX = rowBox!.x + rowBox!.width / 2
    expect(Math.abs((topRowGripBox!.x + topRowGripBox!.width / 2) - rowCenterX)).toBeLessThan(2)
    expect(Math.abs((rowGripBox!.x + rowGripBox!.width / 2) - rowCenterX)).toBeLessThan(2)
    expect(Math.abs((topRowGripBox!.y + topRowGripBox!.height / 2) - rowBox!.y)).toBeLessThan(2)
    expect(Math.abs((rowGripBox!.y + rowGripBox!.height / 2) - (rowBox!.y + rowBox!.height))).toBeLessThan(2)
    await page.mouse.move(rowGripBox!.x + rowGripBox!.width / 2, rowGripBox!.y + rowGripBox!.height / 2)
    await page.mouse.down()
    await page.mouse.move(rowGripBox!.x + rowGripBox!.width / 2, rowGripBox!.y + rowGripBox!.height / 2 + 26, { steps: 5 })
    await page.mouse.up()
    await expect.poll(() => bottomHeaderSpacer.evaluate(element => element.getBoundingClientRect().height)).toBeGreaterThan(spacerHeightBefore)
    const titleHeightAfterRowDrag = await headerTitleRow.evaluate(element => element.getBoundingClientRect().height)
    expect(Math.abs(titleHeightAfterRowDrag - titleHeightBeforeRowDrag)).toBeLessThan(16)
    await page.getByTestId('template-row-height').evaluate((input) => {
      const range = input as HTMLInputElement
      range.value = '1.7'
      range.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await expect.poll(() => bottomHeaderSpacer.evaluate(element => element.getBoundingClientRect().height)).toBeGreaterThan(spacerHeightBefore)

    const footerPrimaryRow = page.locator('.fixed-template-map-preview .chrome-grid-row[data-chrome-row-id="footer-primary"]')
    await expect(footerPrimaryRow).toHaveCount(1)
    const footerDesign = await footerPrimaryRow.evaluate((row) => {
      const block = (slot: string) => row.querySelector<HTMLElement>(`[data-chrome-slot="${slot}"]`)
      const cellWidth = (element: HTMLElement | null) => element?.closest<HTMLElement>('.chrome-grid-cell')?.getBoundingClientRect().width ?? 0
      const distance = block('distance')
      const gain = block('elevation_gain')
      const date = block('date')
      const coords = block('coordinates')
      const brand = row.querySelector<HTMLElement>('[data-chrome-kind="brand"]')
      const statStyle = distance ? window.getComputedStyle(distance) : null
      const coordsStyle = coords ? window.getComputedStyle(coords) : null
      const brandStyle = brand ? window.getComputedStyle(brand) : null

      return {
        distanceText: distance?.innerText ?? '',
        distanceRawText: distance?.textContent ?? '',
        gainText: gain?.innerText ?? '',
        gainRawText: gain?.textContent ?? '',
        dateText: date?.innerText ?? '',
        dateRawText: date?.textContent ?? '',
        coordsText: coords?.innerText ?? '',
        brandText: brand?.innerText ?? '',
        widths: [distance, gain, date, coords, brand].map(cellWidth),
        coordsOpacity: coordsStyle ? Number.parseFloat(coordsStyle.opacity) : 1,
        brandOpacity: brandStyle ? Number.parseFloat(brandStyle.opacity) : 1,
        statSize: statStyle ? Number.parseFloat(statStyle.fontSize) : 0,
        statFirstLineSize: distance ? Number.parseFloat(window.getComputedStyle(distance, '::first-line').fontSize) : 0,
      }
    })
    expect(footerDesign.distanceRawText).toContain('\n')
    expect(footerDesign.distanceText).toContain('MILES')
    expect(footerDesign.gainRawText).toContain('\n')
    expect(footerDesign.gainText).toContain('FT GAIN')
    expect(footerDesign.dateRawText).toContain('\n')
    expect(footerDesign.dateText).toContain('DATE')
    expect(footerDesign.coordsText.length).toBeGreaterThan(0)
    expect(footerDesign.brandText).toBe('RADMAPS')
    expect(footerDesign.statFirstLineSize).toBeGreaterThan(footerDesign.statSize * 1.4)
    expect(footerDesign.coordsOpacity).toBeLessThan(1)
    expect(footerDesign.brandOpacity).toBeLessThan(1)
    const footerCellsBeforeDelete = await footerPrimaryRow.locator('.chrome-grid-cell').count()
    expect(footerCellsBeforeDelete).toBeGreaterThan(1)
    const mapBoxBeforeFooterDelete = await fixedPreview.getByTestId('poster-map').boundingBox()
    expect(mapBoxBeforeFooterDelete).toBeTruthy()
    const deletedFooterCell = footerPrimaryRow.locator('.chrome-grid-cell[data-chrome-cell-id="ft-distance"]')
    await deletedFooterCell.evaluate(element => element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })))
    await deletedFooterCell.locator('[data-testid="chrome-cell-trash"]').evaluate(element => element.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true })))
    await expect(footerPrimaryRow).toHaveCount(1)
    await expect(footerPrimaryRow.locator('.chrome-grid-cell')).toHaveCount(footerCellsBeforeDelete - 1)
    await expect.poll(async () => page.evaluate(() => {
      const fixedTemplate = (window as any).__RADMAPS_FIXED_TEMPLATE_EDITOR__
      const rows = fixedTemplate?.getStyle?.().poster_layout?.bands?.footer?.rows ?? []
      const footerPrimary = rows.find((row: any) => row.id === 'footer-primary')
      return footerPrimary?.cells?.some((cell: any) => cell.deleted === true) ?? false
    })).toBe(true)
    await expect(page.getByTestId('template-restore-list')).toBeVisible()
    await page.getByTestId('template-restore-item').filter({ hasText: 'Distance' }).click()
    await expect(footerPrimaryRow.locator('.chrome-grid-cell')).toHaveCount(footerCellsBeforeDelete)
    await expect.poll(async () => page.evaluate(() => {
      const fixedTemplate = (window as any).__RADMAPS_FIXED_TEMPLATE_EDITOR__
      const rows = fixedTemplate?.getStyle?.().poster_layout?.bands?.footer?.rows ?? []
      const footerPrimary = rows.find((row: any) => row.id === 'footer-primary')
      return footerPrimary?.cells?.some((cell: any) => cell.deleted === true) ?? false
    })).toBe(false)

    await page.getByTestId('template-tab-layers').click()
    await page.locator('[data-testid="template-layer-group"][data-band-id="footer"] .fixed-template-layer-row').nth(1).click()
    await page.getByTestId('template-delete-row').click()
    await expect(footerPrimaryRow).toHaveCount(0)
    const mapBoxAfterFooterGroupDelete = await fixedPreview.getByTestId('poster-map').boundingBox()
    expect(mapBoxAfterFooterGroupDelete).toBeTruthy()
    expect(Math.abs(mapBoxAfterFooterGroupDelete!.x - mapBoxBeforeFooterDelete!.x)).toBeLessThan(1)
    expect(Math.abs(mapBoxAfterFooterGroupDelete!.y - mapBoxBeforeFooterDelete!.y)).toBeLessThan(1)
    expect(Math.abs(mapBoxAfterFooterGroupDelete!.width - mapBoxBeforeFooterDelete!.width)).toBeLessThan(1)
    expect(Math.abs(mapBoxAfterFooterGroupDelete!.height - mapBoxBeforeFooterDelete!.height)).toBeLessThan(1)
    await expect.poll(async () => page.evaluate(() => {
      const fixedTemplate = (window as any).__RADMAPS_FIXED_TEMPLATE_EDITOR__
      const rows = fixedTemplate?.getStyle?.().poster_layout?.bands?.footer?.rows ?? []
      return rows.some((row: any) => row.id === 'footer-primary' && row.deleted === true)
    })).toBe(true)
    await page.getByTestId('template-restore-item').filter({ hasText: 'Footer metrics' }).click()
    await expect(footerPrimaryRow).toHaveCount(1)
    await expect(footerPrimaryRow.locator('.chrome-grid-cell')).toHaveCount(footerCellsBeforeDelete)

    const bottomFooterSpacer = page.locator('.fixed-template-map-preview .chrome-grid-row[data-chrome-row-id="footer-spacer-bottom"]')
    await expect(bottomFooterSpacer).toHaveCount(1)
    await bottomFooterSpacer.locator('.chrome-grid-cell').first().evaluate(element => element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })))
    await bottomFooterSpacer.locator('[data-testid="chrome-cell-trash"]').evaluate(element => element.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true })))
    await expect(bottomFooterSpacer).toHaveCount(0)
    await expect.poll(async () => page.evaluate(() => {
      const fixedTemplate = (window as any).__RADMAPS_FIXED_TEMPLATE_EDITOR__
      const rows = fixedTemplate?.getStyle?.().poster_layout?.bands?.footer?.rows ?? []
      return rows.some((row: any) => row.id === 'footer-spacer-bottom' && row.deleted === true)
    })).toBe(true)

    await expect(headerTitleRow).toHaveCount(1)
    const headerTitleCellsBeforeDelete = await headerTitleRow.locator('.chrome-grid-cell').count()
    const headerTitleCell = headerTitleRow.locator('.chrome-grid-cell').first()
    await headerTitleCell.click()
    await expect(headerTitleCell.locator('[data-testid="chrome-cell-trash"]')).toBeVisible()
    const headerTitleBlockBox = await headerTitleCell.locator('.chrome-grid-block').boundingBox()
    const headerTitleTrashBox = await headerTitleCell.locator('[data-testid="chrome-cell-trash"]').boundingBox()
    const headerTitleAddColBox = await headerTitleCell.locator('[data-testid="chrome-cell-add-column"]').boundingBox()
    const headerTitleRowTopBox = await headerTitleRow.locator('[data-testid="chrome-row-resize-row"][data-edge="top"]').boundingBox()
    const headerTitleRowBottomBox = await headerTitleRow.locator('[data-testid="chrome-row-resize-row"][data-edge="bottom"]').boundingBox()
    const headerTitleRowAddBox = await headerTitleRow.locator('[data-testid="chrome-row-add-row"]').boundingBox()
    expect(headerTitleBlockBox).toBeTruthy()
    expect(headerTitleTrashBox).toBeTruthy()
    expect(headerTitleAddColBox).toBeTruthy()
    expect(headerTitleRowTopBox).toBeTruthy()
    expect(headerTitleRowBottomBox).toBeTruthy()
    expect(headerTitleRowAddBox).toBeTruthy()
    const boxesOverlap = (
      a: NonNullable<typeof headerTitleTrashBox>,
      b: NonNullable<typeof headerTitleTrashBox>,
    ) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y
    expect(headerTitleTrashBox!.x + headerTitleTrashBox!.width).toBeLessThanOrEqual(headerTitleBlockBox!.x - 1)
    expect(boxesOverlap(headerTitleAddColBox!, headerTitleRowTopBox!)).toBe(false)
    expect(boxesOverlap(headerTitleAddColBox!, headerTitleRowBottomBox!)).toBe(false)
    expect(boxesOverlap(headerTitleAddColBox!, headerTitleRowAddBox!)).toBe(false)
    expect(boxesOverlap(headerTitleRowTopBox!, headerTitleRowAddBox!)).toBe(false)
    expect(boxesOverlap(headerTitleRowBottomBox!, headerTitleRowAddBox!)).toBe(false)
    expect(await page.evaluate(() => {
      const overlaps = (a: DOMRect, b: DOMRect) =>
        a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top

      return Array.from(document.querySelectorAll<HTMLElement>('.fixed-template-map-preview .chrome-grid-cell'))
        .every((cell) => {
          const add = cell.querySelector<HTMLElement>('[data-testid="chrome-cell-add-column"]')
          if (!add || window.getComputedStyle(add).opacity === '0') return true
          const addBox = add.getBoundingClientRect()
          return Array.from(cell.querySelectorAll<HTMLElement>('[data-testid="chrome-cell-resize-column"]'))
            .every(handle => !overlaps(addBox, handle.getBoundingClientRect()))
        })
    })).toBe(true)
    expect(await page.evaluate(() => {
      const overlaps = (a: DOMRect, b: DOMRect) =>
        a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top

      return Array.from(document.querySelectorAll<HTMLElement>('.fixed-template-map-preview .chrome-grid-row'))
        .every((row) => {
          const add = row.querySelector<HTMLElement>('[data-testid="chrome-row-add-row"]')
          if (!add || window.getComputedStyle(add).opacity === '0') return true
          const addBox = add.getBoundingClientRect()
          return Array.from(row.querySelectorAll<HTMLElement>('[data-testid="chrome-row-resize-row"]'))
            .every(handle => !overlaps(addBox, handle.getBoundingClientRect()))
        })
    })).toBe(true)
    await headerTitleCell.locator('[data-testid="chrome-cell-trash"]').click()
    if (headerTitleCellsBeforeDelete > 1) {
      await expect(headerTitleRow).toHaveCount(1)
      await expect(headerTitleRow.locator('.chrome-grid-cell')).toHaveCount(headerTitleCellsBeforeDelete - 1)
      await expect.poll(async () => page.evaluate(() => {
        const fixedTemplate = (window as any).__RADMAPS_FIXED_TEMPLATE_EDITOR__
        const rows = fixedTemplate?.getStyle?.().poster_layout?.bands?.header?.rows ?? []
        const headerTitle = rows.find((row: any) => row.id === 'header-title')
        return headerTitle?.cells?.some((cell: any) => cell.deleted === true) ?? false
      })).toBe(true)
    } else {
      await expect(headerTitleRow).toHaveCount(0)
      await expect.poll(async () => page.evaluate(() => {
        const fixedTemplate = (window as any).__RADMAPS_FIXED_TEMPLATE_EDITOR__
        const rows = fixedTemplate?.getStyle?.().poster_layout?.bands?.header?.rows ?? []
        return rows.some((row: any) => row.id === 'header-title' && row.deleted === true)
      })).toBe(true)
    }
  })

  test('fixed poster template editor done returns to the editable surface', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'desktop fixed-template editor coverage')

    await page.goto('/style-browser-fixture?surface=1&posterEditor=1&surfaceTemplateEditor=1&width=1180&height=820')
    await expect(page.getByTestId('fixed-template-editor')).toBeVisible()
    await page.getByTestId('template-done').click()
    await expect(page.getByTestId('map-editor-surface')).toBeVisible()
    await expect(page.getByTestId('poster-canvas')).toBeVisible()
    await expect(page.getByTestId('style-panel')).toBeVisible()
    await expect(page.getByTestId('map-editor-surface')).toHaveAttribute('data-chrome-editing', 'true')
  })

  test('keeps mid-century fixed-template chrome side margins compact', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'desktop fixed-template margin coverage')

    await page.goto('/style-browser-fixture?surface=1&composition=travel-banner&theme=midcentury-travel&posterEditor=1&surfaceTemplateEditor=1&width=1180&height=820')
    await expect(page.getByTestId('fixed-template-editor')).toBeVisible()
    const posterBox = await page.getByTestId('fixed-template-poster').boundingBox()
    expect(posterBox).toBeTruthy()

    const chromePadding = await page.getByTestId('poster-footer').evaluate((element) => {
      const style = window.getComputedStyle(element)
      return {
        left: Number.parseFloat(style.paddingLeft),
        right: Number.parseFloat(style.paddingRight),
      }
    })

    expect(chromePadding.left).toBeGreaterThanOrEqual(posterBox!.width * 0.035)
    expect(chromePadding.right).toBeGreaterThanOrEqual(posterBox!.width * 0.035)
    expect(chromePadding.left).toBeLessThanOrEqual(posterBox!.width * 0.038)
    expect(chromePadding.right).toBeLessThanOrEqual(posterBox!.width * 0.038)
    await expect(page.getByTestId('fixed-template-poster')).not.toContainText('Complete trail network')
  })

  test('editor surface can mount the fixed template editor behind the template gate', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'desktop fixed-template surface coverage')

    await page.goto('/style-browser-fixture?surface=1&posterEditor=1&surfaceTemplateEditor=1&width=1180&height=820')
    await expect(page.getByTestId('map-editor-surface')).toBeVisible()
    await expect(page.getByTestId('map-editor-surface')).toHaveAttribute('data-chrome-editing', 'false')
    const fixedTemplateEditor = page.getByTestId('fixed-template-editor')
    await expect(fixedTemplateEditor).toBeVisible()
    await expect.poll(() => page.evaluate(() => Boolean((window as any).__RADMAPS_FIXED_TEMPLATE_EDITOR__))).toBe(true)
    await expect(page.getByTestId('chrome-editor-app-bar')).toHaveCount(0)
    await expect(page.getByTestId('chrome-layout-builder')).toHaveCount(0)
    await expect(page.getByTestId('template-map-height')).toHaveCount(0)
    await fixedTemplateEditor.getByTestId('template-tab-layers').click()
    await expect(fixedTemplateEditor.getByTestId('template-layer-list')).toBeVisible()
    await expect(fixedTemplateEditor.locator('[data-testid="template-layer-group"][data-band-id="header"]')).toContainText('Title')
    await expect(fixedTemplateEditor.locator('[data-testid="template-layer-group"][data-band-id="footer"]')).toContainText('Distance')
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
    await expect(stylePanel).toContainText('Map style')
    await expect(stylePanel).toContainText('Owned Atlas vector layers')
    await expect(stylePanel).toContainText('Viewpoint')
    await stylePanel.getByRole('button', { name: 'Text', exact: true }).click()
    await expect(stylePanel).not.toContainText('Global typography')
    await expect(stylePanel).toContainText('Stats & labels')
  })

  test('poster editor v2 defaults to guided slot editing in the editor surface', async ({ page }, testInfo) => {
    await page.goto('/style-browser-fixture?surface=1&posterEditor=1&overlay=1&asset=1&icon=1&width=1180&height=820')
    await expect(page.getByTestId('map-editor-surface')).toHaveAttribute('data-chrome-editing', 'true')
    if (testInfo.project.name === 'mobile') {
      await expect(page.getByTestId('chrome-editor-app-bar')).toHaveCount(0)
      await expect(page.getByTestId('chrome-layout-builder')).toHaveCount(0)
      await expect(page.getByTestId('chrome-structure-popover')).toHaveCount(0)
      return
    }
    await expect(page.getByTestId('chrome-editor-app-bar')).toHaveCount(0)
    await expect(page.getByTestId('chrome-layout-builder')).toHaveCount(0)
    await expect(page.getByTestId('chrome-structure-popover')).toHaveCount(0)
    await expect(page.getByTestId('poster-editor-guides')).toHaveCount(0)
    await expect(page.getByTestId('poster-canvas')).toBeVisible()
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
    const titleSlot = page.locator('[data-poster-element-id="slot:trail_name"]').first()
    await expect(titleSlot).toBeVisible()
    await titleSlot.click()
    await expect(page.locator('.poster-element-moveable .moveable-control')).toHaveCount(8)
    await expect(page.getByTestId('chrome-editor-add-block')).toHaveCount(0)
    await expect(page.getByTestId('chrome-cell-resize-column')).toHaveCount(0)
    await expect(page.locator('[data-poster-element-id^="text:"]')).toHaveCount(0)
    await expect(page.locator('[data-poster-element-id^="asset:"]')).toHaveCount(0)
    await expect(page.locator('[data-poster-element-id^="icon:"]')).toHaveCount(0)
    await expect(page.getByTestId('poster-tool-text')).toHaveCount(0)
    await expect(page.getByTestId('poster-tool-image')).toHaveCount(0)
    await expect(page.getByTestId('poster-tool-icon')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Upload logo' })).toHaveCount(0)
    await expect(page.getByText('Icons', { exact: true })).toHaveCount(0)
  })

  test('style panel exposes text overlay customization controls', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'desktop text overlay editor coverage')

    await page.goto('/style-browser-fixture?surface=1&overlay=1&width=1180&height=820')
    const stylePanel = page.getByTestId('style-panel')
    await expect(stylePanel).toBeVisible()
    await stylePanel.getByRole('button', { name: 'Text', exact: true }).click()
    await expect(stylePanel).toContainText('Text overlays')
    await stylePanel.getByText('Text overlays').click()
    await expect(page.getByTestId('text-overlay-toggle-fixture-overlay-label')).toBeVisible()
    await page.getByTestId('text-overlay-toggle-fixture-overlay-label').click()

    const overlay = page.locator('[data-poster-element-id="text:fixture-overlay-label"]')
    const content = page.getByTestId('text-overlay-content-fixture-overlay-label')
    await expect(content).toBeVisible()
    await content.fill('Finish Line')
    await expect(overlay).toContainText('Finish Line')

    await page.getByTestId('text-overlay-editor-fixture-overlay-label').getByText('Space Grotesk', { exact: true }).click()
    await expect.poll(() => overlay.evaluate(element => window.getComputedStyle(element).fontFamily)).toContain('Space Grotesk')
  })

  test('poster editor v2 layout builder manages chrome grid content and spacing', async ({ page }, testInfo) => {
    test.skip(true, 'retired grid-builder coverage; W3 is guided slot editing')
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
    await expect(hoverRow.locator('[data-testid="chrome-row-resize-row"][data-edge="bottom"]').first()).toBeVisible()
    const widthBeforeResize = await resizableCells.first().evaluate(el => (el as HTMLElement).getBoundingClientRect().width)
    await resizableCells.first().click()
    const resizeGrip = resizableCells.first().locator('[data-testid="chrome-cell-resize-column"]')
    await expect(resizeGrip).toBeVisible()
    const cellBox = await resizableCells.first().boundingBox()
    const gripBox = await resizeGrip.boundingBox()
    expect(cellBox).toBeTruthy()
    expect(gripBox).toBeTruthy()
    expect(Math.abs((gripBox!.y + gripBox!.height / 2) - (cellBox!.y + cellBox!.height / 2))).toBeLessThan(2)
    await page.mouse.move(gripBox!.x + gripBox!.width / 2, gripBox!.y + gripBox!.height / 2)
    await page.mouse.down()
    await page.mouse.move(gripBox!.x + gripBox!.width / 2 + 42, gripBox!.y + gripBox!.height / 2, { steps: 5 })
    await page.mouse.up()
    await expect.poll(() => resizableCells.first().evaluate(el => (el as HTMLElement).getBoundingClientRect().width)).toBeGreaterThan(widthBeforeResize)

    const resizableRows = page.locator('.chrome-grid-row:has([data-testid="chrome-row-resize-row"])')
    await expect.poll(() => resizableRows.count()).toBeGreaterThan(0)
    const heightBeforeResize = await resizableRows.first().evaluate(el => (el as HTMLElement).getBoundingClientRect().height)
    await resizableRows.first().locator('.chrome-grid-cell').first().click()
    await resizableRows.first().hover()
    const rowResizeGrip = resizableRows.first().locator('[data-testid="chrome-row-resize-row"][data-edge="bottom"]')
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
    test.skip(true, 'retired grid-builder coverage; W3 is guided slot editing')
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

  test('keeps Modernist content aligned without legacy side rails', async ({ page }) => {
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

    expect(boxes.map).toBeTruthy()
    expect(boxes.poster).toBeTruthy()
    expect(boxes.rail).toBeFalsy()
    expect(boxes.rightRail).toBeFalsy()
    expect(Math.abs(boxes.map!.x - boxes.poster!.x)).toBeLessThanOrEqual(1)
    expect(Math.abs((boxes.map!.x + boxes.map!.width) - (boxes.poster!.x + boxes.poster!.width))).toBeLessThanOrEqual(1)
    expect(boxes.frameCount).toBe(0)
  })

  test('keeps Modernist title band high contrast without legacy side rail', async ({ page }) => {
    await page.goto('/style-browser-fixture?composition=modernist-block&theme=bold-modern')

    await expect(page.getByTestId('poster-canvas')).toHaveAttribute('data-composition', 'modernist-block')
    const contrast = await page.evaluate(() => {
      const header = document.querySelector<HTMLElement>('[data-testid="poster-header"]')
      const title = document.querySelector<HTMLElement>('.poster-trail-name')
      return {
        headerBg: header ? getComputedStyle(header).backgroundColor : '',
        titleColor: title ? getComputedStyle(title).color : '',
        railCount: document.querySelectorAll('[data-testid="composition-side-rail"], [data-testid="composition-side-rail-right"]').length,
      }
    })

    expect(contrast.headerBg).toBe('rgb(238, 236, 231)')
    expect(contrast.titleColor).toBe('rgb(6, 5, 0)')
    expect(contrast.railCount).toBe(0)
  })

  test('does not render Modernist filler occasion or footer-note text', async ({ page }) => {
    await page.goto('/style-browser-fixture?composition=modernist-block&theme=bold-modern&editable=1')

    await expect(page.locator('.poster-occasion')).toHaveCount(0)
    await expect(page.getByTestId('composition-footer-note')).toHaveCount(0)
  })

  test('keeps Modernist map framed full-width with visible topo detail', async ({ page }) => {
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
    expect(layout.map).toBeTruthy()
    expect(layout.hasCanvas).toBe(true)
    expect(layout.rail).toBeFalsy()
    expect(layout.rightRail).toBeFalsy()
    expect(Math.abs(layout.map!.x - layout.poster!.x)).toBeLessThanOrEqual(1)
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

  test('does not expose legacy Modernist side rail editing affordances', async ({ page }) => {
    await page.goto('/style-browser-fixture?composition=modernist-block&theme=bold-modern&editable=1')

    await expect(page.getByTestId('composition-side-rail')).toHaveCount(0)
    await expect(page.getByTestId('composition-side-rail-right')).toHaveCount(0)
    await expect(page.getByTestId('composition-side-rail-label')).toHaveCount(0)
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

    expect(contrast.headerBg).toBe('rgb(243, 234, 214)')
    expect(contrast.titleColor).toBe('rgb(42, 32, 24)')
  })

  test('keeps Mid-Century footer focused on route stats', async ({ page }) => {
    await page.goto('/style-browser-fixture?composition=travel-banner&theme=midcentury-travel&occasion=Complete%20trail%20network')

    await expect(page.getByTestId('poster-canvas')).toHaveAttribute('data-composition', 'travel-banner')
    await expect(page.locator('.poster-occasion')).toHaveCount(0)
    await expect(page.locator('.poster-stats')).toBeHidden()
  })
})
