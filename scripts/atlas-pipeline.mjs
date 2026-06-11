#!/usr/bin/env node
/**
 * Cloud-runner atlas build pipeline.
 *
 * This is intentionally orchestration-only. Heavy work happens on the runner
 * that invokes it: GitHub larger runner, self-hosted VM, or short-lived cloud VM
 * with enough scratch disk. Artifacts are uploaded to Cloudflare R2.
 */

import { closeSync, existsSync, mkdirSync, openSync, readFileSync, readSync, statSync, unlinkSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const repoRoot = resolve(__dirname, '..')
const args = parseArgs(process.argv.slice(2))
const env = { ...loadEnv(resolve(repoRoot, '.env')), ...process.env }
const regions = JSON.parse(readFileSync(resolve(repoRoot, 'atlas/regions.json'), 'utf8'))
const coverageTargets = JSON.parse(readFileSync(resolve(repoRoot, 'atlas/coverage-targets.json'), 'utf8'))
const regionKey = args.region || 'driftless-lab'
const region = regions[regionKey]
if (!region) throw new Error(`Unknown atlas region: ${regionKey}`)

const stage = args.stage || 'all'
const environment = args.environment || 'staging'
const date = args.date || new Date().toISOString().slice(0, 10)
const version = args.version || `${date.replaceAll('-', '.')}-${region.coverage}.1`
const dryRun = Boolean(args.dryRun)
const allowMissingContours = args.allowMissingContours !== false
const buildRoot = resolve(repoRoot, args.workdir || `atlas/build/${region.id}`)
const sourceDir = resolve(buildRoot, 'source')
const outputDir = resolve(buildRoot, 'output')
const manifestPath = resolve(repoRoot, `public/atlas/manifests/${environment}.json`)
const publicBaseUrl = args.publicBaseUrl || env.ATLAS_PUBLIC_BASE_URL
const bucket = args.bucket || (environment === 'production' ? 'radmaps-atlas-prod' : 'radmaps-atlas-staging')
const estimatedCostUsd = numericArg(args.estimatedCostUsd, env.ATLAS_ESTIMATED_COST_USD)

const stages = expandStage(stage)
console.log(JSON.stringify({
  pipeline: 'radmaps-atlas',
  region: regionKey,
  environment,
  version,
  stages,
  dryRun,
  buildRoot,
  estimatedCostUsd,
}, null, 2))

mkdirSync(sourceDir, { recursive: true })
mkdirSync(outputDir, { recursive: true })

enforceCoverageCostGate()
if (stages.includes('preflight')) preflight()
if (stages.includes('download')) downloadSource()
if (stages.includes('base')) buildBase()
if (stages.includes('feature-ids')) stampFeatureIds()
if (stages.includes('contours')) buildContours()
if (stages.includes('validate')) validateArtifacts()
if (stages.includes('upload')) uploadArtifacts()
if (stages.includes('manifest')) generateManifest()
if (stages.includes('publish')) publishManifest()
if (stages.includes('promote-approved')) promoteApprovedArtifacts()

function parseArgs(argv) {
  const parsed = { allowMissingContours: true }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--region') parsed.region = argv[++i]
    else if (arg === '--bucket') parsed.bucket = argv[++i]
    else if (arg === '--environment') parsed.environment = argv[++i]
    else if (arg === '--stage') parsed.stage = argv[++i]
    else if (arg === '--version') parsed.version = argv[++i]
    else if (arg === '--date') parsed.date = argv[++i]
    else if (arg === '--workdir') parsed.workdir = argv[++i]
    else if (arg === '--public-base-url') parsed.publicBaseUrl = argv[++i]
    else if (arg === '--estimated-cost-usd') parsed.estimatedCostUsd = argv[++i]
    else if (arg === '--dry-run') parsed.dryRun = true
    else if (arg === '--no-allow-missing-contours') parsed.allowMissingContours = false
    else if (arg === '--help' || arg === '-h') {
      console.log(`Usage: node scripts/atlas-pipeline.mjs [options]

Options:
  --region <id>                 Region key from atlas/regions.json
  --bucket <name>               R2 bucket override
  --environment <name>          staging or production
  --stage <name>                all, preflight, download, base, feature-ids, contours, validate, upload, manifest, publish, promote-approved
  --version <id>                Atlas version, defaults to date + coverage
  --date <yyyy-mm-dd>           Date inserted into R2 object paths
  --workdir <path>              Build scratch dir, defaults to atlas/build/<region>
  --public-base-url <url>       R2 public base URL
  --estimated-cost-usd <value>  Required for real heavyweight builds; checked against atlas/coverage-targets.json
  --dry-run                     Print commands without running heavyweight stages
  --no-allow-missing-contours   Fail if a region has no contour artifact`)
      process.exit(0)
    }
  }
  return parsed
}

