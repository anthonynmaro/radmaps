import { describe, expect, it } from 'vitest'
import { atlasPrintQaFixtures, buildAtlasPrintQaPayload } from '../utils/atlasPrintQa'
import { createRenderTicket, verifyRenderTicket } from '../utils/render/renderTicket'

describe('atlas print QA fixtures', () => {
  it('derives one signed-renderable fixture from every coverage target QA entry', () => {
    const fixtures = atlasPrintQaFixtures()
    expect(fixtures).toHaveLength(23)
    expect(new Set(fixtures.map(fixture => fixture.id)).size).toBe(fixtures.length)
    expect(fixtures.every(fixture => fixture.printSize === '24x36')).toBe(true)
  })

  it('builds a 24x36 MapPreview payload with POI and outdoor route overlays enabled', () => {
    const payload = buildAtlasPrintQaPayload('western-alps-dolomites-chamonix-zermatt')

    expect(payload.map.id).toBe('atlas-print-qa-western-alps-dolomites-chamonix-zermatt')
    expect(payload.map.geojson.features).toHaveLength(1)
    expect(payload.styleConfig.print_size).toBe('24x36')
    expect(payload.styleConfig.preset).toBe('radmaps-field-topo')
    expect(payload.styleConfig.atlas_layers?.poi).toBe(true)
    expect(payload.styleConfig.atlas_layers?.outdoorRoute).toBe(true)
    expect(payload.styleConfig.atlas_layer_settings?.outdoorRoute?.activities).toContain('hiking')
  })

  it('accepts atlas-qa as a signed render ticket kind', () => {
    const token = createRenderTicket({
      kind: 'atlas-qa',
      subject: 'western-alps-dolomites-chamonix-zermatt',
      renderClass: 'final',
      widthPx: 7271,
      heightPx: 10871,
      deviceScaleFactor: 2,
      productUid: '24x36',
      expiresAt: Date.now() + 60_000,
    }, 'test-secret')

    expect(verifyRenderTicket(token, 'test-secret').kind).toBe('atlas-qa')
  })
})
