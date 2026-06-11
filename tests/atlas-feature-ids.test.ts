/**
 * E2 stable feature ids — unit tests for scripts/atlas-add-feature-ids.mjs.
 * Design contract: docs/ATLAS_STABLE_FEATURE_IDS.md.
 *
 * All fixtures are tiny synthetic MVT/PMTiles archives built in-test with the
 * same libraries the pipeline uses; no heavyweight pipeline stages run here.
 */
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { afterAll, describe, expect, it } from 'vitest'
import { VectorTile } from '@mapbox/vector-tile'
import Protobuf from 'pbf'
import {
  FEATURE_ID_SCHEME,
  collectRmIds,
  computeRmId,
  diffArchiveIds,
  encodeGeohash,
  normalizeLabelText,
  openArchive,
  pickLabelText,
  splitTileLayers,
  stampPmtilesArchive,
  stampTileBuffer,
  writePmtilesFromTiles,
  xxhash64,
} from '../scripts/atlas-add-feature-ids.mjs'
import { buildTileBuffer, lineFeature, lonLatToTile, pointFeature, polygonFeature } from './helpers/atlas-mvt-fixture.mjs'

const workdir = mkdtempSync(join(tmpdir(), 'radmaps-feature-ids-'))
afterAll(() => rmSync(workdir, { recursive: true, force: true }))

const Z = 10
const BASE_LON = -89.4
const BASE_LAT = 43.07
const TILE = lonLatToTile(BASE_LON, BASE_LAT, Z)

function decodeTile(buffer: Buffer | Uint8Array) {
  return new VectorTile(new Protobuf(buffer instanceof Buffer ? buffer : Buffer.from(buffer)))
}

function layerProps(buffer: Buffer | Uint8Array, layerName: string): Record<string, unknown>[] {
  const layer = (decodeTile(buffer).layers as Record<string, any>)[layerName]
  if (!layer) return []
  const out: Record<string, unknown>[] = []
  for (let i = 0; i < layer.length; i += 1) out.push({ ...layer.feature(i).properties })
  return out
}

function baseLayers(overrides: Record<string, any[]> = {}) {
  return {
    place: [
      pointFeature(BASE_LON, BASE_LAT, { class: 'town', name: 'Madison', rank: 5 }),
      pointFeature(BASE_LON - 0.02, BASE_LAT + 0.01, { class: 'park' }), // nameless -> skipped
    ],
    poi: [
      pointFeature(BASE_LON + 0.01, BASE_LAT, { class: 'campsite', name: 'Token Creek  Camp' }),
    ],
    transportation_name: [
      lineFeature(
        [[BASE_LON - 0.05, BASE_LAT], [BASE_LON + 0.05, BASE_LAT]],
        { class: 'primary', ref: 'US 14' },
      ),
    ],
    water: [
      polygonFeature(
        [[[BASE_LON - 0.03, BASE_LAT + 0.02], [BASE_LON - 0.01, BASE_LAT + 0.02], [BASE_LON - 0.01, BASE_LAT + 0.03], [BASE_LON - 0.03, BASE_LAT + 0.02]]],
        { class: 'lake' },
      ),
    ],
    ...overrides,
  }
}

describe('xxhash64 (pure JS)', () => {
  it('matches the XXH64 reference vectors', () => {
    expect(xxhash64('').toString(16)).toBe('ef46db3751d8e999')
    expect(xxhash64('a').toString(16)).toBe('d24ec4f1a98c6e5b')
    expect(xxhash64('abc').toString(16)).toBe('44bc2cf5ad770999')
    // >= 32 bytes exercises the four-lane accumulator path (verified against python xxhash)
    expect(xxhash64('The quick brown fox jumps over the lazy dog').toString(16)).toBe('b242d361fda71bc')
    expect(xxhash64('0123456789012345678901234567890123456').toString(16)).toBe('3f3df7c8777eb8f1')
  })
})

