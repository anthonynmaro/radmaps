import { z } from 'zod'
import { serverSupabaseServiceRole } from '#supabase/server'
import { isSuperAdminEmail, requireStaff } from '~/server/utils/adminAuth'
import { isAdminRole } from '~/utils/adminPermissions'

const Body = z.object({
  email: z.string().email(),
  role: z.string().refine(isAdminRole, 'Invalid staff role'),
})

export default defineEventHandler(async (event) => {
  const session = await requireStaff(event, 'staff:manage')
  const parsed = Body.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 400, message: parsed.error.message })

  const body = parsed.data
  const supabase = await serverSupabaseServiceRole(event)

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, email, full_name')
    .ilike('email', body.email)
    .maybeSingle()

  if (profileError) throw createError({ statusCode: 500, message: profileError.message })
  if (!profile) throw createError({ statusCode: 404, message: 'No signed-in user found with that email' })

  const { data, error } = await supabase
    .from('admin_users')
    .upsert(
      {
        user_id: profile.id,
        role: isSuperAdminEmail(profile.email) ? 'admin' : body.role,
        active: true,
        updated_by: session.user!.id,
        created_by: session.user!.id,
      },
      { onConflict: 'user_id' },
    )
    .select('id, user_id, role, active, created_at, updated_at')
    .single()

  if (error) throw createError({ statusCode: 500, message: error.message })
  return { ...profile, staff: data }
})
