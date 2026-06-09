#!/usr/bin/env node
/**
 * Build z8-16 hotspot overlay PMTiles for additive Atlas layers:
 * - poi: bbox-filtered Overture Places enrichment
 * - outdoorRoutes: named OSM route=hiking/bicycle/mtb relations
 *
 * This script is intentionally overlay-only. Base trail/path geometry stays in
 * Planetiler's transportation layer; these overlays add high-value print labels.
 */

import { createHash } from 'node:crypto'
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  readSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { dirname, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { PMTiles, TileType } from 'pmtiles'

const __filename = fileURLToPath(import.meta.url)
const repoRoot = resolve(dirname(__filename), '..')
const args = parseArgs(process.argv.slice(2))
const env = { ...loadEnv(resolve(repoRoot, '.env')), ...process.env }
const overlayConfig = JSON.parse(readFileSync(resolve(repoRoot, 'atlas/overlay-targets.json'), 'utf8'))
const coverageTargets = JSON.parse(readFileSync(resolve(repoRoot, 'atlas/coverage-targets.json'), 'utf8'))

const environment = args.environment || 'staging'
const date = args.date || new Date().toISOString().slice(0, 10)
const version = args.version || `${date.replaceAll('-', '.')}-overlay-hotspots.1`
const dryRun = Boolean(args.dryRun)
const upload = Boolean(args.upload)
const publish = Boolean(args.publish)
const targetArg = args.target || 'all'
const kindArg = args.kind || 'all'
const kinds = expandKinds(kindArg)
const selectedTargets = selectTargets(targetArg)
const buildRoot = resolve(repoRoot, args.workdir || 'atlas/build/overlays')
const bucket = args.bucket || env.ATLAS_STORAGE_BUCKET || (environment === 'production' ? 'radmaps-atlas-prod' : 'radmaps-atlas-staging')
const publicBaseUrl = (args.publicBaseUrl || env.ATLAS_PUBLIC_BASE_URL || '').replace(/\/$/, '')
const overtureBin = args.overtureBin || env.OVERTUREMAPS_BIN || 'overturemaps'
const pmtilesBin = args.pmtilesBin || env.PMTILES_BIN || 'pmtiles'
const tippecanoeBin = args.tippecanoeBin || env.TIPPECANOE_BIN || 'tippecanoe'
const overpassUrls = (args.overpassUrl || env.OVERPASS_API_URLS || env.OVERPASS_API_URL || 'https://overpass-api.de/api/interpreter,https://overpass.kumi.systems/api/interpreter,https://overpass.openstreetmap.ru/api/interpreter')
  .split(',')
  .map(value => value.trim())
  .filter(Boolean)
const overpassRetries = Number(args.overpassRetries ?? env.OVERPASS_RETRIES ?? 3)
const overpassDelayMs = Number(args.overpassDelayMs ?? env.OVERPASS_DELAY_MS ?? 6000)
const bboxLimit = numericArg(args.bboxLimit, null)
const estimatedCostUsd = numericArg(args.estimatedCostUsd, env.ATLAS_ESTIMATED_COST_USD)
const defaults = overlayConfig.defaults || {}
const minzoom = Number(args.minzoom ?? defaults.minzoom ?? 0)
const maxzoom = Number(args.maxzoom ?? defaults.maxzoom ?? 16)
const reuseSource = args.reuseSource !== false

console.log(JSON.stringify({
  pipeline: 'radmaps-atlas-overlays',
  target: targetArg,
  selectedTargets: selectedTargets.map(([id]) => id),
  kinds,
  environment,
  version,
  date,
  dryRun,
  upload,
  publish,
  reuseSource,
  buildRoot,
  minzoom,
  maxzoom,
  estimatedCostUsd,
}, null, 2))

enforceCostGate()
preflight()

const generatedManifests = []

for (const [targetId, target] of selectedTargets) {
  const outputs = []
  const targetBuildRoot = resolve(buildRoot, targetId)
  const sourceDir = resolve(targetBuildRoot, 'source')
  const filteredDir = resolve(targetBuildRoot, 'filtered')
  const outputDir = resolve(targetBuildRoot, 'output')
  const manifestDir = resolve(targetBuildRoot, 'manifest')
  mkdirSync(sourceDir, { recursive: true })
  mkdirSync(filteredDir, { recursive: true })
  mkdirSync(outputDir, { recursive: true })
  mkdirSync(manifestDir, { recursive: true })

  for (const kind of kinds) {
    const result = kind === 'poi'
      ? await buildPoiOverlay({ targetId, target, sourceDir, filteredDir, outputDir })
      : await buildOutdoorRoutesOverlay({ targetId, target, sourceDir, filteredDir, outputDir })
    if (result) outputs.push(result)
  }

  if (!outputs.length) {
    console.log(JSON.stringify({ target: targetId, skipped: true, reason: 'No overlay artifacts generated' }, null, 2))
    continue
  }

  const manifestPath = resolve(manifestDir, `${environment}-${targetId}-overlays.json`)
  writeOverlayManifest({ targetId, target, outputs, manifestPath })
  generatedManifests.push(manifestPath)

  if (upload) {
    for (const output of outputs) uploadArtifact(output)
  }

  if (publish) publishGeneratedManifest(manifestPath, outputs)
}

console.log(JSON.stringify({
  complete: true,
  generatedManifests,
}, null, 2))

function parseArgs(argv) {
  const parsed = {}
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--target') parsed.target = argv[++i]
    else if (arg === '--kind') parsed.kind = argv[++i]
    else if (arg === '--environment') parsed.environment = argv[++i]
    else if (arg === '--date') parsed.date = argv[++i]
    else if (arg === '--version') parsed.version = argv[++i]
    else if (arg === '--workdir') parsed.workdir = argv[++i]
    else if (arg === '--bucket') parsed.bucket = argv[++i]
    else if (arg === '--public-base-url') parsed.publicBaseUrl = argv[++i]
    else if (arg === '--estimated-cost-usd') parsed.estimatedCostUsd = argv[++i]
    else if (arg === '--overture-bin') parsed.overtureBin = argv[++i]
    else if (arg === '--pmtiles-bin') parsed.pmtilesBin = argv[++i]
    else if (arg === '--tippecanoe-bin') parsed.tippecanoeBin = argv[++i]
    else if (arg === '--overpass-url') parsed.overpassUrl = argv[++i]
    else if (arg === '--overpass-retries') parsed.overpassRetries = argv[++i]
    else if (arg === '--overpass-delay-ms') parsed.overpassDelayMs = argv[++i]
    else if (arg === '--bbox-limit') parsed.bboxLimit = argv[++i]
    else if (arg === '--minzoom') parsed.minzoom = argv[++i]
    else if (arg === '--maxzoom') parsed.maxzoom = argv[++i]
    else if (arg === '--dry-run') parsed.dryRun = true
    else if (arg === '--upload') parsed.upload = true
    else if (arg === '--publish') parsed.publish = true
    else if (arg === '--no-reuse-source') parsed.reuseSource = false
    else if (arg === '--help' || arg === '-h') {
      console.log(`Usage: node scripts/atlas-build-overlays.mjs [options]

Options:
  --target <id|all>             Overlay target from atlas/overlay-targets.json
  --kind <poi|outdoorRoutes|all>
  --environment <name>          staging or production
  --date <yyyy-mm-dd>           Date inserted into immutable R2 object paths
  --version <id>                Atlas manifest version used during publish
  --workdir <path>              Build scratch directory
  --public-base-url <url>       Public R2/tile object base URL
  --bucket <name>               R2 bucket override
  --estimated-cost-usd <value>  Required for non-dry-run network/build/upload
  --overture-bin <path>         Overture CLI, defaults to OVERTUREMAPS_BIN or overturemaps
  --pmtiles-bin <path>          pmtiles CLI, defaults to PMTILES_BIN or pmtiles
  --tippecanoe-bin <path>       Tippecanoe CLI, defaults to TIPPECANOE_BIN or tippecanoe
  --overpass-url <url[,url]>    Overpass API endpoint list
  --overpass-retries <n>        Retry attempts per bbox, defaults to 3
  --overpass-delay-ms <n>       Delay between Overpass requests/retries, defaults to 6000
  --bbox-limit <n>              Limit hotspot bboxes for local smoke tests
  --dry-run                     Print planned work without network/build/upload
  --upload                      Upload generated PMTiles to R2
  --publish                     Merge into public/atlas/manifests/<environment>.json and upload manifest
  --no-reuse-source             Redownload source files even if present`)
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

function numericArg(...values) {
  const raw = values.find(value => value !== undefined && value !== null && String(value).trim() !== '')
  if (raw === undefined || raw === null) return null
  const parsed = Number(raw)
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error(`Invalid numeric argument: ${raw}`)
  return parsed
}

function expandKinds(value) {
  if (value === 'all') return ['poi', 'outdoorRoutes']
  if (value === 'poi' || value === 'outdoorRoutes') return [value]
  throw new Error(`Unsupported overlay kind: ${value}`)
}

function selectTargets(value) {
  const entries = Object.entries(overlayConfig.targets || {})
  if (value === 'all') return entries
  const target = overlayConfig.targets?.[value]
  if (!target) throw new Error(`Unknown overlay target: ${value}`)
  return [[value, target]]
}

function enforceCostGate() {
  const networkOrHeavy = !dryRun
  const guardrails = coverageTargets.costGuardrails || {}
  const totalBudgetUsd = Number(guardrails.totalBuildBudgetUsd ?? guardrails.awsExperimentBudgetUsdPerMonth ?? 200)
  const actualCoverageBuildCostUsd = Number(guardrails.actualCoverageBuildCostUsd ?? guardrails.observedAwsMonthToDateUsd ?? 0)
  const remainingBudgetUsd = Math.max(0, totalBudgetUsd - actualCoverageBuildCostUsd)
  const coverageById = new Map((coverageTargets.targets || []).map(target => [target.id, target]))
  const targetCaps = selectedTargets
    .map(([, target]) => coverageById.get(target.coverageTarget)?.maxNewBuildCostUsd)
    .filter(value => typeof value === 'number')
  const lowestTargetCapUsd = targetCaps.length ? Math.min(...targetCaps) : null

  console.log(JSON.stringify({
    costGate: {
      schemaVersion: coverageTargets.schemaVersion,
      targetCount: selectedTargets.length,
      dryRun,
      estimatedCostUsd,
      actualCoverageBuildCostUsd,
      totalBudgetUsd,
      remainingBudgetUsd,
      lowestTargetCapUsd,
    },
  }, null, 2))

  if (!networkOrHeavy) return
  if (estimatedCostUsd === null || estimatedCostUsd <= 0) {
    throw new Error('Real overlay builds require --estimated-cost-usd so the $200 coverage budget gate can run')
  }
  if (estimatedCostUsd > remainingBudgetUsd) {
    throw new Error(`Estimated overlay build cost $${estimatedCostUsd.toFixed(2)} exceeds remaining $${remainingBudgetUsd.toFixed(2)} of the $${totalBudgetUsd.toFixed(2)} coverage budget`)
  }
  if (selectedTargets.length === 1 && lowestTargetCapUsd !== null && estimatedCostUsd > lowestTargetCapUsd) {
    throw new Error(`Estimated overlay build cost $${estimatedCostUsd.toFixed(2)} exceeds this target's $${lowestTargetCapUsd.toFixed(2)} cap`)
  }
}

function preflight() {
  mkdirSync(buildRoot, { recursive: true })
  const ogr = run('ogr2ogr', ['--version'], { capture: true, optional: true }).trim()
  const overture = kinds.includes('poi')
    ? run(overtureBin, ['download', '--help'], { capture: true, optional: true }).trim().split('\n')[0]
    : 'not required'
  const pmtiles = kinds.includes('outdoorRoutes')
    ? run(pmtilesBin, ['version'], { capture: true, optional: true }).trim()
    : 'not required'
  const tippecanoe = kinds.includes('outdoorRoutes')
    ? run(tippecanoeBin, ['--version'], { capture: true, optional: true }).trim()
    : 'not required'
  console.log(JSON.stringify({ preflight: { ogr2ogr: ogr || 'missing', overture: overture || 'missing', pmtiles: pmtiles || 'missing', tippecanoe: tippecanoe || 'missing' } }, null, 2))
  if (!dryRun && !ogr) throw new Error('ogr2ogr with PMTiles support is required for overlay builds')
  if (!dryRun && kinds.includes('poi') && !overture) throw new Error('Overture CLI is required for poi overlay builds')
  if (!dryRun && kinds.includes('outdoorRoutes') && !pmtiles) throw new Error('pmtiles CLI is required for outdoorRoutes overlay builds')
  if (!dryRun && kinds.includes('outdoorRoutes') && !tippecanoe) throw new Error('Tippecanoe CLI is required for outdoorRoutes overlay builds')
}

async function buildPoiOverlay({ targetId, target, sourceDir, filteredDir, outputDir }) {
  const artifactPrefix = target.artifactPrefix || targetId
  const rawFeatures = []
  const bboxes = selectedBboxes(target)
  const maxFeatures = Number(target.maxPoiFeatures ?? defaults.maxPoiFeatures ?? 6000)
  const sourcePaths = []

  for (const [index, bboxTarget] of bboxes.entries()) {
    const sourcePath = resolve(sourceDir, `${artifactPrefix}-poi-${index + 1}.geojson`)
    sourcePaths.push(sourcePath)
    const bbox = bboxTarget.bbox.join(',')
    console.log(JSON.stringify({ target: targetId, kind: 'poi', bbox: bboxTarget.label, command: `${overtureBin} download --bbox=${bbox} -f geojson --type=place -o ${sourcePath}` }, null, 2))
    if (dryRun) continue
    if (reuseSource && existsSync(sourcePath) && statSync(sourcePath).size > 0) {
      console.log(JSON.stringify({ target: targetId, kind: 'poi', bbox: bboxTarget.label, reuseSource: sourcePath }, null, 2))
    } else {
      run(overtureBin, [
        'download',
        `--bbox=${bbox}`,
        '-f',
        'geojson',
        '--type',
        'place',
        '-o',
        sourcePath,
        '--request_timeout',
        String(target.overtureRequestTimeoutSeconds ?? defaults.overtureRequestTimeoutSeconds ?? 300),
      ], { heavy: true })
    }
    rawFeatures.push(...readGeoJsonFeatures(sourcePath).map(feature => ({
      ...feature,
      properties: {
        ...(feature.properties || {}),
        bbox_label: bboxTarget.label,
      },
    })))
  }

  if (dryRun) return dryRunArtifact({ targetId, target, artifactPrefix, kind: 'poi', layer: 'poi', bboxes, maxFeatures, sourcePaths })

  const filtered = filterPoiFeatures(rawFeatures, maxFeatures)
  const filteredPath = resolve(filteredDir, `${artifactPrefix}-poi-filtered.geojson`)
  writeFeatureCollection(filteredPath, filtered)
  console.log(JSON.stringify({ target: targetId, kind: 'poi', rawFeatures: rawFeatures.length, filteredFeatures: filtered.length, filteredPath }, null, 2))
  if (!filtered.length) return null

  const pmtilesPath = resolve(outputDir, `radmaps-poi-${artifactPrefix}.pmtiles`)
  const output = await buildPmtiles({
    kind: 'poi',
    layer: 'poi',
    targetId,
    target,
    artifactPrefix,
    inputPath: filteredPath,
    pmtilesPath,
    objectPath: `atlas/v1/poi/${artifactPrefix}/${date}/radmaps-poi-${artifactPrefix}.pmtiles`,
  })
  output.featureCount = filtered.length
  return output
}

async function buildOutdoorRoutesOverlay({ targetId, target, sourceDir, filteredDir, outputDir }) {
  const artifactPrefix = target.artifactPrefix || targetId
  const rawElements = []
  const bboxes = selectedBboxes(target)
  const maxFeatures = Number(target.maxOutdoorRouteFeatures ?? defaults.maxOutdoorRouteFeatures ?? 2000)
  const sourcePaths = []

  for (const [index, bboxTarget] of bboxes.entries()) {
    const sourcePath = resolve(sourceDir, `${artifactPrefix}-outdoor-routes-${index + 1}.json`)
    sourcePaths.push(sourcePath)
    const query = overpassQuery(bboxTarget.bbox, Number(target.overpassTimeoutSeconds ?? defaults.overpassTimeoutSeconds ?? 180))
    console.log(JSON.stringify({ target: targetId, kind: 'outdoorRoutes', bbox: bboxTarget.label, overpassUrls, query: query.replace(/\s+/g, ' ').trim() }, null, 2))
    if (dryRun) continue
    let json
    if (reuseSource && existsSync(sourcePath) && statSync(sourcePath).size > 0) {
      console.log(JSON.stringify({ target: targetId, kind: 'outdoorRoutes', bbox: bboxTarget.label, reuseSource: sourcePath }, null, 2))
      json = JSON.parse(readFileSync(sourcePath, 'utf8'))
    } else {
      json = await fetchOverpassJson({ targetId, label: bboxTarget.label, query })
      writeFileSync(sourcePath, `${JSON.stringify(json, null, 2)}\n`)
      if (overpassDelayMs > 0) await delay(overpassDelayMs)
    }
    rawElements.push(...(json.elements || []).map(element => ({ ...element, bbox_label: bboxTarget.label })))
  }

  if (dryRun) return dryRunArtifact({ targetId, target, artifactPrefix, kind: 'outdoorRoutes', layer: 'outdoor_route', bboxes, maxFeatures, sourcePaths })

  const maxGeometryPoints = Number(target.maxOutdoorRouteGeometryPoints ?? defaults.maxOutdoorRouteGeometryPoints ?? 1500)
  const bboxByLabel = new Map(bboxes.map(item => [item.label, item.bbox]))
  const features = filterOutdoorRouteFeatures(rawElements, maxFeatures, maxGeometryPoints, bboxByLabel)
  const filteredPath = resolve(filteredDir, `${artifactPrefix}-outdoor-routes-filtered.geojson`)
  writeFeatureCollection(filteredPath, features)
  console.log(JSON.stringify({ target: targetId, kind: 'outdoorRoutes', rawElements: rawElements.length, filteredFeatures: features.length, filteredPath }, null, 2))
  if (!features.length) return null

  const pmtilesPath = resolve(outputDir, `radmaps-outdoor-routes-${artifactPrefix}.pmtiles`)
  const output = await buildPmtiles({
    kind: 'outdoorRoutes',
    layer: 'outdoor_route',
    targetId,
    target,
    artifactPrefix,
    inputPath: filteredPath,
    pmtilesPath,
    objectPath: `atlas/v1/outdoorRoutes/${artifactPrefix}/${date}/radmaps-outdoor-routes-${artifactPrefix}.pmtiles`,
  })
  output.featureCount = features.length
  return output
}

function selectedBboxes(target) {
  const bboxes = target.bboxes || []
  if (bboxLimit === null) return bboxes
  return bboxes.slice(0, bboxLimit)
}

function dryRunArtifact({ targetId, target, artifactPrefix, kind, layer, bboxes, maxFeatures, sourcePaths }) {
  return {
    dryRun: true,
    id: artifactId(kind, artifactPrefix),
    targetId,
    kind,
    layer,
    objectPath: kind === 'poi'
      ? `atlas/v1/poi/${artifactPrefix}/${date}/radmaps-poi-${artifactPrefix}.pmtiles`
      : `atlas/v1/outdoorRoutes/${artifactPrefix}/${date}/radmaps-outdoor-routes-${artifactPrefix}.pmtiles`,
    localPath: null,
    minzoom,
    maxzoom,
    bounds: unionBboxes(bboxes.map(item => item.bbox)),
    bytes: 0,
    sourcePaths,
    maxFeatures,
    sourceStrategy: sourceStrategyForKind(kind),
    sourceLicenses: sourceLicensesForKind(kind),
    sourceDate: date,
    status: environment === 'production' ? 'production' : 'staging',
    qaStatus: 'pending',
    coverageTarget: target.coverageTarget,
  }
}

function readGeoJsonFeatures(path) {
  if (!existsSync(path) || statSync(path).size === 0) return []
  const text = readFileSync(path, 'utf8').trim()
  if (!text) return []
  if (text.startsWith('{')) {
    const json = JSON.parse(text)
    if (Array.isArray(json.features)) return json.features
    if (json.type === 'Feature') return [json]
  }
  return text
    .split(/\n+/)
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => JSON.parse(line))
    .filter(item => item.type === 'Feature')
}

function filterPoiFeatures(features, maxFeatures) {
  const deduped = new Map()
  for (const feature of features) {
    if (!feature?.geometry || feature.geometry.type !== 'Point') continue
    const props = feature.properties || {}
    const name = readableName(props)
    const category = readableCategory(props)
    const score = poiScore({ name, category, props })
    if (score <= 0) continue
    const coordinates = feature.geometry.coordinates || []
    const key = props.id || feature.id || `${name}:${coordinates[0]?.toFixed?.(5)},${coordinates[1]?.toFixed?.(5)}`
    const simplified = {
      type: 'Feature',
      geometry: feature.geometry,
      properties: compactProps({
        id: String(props.id || feature.id || key).slice(0, 120),
        name,
        category: category.primary,
        group: category.group,
        confidence: numericOrNull(props.confidence),
        bbox_label: String(props.bbox_label || ''),
        source: 'overture',
        score,
      }),
    }
    const existing = deduped.get(key)
    if (!existing || existing.properties.score < score) deduped.set(key, simplified)
  }

  return [...deduped.values()]
    .sort((left, right) => right.properties.score - left.properties.score || String(left.properties.name).localeCompare(String(right.properties.name)))
    .slice(0, maxFeatures)
    .map(feature => ({
      ...feature,
      properties: compactProps({
        ...feature.properties,
        score: undefined,
      }),
    }))
}

function poiScore({ name, category, props }) {
  const text = `${category.primary} ${category.group} ${category.alternate.join(' ')} ${name}`.toLowerCase()
  const terms = [
    'trail', 'trailhead', 'park', 'national_park', 'campground', 'campsite',
    'viewpoint', 'mountain', 'peak', 'bicycle', 'bike', 'cycle', 'ski',
    'hotel', 'hostel', 'lodge', 'guest', 'restaurant', 'cafe', 'pub', 'bar',
    'attraction', 'museum', 'visitor', 'information', 'parking', 'outdoor',
    'adventure', 'tourism', 'beach', 'waterfall', 'forest', 'reserve',
  ]
  const matched = terms.filter(term => text.includes(term)).length
  const confidence = Number(props.confidence ?? 0.35)
  const named = name ? 3 : 0
  const relevant = matched ? matched * 3 : 0
  const fallbackCategories = [
    'hotel', 'hostel', 'guest_house', 'lodging', 'restaurant', 'cafe', 'bar',
    'pub', 'attraction', 'museum', 'tourism', 'camp_site', 'campground',
    'parking', 'bicycle', 'bicycle_rental', 'information',
  ]
  const fallbackUseful = name && confidence >= 0.65 && fallbackCategories.some(value => text.includes(value)) ? 1 : 0
  if (!matched && !fallbackUseful) return 0
  return relevant + named + fallbackUseful + Math.min(2, confidence * 2)
}

function readableName(props) {
  const names = props.names
  if (typeof props.name === 'string') return props.name.slice(0, 96)
  if (typeof names === 'string') return names.slice(0, 96)
  if (typeof names?.primary === 'string') return names.primary.slice(0, 96)
  if (Array.isArray(names?.common)) {
    const match = names.common.find(item => typeof item?.value === 'string' || typeof item?.name === 'string')
    return String(match?.value || match?.name || '').slice(0, 96)
  }
  if (names?.common && typeof names.common === 'object') {
    const value = Object.values(names.common).find(item => typeof item === 'string')
    if (value) return String(value).slice(0, 96)
  }
  return ''
}

function readableCategory(props) {
  const categories = props.categories || {}
  const alternate = Array.isArray(categories.alternate)
    ? categories.alternate
    : Array.isArray(categories.alternates)
      ? categories.alternates
      : []
  const primary = String(categories.primary || props.category || props.kind || '').slice(0, 80)
  const group = String(categories.main || categories.group || primary.split('.')[0] || '').slice(0, 80)
  return {
    primary,
    group,
    alternate: alternate.map(item => String(item).slice(0, 80)),
  }
}

function filterOutdoorRouteFeatures(elements, maxFeatures, maxGeometryPoints, bboxByLabel) {
  const deduped = new Map()
  const wayGeometryById = new Map()
  for (const element of elements) {
    if (element.type !== 'way' || !Array.isArray(element.geometry) || element.geometry.length < 2) continue
    const line = element.geometry.map(point => [point.lon, point.lat])
    wayGeometryById.set(element.id, line)
    wayGeometryById.set(`${element.bbox_label}:${element.id}`, line)
  }
  for (const element of elements) {
    if (element.type !== 'relation') continue
    const tags = element.tags || {}
    if (!['hiking', 'bicycle', 'mtb'].includes(tags.route)) continue
    const coordinates = []
    const clipBbox = bboxByLabel.get(element.bbox_label)
    for (const member of element.members || []) {
      if (member.type !== 'way') continue
      let line = null
      if (Array.isArray(member.geometry) && member.geometry.length >= 2) {
        line = member.geometry.map(point => [point.lon, point.lat])
      } else if (wayGeometryById.has(member.ref)) {
        line = wayGeometryById.get(`${element.bbox_label}:${member.ref}`) || wayGeometryById.get(member.ref)
      }
      if (!line) continue
      const clipped = clipLineToBbox(line, clipBbox)
      if (clipped.length >= 2) coordinates.push(clipped)
    }
    if (!coordinates.length) continue
    const simplifiedCoordinates = simplifyRouteCoordinates(coordinates, maxGeometryPoints)
    const name = String(tags.name || tags.ref || '').slice(0, 120)
    const score = routeScore(tags, simplifiedCoordinates)
    const feature = {
      type: 'Feature',
      geometry: {
        type: simplifiedCoordinates.length === 1 ? 'LineString' : 'MultiLineString',
        coordinates: simplifiedCoordinates.length === 1 ? simplifiedCoordinates[0] : simplifiedCoordinates,
      },
      properties: compactProps({
        osm_id: String(element.id),
        name,
        route: tags.route,
        network: tags.network,
        ref: tags.ref,
        operator: tags.operator,
        colour: tags.colour || tags.color,
        osmc_symbol: tags.osmc_symbol,
        distance: tags.distance,
        bbox_label: element.bbox_label,
        source: 'openstreetmap',
        geometry_generalized: totalCoordinateCount(coordinates) > totalCoordinateCount(simplifiedCoordinates) ? 'true' : undefined,
        score,
      }),
    }
    const key = `${element.id}:${element.bbox_label || ''}`
    const existing = deduped.get(key)
    if (!existing || existing.properties.score < score) deduped.set(key, feature)
  }

  return [...deduped.values()]
    .sort((left, right) => right.properties.score - left.properties.score || String(left.properties.name).localeCompare(String(right.properties.name)))
    .slice(0, maxFeatures)
    .map(feature => ({
      ...feature,
      properties: compactProps({
        ...feature.properties,
        score: undefined,
      }),
    }))
}

function clipLineToBbox(line, bbox) {
  if (!bbox) return line
  const clipped = []
  for (let index = 0; index < line.length; index += 1) {
    const point = line[index]
    const prev = line[index - 1]
    const next = line[index + 1]
    if (pointInBbox(point, bbox) || (prev && pointInBbox(prev, bbox)) || (next && pointInBbox(next, bbox))) {
      clipped.push(point)
    }
  }
  return clipped
}

function pointInBbox(point, bbox) {
  const [lng, lat] = point
  const [west, south, east, north] = bbox
  return lng >= west && lng <= east && lat >= south && lat <= north
}

function routeScore(tags, coordinates) {
  let score = 0
  if (tags.name) score += 6
  if (tags.ref) score += 3
  if (tags.route === 'mtb') score += 4
  if (tags.network) score += ['iwn', 'nwn', 'rwn', 'icn', 'ncn', 'rcn'].includes(tags.network) ? 3 : 1
  score += Math.min(5, coordinates.reduce((sum, line) => sum + line.length, 0) / 100)
  return score
}

function simplifyRouteCoordinates(coordinates, maxGeometryPoints) {
  const total = totalCoordinateCount(coordinates)
  if (!Number.isFinite(maxGeometryPoints) || maxGeometryPoints <= 0 || total <= maxGeometryPoints) return coordinates
  const stride = Math.ceil(total / maxGeometryPoints)
  const thinned = coordinates
    .map(line => thinLine(line, stride))
    .filter(line => line.length >= 2)
  if (totalCoordinateCount(thinned) <= maxGeometryPoints) return thinned
  return limitRouteLines(thinned, maxGeometryPoints)
}

function totalCoordinateCount(coordinates) {
  return coordinates.reduce((sum, line) => sum + line.length, 0)
}

function thinLine(line, stride) {
  if (line.length <= 2 || stride <= 1) return line
  const thinned = line.filter((_, index) => index === 0 || index === line.length - 1 || index % stride === 0)
  return thinned.length >= 2 ? thinned : [line[0], line.at(-1)]
}

function limitRouteLines(lines, maxGeometryPoints) {
  const longestFirst = [...lines].sort((left, right) => right.length - left.length)
  const kept = []
  let remaining = maxGeometryPoints
  for (const line of longestFirst) {
    if (remaining < 2) break
    if (line.length <= remaining) {
      kept.push(line)
      remaining -= line.length
      continue
    }
    const stride = Math.ceil(line.length / remaining)
    const thinned = thinLine(line, stride).slice(0, remaining)
    if (thinned.length >= 2) {
      kept.push(thinned)
      remaining -= thinned.length
    }
  }
  return kept
}

function overpassQuery(bbox, timeout) {
  const [west, south, east, north] = bbox
  return `
[out:json][timeout:${timeout}];
relation["type"="route"]["route"~"^(hiking|bicycle|mtb)$"](${south},${west},${north},${east})->.routes;
.routes out body;
way(r.routes);
out geom;
`
}

async function fetchOverpassJson({ targetId, label, query }) {
  let lastError = null
  const attempts = Math.max(1, overpassRetries)
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    for (const url of overpassUrls) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'content-type': 'application/x-www-form-urlencoded; charset=utf-8',
            'user-agent': 'RadMaps Atlas overlay builder (https://radmaps.studio)',
          },
          body: new URLSearchParams({ data: query }),
        })
        if (response.ok) return await response.json()
        const text = await response.text()
        lastError = new Error(`Overpass request failed for ${targetId}/${label} at ${url}: ${response.status} ${text.slice(0, 500)}`)
        console.warn(lastError.message)
      } catch (error) {
        lastError = error
        console.warn(`Overpass request failed for ${targetId}/${label}: ${error.message}`)
      }
      if (overpassDelayMs > 0) await delay(overpassDelayMs * attempt)
    }
  }
  throw lastError || new Error(`Overpass request failed for ${targetId}/${label}`)
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function buildPmtiles({ kind, layer, targetId, target, artifactPrefix, inputPath, pmtilesPath, objectPath }) {
  mkdirSync(dirname(pmtilesPath), { recursive: true })
  if (existsSync(pmtilesPath)) unlinkSync(pmtilesPath)
  if (kind === 'outdoorRoutes') {
    const mbtilesPath = pmtilesPath.replace(/\.pmtiles$/, '.mbtiles')
    if (existsSync(mbtilesPath)) unlinkSync(mbtilesPath)
    run(tippecanoeBin, [
      '--quiet',
      '--force',
      '--output',
      mbtilesPath,
      '--layer',
      layer,
      '--minimum-zoom',
      String(minzoom),
      '--maximum-zoom',
      String(maxzoom),
      '--no-feature-limit',
      '--no-tile-size-limit',
      '--no-tile-compression',
      inputPath,
    ], { heavy: true })
    run(pmtilesBin, [
      '--quiet',
      'convert',
      '--force',
      mbtilesPath,
      pmtilesPath,
    ], { heavy: true })
    if (existsSync(mbtilesPath)) unlinkSync(mbtilesPath)
  } else {
    run('ogr2ogr', [
      '-f',
      'PMTiles',
      pmtilesPath,
      inputPath,
      '-overwrite',
      '-nln',
      layer,
      '-dsco',
      `NAME=RadMaps ${target.label || targetId} ${kind}`,
      '-dsco',
      'TYPE=overlay',
      '-dsco',
      `MINZOOM=${minzoom}`,
      '-dsco',
      `MAXZOOM=${maxzoom}`,
      '-dsco',
      'MAX_SIZE=500000',
      '-dsco',
      'MAX_FEATURES=200000',
      '-lco',
      `NAME=${layer}`,
      '-lco',
      `MINZOOM=${minzoom}`,
      '-lco',
      `MAXZOOM=${maxzoom}`,
    ], { heavy: true })
  }

  const metadata = await pmtilesInfo(pmtilesPath)
  run('node', [
    'scripts/atlas-validate-pmtiles.mjs',
    '--file',
    pmtilesPath,
    '--minzoom',
    String(minzoom),
    '--maxzoom',
    String(maxzoom),
    '--tile-type',
    'mvt',
    '--layers',
    layer,
  ])

  return {
    id: artifactId(kind, artifactPrefix),
    targetId,
    kind,
    layer,
    objectPath,
    localPath: pmtilesPath,
    minzoom: metadata.minZoom,
    maxzoom: metadata.maxZoom,
    bounds: metadata.bounds,
    bytes: statSync(pmtilesPath).size,
    checksum: sha256File(pmtilesPath),
    sourceStrategy: sourceStrategyForKind(kind),
    sourceLicenses: sourceLicensesForKind(kind),
    sourceDate: date,
    status: environment === 'production' ? 'production' : 'staging',
    qaStatus: 'pending',
    coverageTarget: target.coverageTarget,
  }
}

