import { serverSupabaseServiceRole } from '#supabase/server'
import { requireStaff } from '~/server/utils/adminAuth'
import { invalidateFeatureFlagCache } from '~/server/utils/featureFlags'
import { FeatureFlagWriteSchema } from '~/utils/featureFlags'

export default defineEventHandler(async (event) => {
  const session = await requireStaff(event, 'flags:manage')
  const parsed = FeatureFlagWriteSchema.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 400, message: parsed.error.message })

  const supabase = await serverSupabaseServiceRole(event)
  const body = parsed.data

  const { data, error } = await supabase
    .from('feature_flags')
    .insert({
      ...body,
      description: body.description || null,
      created_by: session.user!.id,
      updated_by: session.user!.id,
    })
    .select('*')
    .single()

  if (error) throw createError({ statusCode: 500, message: error.message })

  const { error: eventError } = await supabase.from('feature_flag_events').insert({
    feature_flag_id: data.id,
    flag_key: data.key,
    environment: data.environment,
    action: 'create',
    actor_id: session.user!.id,
    before: null,
    after: data,
  })
  if (eventError) throw createError({ statusCode: 500, message: eventError.message })

  invalidateFeatureFlagCache()
  return data
})
