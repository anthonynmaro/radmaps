import { describe, expect, it } from 'vitest'
import { ADMIN_ROLES, DEFAULT_SUPER_ADMIN_EMAIL, isAdminRole, roleCan, rolesForAction } from '~/utils/adminPermissions'

describe('admin role permissions', () => {
  it('allows admins to manage every admin surface', () => {
    expect(roleCan('admin', 'staff:manage')).toBe(true)
    expect(roleCan('admin', 'premade:publish')).toBe(true)
    expect(roleCan('admin', 'coupon:manage')).toBe(true)
    expect(roleCan('admin', 'homepage:manage')).toBe(true)
    expect(roleCan('admin', 'support:read')).toBe(true)
    expect(roleCan('admin', 'flags:manage')).toBe(true)
  })

  it('keeps practical roles scoped', () => {
    expect(roleCan('curator', 'premade:publish')).toBe(true)
    expect(roleCan('curator', 'staff:manage')).toBe(false)
    expect(roleCan('designer', 'premade:create')).toBe(true)
    expect(roleCan('designer', 'premade:publish')).toBe(false)
    expect(roleCan('support', 'support:read')).toBe(true)
    expect(roleCan('support', 'coupon:manage')).toBe(false)
    expect(roleCan('support', 'premade:edit')).toBe(false)
    expect(roleCan('designer', 'flags:manage')).toBe(false)
    expect(roleCan('curator', 'flags:manage')).toBe(false)
    expect(roleCan('support', 'flags:manage')).toBe(false)
  })

  it('validates the staff role union at runtime', () => {
    expect(ADMIN_ROLES).toEqual(['admin', 'curator', 'designer', 'support'])
    expect(isAdminRole('designer')).toBe(true)
    expect(isAdminRole('owner')).toBe(false)
    expect(isAdminRole(null)).toBe(false)
  })

  it('lists roles that can perform a given action', () => {
    expect(rolesForAction('premade:publish')).toEqual(['admin', 'curator'])
    expect(rolesForAction('staff:manage')).toEqual(['admin'])
    expect(rolesForAction('coupon:manage')).toEqual(['admin'])
    expect(rolesForAction('support:read')).toEqual(['admin', 'support'])
    expect(rolesForAction('flags:manage')).toEqual(['admin'])
  })

  it('keeps Anthony configured as the immutable default super-admin', () => {
    expect(DEFAULT_SUPER_ADMIN_EMAIL).toBe('anthonynmaro@gmail.com')
  })
})
