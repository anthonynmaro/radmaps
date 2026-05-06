import { z } from 'zod'
import { serverSupabaseServiceRole } from '#supabase/server'
import { requireStaff } from '~/server/utils/adminAuth'
import { PREMADE_CATEGORIES } from '~/utils/premadeCatalog'
import { premadeRowToMap } from '~/server/utils/premadeCatalog'

const categoryIds = PREMADE_CATEGORIES.map((category) => category.id) as [string, ...string[]]

const Body = z.object({
  id: z.string().uuid(),
  slug: z.string().min(1).max(96).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
  title: z.string().min(1).max(160).optional(),
  subtitle: z.string().max(180).nullable().optional(),
  region: z.string().min(1).max(160).optional(),
  country: z.string().min(1).max(80).optional(),
  category: z.enum(categoryIds).optional(),
  tagline: z.string().max(220).optional(),
  description: z.string().max(3000).optional(),
  badges: z.array(z.string().min(1).max(32)).max(8).optional(),
  preview_image_url: z.string().url().nullable().optional(),
  render_url: z.string().url().nullable().optional(),
  base_price_cents: z.number().int().min(0).optional(),
  homepage_visible: z.boolean().optional(),
  homepage_sort_order: z.number().int().optional(),
  status: z.enum(['draft', 'archived']).optional(),
})

export default defineEventHandler(async (event) => {
  const session = await requireStaff(event, 'premade:edit')
  const parsed = Body.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 400, message: parsed.error.message })

  const body = parsed.data
  const { id, ...updates } = body
  const supabase = await serverSupabaseServiceRole(event)
  const previewWasProvided = Object.prototype.hasOwnProperty.call(updates, 'preview_image_url')

  const { data, error } = await supabase
    .from('premade_maps')
    .update({
      ...updates,
      updated_by: session.user!.id,
      needs_preview: previewWasProvided ? !updates.preview_image_url : undefined,
    })
    .eq('id', id)
    .select('*')
    .single()

  if (error) throw createError({ statusCode: 500, message: error.message })
  return premadeRowToMap(data)
})
