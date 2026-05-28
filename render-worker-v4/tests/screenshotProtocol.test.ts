import { describe, expect, it } from 'vitest'

import { toPlaywrightWaitFunction } from '../src/screenshotProtocol.js'

describe('toPlaywrightWaitFunction', () => {
  it('leaves boolean expressions as expressions for Playwright string evaluation', () => {
    expect(toPlaywrightWaitFunction('window.__RENDER_READY === true'))
      .toBe('window.__RENDER_READY === true')
  })

  it('invokes function-shaped strings instead of returning a truthy function object', () => {
    expect(toPlaywrightWaitFunction('() => window.__RENDER_READY === true'))
      .toBe('(() => window.__RENDER_READY === true)()')
  })
})
