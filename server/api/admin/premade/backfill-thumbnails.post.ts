import { z } from 'zod'
import { serverSupabaseServiceRole } from '#supabase/server'
import { requireStaff } from '~/server/utils/adminAuth'
import { renderPremadeThumbnail } from '~/server/utils/premadeThumbnail'

const Body = z.object({
  limit: z.number().int().min(1).max(20).default(5),
  force: z.boolean().default(false),
})

export default defineEventHandler(async (event) => {
  const session = await requireStaff(event, 'premade:edit')
  const parsed = Body.safeParse((await readBody(event).catch(() => ({}))) ?? {})
  if (!parsed.success) throw createError({ statusCode: 400, message: parsed.error.message })

  const { limit, force } = parsed.data
  const supabase = await serverSupabaseServiceRole(event)
  let query = supabase
    .from('premade_maps')
    .select('id, slug')
    .order('updated_at', { ascending: true })
    .limit(limit)
  if (!force) {
    query = query.or('preview_image_url.is.null,needs_preview.eq.true')
  }
  const { data: rows, error } = await query

  if (error) throw createError({ statusCode: 500, message: error.message })

  const results: Array<{ id: string; slug: string; status: 'cached' | 'rendered' | 'failed'; preview_image_url?: string; error?: string }> = []
  for (const row of rows ?? []) {
    try {
      const result = await renderPremadeThumbnail({
        event,
        premadeId: row.id,
        updatedBy: session.user!.id,
        force,
      })
      results.push({
        id: row.id,
        slug: row.slug,
        status: result.status,
        preview_image_url: result.preview_image_url,
      })
    } catch (err) {
      results.push({
        id: row.id,
        slug: row.slug,
        status: 'failed',
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return {
    processed: results.length,
    results,
  }
})
