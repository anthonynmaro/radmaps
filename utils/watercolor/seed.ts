export function hashString(value: string): number {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

export function hashFloat(value: string) {
  return hashString(value) / 0xffffffff
}

export function seededNoise2D(x: number, y: number, seed: string | number) {
  const seedNumber = typeof seed === 'number' ? seed : hashString(seed)
  let n = Math.imul(Math.floor(x), 374761393) + Math.imul(Math.floor(y), 668265263) + seedNumber
  n = (n ^ (n >>> 13)) >>> 0
  n = Math.imul(n, 1274126177) >>> 0
  return ((n ^ (n >>> 16)) >>> 0) / 0xffffffff
}

function smoothstep(value: number) {
  return value * value * (3 - 2 * value)
}

export function smoothNoise2D(x: number, y: number, scale: number, seed: string | number) {
  const ix = Math.floor(x / scale)
  const iy = Math.floor(y / scale)
  const fx = x / scale - ix
  const fy = y / scale - iy
  const sx = smoothstep(fx)
  const sy = smoothstep(fy)
  const a = seededNoise2D(ix, iy, seed)
  const b = seededNoise2D(ix + 1, iy, seed)
  const c = seededNoise2D(ix, iy + 1, seed)
  const d = seededNoise2D(ix + 1, iy + 1, seed)
  return (a * (1 - sx) + b * sx) * (1 - sy) + (c * (1 - sx) + d * sx) * sy
}

export function fbmNoise2D(x: number, y: number, seed: string | number) {
  const seedNumber = typeof seed === 'number' ? seed : hashString(seed)
  return smoothNoise2D(x, y, 220, seedNumber) * 0.5 +
    smoothNoise2D(x, y, 78, seedNumber + 17) * 0.32 +
    smoothNoise2D(x, y, 26, seedNumber + 41) * 0.18
}

export function quantizedGeometrySeed(
  prefix: string,
  points: Array<{ worldX: number, worldY: number }>,
) {
  const sample = points
    .slice(0, 12)
    .map(point => `${Math.round(point.worldX / 8)},${Math.round(point.worldY / 8)}`)
    .join(';')
  return `${prefix}:${sample}:${points.length}`
}
