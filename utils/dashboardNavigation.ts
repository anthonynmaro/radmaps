const INTERACTIVE_CARD_SELECTOR = 'a, button, input, select, textarea, [role="button"], [data-dashboard-card-action]'

export function shouldHandleDashboardCardClick(event: MouseEvent): boolean {
  const target = event.target
  if (!target || typeof (target as { closest?: unknown }).closest !== 'function') return true
  return !(target as Element).closest(INTERACTIVE_CARD_SELECTOR)
}
