import { describe, expect, it } from 'vitest'
import { shouldHandleDashboardCardClick } from '../utils/dashboardNavigation'

function eventFromClosestResult(result: Element | null): MouseEvent {
  return {
    target: {
      closest: () => result,
    },
  } as unknown as MouseEvent
}

describe('dashboard card navigation', () => {
  it('lets the dashboard card handle clicks from non-interactive card areas', () => {
    expect(shouldHandleDashboardCardClick(eventFromClosestResult(null))).toBe(true)
  })

  it('does not double-handle clicks that started inside nested links or buttons', () => {
    const interactiveAncestor = {} as Element

    expect(shouldHandleDashboardCardClick(eventFromClosestResult(interactiveAncestor))).toBe(false)
  })

  it('falls back to card navigation for non-element event targets', () => {
    expect(shouldHandleDashboardCardClick({ target: null } as unknown as MouseEvent)).toBe(true)
  })
})
