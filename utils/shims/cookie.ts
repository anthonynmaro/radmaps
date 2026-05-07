export interface CookieSerializeOptions {
  domain?: string
  encode?: (value: string) => string
  expires?: Date
  httpOnly?: boolean
  maxAge?: number
  path?: string
  sameSite?: boolean | 'lax' | 'strict' | 'none'
  secure?: boolean
}

export function parse(str: string): Record<string, string> {
  const result: Record<string, string> = {}
  if (!str) return result

  for (const part of str.split(';')) {
    const index = part.indexOf('=')
    if (index < 0) continue
    const key = part.slice(0, index).trim()
    if (!key || result[key] != null) continue
    const value = part.slice(index + 1).trim()
    try {
      result[key] = decodeURIComponent(value)
    } catch {
      result[key] = value
    }
  }

  return result
}

export function serialize(name: string, value: string, options: CookieSerializeOptions = {}): string {
  const encode = options.encode ?? encodeURIComponent
  const parts = [`${name}=${encode(value)}`]

  if (options.maxAge != null) parts.push(`Max-Age=${Math.floor(options.maxAge)}`)
  if (options.domain) parts.push(`Domain=${options.domain}`)
  if (options.path) parts.push(`Path=${options.path}`)
  if (options.expires) parts.push(`Expires=${options.expires.toUTCString()}`)
  if (options.httpOnly) parts.push('HttpOnly')
  if (options.secure) parts.push('Secure')
  if (options.sameSite) {
    const sameSite = options.sameSite === true ? 'Strict' : String(options.sameSite)
    parts.push(`SameSite=${sameSite.charAt(0).toUpperCase()}${sameSite.slice(1).toLowerCase()}`)
  }

  return parts.join('; ')
}

export default { parse, serialize }
