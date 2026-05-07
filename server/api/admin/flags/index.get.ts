import { serverSupabaseServiceRole } from '#supabase/server'
import { requireStaff } from '~/server/utils/adminAuth'
import { currentFeatureFlagEnvironment } from '~/server/utils/featureFlags'
import { normalizeFlagRules } from '~/utils/featureFlags'

export default defineEventHandler(async (event) => {
  await requireStaff(event, 'flags:manage')
  const supabase = await serverSupabaseServiceRole(event)

  const [flagsResult, eventsResult] = await Promise.all([
    supabase
      .from('feature_flags')
      .select('*')
      .order('environment', { ascending: true })
      .order('key', { ascending: true }),
    supabase
      .from('feature_flag_events')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100),
  ])

  if (flagsResult.error) throw createError({ statusCode: 500, message: flagsResult.error.message })
  if (eventsResult.error) throw createError({ statusCode: 500, message: eventsResult.error.message })

  return {
    environment: currentFeatureFlagEnvironment(),
    flags: (flagsResult.data || []).map((flag: any) => ({ ...flag, rules: normalizeFlagRules(flag.rules) })),
    events: eventsResult.data || [],
  }
})
