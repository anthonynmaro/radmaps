export type PosterThumbnailSource = {
  id: string
  proof_render_url?: string | null
  thumbnail_url?: string | null
  render_url?: string | null
}

export type PosterThumbnailFailures = Record<string, boolean | undefined>

export function posterThumbnailFailureKey(mapId: string, url: string) {
  return `${mapId}:${url}`
}

export function isUsablePosterThumbnailUrl(url: string | null | undefined) {
  const trimmed = url?.trim()
  return Boolean(trimmed && !trimmed.startsWith('error:'))
}

export function posterThumbnailUrl(
  map: PosterThumbnailSource,
  failedUrls: PosterThumbnailFailures = {}
) {
  const candidates = [
    map.proof_render_url,
    map.thumbnail_url,
    map.render_url,
  ]

  for (const candidate of candidates) {
    if (!isUsablePosterThumbnailUrl(candidate)) continue
    const url = candidate!.trim()
    if (failedUrls[posterThumbnailFailureKey(map.id, url)]) continue
    return url
  }

  return null
}