describe('geohash + normalization', () => {
  it('encodes the canonical geohash test vector', () => {
    expect(encodeGeohash(10.40744, 57.64911, 11)).toBe('u4pruydqqvj')
  })

  it('normalizes NFKC, casefold, trim, collapsed whitespace', () => {
    expect(normalizeLabelText('  Token  Creek  Camp ')).toBe('token creek camp')
    expect(normalizeLabelText('ＭＡＤＩＳＯＮ')).toBe('madison') // fullwidth -> NFKC
  })

  it('falls back name -> name:latin -> ref -> null', () => {
    expect(pickLabelText({ name: 'Madison', ref: 'X' })).toBe('Madison')
    expect(pickLabelText({ 'name:latin': 'Tokyo' })).toBe('Tokyo')
    expect(pickLabelText({ ref: 'US 14' })).toBe('US 14')
    expect(pickLabelText({ class: 'park' })).toBeNull()
  })
})

describe('stampTileBuffer', () => {
  it('(a) stamps stable rm_id on point layers; identical content in a second build yields identical ids', () => {
    const buffer1 = buildTileBuffer(baseLayers(), Z, TILE.x, TILE.y)
    // Second synthetic "build": same content, different feature/layer encode order.
    const reordered = baseLayers()
    reordered.place = [...reordered.place].reverse()
    const buffer2 = buildTileBuffer(
      Object.fromEntries(Object.entries(reordered).reverse()),
      Z, TILE.x, TILE.y,
    )
    const stamped1 = stampTileBuffer(buffer1, { z: Z, x: TILE.x, y: TILE.y })
    const stamped2 = stampTileBuffer(buffer2, { z: Z, x: TILE.x, y: TILE.y })
    expect(stamped1.changed).toBe(true)
    const ids1 = layerProps(stamped1.buffer, 'place').map(p => p.rm_id).filter(Boolean).sort()
    const ids2 = layerProps(stamped2.buffer, 'place').map(p => p.rm_id).filter(Boolean).sort()
    expect(ids1).toHaveLength(1)
    expect(ids1).toEqual(ids2)
    expect(typeof ids1[0]).toBe('string')
  })

  it('(b) moving a place within its geohash cell keeps the id; beyond the cell changes it', () => {
    const smallMove = { lon: BASE_LON + 0.0004, lat: BASE_LAT + 0.0002 }
    const bigMove = { lon: BASE_LON + 0.5, lat: BASE_LAT }
    // Guard: the small move stays inside the geohash-6 cell, the big one leaves it.
    expect(encodeGeohash(smallMove.lon, smallMove.lat, 6)).toBe(encodeGeohash(BASE_LON, BASE_LAT, 6))
    expect(encodeGeohash(bigMove.lon, bigMove.lat, 6)).not.toBe(encodeGeohash(BASE_LON, BASE_LAT, 6))

    const idAt = (lon: number, lat: number) => {
      const tile = lonLatToTile(lon, lat, Z)
      const buffer = buildTileBuffer({ place: [pointFeature(lon, lat, { class: 'town', name: 'Madison' })] }, Z, tile.x, tile.y)
      const stamped = stampTileBuffer(buffer, { z: Z, x: tile.x, y: tile.y })
      return layerProps(stamped.buffer, 'place')[0]?.rm_id
    }
    const baseId = idAt(BASE_LON, BASE_LAT)
    expect(idAt(smallMove.lon, smallMove.lat)).toBe(baseId)
    expect(idAt(bigMove.lon, bigMove.lat)).not.toBe(baseId)
  })

  it('(c) line features with the same name/class get the SAME id across different tiles (no geohash)', () => {
    const coords: [number, number][] = [[BASE_LON - 0.3, BASE_LAT], [BASE_LON + 0.3, BASE_LAT]]
    const left = lonLatToTile(coords[0][0], BASE_LAT, Z)
    const right = lonLatToTile(coords[1][0], BASE_LAT, Z)
    expect(left.x).not.toBe(right.x) // really spans two tiles
    const idIn = (tile: { x: number, y: number }) => {
      const buffer = buildTileBuffer({ transportation_name: [lineFeature(coords, { class: 'primary', name: 'County Road M' })] }, Z, tile.x, tile.y)
      const stamped = stampTileBuffer(buffer, { z: Z, x: tile.x, y: tile.y })
      return layerProps(stamped.buffer, 'transportation_name')[0]?.rm_id
    }
    const leftId = idIn(left)
    expect(leftId).toBeTruthy()
    expect(idIn(right)).toBe(leftId)
    expect(leftId).toBe(computeRmId('transportation_name', 'primary', 'county road m', null))
  })

  it('water_name centerlines (non-point geometry in a point layer) also key without geohash across tiles', () => {
    const coords: [number, number][] = [[BASE_LON - 0.3, BASE_LAT - 0.1], [BASE_LON + 0.3, BASE_LAT - 0.1]]
    const left = lonLatToTile(coords[0][0], BASE_LAT - 0.1, Z)
    const right = lonLatToTile(coords[1][0], BASE_LAT - 0.1, Z)
    const idIn = (tile: { x: number, y: number }) => {
      const buffer = buildTileBuffer({ water_name: [lineFeature(coords, { class: 'lake', name: 'Lake Mendota' })] }, Z, tile.x, tile.y)
      const stamped = stampTileBuffer(buffer, { z: Z, x: tile.x, y: tile.y })
      return layerProps(stamped.buffer, 'water_name')[0]?.rm_id
    }
    expect(idIn(left)).toBe(idIn(right))
  })

  it('(d) renaming a feature changes its id', () => {
    const idFor = (name: string) => {
      const buffer = buildTileBuffer({ place: [pointFeature(BASE_LON, BASE_LAT, { class: 'town', name })] }, Z, TILE.x, TILE.y)
      return layerProps(stampTileBuffer(buffer, { z: Z, x: TILE.x, y: TILE.y }).buffer, 'place')[0]?.rm_id
    }
    expect(idFor('Madison')).not.toBe(idFor('Middleton'))
  })

  it('(e) non-label layers pass through byte-identical', () => {
    const buffer = buildTileBuffer(baseLayers(), Z, TILE.x, TILE.y)
    const stamped = stampTileBuffer(buffer, { z: Z, x: TILE.x, y: TILE.y })
    const segmentsBefore = splitTileLayers(buffer) as any[]
    const segmentsAfter = splitTileLayers(stamped.buffer) as any[]
    const rawOf = (segments: any[], name: string) => Buffer.from(segments.find(s => s.kind === 'layer' && s.name === name).raw)
    expect(Buffer.compare(rawOf(segmentsBefore, 'water'), rawOf(segmentsAfter, 'water'))).toBe(0)
    expect(Buffer.compare(rawOf(segmentsBefore, 'place'), rawOf(segmentsAfter, 'place'))).not.toBe(0)
    // tiles with no label layers at all are returned untouched (same reference)
    const pure = buildTileBuffer({ water: baseLayers().water }, Z, TILE.x, TILE.y)
    const pureResult = stampTileBuffer(pure, { z: Z, x: TILE.x, y: TILE.y })
    expect(pureResult.changed).toBe(false)
    expect(pureResult.buffer).toBe(pure)
  })

  it('(f) features with no name and no ref are skipped; ref-only features are stamped', () => {
    const buffer = buildTileBuffer(baseLayers(), Z, TILE.x, TILE.y)
    const stamped = stampTileBuffer(buffer, { z: Z, x: TILE.x, y: TILE.y })
    const places = layerProps(stamped.buffer, 'place')
    const nameless = places.find(p => p.class === 'park')
    expect(nameless).toBeDefined()
    expect(nameless?.rm_id).toBeUndefined()
    const roads = layerProps(stamped.buffer, 'transportation_name')
    expect(roads[0]?.rm_id).toBe(computeRmId('transportation_name', 'primary', 'us 14', null))
  })

  it('(g) is idempotent at the tile level', () => {
    const buffer = buildTileBuffer(baseLayers(), Z, TILE.x, TILE.y)
    const once = stampTileBuffer(buffer, { z: Z, x: TILE.x, y: TILE.y })
    const twice = stampTileBuffer(Buffer.from(once.buffer), { z: Z, x: TILE.x, y: TILE.y })
    expect(Buffer.compare(Buffer.from(once.buffer), Buffer.from(twice.buffer))).toBe(0)
  })
})

