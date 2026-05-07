export const COUPON_SLUG_PATTERN = /^[A-Z0-9]+(?:-[A-Z0-9]+)*$/

export function normalizeCouponSlug(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toUpperCase()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

export function isValidCouponSlug(value: unknown): boolean {
  return COUPON_SLUG_PATTERN.test(normalizeCouponSlug(value))
}

export function normalizeCouponEmail(value: unknown): string | null {
  const email = String(value ?? '').trim().toLowerCase()
  return email ? email : null
}

export function calculateCouponDiscountCents(subtotalCents: number, percentOff: number): number {
  if (!Number.isFinite(subtotalCents) || !Number.isFinite(percentOff)) return 0
  const subtotal = Math.max(0, Math.round(subtotalCents))
  const percent = Math.max(0, Math.min(100, percentOff))
  return Math.min(subtotal, Math.max(0, Math.round((subtotal * percent) / 100)))
}

export function isCouponExpired(expiresAt: string | null | undefined, now = new Date()): boolean {
  if (!expiresAt) return false
  const expiry = new Date(expiresAt)
  return Number.isFinite(expiry.getTime()) && expiry <= now
}

export function isCouponLimitReached(maxRedemptions: number | null | undefined, redeemedCount: number, reservedCount = 0): boolean {
  if (!maxRedemptions) return false
  return Math.max(0, redeemedCount) + Math.max(0, reservedCount) >= maxRedemptions
}

