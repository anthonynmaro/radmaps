import { serverSupabaseServiceRole, serverSupabaseUser } from '#supabase/server'
import { DEFAULT_SUPER_ADMIN_EMAIL, roleCan, type AdminAction } from '~/utils/adminPermissions'
import type { AdminRole } from '~/types'

export interface StaffSession {
  user: Awaited<ReturnType<typeof serverSupabaseUser>>
  role: AdminRole
  staffId: string | null
  superAdmin: boolean
}

function parseEmailList(value: unknown): Set<string> {
  return new Set(
    String(value || '')
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  )
}

export function superAdminEmails(): Set<string> {
  const config = useRuntimeConfig()
  const emails = parseEmailList(config.adminSuperAdminEmails || DEFAULT_SUPER_ADMIN_EMAIL)
  emails.add(DEFAULT_SUPER_ADMIN_EMAIL)
  return emails
}

export function bootstrapEmails(): Set<string> {
  const config = useRuntimeConfig()
  const emails = parseEmailList(config.adminBootstrapEmails)
  for (const email of superAdminEmails()) emails.add(email)
  return emails
}

export function isSuperAdminEmail(email: string | null | undefined): boolean {
  return Boolean(email && superAdminEmails().has(email.trim().toLowerCase()))
}

async function upsertAdminRole(adminClient: any, userId: string) {
  const { data, error } = await adminClient
    .from('admin_users')
    .upsert(
      {
        user_id: userId,
        role: 'admin',
        active: true,
        created_by: userId,
        updated_by: userId,
      },
      { onConflict: 'user_id' },
    )
    .select('id, role')
    .single()

  return { data, error }
}

export async function assertMutableStaffTarget(adminClient: any, staffId: string) {
  const { data, error } = await adminClient
    .from('admin_users')
    .select('id, user_id')
    .eq('id', staffId)
    .maybeSingle()

  if (error) throw createError({ statusCode: 500, message: error.message })
  if (!data) throw createError({ statusCode: 404, message: 'Staff user not found' })

  const { data: profile, error: profileError } = await adminClient
    .from('profiles')
    .select('email')
    .eq('id', data.user_id)
    .maybeSingle()
  if (profileError) throw createError({ statusCode: 500, message: profileError.message })

  if (isSuperAdminEmail(profile?.email)) {
    throw createError({ statusCode: 403, message: 'Super-admin access cannot be changed from the staff UI' })
  }

  return data
}

export async function getStaffSession(event: Parameters<typeof serverSupabaseUser>[0]): Promise<StaffSession | null> {
  const user = await serverSupabaseUser(event).catch(() => null)
  if (!user?.id) return null

  const adminClient = await serverSupabaseServiceRole(event)
  const email = user.email?.toLowerCase()

  if (isSuperAdminEmail(email)) {
    const { data: bootstrapped } = await upsertAdminRole(adminClient, user.id)
    return { user, role: 'admin', staffId: bootstrapped?.id ?? null, superAdmin: true }
  }

  const { data: staff, error } = await adminClient
    .from('admin_users')
    .select('id, role, active')
    .eq('user_id', user.id)
    .eq('active', true)
    .maybeSingle()

  if (!error && staff?.role) {
    return { user, role: staff.role as AdminRole, staffId: staff.id, superAdmin: false }
  }

  if (email && bootstrapEmails().has(email)) {
    const { data: bootstrapped, error: bootstrapError } = await upsertAdminRole(adminClient, user.id)

    if (!bootstrapError && bootstrapped?.role) {
      return { user, role: bootstrapped.role as AdminRole, staffId: bootstrapped.id, superAdmin: false }
    }
  }

  return null
}

export async function requireStaff(event: Parameters<typeof serverSupabaseUser>[0], action?: AdminAction): Promise<StaffSession> {
  const session = await getStaffSession(event)
  if (!session) {
    throw createError({ statusCode: 403, message: 'Admin access required' })
  }
  if (action && !roleCan(session.role, action)) {
    throw createError({ statusCode: 403, message: 'Your staff role cannot perform this action' })
  }
  return session
}
