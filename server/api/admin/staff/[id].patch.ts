import { z } from 'zod'
import { serverSupabaseServiceRole } from '#supabase/server'
import { assertMutableStaffTarget, requireStaff } from '~/server/utils/adminAuth'
import { isAdminRole } from '~/utils/adminPermissions'

const Body = z.object({
  role: z.string().refine(isAdminRole, 'Invalid staff role').optional(),
  active: z.boolean().optional(),
})

export default defineEventHandler(async (event) => {
  const session = await requireStaff(event, 'staff:manage')
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'Staff ID required' })

  const parsed = Body.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 400, message: parsed.error.message })

  const supabase = await serverSupabaseServiceRole(event)
  await assertMutableStaffTarget(supabase, id)
  const patch = { ...parsed.data, updated_by: session.user!.id }

  const { data, error } = await supabase
    .from('admin_users')
    .update(patch)
    .eq('id', id)
    .select('id, user_id, role, active, created_at, updated_at')
    .single()

  if (error) throw createError({ statusCode: 500, message: error.message })
  return data
})