function writeFeatureCollection(path, features) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${JSON.stringify({
    type: 'FeatureCollection',
    features,
  })}\n`)
}

function compactProps(props) {
  return Object.fromEntries(
    Object.entries(props)
      .filter(([, value]) => value !== undefined && value !== null && value !== '')
      .map(([key, value]) => [key, typeof value === 'number' ? value : String(value)]),
  )
}

function numericOrNull(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function artifactId(kind, artifactPrefix) {
  return kind === 'poi'
    ? `radmaps-${artifactPrefix}-poi`
    : `radmaps-${artifactPrefix}-outdoor-routes`
}

function sourceStrategyForKind(kind) {
  return kind === 'poi'
    ? 'bbox-filtered Overture Places overlay for global adventure/vacation hotspots'
    : 'OSM route=hiking/bicycle/mtb relation overlay for named outdoor routes'
}

function sourceLicensesForKind(kind) {
  return kind === 'poi'
    ? [
        {
          name: 'Overture Maps Foundation Places',
          url: 'https://docs.overturemaps.org/guides/places/',
          attribution: 'Overture Maps Foundation and source contributors',
        },
      ]
    : [
        {
          name: 'OpenStreetMap',
          url: 'https://www.openstreetmap.org/copyright',
          attribution: '© OpenStreetMap contributors',
        },
      ]
}

function unionBboxes(bboxes) {
  if (!bboxes.length) return [-180, -90, 180, 90]
  return bboxes.reduce((acc, bbox) => [
    Math.min(acc[0], bbox[0]),
    Math.min(acc[1], bbox[1]),
    Math.max(acc[2], bbox[2]),
    Math.max(acc[3], bbox[3]),
  ], [180, 90, -180, -90])
}

function writeOverlayManifest({ targetId, target, outputs, manifestPath }) {
  const artifacts = {}
  for (const output of outputs) {
    artifacts[output.kind] ||= []
    artifacts[output.kind].push({
      id: output.id,
      kind: output.kind,
      url: publicBaseUrl ? `${publicBaseUrl}/${output.objectPath}` : '',
      objectPath: output.objectPath,
      minzoom: output.minzoom,
      maxzoom: output.maxzoom,
      bounds: output.bounds,
      layers: [output.layer],
      bytes: output.bytes,
      checksum: output.checksum,
      sourceLicenses: output.sourceLicenses,
      sourceStrategy: output.sourceStrategy,
      sourceDate: output.sourceDate,
      generatedBy: 'scripts/atlas-build-overlays.mjs',
      qaStatus: output.qaStatus,
      createdAt: new Date().toISOString(),
      status: output.status,
      sourceRegion: targetId,
    })
  }

  const manifest = {
    atlasVersion: version,
    schemaVersion: 'radmaps-atlas-v1',
    coverage: target.coverageTarget || targetId,
    label: target.label || `RadMaps overlays: ${targetId}`,
    createdAt: new Date().toISOString(),
    storage: {
      provider: 'cloudflare-r2',
      bucket,
      ...(publicBaseUrl ? { publicBaseUrl } : {}),
    },
    artifacts,
    layerCatalog: [...new Set(outputs.map(output => output.layer))],
    attribution: [
      {
        name: 'OpenStreetMap',
        requiredText: '© OpenStreetMap contributors',
        url: 'https://www.openstreetmap.org/copyright',
      },
      {
        name: 'Overture Maps Foundation',
        requiredText: 'Overture Maps Foundation and source contributors',
        url: 'https://overturemaps.org/',
      },
    ],
  }

  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
  console.log(JSON.stringify({ manifest: manifestPath, artifacts: outputs.map(output => output.id) }, null, 2))
}

function uploadArtifact(output) {
  if (output.dryRun) return
  run('node', [
    'scripts/upload-atlas-object.mjs',
    '--bucket',
    bucket,
    '--source',
    output.localPath,
    '--object',
    output.objectPath,
    '--verify',
    'pmtiles',
  ], { heavy: true })
}

function publishGeneratedManifest(manifestPath, outputs) {
  if (dryRun) {
    console.log(JSON.stringify({
      dryRunPublish: true,
      manifestPath,
      kinds: [...new Set(outputs.map(output => output.kind))],
      targetManifest: `public/atlas/manifests/${environment}.json`,
      objectPath: `atlas/v1/manifests/${environment}.json`,
    }, null, 2))
    return
  }
  const manifestPathForEnvironment = resolve(repoRoot, `public/atlas/manifests/${environment}.json`)
  for (const kind of [...new Set(outputs.map(output => output.kind))]) {
    run('node', [
      'scripts/atlas-merge-manifest-artifact.mjs',
      '--source',
      manifestPath,
      '--target',
      manifestPathForEnvironment,
      '--output',
      manifestPathForEnvironment,
      '--kind',
      kind,
      '--atlas-version',
      version,
      ...(publicBaseUrl ? ['--public-base-url', publicBaseUrl] : []),
    ])
  }
  run('node', [
    'scripts/upload-atlas-object.mjs',
    '--bucket',
    bucket,
    '--source',
    manifestPathForEnvironment,
    '--object',
    `atlas/v1/manifests/${environment}.json`,
    '--content-type',
    'application/json',
    '--verify',
    'json',
  ], { heavy: true })
}

async function pmtilesInfo(path) {
  class NodeFileSource {
    getKey() {
      return path
    }

    getBytes(offset, length) {
      const fd = requireOpenSync(path)
      try {
        const buffer = Buffer.alloc(length)
        const bytesRead = readSyncCompat(fd, buffer, offset)
        return Promise.resolve({ data: buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + bytesRead) })
      } finally {
        closeSyncCompat(fd)
      }
    }
  }

  const archive = new PMTiles(new NodeFileSource())
  const header = await archive.getHeader()
  const metadata = await archive.getMetadata().catch(() => ({}))
  if (header.tileType !== TileType.Mvt) throw new Error(`Expected MVT PMTiles, got tile type ${header.tileType}`)
  return {
    minZoom: header.minZoom,
    maxZoom: header.maxZoom,
    bounds: [header.minLon, header.minLat, header.maxLon, header.maxLat],
    vectorLayers: Array.isArray(metadata.vector_layers) ? metadata.vector_layers.map(layer => layer.id) : [],
  }
}

function sha256File(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

function run(cmd, cmdArgs, opts = {}) {
  const printable = [cmd, ...cmdArgs].join(' ')
  console.log(`$ ${printable}`)
  if (dryRun && opts.heavy) return ''
  const result = spawnSync(cmd, cmdArgs, {
    cwd: repoRoot,
    stdio: opts.capture ? 'pipe' : 'inherit',
    encoding: 'utf8',
  })
  if (opts.optional && result.status !== 0) return ''
  if (result.status !== 0) throw new Error(`Command failed (${result.status}): ${printable}`)
  return result.stdout || result.stderr || ''
}

function requireOpenSync(path) {
  return openSync(path, 'r')
}

function readSyncCompat(fd, buffer, offset) {
  return readSync(fd, buffer, 0, buffer.length, offset)
}

function closeSyncCompat(fd) {
  closeSync(fd)
}
