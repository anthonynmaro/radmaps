import { getStaffSession } from '~/server/utils/adminAuth'

export default defineEventHandler(async (event) => {
  const session = await getStaffSession(event)
  if (!session) return { staff: null }

  return {
    staff: {
      user_id: session.user!.id,
      email: session.user!.email,
      role: session.role,
      staff_id: session.staffId,
      super_admin: session.superAdmin,
    },
  }
})
