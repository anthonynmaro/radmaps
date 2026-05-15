#!/usr/bin/env node
import { existsSync, mkdirSync, openSync, readFileSync, readSync, statSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { PMTiles } from 'pmtiles'

const repoRoot = resolve(new URL('..', import.meta.url).pathname)
const args = parseArgs(process.argv.slice(2))
const env = { ...loadEnv(resolve(repoRoot, '.env')), ...process.env }
const regions = JSON.parse(readFileSync(resolve(repoRoot, 'atlas/regions.json'), 'utf8'))
const region = regions[args.region || 'driftless-lab']
if (!region) throw new Error(`Unknown atlas region: ${args.region}`)

const date = args.date || new Date().toISOString().slice(0, 10)
const environment = args.environment || 'staging'
const publicBaseUrl = args.publicBaseUrl || env.ATLAS_PUBLIC_BASE_URL || 'https://pub-your-bucket.r2.dev'
const atlasVersion = args.version || `${date.replaceAll('-', '.')}-${region.coverage}.1`
const output = resolve(repoRoot, args.output || `public/atlas/manifests/${environment}.json`)

class NodeFileSource {
  constructor(path) {
    this.path = path
    this.fd = openSync(path, 'r')
  }

  getKey() {
    return this.path
  }

  getBytes(offset, length) {
    const buffer = Buffer.alloc(length)
    const bytesRead = readSync(this.fd, buffer, 0, length, offset)
    const data = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + bytesRead)
    return Promise.resolve({ data })
  }
}

const artifacts = {}
if (region.base?.localPath) {
  artifacts.base = await artifactFromConfig('base', region.base)
}
if (region.contours?.enabled && region.contours?.localPath && existsSync(resolve(repoRoot, region.contours.localPath))) {
  artifacts.contours = await artifactFromConfig('contours', region.contours)
}

const manifest = {
  atlasVersion,
  schemaVersion: 'radmaps-atlas-v1',
  coverage: region.coverage,
  label: region.label,
  createdAt: new Date().toISOString(),
  storage: {
    provider: 'cloudflare-r2',
    bucket: args.bucket || env.ATLAS_STORAGE_BUCKET || 'radmaps-atlas-staging',
    publicBaseUrl,
  },
  artifacts,
  layerCatalog: [...new Set(Object.values(artifacts).flatMap(artifact => artifact.layers || []))]
    .filter(layer => layer !== 'landuse' && layer !== 'transportation_name'),
  attribution: [
    {
      name: 'OpenStreetMap contributors',
      requiredText: '© OpenStreetMap contributors',
      url: 'https://www.openstreetmap.org/copyright',
    },
    {
      name: 'RadMaps Atlas',
      requiredText: 'Atlas styling and derived tile packaging © RadMaps',
      url: 'https://radmaps.studio',
    },
  ],
}

mkdirSync(dirname(output), { recursive: true })
writeFileSync(output, `${JSON.stringify(manifest, null, 2)}\n`)
console.log(JSON.stringify({ output, atlasVersion, artifacts: Object.keys(artifacts) }, null, 2))

async function artifactFromConfig(kind, config) {
  const localPath = resolve(repoRoot, config.localPath)
  if (!existsSync(localPath)) throw new Error(`Missing artifact for manifest: ${localPath}`)
  const archive = new PMTiles(new NodeFileSource(localPath))
  const header = await archive.getHeader()
  const objectPath = fillObjectPath(config.objectPath)
  return {
    id: config.id || `radmaps-${region.coverage}-${kind}`,
    kind,
    url: `${publicBaseUrl.replace(/\/$/, '')}/${objectPath}`,
    objectPath,
    minzoom: config.minzoom ?? header.minZoom,
    maxzoom: config.maxzoom ?? header.maxZoom,
    bounds: [header.minLon, header.minLat, header.maxLon, header.maxLat],
    layers: config.layers || [],
    bytes: statSync(localPath).size,
  }
}

function fillObjectPath(path) {
  return path.replaceAll('{date}', date).replaceAll('{version}', atlasVersion)
}

function parseArgs(argv) {
  const parsed = {}
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--region') parsed.region = argv[++i]
    else if (arg === '--environment') parsed.environment = argv[++i]
    else if (arg === '--date') parsed.date = argv[++i]
    else if (arg === '--version') parsed.version = argv[++i]
    else if (arg === '--bucket') parsed.bucket = argv[++i]
    else if (arg === '--public-base-url') parsed.publicBaseUrl = argv[++i]
    else if (arg === '--output') parsed.output = argv[++i]
    else if (arg === '--help' || arg === '-h') {
      console.log('Usage: node scripts/atlas-generate-manifest.mjs --region <id> --environment staging|production [--version <id>] [--public-base-url <url>]')
      process.exit(0)
    }
  }
  return parsed
}

function loadEnv(path) {
  try {
    return Object.fromEntries(
      readFileSync(path, 'utf8')
        .split(/\n/)
        .map(line => line.match(/^\s*([A-Z0-9_]+)=(.*)$/))
        .filter(Boolean)
        .map(([, key, raw]) => [key, raw.trim().replace(/^['"]|['"]$/g, '')]),
    )
  } catch {
    return {}
  }
}
