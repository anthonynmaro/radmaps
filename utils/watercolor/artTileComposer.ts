import sharp from 'sharp'
import { WATERCOLOR_TILE_SIZE } from './constants'
import { defaultWatercolorTexturePack } from './texturePack'
import { fbmNoise2D, hashString } from './seed'
import type {
  WatercolorComposeOptions,
  WatercolorFeature,
  WatercolorGeometry,
  WatercolorPalette,
  WatercolorPoint,
  WatercolorRawImage,
  WatercolorTexturePack,
} from './types'

type TileWorldOrigin = {
  x: number
  y: number
}

const DEFAULT_PALETTE: WatercolorPalette = {
  paper: '#eee5cd',
  water: '#38b8d0',
  waterEdge: '#0e7f98',
  park: '#98bf8a',
  parkEdge: '#789a6b',
  roadMajor: '#c87938',
  roadMinor: '#d0b171',
  roadEdge: '#864820',
  trail: '#6f6b50',
  waterway: '#14a9c8',
  building: '#74685c',
}

function hexColor(value: string): [number, number, number] {
  const normalized = value.startsWith('#') ? value.slice(1) : value
  const int = parseInt(normalized.padEnd(6, '0').slice(0, 6), 16)
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255]
}

function mixColor(a: [number, number, number], b: [number, number, number], t: number): [number, number, number] {
  const inv = 1 - t
  return [
    Math.round(a[0] * inv + b[0] * t),
    Math.round(a[1] * inv + b[1] * t),
    Math.round(a[2] * inv + b[2] * t),
  ]
}

function rgbHex(color: [number, number, number]) {
  return `#${color.map(value => value.toString(16).padStart(2, '0')).join('')}`
}

function clampByte(value: number) {
  return Math.max(0, Math.min(255, Math.round(value)))
}

function blendPixel(data: Uint8ClampedArray, index: number, color: [number, number, number], alpha: number) {
  if (alpha <= 0) return
  const a = Math.min(1, alpha)
  const inv = 1 - a
  data[index] = clampByte(color[0] * a + data[index] * inv)
  data[index + 1] = clampByte(color[1] * a + data[index + 1] * inv)
  data[index + 2] = clampByte(color[2] * a + data[index + 2] * inv)
  data[index + 3] = 255
}

function multiplyPixel(data: Uint8ClampedArray, index: number, color: [number, number, number], alpha: number) {
  if (alpha <= 0) return
  const a = Math.min(1, alpha)
  const inv = 1 - a
  data[index] = clampByte(data[index] * inv + data[index] * (color[0] / 255) * a)
  data[index + 1] = clampByte(data[index + 1] * inv + data[index + 1] * (color[1] / 255) * a)
  data[index + 2] = clampByte(data[index + 2] * inv + data[index + 2] * (color[2] / 255) * a)
}

