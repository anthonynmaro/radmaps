import { z } from 'zod'
import { serverSupabaseServiceRole } from '#supabase/server'
import { requireStaff } from '~/server/utils/adminAuth'
import { slugifyPremadeTitle } from '~/utils/premadeCatalog'
import { premadeRowToMap } from '~/server/utils/premadeCatalog'

const Body = z.object({
  title: z.string().min(1).max(160),
  preview_image_url: z.string().url().optional(),
})

async function uniqueSlug(supabase: any, base: string): Promise<string> {
  for (let i = 0; i < 100; i++) {
    const candidate = i === 0 ? base : `${base}-${i + 1}`
    const { data, error } = await supabase.from('premade_maps').select('id').eq('slug', candidate).maybeSingle()
    if (error) throw createError({ statusCode: 500, message: error.message })
    if (!data) return candidate
  }
  throw createError({ statusCode: 409, message: 'Could not generate a unique slug' })
}

export default defineEventHandler(async (event) => {
  const session = await requireStaff(event, 'premade:create')
  const parsed = Body.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 400, message: parsed.error.message })

  const body = parsed.data
  const supabase = await serverSupabaseServiceRole(event)
  const slug = await uniqueSlug(supabase, slugifyPremadeTitle(body.title))

  const { data, error } = await supabase
    .from('premade_maps')
    .insert({
      title: body.title,
      slug,
      preview_image_url: body.preview_image_url,
      needs_preview: !body.preview_image_url,
      status: 'draft',
      created_by: session.user!.id,
      updated_by: session.user!.id,
    })
    .select('*')
    .single()

  if (error) throw createError({ statusCode: 500, message: error.message })
  return premadeRowToMap(data)
})