function numericArg(...values) {
  const raw = values.find(value => value !== undefined && value !== null && String(value).trim() !== '')
  if (raw === undefined) return null
  const parsed = Number(raw)
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error(`Invalid estimated cost: ${raw}`)
  return parsed
}

function enforceCoverageCostGate() {
  const target = findCoverageTarget()
  const heavyStages = stages.filter(item => ['download', 'base', 'contours', 'upload'].includes(item))
  const requiresEstimate = !dryRun && heavyStages.length > 0
  const guardrails = coverageTargets.costGuardrails || {}
  const totalBudgetUsd = Number(guardrails.totalBuildBudgetUsd ?? guardrails.awsExperimentBudgetUsdPerMonth ?? 200)
  const actualCoverageBuildCostUsd = Number(guardrails.actualCoverageBuildCostUsd ?? guardrails.observedAwsMonthToDateUsd ?? 0)
  const remainingBudgetUsd = Math.max(0, totalBudgetUsd - actualCoverageBuildCostUsd)
  const targetMaxUsd = target?.maxNewBuildCostUsd

  console.log(JSON.stringify({
    costGate: {
      schemaVersion: coverageTargets.schemaVersion,
      targetId: target?.id ?? null,
      heavyStages,
      dryRun,
      estimatedCostUsd,
      actualCoverageBuildCostUsd,
      totalBudgetUsd,
      remainingBudgetUsd,
      targetMaxUsd,
    },
  }, null, 2))

  if (target?.status?.startsWith('deferred') && requiresEstimate) {
    throw new Error(`Coverage target ${target.id} is ${target.status}; move it to build-candidate/qa-ready/staging-live before running real build stages`)
  }
  if (!requiresEstimate) return
  if (estimatedCostUsd === null || estimatedCostUsd <= 0) {
    throw new Error('Real atlas build stages require --estimated-cost-usd so the $200 coverage budget gate can run')
  }
  if (estimatedCostUsd > remainingBudgetUsd) {
    throw new Error(`Estimated atlas build cost $${estimatedCostUsd.toFixed(2)} exceeds remaining $${remainingBudgetUsd.toFixed(2)} of the $${totalBudgetUsd.toFixed(2)} coverage budget`)
  }
  if (typeof targetMaxUsd === 'number' && estimatedCostUsd > targetMaxUsd) {
    throw new Error(`Estimated atlas build cost $${estimatedCostUsd.toFixed(2)} exceeds ${target.id}'s $${targetMaxUsd.toFixed(2)} target cap`)
  }
}

function findCoverageTarget() {
  return (coverageTargets.targets || []).find(target =>
    target.id === regionKey ||
    target.id === region.coverage ||
    target.atlasRegion === regionKey ||
    target.atlasRegion === region.id,
  )
}

function expandStage(value) {
  if (value === 'all') return ['preflight', 'download', 'base', 'feature-ids', 'contours', 'validate', 'upload', 'manifest', 'publish']
  return value.split(',').map(item => item.trim()).filter(Boolean)
}

function preflight() {
  const defaultMinGb = region.scratchGb || (region.id === 'north-america' ? 900 : region.id === 'us' ? 500 : 120)
  const minGb = Number(env.ATLAS_MIN_FREE_GB || defaultMinGb)
  const freeKb = Number(command('df', ['-Pk', buildRoot], { capture: true }).trim().split(/\s+/).at(-3) || 0)
  const freeGb = freeKb / 1024 / 1024
  const docker = command('docker', ['--version'], { capture: true, optional: true }).trim()
  const summary = { freeGb: Number(freeGb.toFixed(1)), minGb, docker: docker || 'missing' }
  console.log(JSON.stringify({ preflight: summary }, null, 2))
  if (!docker && region.planetiler?.enabled) throw new Error('Docker is required for Planetiler stages')
  if (!dryRun && freeGb < minGb) throw new Error(`Need at least ${minGb}GB free for ${regionKey}, found ${freeGb.toFixed(1)}GB`)
}

