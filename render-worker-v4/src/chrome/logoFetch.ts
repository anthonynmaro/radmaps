// render-worker-v4/src/chrome/logoFetch.ts
//
// Pre-fetch the user's logo into a Buffer BEFORE chrome composition.
// Plan v4 locked decision #12: a logo fetch failure must fail the render
// at the source rather than via a downstream visual probe.
//
// SSRF mitigation: validate the URL against an allowlist (Supabase Storage
// origin + APP_URL only). Plain HTTP is rejected. No internal IPs, no
// metadata endpoints.

import { getAllowedLogoOrigins } from '../config.js'
import { log } from '../log.js'

const MAX_LOGO_BYTES = 5 * 1024 * 1024 // 5 MB

export interface LogoBuffer {
  buffer: Buffer
  contentType: string
  url: string
}

/** Returns null if the URL is rejected by the allowlist. */
export function validateLogoUrl(url: string | undefined | null): string | null {
  if (!url || typeof url !== 'string') return null
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null
  // Reject http: outright. Logos must come over TLS.
  if (parsed.protocol === 'http:') return null
  const allowed = getAllowedLogoOrigins()
  if (!allowed.some((origin) => parsed.origin === origin)) {
    return null
  }
  return url
}

/**
 * Fetch the user's logo into a Buffer.
 *
 * @throws if the URL is invalid, rejected by the allowlist, fetch fails,
 *         or the response exceeds MAX_LOGO_BYTES.
 */
export async function fetchLogo(url: string | undefined | null): Promise<LogoBuffer | null> {
  const safe = validateLogoUrl(url)
  if (!safe) {
    if (url) {
      log.warn('logo_url_rejected', { url })
      // Plan v4 §"Output validation" — logo failures are render-time errors,
      // NOT silent skips. Re-throw with a marker the validator surfaces.
      throw new Error(`logo URL not in allowlist: ${url}`)
    }
    return null
  }

  const res = await fetch(safe, { redirect: 'follow' })
  if (!res.ok) {
    throw new Error(`logo fetch ${res.status} ${res.statusText} :: ${safe}`)
  }
  const contentLength = Number(res.headers.get('content-length') ?? 0)
  if (contentLength && contentLength > MAX_LOGO_BYTES) {
    throw new Error(`logo too large: ${contentLength} bytes`)
  }
  const ab = await res.arrayBuffer()
  if (ab.byteLength > MAX_LOGO_BYTES) {
    throw new Error(`logo too large: ${ab.byteLength} bytes`)
  }
  return {
    buffer: Buffer.from(ab),
    contentType: res.headers.get('content-type') ?? 'application/octet-stream',
    url: safe,
  }
}
