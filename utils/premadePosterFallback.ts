import type { PremadeMap } from '~/types'

type Point = { x: number; y: number }

type SvgBox = {
  x: number
  y: number
  w: number
  h: number
}

const DEFAULT_VIEWBOX = { width: 600, height: 900 }

function escapeSvg(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&apos;',
  }[char] || char))
}

function firstLineCoordinates(geojson?: GeoJSON.FeatureCollection | null): number[][] | null {
  const features = Array.isArray(geojson?.features) ? geojson!.features : []
  for (const feature of features) {
    const geometry = feature?.geometry as GeoJSON.Geometry | null | undefined
    if (!geometry) continue
    if (geometry.type === 'LineString' && Array.isArray(geometry.coordinates)) {
      return geometry.coordinates as number[][]
    }
    if (geometry.type === 'MultiLineString' && Array.isArray(geometry.coordinates)) {
      return (geometry.coordinates as number[][][]).flat()
    }
  }
  return null
}

function projectCoordinates(coords: number[][], bbox: unknown, box: SvgBox, maxPoints = 240): Point[] {
  if (!Array.isArray(bbox) || bbox.length < 4) return []
  const [minLng, minLat, maxLng, maxLat] = bbox.map(Number)
  if (![minLng, minLat, maxLng, maxLat].every(Number.isFinite)) return []

  const lngRange = Math.max(maxLng - minLng, 0.0001)
  const latRange = Math.max(maxLat - minLat, 0.0001)
  const scale = Math.min(box.w / lngRange, box.h / latRange)
  const fittedW = lngRange * scale
  const fittedH = latRange * scale
  const offsetX = box.x + (box.w - fittedW) / 2
  const offsetY = box.y + (box.h - fittedH) / 2
  const stride = Math.max(1, Math.floor(coords.length / maxPoints))
  const points: Point[] = []

  for (let i = 0; i < coords.length; i += stride) {
    const [lng, lat] = coords[i].map(Number)
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue
    points.push({
      x: offsetX + (lng - minLng) * scale,
      y: offsetY + (maxLat - lat) * scale,
    })
  }

  return points
}

function pathFromPoints(points: Point[]): string {
  return points.map((point, index) =>
    `${index === 0 ? 'M' : 'L'}${point.x.toFixed(1)} ${point.y.toFixed(1)}`,
  ).join(' ')
}

function contourPaths(box: SvgBox): string {
  const paths: string[] = []
  for (let i = 0; i < 28; i += 1) {
    const y = box.y - 30 + i * 24
    const phase = (i % 5) * 18
    paths.push(
      `<path d="M${box.x - 40} ${y.toFixed(1)} C${(box.x + 70 + phase).toFixed(1)} ${(y - 30).toFixed(1)} ${(box.x + 210 - phase).toFixed(1)} ${(y + 36).toFixed(1)} ${(box.x + 310).toFixed(1)} ${y.toFixed(1)} S${(box.x + 520 + phase).toFixed(1)} ${(y - 28).toFixed(1)} ${(box.x + box.w + 44).toFixed(1)} ${(y + 12).toFixed(1)}"/>`,
    )
  }
  for (let i = 0; i < 13; i += 1) {
    const x = box.x - 20 + i * 48
    paths.push(
      `<path d="M${x.toFixed(1)} ${box.y - 28} C${(x + 32).toFixed(1)} ${(box.y + 100).toFixed(1)} ${(x - 36).toFixed(1)} ${(box.y + 300).toFixed(1)} ${(x + 18).toFixed(1)} ${(box.y + box.h + 32).toFixed(1)}"/>`,
    )
  }
  return paths.join('')
}

