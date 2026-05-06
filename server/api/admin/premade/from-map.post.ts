import { z } from 'zod'
import { serverSupabaseServiceRole } from '#supabase/server'
import { requireStaff } from '~/server/utils/adminAuth'
import { draftPremadeFromMap, slugifyPremadeTitle } from '~/utils/premadeCatalog'
import { premadeRowToMap } from '~/server/utils/premadeCatalog'

const Body = z.object({
  map_id: z.string().uuid(),
})

async function uniqueSlug(supabase: any, base: string): Promise<string> {
  for (let i = 0; i < 100; i++) {
    const candidate = i === 0 ? base : `${base}-${i + 1}`
    const { data, error } = await supabase
      .from('premade_maps')
      .select('id')
      .eq('slug', candidate)
      .maybeSingle()
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

  const { data: map, error: mapError } = await supabase
    .from('maps')
    .select('id, title, subtitle, geojson, bbox, stats, style_config, proof_render_url, thumbnail_url, render_url')
    .eq('id', body.map_id)
    .maybeSingle()

  if (mapError) throw createError({ statusCode: 500, message: mapError.message })
  if (!map) throw createError({ statusCode: 404, message: 'Source map not found' })

  const slug = await uniqueSlug(supabase, slugifyPremadeTitle(map.title))
  const draft = draftPremadeFromMap(map, slug)
  const { featured: _featured, ...insertDraft } = draft

  const { data, error } = await supabase
    .from('premade_maps')
    .insert({
      ...insertDraft,
      created_by: session.user!.id,
      updated_by: session.user!.id,
    })
    .select('*')
    .single()

  if (error) throw createError({ statusCode: 500, message: error.message })
  return premadeRowToMap(data)
})
