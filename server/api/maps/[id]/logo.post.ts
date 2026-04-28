import { z } from 'zod'
import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'

// SVG excluded: Puppeteer renders it inline — a malicious SVG can trigger SSRF
// or stored XSS. GIF excluded: not useful for print logos.
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp'])
const MAX_SIZE_BYTES = 5 * 1024 * 1024 // 5 MB

const mapIdSchema = z.string().uuid()

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const rawMapId = getRouterParam(event, 'id')
  const mapIdParsed = mapIdSchema.safeParse(rawMapId)
  if (!mapIdParsed.success) throw createError({ statusCode: 400, message: 'Invalid map ID' })
  const mapId = mapIdParsed.data

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

  // Validate client-reported MIME type against allowlist
  if (!ALLOWED_MIME.has(imageFile.type)) {
    throw createError({ statusCode: 400, message: 'Invalid image type. Use PNG, JPG, or WebP.' })
  }

  if (imageFile.size > MAX_SIZE_BYTES) {
    throw createError({ statusCode: 413, message: 'Image too large (max 5 MB)' })
  }

  // Use a safe, deterministic storage path — no user-controlled extension
  const mimeToExt: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
  }
  const ext = mimeToExt[imageFile.type] ?? 'jpg'
  const storagePath = `${user.id}/${mapId}.${ext}`

  const arrayBuffer = await imageFile.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  const { error: uploadError } = await supabase.storage
    .from('logos')
    .upload(storagePath, buffer, {
      contentType: imageFile.type,
      upsert: true,
    })

  if (uploadError) throw createError({ statusCode: 500, message: 'Upload failed' })

  const { data: { publicUrl } } = supabase.storage.from('logos').getPublicUrl(storagePath)

  return { url: publicUrl }
})
