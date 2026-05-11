import type { H3Event } from 'h3'

interface RateLimitEntry {
  count: number
  resetAt: number
}

const buckets = new Map<string, RateLimitEntry>()

function clientIp(event: H3Event): string {
  const forwarded = getRequestHeader(event, 'x-forwarded-for')
  return forwarded?.split(',')[0]?.trim() ||
    getRequestHeader(event, 'x-real-ip') ||
    event.node.req.socket.remoteAddress ||
    'unknown'
}

export function assertRateLimit(
  event: H3Event,
  options: {
    key: string
    limit: number
    windowMs: number
    userId?: string | null
  },
) {
  const now = Date.now()
  const actor = options.userId ? `user:${options.userId}` : `ip:${clientIp(event)}`
  const key = `${options.key}:${actor}`
  const entry = buckets.get(key)

  if (!entry || entry.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + options.windowMs })
    return
  }

  entry.count += 1
  if (entry.count > options.limit) {
    const retryAfter = Math.max(1, Math.ceil((entry.resetAt - now) / 1000))
    setHeader(event, 'Retry-After', retryAfter)
    throw createError({ statusCode: 429, message: 'Too many requests. Please try again later.' })
  }
}
