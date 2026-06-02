import { describe, expect, it } from 'vitest'
import { RENDER_READY_EXPRESSION } from '../utils/render/readiness'

describe('render readiness expression', () => {
  it('waits for route content rather than the primary route layer specifically', () => {
    expect(RENDER_READY_EXPRESSION).toBe(
      'window.__RENDER_READY === true && window.__RADMAPS_RENDER_STATUS?.routeContentPresent === true',
    )
    expect(RENDER_READY_EXPRESSION).not.toContain('routeLayerPresent')
  })
})
