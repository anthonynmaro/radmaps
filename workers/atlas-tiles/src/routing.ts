import type {
  AtlasArtifactKey,
  AtlasManifest,
  AtlasManifestArtifact,
} from '../../../utils/atlasManifest'
import {
  ATLAS_ARTIFACT_KEYS,
  atlasAllManifestArtifacts,
  atlasArtifactIntersectsBbox,
  findAtlasArtifact,
} from '../../../utils/atlasManifest'

export const APPROVED_ENVIRONMENTS = ['staging', 'production'] as const

export type AtlasTileEnvironment = typeof APPROVED_ENVIRONMENTS[number]

export type ParsedTilePath = {
  environment: AtlasTileEnvironment
  artifactId: string
  z: number
  x: number
  y: number
}

export function isApprovedEnvironment(value: string): value is AtlasTileEnvironment {
  return APPROVED_ENVIRONMENTS.includes(value as AtlasTileEnvironment)
}

function parseNonNegativeInteger(value: string, name: string) {
  const parsed = Number(value.replace(/\.mvt$/, ''))
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`Invalid tile ${name}`)
  }
  return parsed
}

export function parseTileRequestPath(pathname: string): ParsedTilePath | null {
  const parts = pathname.split('/').filter(Boolean)
  if (parts.length !== 6 || parts[0] !== 'tiles') return null

  const [, environment, artifactId, zPart, xPart, yPart] = parts
  if (!isApprovedEnvironment(environment)) {
    throw new Error('Unknown atlas environment')
  }
  if (!/^[a-z0-9][a-z0-9._-]{2,120}$/i.test(artifactId)) {
    throw new Error('Invalid atlas artifact')
  }
  if (!yPart.endsWith('.mvt')) {
    throw new Error('Atlas tiles must be requested as .mvt')
  }

  const z = parseNonNegativeInteger(zPart, 'z')
  const x = parseNonNegativeInteger(xPart, 'x')
  const y = parseNonNegativeInteger(yPart, 'y')
  validateTileCoordinateRange(z, x, y)

  return { environment, artifactId, z, x, y }
}

export function validateTileCoordinateRange(z: number, x: number, y: number) {
  if (z > 24) throw new Error('Tile zoom exceeds atlas service limit')
  const max = 2 ** z
  if (x >= max || y >= max) {
    throw new Error('Tile coordinate outside zoom range')
  }
}

export function tileToBbox(z: number, x: number, y: number): [number, number, number, number] {
  const n = 2 ** z
  const west = x / n * 360 - 180
  const east = (x + 1) / n * 360 - 180
  const north = Math.atan(Math.sinh(Math.PI * (1 - 2 * y / n))) * 180 / Math.PI
  const south = Math.atan(Math.sinh(Math.PI * (1 - 2 * (y + 1) / n))) * 180 / Math.PI
  return [west, south, east, north]
}

export function validateArtifactTileRequest(
  manifest: AtlasManifest,
  parsed: ParsedTilePath,
) {
  const artifact = findAtlasArtifact(manifest, parsed.artifactId)
  if (!artifact) throw new Error('Atlas artifact is not in approved manifest')
  if (!artifact.objectPath) throw new Error('Atlas artifact has no R2 object path')

  const minzoom = artifact.minzoom ?? 0
  const maxzoom = artifact.maxzoom ?? 24
  if (parsed.z < minzoom || parsed.z > maxzoom) {
    throw new Error('Tile zoom outside artifact range')
  }
  if (!atlasArtifactIntersectsBbox(artifact, tileToBbox(parsed.z, parsed.x, parsed.y))) {
    throw new Error('Tile outside artifact bounds')
  }

  return artifact
}

export function manifestObjectPath(environment: AtlasTileEnvironment) {
  return `atlas/v1/manifests/${environment}.json`
}

export function publicManifestPath(environment: AtlasTileEnvironment) {
  return `/manifests/${environment}.json`
}

export function artifactKindCounts(manifest: AtlasManifest) {
  return atlasAllManifestArtifacts(manifest).reduce<Record<AtlasArtifactKey | 'other', number>>((acc, artifact) => {
    const kind = normalizedArtifactKind(artifact)
    acc[kind] = (acc[kind] || 0) + 1
    return acc
  }, Object.fromEntries([...ATLAS_ARTIFACT_KEYS, 'other'].map(kind => [kind, 0])) as Record<AtlasArtifactKey | 'other', number>)
}

function normalizedArtifactKind(artifact: AtlasManifestArtifact): AtlasArtifactKey | 'other' {
  if (artifact.kind === 'terrain') return 'contours'
  if ((ATLAS_ARTIFACT_KEYS as readonly string[]).includes(artifact.kind)) {
    return artifact.kind as AtlasArtifactKey
  }
  return 'other'
}