async function loadRawImage(file: string, width: number, height: number): Promise<WatercolorRawImage> {
  const { data, info } = await sharp(file)
    .resize(width, height, { fit: 'cover' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  return {
    data: new Uint8ClampedArray(data),
    width: info.width,
    height: info.height,
    channels: info.channels,
  }
}

async function loadTexture(file: string, width = 840, height = 320) {
  const { data, info } = await sharp(file)
    .resize(width, height, { fit: 'cover' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  return {
    data: new Uint8ClampedArray(data),
    width: info.width,
    height: info.height,
  }
}

function textureDarkness(
  texture: Awaited<ReturnType<typeof loadTexture>>,
  x: number,
  y: number,
  seed: number,
) {
  const tx = ((Math.floor(x) + seed * 43) % texture.width + texture.width) % texture.width
  const ty = ((Math.floor(y) + seed * 67) % texture.height + texture.height) % texture.height
  const index = (ty * texture.width + tx) * 3
  const luminance = texture.data[index] * 0.299 + texture.data[index + 1] * 0.587 + texture.data[index + 2] * 0.114
  return Math.max(0, Math.min(1, (250 - luminance) / 160))
}

function pathFromLine(points: WatercolorPoint[]) {
  if (points.length < 2) return ''
  let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`
  for (let index = 0; index < points.length - 1; index += 1) {
    const p0 = points[Math.max(0, index - 1)]
    const p1 = points[index]
    const p2 = points[index + 1]
    const p3 = points[Math.min(points.length - 1, index + 2)]
    const tension = 0.62
    const c1x = p1.x + (p2.x - p0.x) * tension / 6
    const c1y = p1.y + (p2.y - p0.y) * tension / 6
    const c2x = p2.x - (p3.x - p1.x) * tension / 6
    const c2y = p2.y - (p3.y - p1.y) * tension / 6
    d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`
  }
  return d
}

function pathFromRing(points: WatercolorPoint[]) {
  if (!points.length) return ''
  const commands = [`M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`]
  for (let index = 1; index < points.length; index += 1) {
    commands.push(`L ${points[index].x.toFixed(1)} ${points[index].y.toFixed(1)}`)
  }
  commands.push('Z')
  return commands.join(' ')
}

function lineSvg(lines: WatercolorPoint[][], width: number, options: { cap?: string, dash?: string } = {}) {
  const cap = options.cap || 'butt'
  const dash = options.dash ? `stroke-dasharray="${options.dash}"` : ''
  return lines
    .filter(line => line.length > 1)
    .map(line => `<path d="${pathFromLine(line)}" fill="none" stroke="#000" stroke-width="${width}" stroke-linecap="${cap}" stroke-linejoin="round" ${dash}/>`)
    .join('\n')
}

function polygonSvg(features: WatercolorFeature[]) {
  return features
    .flatMap(feature => feature.rings.length ? [feature.rings] : [])
    .map(rings => `<path d="${rings.map(pathFromRing).join(' ')}" fill="#000" fill-rule="evenodd"/>`)
    .join('\n')
}

function polygonStrokeSvg(features: WatercolorFeature[], width: number) {
  return features
    .flatMap(feature => feature.rings)
    .filter(ring => ring.length > 1)
    .map(ring => `<path d="${pathFromRing(ring)}" fill="none" stroke="#000" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`)
    .join('\n')
}

function blobSvg(x: number, y: number, rx: number, ry: number, seed: string) {
  const points: string[] = []
  const hash = hashString(seed)
  for (let index = 0; index < 34; index += 1) {
    const angle = index / 34 * Math.PI * 2
    const wobble = 0.7 + ((hashString(`${hash}:${index}`) / 0xffffffff) * 0.55)
    points.push(`${(x + Math.cos(angle) * rx * wobble).toFixed(1)} ${(y + Math.sin(angle) * ry * wobble).toFixed(1)}`)
  }
  return `<path d="M ${points.join(' L ')} Z" fill="#000"/>`
}

async function alphaMask(svgBody: string, tileSize: number, blur = 0) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${tileSize}" height="${tileSize}" viewBox="0 0 ${tileSize} ${tileSize}">${svgBody}</svg>`
  let image = sharp(Buffer.from(svg)).ensureAlpha()
  if (blur >= 0.3) image = image.blur(blur)
  const { data } = await image.raw().toBuffer({ resolveWithObject: true })
  const raw = new Uint8ClampedArray(data)
  const mask = new Uint8ClampedArray(tileSize * tileSize)
  for (let index = 0, alphaIndex = 3; index < mask.length; index += 1, alphaIndex += 4) {
    mask[index] = raw[alphaIndex]
  }
  return mask
}

function maskRing(outer: Uint8ClampedArray, inner: Uint8ClampedArray) {
  const result = new Uint8ClampedArray(outer.length)
  for (let index = 0; index < result.length; index += 1) {
    result[index] = Math.max(0, outer[index] - inner[index])
  }
  return result
}

function intersectMask(a: Uint8ClampedArray, b: Uint8ClampedArray) {
  const result = new Uint8ClampedArray(a.length)
  for (let index = 0; index < result.length; index += 1) {
    result[index] = Math.min(a[index], b[index])
  }
  return result
}

function maskAlphaCoverage(mask: Uint8ClampedArray) {
  let total = 0
  for (let index = 0; index < mask.length; index += 1) total += mask[index] / 255
  return total / mask.length
}

function maskContains(mask: Uint8ClampedArray, tileSize: number, x: number, y: number) {
  const ix = Math.max(0, Math.min(tileSize - 1, Math.round(x)))
  const iy = Math.max(0, Math.min(tileSize - 1, Math.round(y)))
  return mask[iy * tileSize + ix] > 20
}

function zoomDetailFactor(z: number) {
  return Math.max(0, Math.min(1, (z - 10) / 5))
}

function subtractMask(a: Uint8ClampedArray, b: Uint8ClampedArray, amount = 0.8) {
  const result = new Uint8ClampedArray(a.length)
  for (let index = 0; index < result.length; index += 1) {
    result[index] = Math.max(0, a[index] - b[index] * amount)
  }
  return result
}

function paintMask(
  target: Uint8ClampedArray,
  mask: Uint8ClampedArray,
  color: [number, number, number],
  opacity: number,
  seed: string,
  options: {
    texture?: Awaited<ReturnType<typeof loadTexture>>
    textureAmount?: number
    noise?: number
    baseDensity?: number
    multiply?: boolean
    worldOrigin?: TileWorldOrigin
  } = {},
) {
  const tileSize = Math.sqrt(mask.length)
  const seedNumber = hashString(seed)
  const worldOrigin = options.worldOrigin || { x: 0, y: 0 }
  for (let y = 0; y < tileSize; y += 1) {
    for (let x = 0; x < tileSize; x += 1) {
      const maskIndex = y * tileSize + x
      const alpha = mask[maskIndex] / 255
      if (alpha <= 0) continue
      const worldX = worldOrigin.x + x
      const worldY = worldOrigin.y + y
      let density = options.baseDensity ?? 0.72
      density += (fbmNoise2D(worldX, worldY, seedNumber) - 0.5) * (options.noise ?? 0.16)
      if (options.texture) {
        density += textureDarkness(options.texture, worldX * 0.56 + worldY * 0.12, worldY * 0.84, seedNumber) * (options.textureAmount ?? 0.18)
      }
      const finalAlpha = alpha * opacity * Math.max(0.04, Math.min(1.35, density))
      const pixelIndex = maskIndex * 4
      if (options.multiply) multiplyPixel(target, pixelIndex, color, finalAlpha)
      else blendPixel(target, pixelIndex, color, finalAlpha)
    }
  }
}

function featureBounds(features: WatercolorFeature[]) {
  const points = features.flatMap(feature => [...feature.rings.flat(), ...feature.lines.flat()])
  if (!points.length) return null
  return points.reduce((bounds, point) => ({
    minX: Math.min(bounds.minX, point.x),
    minY: Math.min(bounds.minY, point.y),
    maxX: Math.max(bounds.maxX, point.x),
    maxY: Math.max(bounds.maxY, point.y),
  }), { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity })
}

function roadJunctionNodes(lines: WatercolorPoint[][], tileSize: number, seed: string) {
  const buckets = new Map<string, { x: number, y: number, count: number }>()
  const bucketSize = 42
  for (const line of lines) {
    for (const point of line) {
      if (point.x < -64 || point.y < -64 || point.x > tileSize + 64 || point.y > tileSize + 64) continue
      const key = `${Math.round(point.x / bucketSize)},${Math.round(point.y / bucketSize)}`
      const bucket = buckets.get(key) || { x: 0, y: 0, count: 0 }
      bucket.x += point.x
      bucket.y += point.y
      bucket.count += 1
      buckets.set(key, bucket)
    }
  }

  return [...buckets.values()]
    .filter(bucket => bucket.count >= 3)
    .slice(0, 16)
    .map((bucket, index) => ({
      x: bucket.x / bucket.count,
      y: bucket.y / bucket.count,
      seed: `${seed}:junction:${index}:${Math.round(bucket.x)}:${Math.round(bucket.y)}`,
    }))
}

async function paintLines(
  target: Uint8ClampedArray,
  lines: WatercolorPoint[][],
  tileSize: number,
  config: {
    width: number
    edge: number
    center: number
    color: string
    under: string
    edgeColor: string
    centerColor: string
    opacity: number
    seed: string
    cap?: string
    dash?: string
    texture?: Awaited<ReturnType<typeof loadTexture>>
    worldOrigin?: TileWorldOrigin
  },
) {
  if (!lines.length) return
  const outer = await alphaMask(lineSvg(lines, config.width + config.edge * 2, { cap: config.cap, dash: config.dash }), tileSize, 0.22)
  const body = await alphaMask(lineSvg(lines, config.width, { cap: config.cap, dash: config.dash }), tileSize, 0.08)
  const center = await alphaMask(lineSvg(lines, config.center, { cap: config.cap, dash: config.dash }), tileSize, 0.04)
  const edge = maskRing(outer, body)
  paintMask(target, outer, hexColor(config.under), config.opacity * 0.52, `${config.seed}:under`, {
    texture: config.texture,
    textureAmount: 0.08,
    noise: 0.06,
    baseDensity: 0.62,
    worldOrigin: config.worldOrigin,
  })
  paintMask(target, body, hexColor(config.color), config.opacity, `${config.seed}:body`, {
    texture: config.texture,
    textureAmount: 0.16,
    noise: 0.09,
    baseDensity: 0.74,
    worldOrigin: config.worldOrigin,
  })
  paintMask(target, edge, hexColor(config.edgeColor), config.opacity * 0.34, `${config.seed}:edge`, {
    texture: config.texture,
    textureAmount: 0.24,
    noise: 0.18,
    baseDensity: 0.48,
    multiply: true,
    worldOrigin: config.worldOrigin,
  })
  paintMask(target, center, hexColor(config.centerColor), config.opacity * 0.13, `${config.seed}:center`, {
    texture: config.texture,
    textureAmount: 0.02,
    noise: 0.03,
    baseDensity: 0.3,
    worldOrigin: config.worldOrigin,
  })
}

async function composeBasePaper(
  tileSize: number,
  seed: string,
  texturePack: WatercolorTexturePack,
  worldOrigin: TileWorldOrigin,
) {
  const clean = await loadRawImage(texturePack.paperClean, tileSize, tileSize)
  const aged = await loadRawImage(texturePack.paperAged, tileSize, tileSize)
  const stains = await loadRawImage(texturePack.stains, tileSize, tileSize)
  const target = new Uint8ClampedArray(tileSize * tileSize * 4)
  const paperBase = hexColor('#f0e7d2')

  for (let index = 0; index < target.length; index += 4) {
    const pixel = index / 4
    const x = pixel % tileSize
    const y = Math.floor(pixel / tileSize)
    const worldX = worldOrigin.x + x
    const worldY = worldOrigin.y + y
    const noise = fbmNoise2D(worldX, worldY, `${seed}:paper`)
    const cleanLuminance = clean.data[index] * 0.299 + clean.data[index + 1] * 0.587 + clean.data[index + 2] * 0.114
    const agedLuminance = aged.data[index] * 0.299 + aged.data[index + 1] * 0.587 + aged.data[index + 2] * 0.114
    const tooth = ((cleanLuminance - 232) * 0.22) + ((agedLuminance - 231) * 0.06)
    target[index] = clampByte(paperBase[0] + tooth + (noise - 0.5) * 3.6)
    target[index + 1] = clampByte(paperBase[1] + tooth + (noise - 0.5) * 2.8)
    target[index + 2] = clampByte(paperBase[2] + tooth + (noise - 0.5) * 2.2)
    target[index + 3] = 255

    const stainLuminance = stains.data[index] * 0.299 + stains.data[index + 1] * 0.587 + stains.data[index + 2] * 0.114
    const stainAlpha = Math.max(0, (220 - stainLuminance) / 255) * 0.018
    if (stainAlpha > 0.001) multiplyPixel(target, index, hexColor('#d4c093'), stainAlpha)
  }

  return target
}

export async function composeWatercolorArtTile(
  geometry: WatercolorGeometry,
  options: WatercolorComposeOptions,
) {
  const tileSize = options.tileSize || geometry.tileSize || WATERCOLOR_TILE_SIZE
  const seed = options.seed || 'radmaps-watercolor'
  const texturePack = {
    ...defaultWatercolorTexturePack(),
    ...(options.texturePack || {}),
  }
  const palette = {
    ...DEFAULT_PALETTE,
    ...(options.palette || {}),
  }
  const waterBase = hexColor(palette.water)
  palette.waterEdge = options.palette?.waterEdge || rgbHex(mixColor(waterBase, hexColor('#1d7283'), 0.5))
  const saturatedWater = mixColor(waterBase, hexColor('#00bfe8'), 0.58)
  const deepWater = mixColor(waterBase, hexColor('#007fa4'), 0.48)
  const zoomDetail = zoomDetailFactor(geometry.requestTile.z)
  const lowZoom = 1 - zoomDetail
  const worldOrigin = {
    x: geometry.requestTile.x * tileSize,
    y: geometry.requestTile.y * tileSize,
  }
  const target = await composeBasePaper(tileSize, seed, texturePack, worldOrigin)
  const blueWash = await loadRawImage(texturePack.blueWash, tileSize, tileSize)
  const greenWash = await loadRawImage(texturePack.greenWash, tileSize, tileSize)
  const granulation = await loadTexture(texturePack.granulation, 720, 720)
  const majorTexture = await loadTexture(texturePack.roadMajor, 860, 320)
  const minorTexture = await loadTexture(texturePack.roadMinor, 800, 300)
  const trailTexture = await loadTexture(texturePack.trailWaterway, 800, 300)
  const bloomTexture = await loadTexture(texturePack.blooms, 900, 900)

  const waterFeatures = geometry.features.filter(feature => feature.group === 'water')
  const parkFeatures = geometry.features.filter(feature => feature.group === 'park')
  const buildingFeatures = geometry.features.filter(feature => feature.group === 'building')
  const waterwayLines = geometry.features.filter(feature => feature.group === 'waterway').flatMap(feature => feature.lines)
  const majorRoadLines = geometry.features.filter(feature => feature.group === 'road-major').flatMap(feature => feature.lines)
  const minorRoadLines = geometry.features.filter(feature => feature.group === 'road-minor').flatMap(feature => feature.lines)
  const trailLines = geometry.features.filter(feature => feature.group === 'trail').flatMap(feature => feature.lines)

  const waterMask = await alphaMask(polygonSvg(waterFeatures), tileSize, 0.35)
  const waterBleed = await alphaMask(polygonStrokeSvg(waterFeatures, 24), tileSize, 0.9)
  const waterEdge = await alphaMask(polygonStrokeSvg(waterFeatures, 8), tileSize, 0.35)
  const parkMask = await alphaMask(polygonSvg(parkFeatures), tileSize, 0.35)
  const parkEdge = await alphaMask(polygonStrokeSvg(parkFeatures, 6), tileSize, 0.35)

  paintMask(target, waterBleed, hexColor(palette.water), 0.045, `${seed}:water-bleed`, {
    texture: bloomTexture,
    textureAmount: 0.06,
    noise: 0.15,
    baseDensity: 0.34,
    worldOrigin,
  })

  for (let y = 0; y < tileSize; y += 1) {
    for (let x = 0; x < tileSize; x += 1) {
      const maskIndex = y * tileSize + x
      const pixelIndex = maskIndex * 4
      const worldX = worldOrigin.x + x
      const worldY = worldOrigin.y + y
      if (parkMask[maskIndex]) {
        const alpha = parkMask[maskIndex] / 255
        const density = 0.62 + fbmNoise2D(worldX, worldY, `${seed}:park`) * 0.16 + textureDarkness(granulation, worldX * 0.8, worldY * 0.8, 3) * 0.14
        const wash = [
          Math.round(greenWash.data[pixelIndex] * 0.3 + hexColor(palette.park)[0] * 0.7),
          Math.round(greenWash.data[pixelIndex + 1] * 0.36 + hexColor(palette.park)[1] * 0.64),
          Math.round(greenWash.data[pixelIndex + 2] * 0.28 + hexColor(palette.park)[2] * 0.72),
        ] as [number, number, number]
        blendPixel(target, pixelIndex, wash, alpha * 0.10 * density)
      }
      if (waterMask[maskIndex]) {
        const alpha = waterMask[maskIndex] / 255
        const density = 0.82 + fbmNoise2D(worldX, worldY, `${seed}:water`) * 0.2 + textureDarkness(granulation, worldX * 0.95, worldY * 0.95, 9) * 0.25
        const waterColor = hexColor(palette.water)
        const wash = [
          Math.round(blueWash.data[pixelIndex] * 0.34 + waterColor[0] * 0.66),
          Math.round(blueWash.data[pixelIndex + 1] * 0.46 + waterColor[1] * 0.54),
          Math.round(blueWash.data[pixelIndex + 2] * 0.54 + waterColor[2] * 0.46),
        ] as [number, number, number]
        blendPixel(target, pixelIndex, wash, alpha * 0.34 * density)
      }
    }
  }

  const waterCoverage = maskAlphaCoverage(waterMask)
  const waterBounds = featureBounds(waterFeatures)
  if (waterBounds) {
    const bloomCount = Math.min(9, Math.max(2, Math.round(waterCoverage * 28), Math.min(5, waterFeatures.length + 1)))
    for (let index = 0; index < bloomCount; index += 1) {
      const localSeed = `${seed}:water-bloom:${index}`
      const tX = hashString(`${localSeed}:x`) / 0xffffffff
      const tY = hashString(`${localSeed}:y`) / 0xffffffff
      const x = waterBounds.minX + (waterBounds.maxX - waterBounds.minX) * tX
      const y = waterBounds.minY + (waterBounds.maxY - waterBounds.minY) * tY
      const blob = await alphaMask(blobSvg(x, y, tileSize * 0.085, tileSize * 0.04, localSeed), tileSize, 0.6)
      paintMask(target, intersectMask(blob, waterMask), hexColor(palette.water), 0.13, localSeed, {
        texture: bloomTexture,
        textureAmount: 0.06,
        noise: 0.18,
        baseDensity: 0.55,
        worldOrigin,
      })
    }
    const splashCount = Math.min(6, Math.max(1, Math.round(waterCoverage * 16)))
    let placedSplashes = 0
    for (let attempt = 0; attempt < splashCount * 9 && placedSplashes < splashCount; attempt += 1) {
      const localSeed = `${seed}:water-splash:${attempt}`
      const tX = hashString(`${localSeed}:x`) / 0xffffffff
      const tY = hashString(`${localSeed}:y`) / 0xffffffff
      const x = waterBounds.minX + (waterBounds.maxX - waterBounds.minX) * tX
      const y = waterBounds.minY + (waterBounds.maxY - waterBounds.minY) * tY
      if (!maskContains(waterMask, tileSize, x, y)) continue
      const sizeJitter = 0.75 + (hashString(`${localSeed}:size`) / 0xffffffff) * 0.7
      const blob = await alphaMask(blobSvg(x, y, tileSize * 0.036 * sizeJitter, tileSize * 0.024 * sizeJitter, localSeed), tileSize, 0.4)
      const clipped = intersectMask(blob, waterMask)
      paintMask(target, clipped, saturatedWater, 0.25, localSeed, {
        texture: bloomTexture,
        textureAmount: 0.08,
        noise: 0.22,
        baseDensity: 0.76,
        worldOrigin,
      })
      const center = await alphaMask(blobSvg(x, y, tileSize * 0.012 * sizeJitter, tileSize * 0.008 * sizeJitter, `${localSeed}:core`), tileSize, 0)
      paintMask(target, intersectMask(center, waterMask), deepWater, 0.22, `${localSeed}:core`, {
        texture: granulation,
        textureAmount: 0.12,
        noise: 0.12,
        baseDensity: 0.72,
        worldOrigin,
      })
      const ringOuter = await alphaMask(blobSvg(x, y, tileSize * 0.052 * sizeJitter, tileSize * 0.035 * sizeJitter, `${localSeed}:ring`), tileSize, 0.35)
      const ring = intersectMask(maskRing(ringOuter, blob), waterMask)
      paintMask(target, ring, deepWater, 0.075, `${localSeed}:ring`, {
        texture: bloomTexture,
        textureAmount: 0.06,
        noise: 0.2,
        baseDensity: 0.5,
        multiply: true,
        worldOrigin,
      })
      placedSplashes += 1
    }
  }

  paintMask(target, waterEdge, hexColor(palette.waterEdge), 0.07, `${seed}:water-edge`, {
    texture: granulation,
    textureAmount: 0.2,
    noise: 0.18,
    baseDensity: 0.48,
    multiply: true,
    worldOrigin,
  })
  paintMask(target, parkEdge, hexColor(palette.parkEdge), 0.045, `${seed}:park-edge`, {
    texture: granulation,
    textureAmount: 0.12,
    noise: 0.12,
    baseDensity: 0.36,
    multiply: true,
    worldOrigin,
  })

  await paintLines(target, minorRoadLines, tileSize, {
    width: 5.8 + zoomDetail * 3.7,
    edge: 1.4 + zoomDetail * 1.0,
    center: 0.9 + zoomDetail * 0.8,
    seed: `${seed}:minor-roads`,
    under: '#efc36f',
    color: rgbHex(mixColor(hexColor(palette.roadMinor), hexColor('#cf7629'), 0.34)),
    edgeColor: palette.roadEdge,
    centerColor: '#fff3ce',
    opacity: 0.30 + zoomDetail * 0.04,
    texture: minorTexture,
    worldOrigin,
  })
  await paintLines(target, majorRoadLines, tileSize, {
    width: 9.8 + zoomDetail * 6.2,
    edge: 2.0 + zoomDetail * 1.4,
    center: 1.5 + zoomDetail * 1.1,
    seed: `${seed}:major-roads`,
    under: '#e99344',
    color: rgbHex(mixColor(hexColor(palette.roadMajor), hexColor('#bd5f18'), 0.36)),
    edgeColor: palette.roadEdge,
    centerColor: '#fff0c8',
    opacity: 0.45 + zoomDetail * 0.04,
    texture: majorTexture,
    worldOrigin,
  })
  await paintLines(target, trailLines, tileSize, {
    width: 2.8 + zoomDetail * 1.2,
    edge: 0.9 + zoomDetail * 0.5,
    center: 0.45 + zoomDetail * 0.35,
    seed: `${seed}:trails`,
    under: '#8f8868',
    color: palette.trail,
    edgeColor: '#4f4c3a',
    centerColor: '#f6ebc9',
    opacity: 0.18 + zoomDetail * 0.06,
    cap: 'round',
    dash: '34 28',
    texture: trailTexture,
    worldOrigin,
  })
  await paintLines(target, waterwayLines, tileSize, {
    width: 5.0 + zoomDetail * 3.0,
    edge: 1.4 + zoomDetail * 1.1,
    center: 0.65 + zoomDetail * 0.75,
    seed: `${seed}:waterways`,
    under: '#7bd6e6',
    color: palette.waterway,
    edgeColor: palette.waterEdge,
    centerColor: '#dbf7f8',
    opacity: 0.34 + lowZoom * 0.05,
    cap: 'round',
    texture: trailTexture,
    worldOrigin,
  })

  const roadLines = [...majorRoadLines, ...minorRoadLines]
  const roadMask = await alphaMask(lineSvg(roadLines, 15 + zoomDetail * 9), tileSize, 0.2)
  for (const node of roadJunctionNodes(roadLines, tileSize, seed)) {
    const local = await alphaMask(blobSvg(node.x, node.y, 24, 17, node.seed), tileSize, 0.35)
    const pool = intersectMask(local, roadMask)
    const larger = await alphaMask(blobSvg(node.x, node.y, 34, 23, `${node.seed}:spill`), tileSize, 0.55)
    const spill = maskRing(larger, roadMask)
    paintMask(target, pool, hexColor('#985028'), 0.055, node.seed, {
      texture: majorTexture,
      textureAmount: 0.08,
      noise: 0.1,
      baseDensity: 0.82,
      worldOrigin,
    })
    paintMask(target, spill, hexColor('#be7b39'), 0.009, `${node.seed}:spill`, {
      texture: bloomTexture,
      textureAmount: 0.03,
      noise: 0.14,
      baseDensity: 0.38,
      worldOrigin,
    })
  }

  const buildingStroke = await alphaMask(polygonStrokeSvg(buildingFeatures, 2.2), tileSize, 0.25)
  paintMask(target, buildingStroke, hexColor(palette.building), 0.12, `${seed}:buildings`, {
    texture: granulation,
    textureAmount: 0.06,
    noise: 0.1,
    baseDensity: 0.45,
    multiply: true,
    worldOrigin,
  })

  return Buffer.from(target)
}

export async function encodeWatercolorArtTilePng(
  geometry: WatercolorGeometry,
  options: WatercolorComposeOptions,
) {
  const tileSize = options.tileSize || geometry.tileSize || WATERCOLOR_TILE_SIZE
  const raw = await composeWatercolorArtTile(geometry, options)
  return sharp(raw, { raw: { width: tileSize, height: tileSize, channels: 4 } })
    .png()
    .toBuffer()
}