function roadTexture(box: SvgBox, color: string): string {
  const lines = [
    [box.x - 20, box.y + box.h * 0.16, box.x + box.w + 30, box.y + box.h * 0.28],
    [box.x - 30, box.y + box.h * 0.42, box.x + box.w + 20, box.y + box.h * 0.35],
    [box.x + box.w * 0.13, box.y - 16, box.x + box.w * 0.65, box.y + box.h + 20],
    [box.x + box.w * 0.76, box.y - 20, box.x + box.w * 0.24, box.y + box.h + 28],
    [box.x - 24, box.y + box.h * 0.72, box.x + box.w + 18, box.y + box.h * 0.64],
  ]
  return lines
    .map(([x1, y1, x2, y2]) => `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${escapeSvg(color)}" stroke-width="2.2" opacity="0.32"/>`)
    .join('')
}

function formatMiles(distanceKm?: number): string {
  if (!Number.isFinite(distanceKm)) return ''
  return `${Math.round(Number(distanceKm) * 0.621371).toLocaleString()} mi`
}

function formatGain(elevationM?: number): string {
  if (!Number.isFinite(elevationM)) return ''
  return `${Math.round(Number(elevationM) * 3.28084).toLocaleString()}'`
}

export function buildPremadePosterFallbackSvg(premade: PremadeMap): string | null {
  const coords = firstLineCoordinates(premade.geojson)
  if (!coords || coords.length < 2) return null

  const width = DEFAULT_VIEWBOX.width
  const height = DEFAULT_VIEWBOX.height
  const style = premade.style_config || {}
  const background = style.background_color || '#F7F4EF'
  const labelBg = style.label_bg_color || '#111827'
  const labelText = style.label_text_color || '#F8FAFC'
  const land = style.land_color || background
  const water = style.water_color || '#9CC9CF'
  const contour = style.contour_color || '#A8BDAF'
  const route = style.route_color || '#C1121F'
  const titleFont = style.font_family || 'Space Grotesk'
  const bodyFont = style.body_font_family || 'Space Grotesk'

  const margin = 38
  const titleBand = 112
  const footerBand = 86
  const mapBox = {
    x: margin,
    y: titleBand,
    w: width - margin * 2,
    h: height - titleBand - footerBand - margin,
  }
  const points = projectCoordinates(coords, premade.bbox, {
    x: mapBox.x + 30,
    y: mapBox.y + 36,
    w: mapBox.w - 60,
    h: mapBox.h - 72,
  })
  if (points.length < 2) return null

  const routePath = pathFromPoints(points)
  const start = points[0]
  const end = points[points.length - 1]
  const miles = formatMiles(premade.stats?.distance_km)
  const gain = formatGain(premade.stats?.elevation_gain_m)
  const location = style.location_text || premade.region || premade.stats?.location || ''
  const subtitle = premade.subtitle || style.occasion_text || ''

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">`,
    `<rect width="${width}" height="${height}" fill="${escapeSvg(background)}"/>`,
    `<rect x="${margin}" y="${margin}" width="${width - margin * 2}" height="${height - margin * 2}" fill="${escapeSvg(land)}"/>`,
    `<rect x="${margin}" y="${margin}" width="${width - margin * 2}" height="${titleBand - margin}" fill="${escapeSvg(labelBg)}"/>`,
    `<rect x="${margin}" y="${height - footerBand - margin}" width="${width - margin * 2}" height="${footerBand}" fill="${escapeSvg(labelBg)}"/>`,
    `<clipPath id="mapClip"><rect x="${mapBox.x}" y="${mapBox.y}" width="${mapBox.w}" height="${mapBox.h}"/></clipPath>`,
    `<g clip-path="url(#mapClip)">`,
    `<rect x="${mapBox.x}" y="${mapBox.y}" width="${mapBox.w}" height="${mapBox.h}" fill="${escapeSvg(land)}"/>`,
    `<path d="M${mapBox.x + mapBox.w * 0.72} ${mapBox.y - 20} C${mapBox.x + mapBox.w * 0.62} ${mapBox.y + mapBox.h * 0.25} ${mapBox.x + mapBox.w * 0.84} ${mapBox.y + mapBox.h * 0.48} ${mapBox.x + mapBox.w * 0.66} ${mapBox.y + mapBox.h + 30} L${mapBox.x + mapBox.w + 40} ${mapBox.y + mapBox.h + 40} L${mapBox.x + mapBox.w + 40} ${mapBox.y - 40} Z" fill="${escapeSvg(water)}" opacity="0.58"/>`,
    `<g stroke="${escapeSvg(contour)}" stroke-width="1.1" fill="none" opacity="0.46">${contourPaths(mapBox)}</g>`,
    `<g>${roadTexture(mapBox, labelText)}</g>`,
    `<path d="${routePath}" fill="none" stroke="#1c1917" stroke-width="9" stroke-linecap="round" stroke-linejoin="round" opacity="0.82"/>`,
    `<path d="${routePath}" fill="none" stroke="${escapeSvg(route)}" stroke-width="5.2" stroke-linecap="round" stroke-linejoin="round"/>`,
    `<circle cx="${start.x.toFixed(1)}" cy="${start.y.toFixed(1)}" r="7" fill="${escapeSvg(route)}" stroke="#fff" stroke-width="2.2"/>`,
    `<circle cx="${end.x.toFixed(1)}" cy="${end.y.toFixed(1)}" r="7" fill="#fff" stroke="${escapeSvg(route)}" stroke-width="3"/>`,
    '</g>',
    `<text x="${width / 2}" y="80" text-anchor="middle" font-family="${escapeSvg(titleFont)}, Arial, sans-serif" font-size="34" font-weight="800" letter-spacing="1.5" fill="${escapeSvg(labelText)}">${escapeSvg(premade.title)}</text>`,
    subtitle ? `<text x="${width / 2}" y="106" text-anchor="middle" font-family="${escapeSvg(bodyFont)}, Arial, sans-serif" font-size="11" font-weight="700" letter-spacing="3" fill="${escapeSvg(labelText)}" opacity="0.66">${escapeSvg(subtitle)}</text>` : '',
    `<text x="${margin + 34}" y="${height - 72}" font-family="${escapeSvg(bodyFont)}, Arial, sans-serif" font-size="12" font-weight="700" letter-spacing="1.6" fill="${escapeSvg(labelText)}" opacity="0.58">DISTANCE</text>`,
    `<text x="${margin + 34}" y="${height - 48}" font-family="${escapeSvg(titleFont)}, Arial, sans-serif" font-size="22" font-weight="800" fill="${escapeSvg(labelText)}">${escapeSvg(miles)}</text>`,
    `<text x="${margin + 150}" y="${height - 72}" font-family="${escapeSvg(bodyFont)}, Arial, sans-serif" font-size="12" font-weight="700" letter-spacing="1.6" fill="${escapeSvg(labelText)}" opacity="0.58">GAIN</text>`,
    `<text x="${margin + 150}" y="${height - 48}" font-family="${escapeSvg(titleFont)}, Arial, sans-serif" font-size="22" font-weight="800" fill="${escapeSvg(labelText)}">${escapeSvg(gain)}</text>`,
    `<text x="${width / 2}" y="${height - 50}" text-anchor="middle" font-family="${escapeSvg(bodyFont)}, Arial, sans-serif" font-size="15" font-weight="700" letter-spacing="1.6" fill="${escapeSvg(route)}">${escapeSvg(location)}</text>`,
    `<text x="${width - margin - 34}" y="${height - 50}" text-anchor="end" font-family="${escapeSvg(bodyFont)}, Arial, sans-serif" font-size="11" font-weight="800" letter-spacing="2" fill="${escapeSvg(labelText)}" opacity="0.48">RADMAPS</text>`,
    '</svg>',
  ].join('')
}

export function buildPremadePosterFallbackDataUrl(premade: PremadeMap): string | null {
  const svg = buildPremadePosterFallbackSvg(premade)
  return svg ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}` : null
}
