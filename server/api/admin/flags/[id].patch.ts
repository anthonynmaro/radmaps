import { z } from 'zod'
import { serverSupabaseServiceRole } from '#supabase/server'
import { requireStaff } from '~/server/utils/adminAuth'
import { invalidateFeatureFlagCache } from '~/server/utils/featureFlags'
import { FeatureFlagUpdateSchema } from '~/utils/featureFlags'

const Params = z.object({ id: z.string().uuid() })
const Body = FeatureFlagUpdateSchema.omit({ key: true })

export default defineEventHandler(async (event) => {
  const session = await requireStaff(event, 'flags:manage')
  const params = Params.safeParse({ id: getRouterParam(event, 'id') })
  if (!params.success) throw createError({ statusCode: 400, message: params.error.message })

  const parsed = Body.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 400, message: parsed.error.message })

  const supabase = await serverSupabaseServiceRole(event)

  const { data: before, error: beforeError } = await supabase
    .from('feature_flags')
    .select('*')
    .eq('id', params.data.id)
    .maybeSingle()

  if (beforeError) throw createError({ statusCode: 500, message: beforeError.message })
  if (!before) throw createError({ statusCode: 404, message: 'Feature flag not found' })

  const { archived, ...body } = parsed.data
  const update: Record<string, unknown> = {
    ...body,
    updated_by: session.user!.id,
  }

  if ('description' in update && update.description === '') update.description = null
  if (archived === true) update.archived_at = new Date().toISOString()
  if (archived === false) update.archived_at = null

  const { data: after, error: updateError } = await supabase
    .from('feature_flags')
    .update(update)
    .eq('id', params.data.id)
    .select('*')
    .single()

  if (updateError) throw createError({ statusCode: 500, message: updateError.message })

  const action = archived === true ? 'archive' : archived === false ? 'restore' : 'update'
  const { error: eventError } = await supabase.from('feature_flag_events').insert({
    feature_flag_id: after.id,
    flag_key: after.key,
    environment: after.environment,
    action,
    actor_id: session.user!.id,
    before,
    after,
  })
  if (eventError) throw createError({ statusCode: 500, message: eventError.message })

  invalidateFeatureFlagCache()
  return after
})
