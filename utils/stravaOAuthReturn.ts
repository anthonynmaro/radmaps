export const STRAVA_OAUTH_STATE_COOKIE = 'radmaps_strava_oauth_state'
export const STRAVA_RETURN_TO_COOKIE = 'radmaps_strava_return_to'
export const STRAVA_CREATE_RETURN_PATH = '/create?strava_connected=1'

export function safeInternalPath(value: unknown, fallback = '/'): string {
  const candidate = Array.isArray(value) ? value[0] : value
  if (typeof candidate !== 'string') return fallback

  const trimmed = candidate.trim()
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) return fallback
  if (trimmed.startsWith('/\\') || containsControlCharacter(trimmed)) return fallback

  return trimmed
}

function containsControlCharacter(value: string): boolean {
  for (let index = 0; index < value.length; index++) {
    const code = value.charCodeAt(index)
    if (code <= 31 || code === 127) return true
  }
  return false
}

export function encodeReturnPathCookie(value: string): string {
  return encodeURIComponent(safeInternalPath(value, STRAVA_CREATE_RETURN_PATH))
}

export function decodeReturnPathCookie(value: string | undefined, fallback = STRAVA_CREATE_RETURN_PATH): string {
  if (!value) return fallback
  try {
    return safeInternalPath(decodeURIComponent(value), fallback)
  } catch {
    return fallback
  }
}

export function authConfirmPathForReturnTo(returnTo: string): string {
  return `/auth/confirm?next=${encodeURIComponent(safeInternalPath(returnTo, STRAVA_CREATE_RETURN_PATH))}`
}

export function withQueryUpdates(path: string, updates: Record<string, string | null>): string {
  const safePath = safeInternalPath(path, STRAVA_CREATE_RETURN_PATH)
  const [withoutHash, rawHash] = safePath.split('#', 2)
  const [pathname, rawQuery = ''] = withoutHash.split('?', 2)
  const params = new URLSearchParams(rawQuery)

  for (const [key, value] of Object.entries(updates)) {
    if (value === null) params.delete(key)
    else params.set(key, value)
  }

  const query = params.toString()
  const hash = rawHash ? `#${rawHash}` : ''
  return `${pathname}${query ? `?${query}` : ''}${hash}`
}

export function stravaErrorReturnPath(returnTo: string, error: string): string {
  return withQueryUpdates(returnTo, {
    strava_connected: null,
    strava_error: error,
  })
}