describe('stampPmtilesArchive', () => {
  function writeFixtureArchive(path: string, overrides: Record<string, any[]> = {}) {
    const mixedTile = buildTileBuffer(baseLayers(overrides), Z, TILE.x, TILE.y)
    const pureTile = buildTileBuffer({ water: baseLayers().water }, Z, TILE.x + 1, TILE.y)
    writePmtilesFromTiles(path, [
      { z: Z, x: TILE.x, y: TILE.y, buffer: mixedTile },
      { z: Z, x: TILE.x + 1, y: TILE.y, buffer: pureTile },
    ], {
      metadata: {
        name: 'fixture',
        vector_layers: [
          { id: 'place', fields: { name: 'String', class: 'String' } },
          { id: 'water', fields: { class: 'String' } },
        ],
      },
    })
  }

  it('stamps label layers, adds the metadata scheme, and leaves label-free tiles byte-identical', async () => {
    const input = join(workdir, 'fixture.pmtiles')
    const output = join(workdir, 'stamped.pmtiles')
    writeFixtureArchive(input)
    const stats: any = stampPmtilesArchive(input, output, { quiet: true })
    expect(stats.scheme).toBe(FEATURE_ID_SCHEME)
    expect(stats.stampedTiles).toBe(1)
    expect(stats.stampedFeatures).toBeGreaterThanOrEqual(3) // place + poi + transportation_name
    expect(stats.skippedNamelessFeatures).toBeGreaterThanOrEqual(1)

    const before: any = openArchive(input)
    const after: any = openArchive(output)
    try {
      expect(after.metadata.feature_id_scheme).toBe(FEATURE_ID_SCHEME)
      const placeLayer = after.metadata.vector_layers.find((layer: any) => layer.id === 'place')
      expect(placeLayer.fields.rm_id).toBe('String')
      const waterLayer = after.metadata.vector_layers.find((layer: any) => layer.id === 'water')
      expect(waterLayer.fields.rm_id).toBeUndefined()
      expect(after.header.minZoom).toBe(before.header.minZoom)
      expect(after.header.maxZoom).toBe(before.header.maxZoom)
      expect(after.entries.length).toBe(before.entries.length)

      // the label-free tile keeps its exact compressed bytes
      const { zxyToTileId } = await import('pmtiles')
      const pureTileId = zxyToTileId(Z, TILE.x + 1, TILE.y)
      const mixedTileId = zxyToTileId(Z, TILE.x, TILE.y)
      const entryFor = (archive: any, tileId: number) => archive.entries.find((entry: any) => entry.tileId === tileId)
      const pureBefore = before.readTileData(entryFor(before, pureTileId))
      const pureAfter = after.readTileData(entryFor(after, pureTileId))
      expect(Buffer.compare(pureBefore, pureAfter)).toBe(0)

      // stamped tile decodes with rm_id present
      const stampedTile = gunzipSync(after.readTileData(entryFor(after, mixedTileId)))
      const places = layerProps(stampedTile, 'place')
      expect(places.find(p => p.name === 'Madison')?.rm_id).toBeTruthy()
    } finally {
      before.close()
      after.close()
    }
  })

  it('(g) re-running on a stamped archive produces a byte-identical file', () => {
    const input = join(workdir, 'fixture-idem.pmtiles')
    const once = join(workdir, 'stamped-once.pmtiles')
    const twice = join(workdir, 'stamped-twice.pmtiles')
    writeFixtureArchive(input)
    stampPmtilesArchive(input, once, { quiet: true })
    stampPmtilesArchive(once, twice, { quiet: true })
    expect(Buffer.compare(readFileSync(once), readFileSync(twice))).toBe(0)
  })

  it('(a) two synthetic builds of the same content produce identical id populations', () => {
    const buildA = join(workdir, 'build-a.pmtiles')
    const buildB = join(workdir, 'build-b.pmtiles')
    writeFixtureArchive(buildA)
    // second build: same content, different place feature order
    writeFixtureArchive(buildB, { place: [...baseLayers().place].reverse() })
    stampPmtilesArchive(buildA, `${buildA}.out`, { quiet: true })
    stampPmtilesArchive(buildB, `${buildB}.out`, { quiet: true })
    const idsA = collectRmIds(`${buildA}.out`) as Map<string, Set<string>>
    const idsB = collectRmIds(`${buildB}.out`) as Map<string, Set<string>>
    expect([...idsA.keys()].sort()).toEqual([...idsB.keys()].sort())
    for (const [layer, ids] of idsA) {
      expect([...ids].sort()).toEqual([...(idsB.get(layer) ?? new Set())].sort())
    }
  })

  it('stamped output remains readable by the pmtiles library (validate-stage compatibility)', async () => {
    const { PMTiles } = await import('pmtiles')
    const { openSync, readSync } = await import('node:fs')
    const output = join(workdir, 'stamped.pmtiles') // from the first test
    class NodeFileSource {
      fd: number
      path: string
      constructor(path: string) {
        this.path = path
        this.fd = openSync(path, 'r')
      }

      getKey() {
        return this.path
      }

      getBytes(offset: number, length: number) {
        const buffer = Buffer.alloc(length)
        const bytesRead = readSync(this.fd, buffer, 0, length, offset)
        return Promise.resolve({ data: buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + bytesRead) })
      }
    }
    const archive = new PMTiles(new NodeFileSource(output) as any)
    const header = await archive.getHeader()
    expect(header.tileType).toBe(1) // mvt
    const metadata: any = await archive.getMetadata()
    expect(metadata.feature_id_scheme).toBe(FEATURE_ID_SCHEME)
    const tile = await archive.getZxy(Z, TILE.x, TILE.y)
    expect(tile).toBeTruthy()
    const places = layerProps(Buffer.from(new Uint8Array(tile!.data)), 'place')
    expect(places.find(p => p.name === 'Madison')?.rm_id).toBeTruthy()
  })

  it('stability diff reports 100% overlap for identical content and less when a feature is renamed', () => {
    const oldBuild = join(workdir, 'diff-old.pmtiles')
    const sameBuild = join(workdir, 'diff-same.pmtiles')
    const renamedBuild = join(workdir, 'diff-renamed.pmtiles')
    writeFixtureArchive(oldBuild)
    writeFixtureArchive(sameBuild)
    writeFixtureArchive(renamedBuild, {
      place: [
        pointFeature(BASE_LON, BASE_LAT, { class: 'town', name: 'Renamed Town', rank: 5 }),
        pointFeature(BASE_LON - 0.02, BASE_LAT + 0.01, { class: 'park' }),
      ],
    })
    stampPmtilesArchive(oldBuild, `${oldBuild}.out`, { quiet: true })
    stampPmtilesArchive(sameBuild, `${sameBuild}.out`, { quiet: true })
    stampPmtilesArchive(renamedBuild, `${renamedBuild}.out`, { quiet: true })

    const same: any = diffArchiveIds(`${oldBuild}.out`, `${sameBuild}.out`)
    expect(same.total.overlapPctOfOld).toBe(100)

    const renamed: any = diffArchiveIds(`${oldBuild}.out`, `${renamedBuild}.out`)
    expect(renamed.total.overlapPctOfOld).toBeLessThan(100)
    expect(renamed.layers.place.shared).toBe(0)
    expect(renamed.layers.transportation_name.shared).toBe(1)
  })
})
