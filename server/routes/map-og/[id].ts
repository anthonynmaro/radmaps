import sharp from 'sharp'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { SITE_URL } from '~/utils/seo'

const MapIdSchema = z.string().uuid()
const WIDTH = 1200
const HEIGHT = 630

function escapeXml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1).trim()}...` : value
}

function splitTitle(value: string): string[] {
  const words = value.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const next = current ? `${current} ${word}` : word
    if (next.length > 23 && current) {
      lines.push(current)
      current = word
    } else {
      current = next
    }
    if (lines.length === 1 && current.length > 23) break
  }
  if (current) lines.push(current)
  return lines.slice(0, 2)
}

function statLine(stats: Record<string, unknown> | null | undefined): string {
  const distanceKm = typeof stats?.distance_km === 'number' ? stats.distance_km : null
  const gainM = typeof stats?.elevation_gain_m === 'number' ? stats.elevation_gain_m : null
  const parts = []
  if (distanceKm != null) parts.push(`${(distanceKm * 0.621371).toFixed(1)} miles`)
  if (gainM != null) parts.push(`${Math.round(gainM * 3.28084).toLocaleString('en-US')} ft gain`)
  return parts.join('  |  ')
}

async function posterPreview(url: string | null | undefined): Promise<Buffer | null> {
  if (!url || url.startsWith('error:')) return null
  try {
    const response = await fetch(url)
    if (!response.ok) return null
    const bytes = Buffer.from(await response.arrayBuffer())
    return await sharp(bytes)
      .resize(330, 495, { fit: 'cover', position: 'center' })
      .jpeg({ quality: 88 })
      .toBuffer()
  } catch {
    return null
  }
}

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? ''
  if (!MapIdSchema.safeParse(id).success) throw createError({ statusCode: 404, message: 'Map not found' })

  const config = useRuntimeConfig()
  const supabase = createClient(
    config.public.supabaseUrl as string,
    config.supabaseServiceKey as string,
  ) as any

  const { data: map, error } = await supabase
    .from('maps')
    .select('id, title, subtitle, stats, render_url, thumbnail_url, proof_render_url, is_public')
    .eq('id', id)
    .eq('is_public', true)
    .single()

  if (error || !map) throw createError({ statusCode: 404, message: 'Map not found' })

  const title = truncate(map.title || 'Trail Poster', 46)
  const titleLines = splitTitle(title)
  const titleSvg = titleLines
    .map((line, index) => `<tspan x="0" dy="${index === 0 ? 0 : 68}">${escapeXml(line)}</tspan>`)
    .join('')
  const subtitle = truncate(map.subtitle || 'Order this print or customize it in RadMaps Studio.', 104)
  const stats = statLine(map.stats)
  const previewUrl = map.proof_render_url || map.thumbnail_url || map.render_url
  const poster = await posterPreview(previewUrl)

  const svg = `
    <svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${WIDTH}" height="${HEIGHT}" fill="#FAF8F4"/>
      <g opacity="0.10" fill="none" stroke="#2D6A4F" stroke-width="1.5">
        <path d="M-40 116 Q180 74 405 116 T890 100 T1260 128"/>
        <path d="M-40 176 Q180 134 405 176 T890 160 T1260 188"/>
        <path d="M-40 236 Q180 194 405 236 T890 220 T1260 248"/>
        <path d="M-40 500 Q180 458 405 500 T890 484 T1260 512"/>
        <path d="M-40 560 Q180 518 405 560 T890 544 T1260 572"/>
      </g>
      <rect x="70" y="46" width="380" height="548" rx="18" fill="#2D6A4F" opacity="0.10" transform="rotate(-3 260 320)"/>
      <rect x="95" y="68" width="330" height="495" rx="10" fill="#ffffff"/>
      <rect x="95" y="68" width="330" height="495" rx="10" fill="#E7E1D8"/>
      <g transform="translate(510 92)">
        <g transform="translate(0 0)">
          <path d="M0 25 L10 5 L16 16 L23 9 L35 25 Z" fill="#2D6A4F" opacity="0.16"/>
          <path d="M0 25 L10 5 L16 16 L23 9 L35 25" stroke="#2D6A4F" stroke-width="2" stroke-linejoin="round" fill="none"/>
          <circle cx="10" cy="5" r="1.6" fill="#2D6A4F"/>
          <text x="48" y="23" fill="#1C1917" font-family="Space Grotesk, Arial, sans-serif" font-size="24" font-weight="700">Rad Maps</text>
          <text x="171" y="22" fill="#78716C" font-family="Space Grotesk, Arial, sans-serif" font-size="12" font-weight="700" letter-spacing="3">STUDIO</text>
        </g>
        <text x="0" y="92" fill="#2D6A4F" font-family="Space Grotesk, Arial, sans-serif" font-size="15" font-weight="700" letter-spacing="4">SHARED TRAIL POSTER</text>
        <text x="0" y="172" fill="#1C1917" font-family="Playfair Display, Georgia, serif" font-size="66" font-weight="700">${titleSvg}</text>
        <text x="2" y="${titleLines.length > 1 ? 288 : 232}" fill="#57534E" font-family="Inter, Arial, sans-serif" font-size="27">${escapeXml(subtitle)}</text>
        ${stats ? `<text x="2" y="${titleLines.length > 1 ? 350 : 294}" fill="#1C1917" font-family="Space Grotesk, Arial, sans-serif" font-size="30" font-weight="700">${escapeXml(stats)}</text>` : ''}
        <rect x="0" y="374" width="285" height="58" rx="29" fill="#2D6A4F"/>
        <text x="32" y="411" fill="#FFFFFF" font-family="Space Grotesk, Arial, sans-serif" font-size="20" font-weight="700">Order or customize</text>
        <text x="0" y="490" fill="#78716C" font-family="Inter, Arial, sans-serif" font-size="18">${escapeXml(`${SITE_URL}/map/${id}`)}</text>
      </g>
    </svg>
  `

  const image = sharp(Buffer.from(svg))
  if (poster) {
    image.composite([{ input: poster, left: 95, top: 68 }])
  }

  const output = await image
    .jpeg({ quality: 90, mozjpeg: true })
    .toBuffer()

  setHeader(event, 'content-type', 'image/jpeg')
  setHeader(event, 'cache-control', 'public, max-age=300, s-maxage=3600')
  return output
})
