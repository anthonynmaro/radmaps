import { z } from 'zod'
import { serverSupabaseServiceRole } from '#supabase/server'
import { requireStaff } from '~/server/utils/adminAuth'
import { PREMADE_CATEGORIES, normalizePremadeCategories } from '~/utils/premadeCatalog'
import { premadeRowToMap } from '~/server/utils/premadeCatalog'
import { renderPremadeThumbnail } from '~/server/utils/premadeThumbnail'

const categoryIds = PREMADE_CATEGORIES.map((category) => category.id) as [string, ...string[]]

const Body = z.object({
  id: z.string().uuid(),
  slug: z.string().min(1).max(96).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
  title: z.string().min(1).max(160).optional(),
  subtitle: z.string().max(180).nullable().optional(),
  region: z.string().min(1).max(160).optional(),
  country: z.string().min(1).max(80).optional(),
  location_label: z.string().max(180).nullable().optional(),
  location_city: z.string().max(120).nullable().optional(),
  location_region: z.string().max(160).nullable().optional(),
  location_country: z.string().max(80).nullable().optional(),
  location_lng: z.number().min(-180).max(180).nullable().optional(),
  location_lat: z.number().min(-90).max(90).nullable().optional(),
  category: z.enum(categoryIds).optional(),
  categories: z.array(z.enum(categoryIds)).min(1).max(13).optional(),
  tagline: z.string().max(220).optional(),
  description: z.string().max(3000).optional(),
  badges: z.array(z.string().min(1).max(32)).max(8).optional(),
  preview_image_url: z.string().url().nullable().optional(),
  render_url: z.string().url().nullable().optional(),
  style_config: z.any().optional(),
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
  if (updates.categories) {
    updates.categories = normalizePremadeCategories(updates.categories, updates.category)
    updates.category = updates.categories[0]
  } else if (updates.category) {
    updates.categories = [updates.category]
  }
  const supabase = await serverSupabaseServiceRole(event)
  const previewWasProvided = Object.prototype.hasOwnProperty.call(updates, 'preview_image_url')
  const styleWasProvided = Object.prototype.hasOwnProperty.call(updates, 'style_config')
  const needsPreview = previewWasProvided ? !updates.preview_image_url : styleWasProvided ? true : undefined
  let nextStatus = updates.status

  if (styleWasProvided && !nextStatus) {
    const { data: current, error: currentError } = await supabase
      .from('premade_maps')
      .select('status')
      .eq('id', id)
      .maybeSingle()
    if (currentError) throw createError({ statusCode: 500, message: currentError.message })
    if (current?.status === 'published') nextStatus = 'draft'
  }

  const { data, error } = await supabase
    .from('premade_maps')
    .update({
      ...updates,
      status: nextStatus,
      updated_by: session.user!.id,
      needs_preview: needsPreview,
    })
    .eq('id', id)
    .select('*')
    .single()

  if (error) throw createError({ statusCode: 500, message: error.message })

  if (styleWasProvided) {
    try {
      await renderPremadeThumbnail({
        event,
        premadeId: id,
        updatedBy: session.user!.id,
      })
      const { data: refreshed, error: refreshError } = await supabase
        .from('premade_maps')
        .select('*')
        .eq('id', id)
        .single()
      if (refreshError) throw createError({ statusCode: 500, message: refreshError.message })
      return premadeRowToMap(refreshed)
    } catch (err) {
      console.warn('[premade] automatic preview refresh failed:', err instanceof Error ? err.message : err)
    }
  }

  return premadeRowToMap(data)
})
