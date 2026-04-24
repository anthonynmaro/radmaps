/**
 * POST /api/shop/customize
 *
 * Clones a premade map from the static catalog into the authenticated
 * user's `maps` table so they can edit everything about it like a regular
 * map. Returns the new `map_id`. Frontend redirects to
 * `/create/<map_id>/style` on success.
 *
 * Requires auth — guests can only purchase, not customize.
 */
import { z } from 'zod'
import { serverSupabaseUser, serverSupabaseClient } from '#supabase/server'
import { getPremadeBySlug } from '~/data/premade-maps'

const Body = z.object({
  slug: z.string().min(1),
})

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user) throw createError({ statusCode: 401, message: 'Sign in to customize a map' })

  const body = await readBody(event)
  const parsed = Body.safeParse(body)
  if (!parsed.success) {
    throw createError({ statusCode: 400, message: parsed.error.message })
  }

  const premade = getPremadeBySlug(parsed.data.slug)
  if (!premade) throw createError({ statusCode: 404, message: 'Premade map not found' })

  const supabase = await serverSupabaseClient(event)

  const { data: inserted, error } = await supabase
    .from('maps')
    .insert({
      user_id: user.id,
      title: premade.title,
      subtitle: premade.subtitle,
      geojson: premade.geojson,
      bbox: premade.bbox,
      stats: premade.stats,
      style_config: premade.style_config,
      status: 'draft',
    })
    .select('id')
    .single()

  if (error || !inserted) {
    console.error('Failed to clone premade map:', error)
    throw createError({ statusCode: 500, message: 'Failed to customize map' })
  }

  return { map_id: inserted.id, redirect: `/create/${inserted.id}/style` }
})
