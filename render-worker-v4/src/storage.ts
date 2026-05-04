// render-worker-v4/src/storage.ts
//
// Thin wrappers over Supabase Storage uploads. All artifacts go to the
// `maps` bucket (same bucket as the legacy worker — paths are namespaced
// under `renders/...` per plan v4).

import { getSupabase } from './db.js'

const BUCKET = 'maps'

interface UploadOpts {
  contentType: string
  upsert?: boolean
  cacheControl?: string
}

/**
 * Upload a buffer to Supabase Storage and return its public URL.
 *
 * @param path  Storage object path (e.g. `renders/cache/map/abc.png`).
 * @param body  Image buffer.
 * @param opts  Content type, upsert flag, cache-control.
 */
export async function uploadBuffer(
  path: string,
  body: Buffer,
  opts: UploadOpts,
): Promise<string> {
  const supabase = getSupabase()
  const { error } = await supabase.storage.from(BUCKET).upload(path, body, {
    contentType: opts.contentType,
    upsert: opts.upsert ?? true,
    cacheControl: opts.cacheControl ?? '3600',
  })
  if (error) {
    throw new Error(`Storage upload failed at ${path}: ${error.message}`)
  }
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return data.publicUrl
}

/**
 * Download a buffer from Supabase Storage. Returns null on 404 so callers
 * can treat "missing" and "fetch failed" differently.
 */
export async function downloadBuffer(path: string): Promise<Buffer | null> {
  const supabase = getSupabase()
  const { data, error } = await supabase.storage.from(BUCKET).download(path)
  if (error) {
    // Supabase returns a generic 400 for 404s; treat absence-shape as missing.
    if (/not.?found|does.?not.?exist|404/i.test(error.message)) return null
    throw new Error(`Storage download failed at ${path}: ${error.message}`)
  }
  if (!data) return null
  const arrayBuffer = await data.arrayBuffer()
  return Buffer.from(arrayBuffer)
}
