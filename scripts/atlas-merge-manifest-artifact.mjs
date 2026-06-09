#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const repoRoot = resolve(new URL('..', import.meta.url).pathname)
const args = parseArgs(process.argv.slice(2))

const sourcePath = resolve(repoRoot, args.source || '')
const targetPath = resolve(repoRoot, args.target || `public/atlas/manifests/${args.environment || 'staging'}.json`)
const outputPath = resolve(repoRoot, args.output || targetPath)
const kind = args.kind || 'base'
const publicBaseUrl = (args.publicBaseUrl || '').replace(/\/$/, '')

if (!args.source) throw new Error('Missing --source manifest path')
if (!['base', 'contours', 'hillshade', 'publicLands', 'poi', 'outdoorRoutes'].includes(kind)) throw new Error(`Unsupported artifact kind: ${kind}`)

const source = JSON.parse(readFileSync(sourcePath, 'utf8'))
const target = JSON.parse(readFileSync(targetPath, 'utf8'))
const sourceArtifacts = artifactArray(source.artifacts?.[kind])
if (!sourceArtifacts.length) throw new Error(`Source manifest has no ${kind} artifacts`)

const incoming = sourceArtifacts.map(artifact => ({
  ...artifact,
  url: publicBaseUrl && artifact.objectPath ? `${publicBaseUrl}/${artifact.objectPath}` : artifact.url,
}))

const current = artifactArray(target.artifacts?.[kind])
const incomingIds = new Set(incoming.map(artifact => artifact.id))
const merged = [
  ...current.filter(artifact => !incomingIds.has(artifact.id)),
  ...incoming,
]

target.artifacts = {
  ...(target.artifacts || {}),
  [kind]: merged,
}

target.storage = {
  ...(target.storage || {}),
  ...(publicBaseUrl ? { publicBaseUrl } : {}),
}

target.layerCatalog = Array.from(new Set([
  ...(target.layerCatalog || []),
  ...incoming.flatMap(artifact => artifact.layers || []),
])).filter(layer => layer !== 'landuse' && layer !== 'transportation_name')

if (args.atlasVersion) target.atlasVersion = args.atlasVersion
if (args.label) target.label = args.label
if (args.coverage) target.coverage = args.coverage
target.updatedAt = new Date().toISOString()

writeFileSync(outputPath, `${JSON.stringify(target, null, 2)}\n`)
console.log(JSON.stringify({
  output: outputPath,
  kind,
  addedOrUpdated: incoming.map(artifact => artifact.id),
  total: target.artifacts[kind].length,
}, null, 2))

function artifactArray(entry) {
  if (!entry) return []
  return Array.isArray(entry) ? entry : [entry]
}

function parseArgs(argv) {
  const parsed = {}
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--source') parsed.source = argv[++i]
    else if (arg === '--target') parsed.target = argv[++i]
    else if (arg === '--output') parsed.output = argv[++i]
    else if (arg === '--kind') parsed.kind = argv[++i]
    else if (arg === '--environment') parsed.environment = argv[++i]
    else if (arg === '--public-base-url') parsed.publicBaseUrl = argv[++i]
    else if (arg === '--atlas-version') parsed.atlasVersion = argv[++i]
    else if (arg === '--label') parsed.label = argv[++i]
    else if (arg === '--coverage') parsed.coverage = argv[++i]
    else if (arg === '--help' || arg === '-h') {
      console.log(`Usage: node scripts/atlas-merge-manifest-artifact.mjs --source <manifest.json> [--target public/atlas/manifests/staging.json] [--kind base] [--public-base-url https://pub-bucket.r2.dev] [--atlas-version 2026.05.21-staging-composite.1]`)
      process.exit(0)
    }
  }
  return parsed
}