function downloadSource() {
  if (!region.source?.url) {
    console.log('No remote source configured; skipping download.')
    return
  }
  const target = sourcePbfPath()
  if (existsSync(target) && statSync(target).size > 0) {
    if (looksLikeHtml(target)) {
      console.warn(`Existing source looks like HTML, deleting and redownloading: ${target}`)
      unlinkSync(target)
    } else {
      console.log(`Using existing source: ${target}`)
      return
    }
  }
  if (existsSync(target) && statSync(target).size > 0) {
    console.log(`Using existing source: ${target}`)
    return
  }
  run('curl', ['--fail', '--location', '--continue-at', '-', '--output', target, region.source.url], { heavy: true })
}

function looksLikeHtml(file) {
  const fd = openSync(file, 'r')
  try {
    const buffer = Buffer.alloc(256)
    const bytesRead = readSync(fd, buffer, 0, buffer.length, 0)
    const prefix = buffer.subarray(0, bytesRead).toString('utf8').trimStart().toLowerCase()
    return prefix.startsWith('<!doctype html') || prefix.startsWith('<html')
  } finally {
    closeSync(fd)
  }
}

function buildBase() {
  if (!region.planetiler?.enabled) {
    console.log(`Planetiler base build disabled for ${regionKey}; using existing base artifact.`)
    return
  }
  const output = resolve(repoRoot, fillPath(region.base.localPath))
  mkdirSync(dirname(output), { recursive: true })
  const dataDir = buildRoot
  const containerSource = `/data/source/${region.id}-latest.osm.pbf`
  const containerOutput = `/data/output/${output.split('/').pop()}`
  const hostSource = sourcePbfPath()
  if (dryRun && !existsSync(hostSource)) {
    console.log(`dry-run: source PBF is not present yet, Planetiler will run after download: ${hostSource}`)
    return
  }
  if (!existsSync(hostSource)) throw new Error(`Missing source PBF: ${hostSource}`)
  const image = env.PLANETILER_IMAGE || region.planetiler.image || 'ghcr.io/onthegomap/planetiler:latest'
  const javaOpts = env.PLANETILER_JAVA_TOOL_OPTIONS || region.planetiler.javaToolOptions || '-Xmx24g'
  const planetilerArgs = [
    'run',
    '--rm',
    '--user',
    `${process.getuid?.() ?? 1000}:${process.getgid?.() ?? 1000}`,
    '-e',
    `JAVA_TOOL_OPTIONS=${javaOpts}`,
    '-v',
    `${dataDir}:/data`,
    image,
    `--osm-path=${containerSource}`,
    `--output=${containerOutput}`,
    `--bounds=${region.bbox.join(',')}`,
    ...(region.planetiler.extraArgs || []),
  ]
  if (hostSource !== resolve(sourceDir, `${region.id}-latest.osm.pbf`)) {
    console.warn(`Expected source PBF at ${resolve(sourceDir, `${region.id}-latest.osm.pbf`)}, got ${hostSource}`)
  }
  run('docker', planetilerArgs, { heavy: true })
}

function stampFeatureIds() {
  // Stamps stable rm_id feature ids onto label layers of the base artifact
  // (docs/ATLAS_STABLE_FEATURE_IDS.md). In-place rewrite of the local PMTiles
  // before validate/upload; idempotent, so reruns are safe. Marked heavy so
  // dry runs never mutate an existing artifact. Local-compute only: not part
  // of the coverage cost gate's heavyweight stage list, which is unchanged.
  if (!region.base?.localPath) {
    console.log(`No base artifact configured for ${regionKey}; skipping feature-id stamping.`)
    return
  }
  const file = resolve(repoRoot, fillPath(region.base.localPath))
  if (dryRun && !existsSync(file)) {
    console.log(`dry-run: base artifact is not present yet, feature-id stamping will run after build: ${file}`)
    return
  }
  if (!existsSync(file)) throw new Error(`Missing base artifact for feature-id stamping: ${file}`)
  run('node', ['scripts/atlas-add-feature-ids.mjs', '--input', file, '--in-place'], { heavy: true })
}

function buildContours() {
  if (!region.contours?.enabled) {
    console.log(`Contours disabled for ${regionKey}; skipping contour build.`)
    return
  }
  const output = resolve(repoRoot, fillPath(region.contours.localPath))
  run('node', [
    'scripts/build-contour-pmtiles.mjs',
    '--region',
    region.contours.scriptRegion || region.id,
    '--output',
    output.replace(`${repoRoot}/`, ''),
  ], { heavy: true })
}

