#!/usr/bin/env node
import { existsSync, openSync, readSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { PMTiles, TileType } from 'pmtiles'

const args = parseArgs(process.argv.slice(2))
if (!args.file) usage('Missing --file')

const file = resolve(args.file)
if (!existsSync(file)) throw new Error(`PMTiles file does not exist: ${file}`)

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

const archive = new PMTiles(new NodeFileSource(file))
const header = await archive.getHeader()
const metadata = await archive.getMetadata().catch(() => ({}))

if (args.minzoom != null && header.minZoom > Number(args.minzoom)) {
  throw new Error(`Expected minZoom <= ${args.minzoom}, got ${header.minZoom}`)
}
if (args.maxzoom != null && header.maxZoom < Number(args.maxzoom)) {
  throw new Error(`Expected maxZoom >= ${args.maxzoom}, got ${header.maxZoom}`)
}
if (args.tileType && tileTypeName(header.tileType) !== args.tileType) {
  throw new Error(`Expected tile type ${args.tileType}, got ${tileTypeName(header.tileType)}`)
}
if (args.layers) {
  const expected = args.layers.split(',').map(value => value.trim()).filter(Boolean)
  const vectorLayers = Array.isArray(metadata.vector_layers) ? metadata.vector_layers.map(layer => layer.id) : []
  const missing = expected.filter(layer => !vectorLayers.includes(layer))
  if (missing.length > 0) throw new Error(`Missing metadata vector_layers: ${missing.join(', ')}`)
}

const result = {
  file,
  bytes: statSync(file).size,
  minZoom: header.minZoom,
  maxZoom: header.maxZoom,
  tileType: tileTypeName(header.tileType),
  tileCompression: header.tileCompression,
  bounds: [
    header.minLon,
    header.minLat,
    header.maxLon,
    header.maxLat,
  ],
  vectorLayers: Array.isArray(metadata.vector_layers) ? metadata.vector_layers.map(layer => layer.id) : [],
}

console.log(JSON.stringify(result, null, 2))

function parseArgs(argv) {
  const parsed = {}
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--file') parsed.file = argv[++i]
    else if (arg === '--minzoom') parsed.minzoom = argv[++i]
    else if (arg === '--maxzoom') parsed.maxzoom = argv[++i]
    else if (arg === '--layers') parsed.layers = argv[++i]
    else if (arg === '--tile-type') parsed.tileType = argv[++i]
    else if (arg === '--help' || arg === '-h') usage()
  }
  return parsed
}

function tileTypeName(value) {
  if (value === TileType.Mvt) return 'mvt'
  if (value === TileType.Png) return 'png'
  if (value === TileType.Jpeg) return 'jpeg'
  if (value === TileType.Webp) return 'webp'
  if (value === TileType.Avif) return 'avif'
  return String(value)
}

function usage(message) {
  if (message) console.error(message)
  console.log('Usage: node scripts/atlas-validate-pmtiles.mjs --file <archive.pmtiles> [--minzoom 0] [--maxzoom 14] [--layers water,transportation] [--tile-type mvt]')
  process.exit(message ? 1 : 0)
}
