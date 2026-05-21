import { PMTiles } from 'pmtiles'
import type { AtlasManifest } from '../../../utils/atlasManifest'
import {
  artifactKindCounts,
  isApprovedEnvironment,
  manifestObjectPath,
  parseTileRequestPath,
  publicManifestPath,
  validateArtifactTileRequest,
  type AtlasTileEnvironment,
} from './routing'

type ExecutionContext = {
  waitUntil(promise: Promise<unknown>): void
}

declare const caches: CacheStorage & { default: Cache }

type R2Range = { offset: number, length: number }

type R2ObjectBody = {
  arrayBuffer(): Promise<ArrayBuffer>
  httpEtag?: string
}

type R2BucketBinding = {
  get(key: string, options?: { range?: R2Range }): Promise<R2ObjectBody | null>
}

type AtlasTilesEnv = {
  ATLAS_STAGING: R2BucketBinding
  ATLAS_PROD: R2BucketBinding
}

class R2PmtilesSource {
  constructor(
    private bucket: R2BucketBinding,
    private objectPath: string,
  ) {}

  getKey() {
    return this.objectPath
  }

  async getBytes(offset: number, length: number) {
    const object = await this.bucket.get(this.objectPath, {
      range: { offset, length },
    })
    if (!object) throw new Error(`Missing PMTiles object: ${this.objectPath}`)
    return { data: await object.arrayBuffer() }
  }
}

const pmtilesCache = new Map<string, PMTiles>()

function bucketForEnvironment(env: AtlasTilesEnv, environment: AtlasTileEnvironment) {
  return environment === 'production' ? env.ATLAS_PROD : env.ATLAS_STAGING
}

async function loadManifest(env: AtlasTilesEnv, environment: AtlasTileEnvironment) {
  const bucket = bucketForEnvironment(env, environment)
  const object = await bucket.get(manifestObjectPath(environment))
  if (!object) throw new Error(`Missing atlas manifest for ${environment}`)
  return JSON.parse(await object.arrayBuffer().then(buffer => new TextDecoder().decode(buffer))) as AtlasManifest
}

function cachedArchive(bucket: R2BucketBinding, objectPath: string) {
  const cached = pmtilesCache.get(objectPath)
  if (cached) return cached
  const archive = new PMTiles(new R2PmtilesSource(bucket, objectPath))
  pmtilesCache.set(objectPath, archive)
  return archive
}

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body, null, 2), {
    ...init,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
      ...init?.headers,
    },
  })
}

function errorResponse(error: unknown, status = 400) {
  return jsonResponse({
    ok: false,
    error: error instanceof Error ? error.message : 'Atlas tile service error',
  }, { status })
}

async function serveManifest(request: Request, env: AtlasTilesEnv) {
  const { pathname } = new URL(request.url)
  const parts = pathname.split('/').filter(Boolean)
  if (parts.length !== 2 || parts[0] !== 'manifests' || !parts[1].endsWith('.json')) return null
  const environment = parts[1].replace(/\.json$/, '')
  if (!isApprovedEnvironment(environment)) return errorResponse(new Error('Unknown atlas environment'), 404)

  const manifest = await loadManifest(env, environment)
  return jsonResponse({
    ...manifest,
    service: {
      tileUrlTemplate: `/tiles/${environment}/{artifactId}/{z}/{x}/{y}.mvt`,
      artifactCounts: artifactKindCounts(manifest),
    },
  }, {
    headers: {
      'Cache-Control': 'public, max-age=300, stale-while-revalidate=1800',
    },
  })
}

async function serveTile(request: Request, env: AtlasTilesEnv, ctx: ExecutionContext) {
  const { pathname } = new URL(request.url)
  const parsed = parseTileRequestPath(pathname)
  if (!parsed) return null

  const cache = caches.default
  const cached = await cache.match(request)
  if (cached) return cached

  const manifest = await loadManifest(env, parsed.environment)
  const artifact = validateArtifactTileRequest(manifest, parsed)
  const bucket = bucketForEnvironment(env, parsed.environment)
  const archive = cachedArchive(bucket, artifact.objectPath!)
  const tile = await archive.getZxy(parsed.z, parsed.x, parsed.y)

  if (!tile) {
    return new Response(null, {
      status: 204,
      headers: {
        'Cache-Control': 'public, max-age=86400',
      },
    })
  }

  const response = new Response(tile.data, {
    headers: {
      'Content-Type': 'application/x-protobuf',
      'Cache-Control': tile.cacheControl || 'public, max-age=31536000, immutable',
      'X-RadMaps-Atlas-Environment': parsed.environment,
      'X-RadMaps-Atlas-Artifact': artifact.id,
    },
  })
  ctx.waitUntil(cache.put(request, response.clone()))
  return response
}

export default {
  async fetch(request: Request, env: AtlasTilesEnv, ctx: ExecutionContext) {
    try {
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        return errorResponse(new Error('Method not allowed'), 405)
      }

      const manifestResponse = await serveManifest(request, env)
      if (manifestResponse) return manifestResponse

      const tileResponse = await serveTile(request, env, ctx)
      if (tileResponse) return tileResponse

      return jsonResponse({
        ok: true,
        routes: [
          publicManifestPath('staging'),
          publicManifestPath('production'),
          '/tiles/:environment/:artifactId/:z/:x/:y.mvt',
        ],
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : ''
      const status = message.includes('not found') || message.includes('Missing') ? 404 : 400
      return errorResponse(error, status)
    }
  },
}