function validateArtifacts() {
  validateArtifact('base', region.base)
  if (region.contours?.enabled && existsSync(resolve(repoRoot, fillPath(region.contours.localPath)))) {
    validateArtifact('contours', region.contours)
  } else if (region.contours?.enabled && !allowMissingContours) {
    throw new Error(`Missing contour artifact for ${regionKey}`)
  }
}

function validateArtifact(name, config) {
  if (!config?.localPath) return
  const file = resolve(repoRoot, fillPath(config.localPath))
  if (dryRun && !existsSync(file)) {
    console.log(`dry-run: ${name} artifact is not present yet, validation will run after build: ${file}`)
    return
  }
  if (!existsSync(file)) throw new Error(`Missing ${name} artifact: ${file}`)
  run('node', [
    'scripts/atlas-validate-pmtiles.mjs',
    '--file',
    file,
    '--minzoom',
    String(config.minzoom ?? 0),
    '--maxzoom',
    String(config.maxzoom ?? 14),
    '--tile-type',
    'mvt',
  ])
}

function uploadArtifacts() {
  uploadArtifact(region.base)
  if (region.contours?.enabled && existsSync(resolve(repoRoot, fillPath(region.contours.localPath)))) uploadArtifact(region.contours)
}

function uploadArtifact(config) {
  const source = resolve(repoRoot, fillPath(config.localPath))
  const object = fillPath(config.objectPath)
  run('node', [
    'scripts/upload-atlas-object.mjs',
    '--bucket',
    bucket,
    '--source',
    source,
    '--object',
    object,
    '--verify',
    'pmtiles',
  ], { heavy: true })
}

function generateManifest() {
  const baseArtifact = resolve(repoRoot, fillPath(region.base.localPath))
  if (dryRun && !existsSync(baseArtifact)) {
    console.log(`dry-run: base artifact is not present yet, manifest generation will run after build: ${baseArtifact}`)
    return
  }
  const generatedManifestPath = resolve(buildRoot, 'manifest', `${environment}-${region.id}.json`)
  mkdirSync(dirname(generatedManifestPath), { recursive: true })
  run('node', [
    'scripts/atlas-generate-manifest.mjs',
    '--region',
    regionKey,
    '--environment',
    environment,
    '--date',
    date,
    '--version',
    version,
    '--bucket',
    bucket,
    ...(publicBaseUrl ? ['--public-base-url', publicBaseUrl] : []),
    '--output',
    generatedManifestPath,
  ])
  mergeGeneratedManifest(generatedManifestPath, 'base')
  if (region.contours?.enabled && existsSync(resolve(repoRoot, fillPath(region.contours.localPath)))) {
    mergeGeneratedManifest(generatedManifestPath, 'contours')
  }
}

function mergeGeneratedManifest(source, kind) {
  run('node', [
    'scripts/atlas-merge-manifest-artifact.mjs',
    '--source',
    source,
    '--target',
    manifestPath,
    '--output',
    manifestPath,
    '--kind',
    kind,
    '--atlas-version',
    version,
    ...(publicBaseUrl ? ['--public-base-url', publicBaseUrl] : []),
  ])
}

function publishManifest() {
  run('node', [
    'scripts/upload-atlas-object.mjs',
    '--bucket',
    bucket,
    '--source',
    manifestPath,
    '--object',
    `atlas/v1/manifests/${environment}.json`,
    '--content-type',
    'application/json',
    '--verify',
    'json',
  ], { heavy: true })
}

function promoteApprovedArtifacts() {
  run('node', [
    'scripts/atlas-promote-approved.mjs',
    '--atlas-version',
    version,
    ...(dryRun ? ['--dry-run'] : []),
  ])
}

function sourcePbfPath() {
  return resolve(sourceDir, `${region.id}-latest.osm.pbf`)
}

function fillPath(value) {
  return value.replaceAll('{date}', date).replaceAll('{version}', version)
}

function run(cmd, cmdArgs, opts = {}) {
  const printable = [cmd, ...cmdArgs].join(' ')
  console.log(`$ ${printable}`)
  if (dryRun && opts.heavy) return
  const result = spawnSync(cmd, cmdArgs, {
    cwd: repoRoot,
    stdio: opts.capture ? 'pipe' : 'inherit',
    encoding: 'utf8',
  })
  if (opts.optional && result.status !== 0) return ''
  if (result.status !== 0) throw new Error(`Command failed (${result.status}): ${printable}`)
  return result.stdout || ''
}

function command(cmd, cmdArgs, opts = {}) {
  return run(cmd, cmdArgs, opts)
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
