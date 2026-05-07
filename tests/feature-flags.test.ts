import { describe, expect, it } from 'vitest'
import type { FeatureFlag, FeatureFlagContext, FeatureFlagRule } from '~/types'
import { evaluateFeatureFlag, isInPercentageRollout, normalizeFlagRules } from '~/utils/featureFlags'
import { FLAGS } from '~/utils/knownFlags'

function flag(overrides: Partial<FeatureFlag> = {}): FeatureFlag {
  return {
    id: '00000000-0000-0000-0000-000000000001',
    key: FLAGS.SCOUT_STYLE_AGENT,
    name: 'Scout AI Style Agent',
    description: null,
    environment: 'all',
    enabled: true,
    rules: [],
    archived_at: null,
    created_at: '2026-05-07T00:00:00Z',
    updated_at: '2026-05-07T00:00:00Z',
    ...overrides,
  }
}

const staffAdmin: FeatureFlagContext = {
  userId: '00000000-0000-0000-0000-000000000010',
  email: 'admin@example.com',
  adminRole: 'admin',
  isStaff: true,
}

describe('feature flag evaluation', () => {
  it('fails closed for disabled, archived, and rule-less flags', () => {
    expect(evaluateFeatureFlag(flag({ enabled: false, rules: [{ type: 'everyone', enabled: true }] }), staffAdmin)).toBe(false)
    expect(evaluateFeatureFlag(flag({ archived_at: '2026-05-07T01:00:00Z', rules: [{ type: 'everyone', enabled: true }] }), staffAdmin)).toBe(false)
    expect(evaluateFeatureFlag(flag({ rules: [] }), staffAdmin)).toBe(false)
  })

  it('allows matching admin roles and rejects other roles', () => {
    const rules: FeatureFlagRule[] = [{ type: 'admin_role', enabled: true, roles: ['admin', 'designer'] }]
    expect(evaluateFeatureFlag(flag({ rules }), staffAdmin)).toBe(true)
    expect(evaluateFeatureFlag(flag({ rules }), { ...staffAdmin, adminRole: 'support' })).toBe(false)
    expect(evaluateFeatureFlag(flag({ rules }), { ...staffAdmin, isStaff: false, adminRole: null })).toBe(false)
  })

  it('supports all-staff and everyone rules', () => {
    expect(evaluateFeatureFlag(flag({ rules: [{ type: 'all_staff', enabled: true }] }), staffAdmin)).toBe(true)
    expect(evaluateFeatureFlag(flag({ rules: [{ type: 'all_staff', enabled: true }] }), { email: 'user@example.com' })).toBe(false)
    expect(evaluateFeatureFlag(flag({ rules: [{ type: 'everyone', enabled: true }] }), {})).toBe(true)
  })

  it('matches specific users by normalized email or user id', () => {
    const rules = normalizeFlagRules([{
      type: 'user_list',
      enabled: true,
      emails: ['  Beta@Example.com '],
      user_ids: ['00000000-0000-0000-0000-000000000020'],
    }])

    expect(evaluateFeatureFlag(flag({ rules }), { email: 'beta@example.com' })).toBe(true)
    expect(evaluateFeatureFlag(flag({ rules }), { userId: '00000000-0000-0000-0000-000000000020' })).toBe(true)
    expect(evaluateFeatureFlag(flag({ rules }), { email: 'other@example.com' })).toBe(false)
  })

  it('applies priority buckets and deny-over-allow inside a bucket', () => {
    expect(evaluateFeatureFlag(flag({
      rules: [
        { type: 'everyone', enabled: true },
        { type: 'user_list', enabled: false, emails: ['admin@example.com'] },
      ],
    }), staffAdmin)).toBe(false)

    expect(evaluateFeatureFlag(flag({
      rules: [
        { type: 'admin_role', enabled: true, roles: ['admin'] },
        { type: 'admin_role', enabled: false, roles: ['admin'] },
      ],
    }), staffAdmin)).toBe(false)
  })

  it('uses deterministic percentage rollout boundaries', () => {
    expect(isInPercentageRollout(staffAdmin.userId, FLAGS.SCOUT_STYLE_AGENT, 0)).toBe(false)
    expect(isInPercentageRollout(staffAdmin.userId, FLAGS.SCOUT_STYLE_AGENT, 100)).toBe(true)
    expect(isInPercentageRollout(undefined, FLAGS.SCOUT_STYLE_AGENT, 100)).toBe(false)

    const first = isInPercentageRollout(staffAdmin.userId, FLAGS.SCOUT_STYLE_AGENT, 35)
    const second = isInPercentageRollout(staffAdmin.userId, FLAGS.SCOUT_STYLE_AGENT, 35)
    expect(second).toBe(first)
  })

  it('captures the Scout v1 targeting contract', () => {
    const scout = flag({
      key: FLAGS.SCOUT_STYLE_AGENT,
      rules: [{ type: 'admin_role', enabled: true, roles: ['admin', 'designer'] }],
    })

    expect(evaluateFeatureFlag(scout, staffAdmin)).toBe(true)
    expect(evaluateFeatureFlag(scout, { ...staffAdmin, adminRole: 'designer' })).toBe(true)
    expect(evaluateFeatureFlag(scout, { ...staffAdmin, adminRole: 'support' })).toBe(false)
    expect(evaluateFeatureFlag(scout, { email: 'customer@example.com', isStaff: false })).toBe(false)
  })
})
