import { serverSupabaseServiceRole } from '#supabase/server'
import { isSuperAdminEmail, requireStaff } from '~/server/utils/adminAuth'

const PROFILE_SELECT = 'id, email, full_name, created_at'

function dedupeProfiles(rows: any[][]): any[] {
  const byId = new Map<string, any>()
  for (const group of rows) {
    for (const profile of group || []) {
      byId.set(profile.id, profile)
    }
  }
  return [...byId.values()]
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
    .slice(0, 50)
}

export default defineEventHandler(async (event) => {
  await requireStaff(event, 'staff:manage')
  const supabase = await serverSupabaseServiceRole(event)
  const query = getQuery(event)
  const search = String(query.search || '').trim().slice(0, 160)

  const profilesPromise = search
    ? Promise.all([
        supabase.from('profiles').select(PROFILE_SELECT).ilike('email', `%${search}%`).order('created_at', { ascending: false }).limit(50),
        supabase.from('profiles').select(PROFILE_SELECT).ilike('full_name', `%${search}%`).order('created_at', { ascending: false }).limit(50),
      ])
    : Promise.all([
        supabase.from('profiles').select(PROFILE_SELECT).order('created_at', { ascending: false }).limit(50),
      ])

  const [profileResults, { data: staff, error: staffError }] = await Promise.all([
    profilesPromise,
    supabase.from('admin_users').select('id, user_id, role, active, created_at, updated_at'),
  ])

  const profilesError = profileResults.find((result: any) => result.error)?.error
  if (profilesError) throw createError({ statusCode: 500, message: profilesError.message })
  if (staffError) throw createError({ statusCode: 500, message: staffError.message })

  const staffByUserId = new Map((staff || []).map((row: any) => [row.user_id, row]))
  const profiles = dedupeProfiles(profileResults.map((result: any) => result.data || []))
  return profiles.map((profile: any) => ({
    ...profile,
    super_admin: isSuperAdminEmail(profile.email),
    staff: staffByUserId.get(profile.id) || null,
  }))
})
