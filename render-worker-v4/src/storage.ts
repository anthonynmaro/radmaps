// render-worker-v4/src/storage.ts
//
// Thin wrappers over Supabase Storage uploads. All artifacts go to the
// `maps` bucket (same bucket as the legacy worker — paths are namespaced
// under `renders/...` per plan v4).

import { getSupabase } from './db.js'

const BUCKET = 'maps'
const DEFAULT_SIGNED_URL_TTL_SECONDS = 7 * 24 * 60 * 60

interface UploadOpts {
  contentType: string
  upsert?: boolean
  cacheControl?: string
}

/**
 * Upload a buffer to Supabase Storage and return a signed URL suitable for
 * short-lived provider handoff. Store `path` for durable references.
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
  return await createSignedStorageUrl(path)
}

export async function createSignedStorageUrl(
  path: string,
  expiresInSeconds = DEFAULT_SIGNED_URL_TTL_SECONDS,
): Promise<string> {
  const supabase = getSupabase()
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, expiresInSeconds)
  if (error || !data?.signedUrl) {
    throw new Error(`Storage signed URL failed at ${path}: ${error?.message ?? 'no signed URL'}`)
  }
  return data.signedUrl
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
