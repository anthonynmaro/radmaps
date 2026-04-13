import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml', 'image/gif'])

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const mapId = getRouterParam(event, 'id')
  if (!mapId) throw createError({ statusCode: 400, message: 'Missing map ID' })

  const supabase = await serverSupabaseClient(event)

  // Verify this map belongs to the user
  const { data: mapRow, error: mapErr } = await supabase
    .from('maps')
    .select('id')
    .eq('id', mapId)
    .eq('user_id', user.id)
    .single()

  if (mapErr || !mapRow) throw createError({ statusCode: 404, message: 'Map not found' })

  // Parse multipart form
  const form = await readFormData(event)
  const imageFile = form.get('image') as File | null
  if (!imageFile || typeof imageFile === 'string') {
    throw createError({ statusCode: 400, message: 'No image file provided' })
  }

  if (!ALLOWED_MIME.has(imageFile.type)) {
    throw createError({ statusCode: 400, message: 'Invalid image type. Use PNG, JPG, WebP, SVG, or GIF.' })
  }

  const ext = imageFile.name.split('.').pop()?.toLowerCase() ?? 'png'
  const storagePath = `${user.id}/${mapId}.${ext}`

  const arrayBuffer = await imageFile.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  const { error: uploadError } = await supabase.storage
    .from('logos')
    .upload(storagePath, buffer, {
      contentType: imageFile.type,
      upsert: true,
    })

  if (uploadError) throw createError({ statusCode: 500, message: `Upload failed: ${uploadError.message}` })

  const { data: { publicUrl } } = supabase.storage.from('logos').getPublicUrl(storagePath)

  return { url: publicUrl }
})
