import { serverSupabaseServiceRole } from '#supabase/server'
import { assertMutableStaffTarget, requireStaff } from '~/server/utils/adminAuth'

export default defineEventHandler(async (event) => {
  const session = await requireStaff(event, 'staff:manage')
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'Staff ID required' })

  const supabase = await serverSupabaseServiceRole(event)
  await assertMutableStaffTarget(supabase, id)
  const { data, error } = await supabase
    .from('admin_users')
    .update({ active: false, updated_by: session.user!.id })
    .eq('id', id)
    .select('id, user_id, role, active')
    .single()

  if (error) throw createError({ statusCode: 500, message: error.message })
  return data
})
