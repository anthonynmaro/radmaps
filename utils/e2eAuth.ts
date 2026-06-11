export function hasDevE2eAuthBypass(): boolean {
  return Boolean(
    import.meta.dev
    && import.meta.client
    && window.localStorage.getItem('radmaps:e2e-auth') === '1',
  )
}
