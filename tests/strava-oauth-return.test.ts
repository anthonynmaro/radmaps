import { describe, expect, it } from 'vitest'
import {
  STRAVA_CREATE_RETURN_PATH,
  authConfirmPathForReturnTo,
  decodeReturnPathCookie,
  encodeReturnPathCookie,
  safeInternalPath,
  stravaErrorReturnPath,
} from '../utils/stravaOAuthReturn'

describe('Strava OAuth return paths', () => {
  it('allows internal return paths with query strings', () => {
    expect(safeInternalPath('/create?strava_connected=1')).toBe('/create?strava_connected=1')
    expect(safeInternalPath('/dashboard')).toBe('/dashboard')
  })

  it('rejects open redirect candidates', () => {
    expect(safeInternalPath('https://evil.example/create', '/safe')).toBe('/safe')
    expect(safeInternalPath('//evil.example/create', '/safe')).toBe('/safe')
    expect(safeInternalPath('/\\evil.example/create', '/safe')).toBe('/safe')
  })

  it('round-trips the return path through the cookie value', () => {
    const encoded = encodeReturnPathCookie('/create?strava_connected=1')
    expect(decodeReturnPathCookie(encoded)).toBe('/create?strava_connected=1')
    expect(decodeReturnPathCookie('%E0%A4%A', '/fallback')).toBe('/fallback')
  })

  it('builds the Supabase auth confirm URL with the Strava create return target', () => {
    expect(authConfirmPathForReturnTo(STRAVA_CREATE_RETURN_PATH)).toBe(
      '/auth/confirm?next=%2Fcreate%3Fstrava_connected%3D1',
    )
  })

  it('returns OAuth errors to the same flow without claiming a connection succeeded', () => {
    expect(stravaErrorReturnPath(STRAVA_CREATE_RETURN_PATH, 'access_denied')).toBe('/create?strava_error=access_denied')
  })
})
