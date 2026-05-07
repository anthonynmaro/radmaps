import { describe, expect, it } from 'vitest'
import {
  calculateCouponDiscountCents,
  isCouponExpired,
  isCouponLimitReached,
  isValidCouponSlug,
  normalizeCouponEmail,
  normalizeCouponSlug,
} from '~/utils/coupons'

describe('coupon helpers', () => {
  it('normalizes coupon slugs for storage and lookup', () => {
    expect(normalizeCouponSlug(' trail_25 ')).toBe('TRAIL-25')
    expect(normalizeCouponSlug('vip   launch')).toBe('VIP-LAUNCH')
    expect(isValidCouponSlug('VIP-LAUNCH')).toBe(true)
    expect(isValidCouponSlug('VIP!')).toBe(false)
  })

  it('normalizes optional email restrictions', () => {
    expect(normalizeCouponEmail('  Rider@Example.COM ')).toBe('rider@example.com')
    expect(normalizeCouponEmail('')).toBeNull()
    expect(normalizeCouponEmail(null)).toBeNull()
  })

  it('calculates bounded percentage discounts in cents', () => {
    expect(calculateCouponDiscountCents(999, 25)).toBe(250)
    expect(calculateCouponDiscountCents(1000, 100)).toBe(1000)
    expect(calculateCouponDiscountCents(1000, 150)).toBe(1000)
    expect(calculateCouponDiscountCents(-10, 25)).toBe(0)
  })

  it('checks expiry and combined redeemed plus reserved limits', () => {
    const now = new Date('2026-05-06T12:00:00Z')
    expect(isCouponExpired(null, now)).toBe(false)
    expect(isCouponExpired('2026-05-06T11:59:59Z', now)).toBe(true)
    expect(isCouponExpired('2026-05-06T12:00:01Z', now)).toBe(false)
    expect(isCouponLimitReached(null, 100, 100)).toBe(false)
    expect(isCouponLimitReached(3, 2, 1)).toBe(true)
    expect(isCouponLimitReached(3, 2, 0)).toBe(false)
  })
})

