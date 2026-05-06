import { z } from 'zod'
import { serverSupabaseServiceRole } from '#supabase/server'
import { requireStaff } from '~/server/utils/adminAuth'

const Body = z.object({
  items: z.array(z.object({
    id: z.string().uuid(),
    homepage_visible: z.boolean(),
    homepage_sort_order: z.number().int(),
  })).max(100),
})

export default defineEventHandler(async (event) => {
  const session = await requireStaff(event, 'homepage:manage')
  const parsed = Body.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 400, message: parsed.error.message })

  const body = parsed.data
  const supabase = await serverSupabaseServiceRole(event)
  const visibleIds = body.items.filter((item) => item.homepage_visible).map((item) => item.id)

  if (visibleIds.length > 0) {
    const { data: visibleRows, error: visibleError } = await supabase
      .from('premade_maps')
      .select('id, status')
      .in('id', visibleIds)

    if (visibleError) throw createError({ statusCode: 500, message: visibleError.message })

    const publishedIds = new Set((visibleRows || []).filter((row: any) => row.status === 'published').map((row: any) => row.id))
    const invalidIds = visibleIds.filter((id) => !publishedIds.has(id))
    if (invalidIds.length > 0) {
      throw createError({ statusCode: 422, message: 'Only published premade maps can be featured on the homepage' })
    }
  }

  const results = []
  for (const item of body.items) {
    const { data, error } = await supabase
      .from('premade_maps')
      .update({
        homepage_visible: item.homepage_visible,
        homepage_sort_order: item.homepage_sort_order,
        updated_by: session.user!.id,
      })
      .eq('id', item.id)
      .select('id, homepage_visible, homepage_sort_order')
      .single()
    if (error) throw createError({ statusCode: 500, message: error.message })
    results.push(data)
  }

  return { items: results }
})
