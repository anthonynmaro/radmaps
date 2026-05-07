import type { AdminRole } from '~/types'

export type AdminAction =
  | 'staff:manage'
  | 'coupon:manage'
  | 'premade:create'
  | 'premade:edit'
  | 'premade:publish'
  | 'homepage:manage'
  | 'support:read'
  | 'flags:manage'

const ROLE_PERMISSIONS: Record<AdminRole, AdminAction[]> = {
  admin: [
    'staff:manage',
    'coupon:manage',
    'premade:create',
    'premade:edit',
    'premade:publish',
    'homepage:manage',
    'support:read',
    'flags:manage',
  ],
  curator: [
    'premade:create',
    'premade:edit',
    'premade:publish',
    'homepage:manage',
  ],
  designer: [
    'premade:create',
    'premade:edit',
  ],
  support: [
    'support:read',
  ],
}

export const ADMIN_ROLES: AdminRole[] = ['admin', 'curator', 'designer', 'support']
export const DEFAULT_SUPER_ADMIN_EMAIL = 'anthonynmaro@gmail.com'

export function isAdminRole(value: unknown): value is AdminRole {
  return typeof value === 'string' && ADMIN_ROLES.includes(value as AdminRole)
}

export function roleCan(role: AdminRole | null | undefined, action: AdminAction): boolean {
  if (!role) return false
  return ROLE_PERMISSIONS[role]?.includes(action) ?? false
}

export function rolesForAction(action: AdminAction): AdminRole[] {
  return ADMIN_ROLES.filter((role) => roleCan(role, action))
}
