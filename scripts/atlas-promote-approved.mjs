#!/usr/bin/env node
/**
 * Promote approved staging atlas artifacts into the production R2 bucket.
 *
 * This copies PMTiles server-side through the R2 S3 API, then publishes a
 * production manifest that only references objects present in the prod bucket.
 */

import { createHash, createHmac } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const repoRoot = resolve(__dirname, '..')
const args = parseArgs(process.argv.slice(2))
const env = { ...loadEnv(resolve(repoRoot, '.env')), ...process.env }

const sourceManifestPath = resolve(repoRoot, args.sourceManifest || 'public/atlas/manifests/staging.json')
const targetManifestPath = resolve(repoRoot, args.targetManifest || 'public/atlas/manifests/production.json')
const outputPath = resolve(repoRoot, args.output || 'atlas/build/promotion/production.approved.json')
const dryRun = Boolean(args.dryRun)
const uploadManifest = args.uploadManifest !== false
const forceCopy = Boolean(args.forceCopy)
const sourceManifest = JSON.parse(readFileSync(sourceManifestPath, 'utf8'))
const targetManifest = JSON.parse(readFileSync(targetManifestPath, 'utf8'))
const sourceBucket = args.sourceBucket || sourceManifest.storage?.bucket || 'radmaps-atlas-staging'
const targetBucket = args.targetBucket || targetManifest.storage?.bucket || 'radmaps-atlas-prod'
const targetPublicBaseUrl = stripTrailingSlash(
  args.targetPublicBaseUrl || env.ATLAS_PROD_PUBLIC_BASE_URL || targetManifest.storage?.publicBaseUrl || '',
)
const accountId = args.accountId || env.CLOUDFLARE_ACCOUNT_ID
const accessKeyId = args.accessKeyId || env.R2_ACCESS_KEY_ID
const secretAccessKey = args.secretAccessKey || env.R2_SECRET_ACCESS_KEY
const sessionToken = args.sessionToken || env.R2_SESSION_TOKEN
const endpoint = stripTrailingSlash(args.endpoint || env.ATLAS_R2_ENDPOINT || (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : ''))
const partSizeBytes = Math.max(64, Number(args.partSizeMib || 1024)) * 1024 * 1024
const multipartCopyThresholdBytes = 4.5 * 1024 * 1024 * 1024
const manifestObjectPath = args.manifestObjectPath || 'atlas/v1/manifests/production.json'
const workerManifestUrl = args.workerManifestUrl || 'https://tiles.radmaps.studio/manifests/production.json'
const atlasVersion = args.atlasVersion || `${new Date().toISOString().slice(0, 10).replaceAll('-', '.')}-approved-coverage.1`
const label = args.label || 'RadMaps production atlas: approved coverage'
const coverage = args.coverage || 'north-america-global-proof-packs'

if (!targetPublicBaseUrl) throw new Error('Missing production public base URL. Set ATLAS_PROD_PUBLIC_BASE_URL or --target-public-base-url.')
if (!dryRun && (!accountId || !accessKeyId || !secretAccessKey || !endpoint)) {
  throw new Error('Missing CLOUDFLARE_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, or R2 endpoint.')
}

const promotedArtifacts = selectArtifacts(sourceManifest, args.artifactIds)
const candidateManifest = buildCandidateManifest({
  sourceManifest,
  targetManifest,
  promotedArtifacts,
  targetBucket,
  targetPublicBaseUrl,
  atlasVersion,
  label,
  coverage,
})

mkdirSync(dirname(outputPath), { recursive: true })
writeFileSync(outputPath, `${JSON.stringify(candidateManifest, null, 2)}\n`)

console.log(JSON.stringify({
  promotion: 'radmaps-atlas-approved',
  dryRun,
  sourceBucket,
  targetBucket,
  targetPublicBaseUrl,
  outputPath,
  atlasVersion,
  promotedArtifacts: promotedArtifacts.map(artifact => ({
    id: artifact.id,
    bytes: artifact.bytes,
    objectPath: artifact.objectPath,
  })),
  candidateCounts: artifactCounts(candidateManifest),
}, null, 2))

if (dryRun) process.exit(0)

for (const artifact of promotedArtifacts) {
  await copyArtifact(artifact)
  await verifyPublicPmtiles(artifact)
}

if (uploadManifest) {
  await putObjectText({
    bucket: targetBucket,
    objectPath: manifestObjectPath,
    body: `${JSON.stringify(candidateManifest, null, 2)}\n`,
    contentType: 'application/json; charset=utf-8',
    cacheControl: 'max-age=60',
  })
  const publicManifest = await verifyPublicJson(`${targetPublicBaseUrl}/${manifestObjectPath}`)
  const workerManifest = await verifyPublicJson(workerManifestUrl)
  console.log(JSON.stringify({
    uploadedManifest: true,
    publicManifest: {
      url: `${targetPublicBaseUrl}/${manifestObjectPath}`,
      atlasVersion: publicManifest.atlasVersion,
      counts: artifactCounts(publicManifest),
    },
    workerManifest: {
      url: workerManifestUrl,
      atlasVersion: workerManifest.atlasVersion,
      counts: artifactCounts(workerManifest),
    },
  }, null, 2))
}

function parseArgs(argv) {
  const parsed = { uploadManifest: true }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--source-manifest') parsed.sourceManifest = argv[++i]
    else if (arg === '--target-manifest') parsed.targetManifest = argv[++i]
    else if (arg === '--output') parsed.output = argv[++i]
    else if (arg === '--artifact-ids') parsed.artifactIds = argv[++i]
    else if (arg === '--source-bucket') parsed.sourceBucket = argv[++i]
    else if (arg === '--target-bucket') parsed.targetBucket = argv[++i]
    else if (arg === '--target-public-base-url') parsed.targetPublicBaseUrl = argv[++i]
    else if (arg === '--manifest-object-path') parsed.manifestObjectPath = argv[++i]
    else if (arg === '--worker-manifest-url') parsed.workerManifestUrl = argv[++i]
    else if (arg === '--atlas-version') parsed.atlasVersion = argv[++i]
    else if (arg === '--label') parsed.label = argv[++i]
    else if (arg === '--coverage') parsed.coverage = argv[++i]
    else if (arg === '--part-size-mib') parsed.partSizeMib = argv[++i]
    else if (arg === '--endpoint') parsed.endpoint = argv[++i]
    else if (arg === '--account-id') parsed.accountId = argv[++i]
    else if (arg === '--access-key-id') parsed.accessKeyId = argv[++i]
    else if (arg === '--secret-access-key') parsed.secretAccessKey = argv[++i]
    else if (arg === '--session-token') parsed.sessionToken = argv[++i]
    else if (arg === '--dry-run') parsed.dryRun = true
    else if (arg === '--force-copy') parsed.forceCopy = true
    else if (arg === '--no-upload-manifest') parsed.uploadManifest = false
    else if (arg === '--help' || arg === '-h') {
      console.log(`Usage: node scripts/atlas-promote-approved.mjs [options]

Options:
  --artifact-ids <ids|all>         Comma-separated staging base artifact ids, default all base artifacts
  --source-manifest <path>         Source manifest, default public/atlas/manifests/staging.json
  --target-manifest <path>         Base production manifest, default public/atlas/manifests/production.json
  --target-public-base-url <url>   Production R2 public base URL
  --atlas-version <version>        Production manifest version
  --dry-run                        Write candidate manifest and print copy plan only
  --force-copy                     Recopy even if destination object exists with expected size
  --no-upload-manifest             Copy artifacts only; do not publish production manifest`)
      process.exit(0)
    }
  }
  return parsed
}

function selectArtifacts(manifest, idsValue) {
  const base = artifactArray(manifest.artifacts?.base)
  const ids = idsValue && idsValue !== 'all'
    ? new Set(idsValue.split(',').map(id => id.trim()).filter(Boolean))
    : null
  const selected = ids ? base.filter(artifact => ids.has(artifact.id)) : base
  if (!selected.length) throw new Error('No staging base artifacts selected for promotion.')
  for (const artifact of selected) {
    if (!artifact.id || !artifact.objectPath || !artifact.bytes) {
      throw new Error(`Selected artifact is missing id, objectPath, or bytes: ${JSON.stringify(artifact)}`)
    }
  }
  if (ids) {
    const found = new Set(selected.map(artifact => artifact.id))
    const missing = Array.from(ids).filter(id => !found.has(id))
    if (missing.length) throw new Error(`Unknown staging artifact ids: ${missing.join(', ')}`)
  }
  return selected
}

function buildCandidateManifest({ targetManifest, promotedArtifacts, targetBucket, targetPublicBaseUrl, atlasVersion, label, coverage }) {
  const manifest = structuredClone(targetManifest)
  const incoming = promotedArtifacts.map(artifact => ({
    ...artifact,
    url: `${targetPublicBaseUrl}/${artifact.objectPath}`,
    status: 'production',
  }))
  const incomingIds = new Set(incoming.map(artifact => artifact.id))
  const currentBase = artifactArray(manifest.artifacts?.base)
  manifest.artifacts = {
    ...(manifest.artifacts || {}),
    base: [
      ...currentBase.filter(artifact => !incomingIds.has(artifact.id)),
      ...incoming,
    ],
  }
  manifest.storage = {
    ...(manifest.storage || {}),
    provider: 'cloudflare-r2',
    bucket: targetBucket,
    publicBaseUrl: targetPublicBaseUrl,
  }
  manifest.layerCatalog = Array.from(new Set([
    ...(manifest.layerCatalog || []),
    ...incoming.flatMap(artifact => artifact.layers || []),
  ])).filter(layer => layer !== 'landuse' && layer !== 'transportation_name')
  manifest.atlasVersion = atlasVersion
  manifest.label = label
  manifest.coverage = coverage
  manifest.updatedAt = new Date().toISOString()
  return manifest
}

async function copyArtifact(artifact) {
  const existing = await headObject(targetBucket, artifact.objectPath)
  if (existing && !forceCopy) {
    if (existing.bytes === artifact.bytes) {
      console.log(JSON.stringify({ copy: 'skip-existing', id: artifact.id, objectPath: artifact.objectPath, bytes: artifact.bytes }))
      return
    }
    throw new Error(`Destination exists with unexpected size for ${artifact.id}: expected ${artifact.bytes}, got ${existing.bytes}`)
  }

  const result = artifact.bytes > multipartCopyThresholdBytes
    ? await multipartCopyObject(artifact)
    : await copyObject(artifact)
  console.log(JSON.stringify({ copy: 'complete', id: artifact.id, ...result }))
}

async function copyObject(artifact) {
  const request = signedS3Request({
    method: 'PUT',
    bucket: targetBucket,
    objectPath: artifact.objectPath,
    payloadHash: hash(''),
    headers: {
      'x-amz-copy-source': copySourceHeader(sourceBucket, artifact.objectPath),
    },
  })
  const response = await fetch(request.url, { method: 'PUT', headers: request.headers, body: '' })
  const text = await response.text()
  if (!response.ok) throw new Error(`R2 CopyObject failed for ${artifact.id}: ${response.status} ${response.statusText}\n${text}`)
  return { multipart: false, etag: xmlValue(text, 'ETag').replace(/^"|"$/g, '') || response.headers.get('etag') }
}

async function multipartCopyObject(artifact) {
  const emptyHash = hash('')
  const initiate = signedS3Request({
    method: 'POST',
    bucket: targetBucket,
    objectPath: artifact.objectPath,
    query: { uploads: '' },
    payloadHash: emptyHash,
    headers: {
      'content-type': 'application/octet-stream',
    },
  })
  const initiateResponse = await fetch(initiate.url, { method: 'POST', headers: initiate.headers, body: '' })
  const initiateText = await initiateResponse.text()
  if (!initiateResponse.ok) {
    throw new Error(`R2 multipart copy initiation failed for ${artifact.id}: ${initiateResponse.status} ${initiateResponse.statusText}\n${initiateText}`)
  }

  const uploadId = xmlValue(initiateText, 'UploadId')
  if (!uploadId) throw new Error(`R2 multipart copy initiation did not return UploadId for ${artifact.id}:\n${initiateText}`)

  const parts = []
  const totalParts = Math.ceil(artifact.bytes / partSizeBytes)
  try {
    for (let index = 0; index < totalParts; index += 1) {
      const partNumber = index + 1
      const start = index * partSizeBytes
      const end = Math.min(artifact.bytes - 1, start + partSizeBytes - 1)
      const part = signedS3Request({
        method: 'PUT',
        bucket: targetBucket,
        objectPath: artifact.objectPath,
        query: { partNumber, uploadId },
        payloadHash: emptyHash,
        headers: {
          'x-amz-copy-source': copySourceHeader(sourceBucket, artifact.objectPath),
          'x-amz-copy-source-range': `bytes=${start}-${end}`,
        },
      })
      const response = await fetch(part.url, { method: 'PUT', headers: part.headers, body: '' })
      const text = await response.text()
      if (!response.ok) {
        throw new Error(`R2 UploadPartCopy ${partNumber}/${totalParts} failed for ${artifact.id}: ${response.status} ${response.statusText}\n${text}`)
      }
      const etag = xmlValue(text, 'ETag')
      if (!etag) throw new Error(`R2 UploadPartCopy ${partNumber}/${totalParts} did not return ETag for ${artifact.id}`)
      parts.push({ partNumber, etag })
      console.log(JSON.stringify({
        copy: 'part',
        id: artifact.id,
        partNumber,
        totalParts,
        range: `bytes=${start}-${end}`,
      }))
    }

    const completeBody = [
      '<CompleteMultipartUpload>',
      ...parts.map(part => `<Part><PartNumber>${part.partNumber}</PartNumber><ETag>${part.etag}</ETag></Part>`),
      '</CompleteMultipartUpload>',
    ].join('')
    const complete = signedS3Request({
      method: 'POST',
      bucket: targetBucket,
      objectPath: artifact.objectPath,
      query: { uploadId },
      payloadHash: hash(completeBody),
      size: Buffer.byteLength(completeBody),
      headers: { 'content-type': 'application/xml' },
    })
    const completeResponse = await fetch(complete.url, {
      method: 'POST',
      headers: complete.headers,
      body: completeBody,
    })
    const completeText = await completeResponse.text()
    if (!completeResponse.ok) {
      throw new Error(`R2 multipart copy completion failed for ${artifact.id}: ${completeResponse.status} ${completeResponse.statusText}\n${completeText}`)
    }
    return {
      multipart: true,
      parts: parts.length,
      etag: xmlValue(completeText, 'ETag').replace(/^"|"$/g, '') || null,
    }
  } catch (error) {
    const abort = signedS3Request({
      method: 'DELETE',
      bucket: targetBucket,
      objectPath: artifact.objectPath,
      query: { uploadId },
      payloadHash: emptyHash,
    })
    await fetch(abort.url, { method: 'DELETE', headers: abort.headers, body: '' }).catch(() => {})
    throw error
  }
}

async function putObjectText({ bucket, objectPath, body, contentType, cacheControl }) {
  const size = Buffer.byteLength(body)
  const request = signedS3Request({
    method: 'PUT',
    bucket,
    objectPath,
    payloadHash: hash(body),
    size,
    headers: {
      'cache-control': cacheControl,
      'content-type': contentType,
    },
  })
  const response = await fetch(request.url, {
    method: 'PUT',
    headers: request.headers,
    body,
  })
  const text = await response.text()
  if (!response.ok) throw new Error(`R2 manifest upload failed: ${response.status} ${response.statusText}\n${text}`)
  console.log(JSON.stringify({ uploaded: true, bucket, objectPath, bytes: size }))
}

async function headObject(bucket, objectPath) {
  const request = signedS3Request({
    method: 'HEAD',
    bucket,
    objectPath,
    payloadHash: hash(''),
  })
  const response = await fetch(request.url, { method: 'HEAD', headers: request.headers })
  if (response.status === 404) return null
  if (!response.ok) throw new Error(`R2 HEAD failed for ${bucket}/${objectPath}: ${response.status} ${response.statusText}`)
  return {
    bytes: Number(response.headers.get('content-length') || 0),
    etag: response.headers.get('etag')?.replace(/^"|"$/g, '') || null,
  }
}

async function verifyPublicPmtiles(artifact) {
  const url = `${targetPublicBaseUrl}/${artifact.objectPath}`
  const response = await fetch(url, { headers: { range: 'bytes=0-16383' } })
  if (response.status !== 206) throw new Error(`Expected 206 Partial Content for ${artifact.id}, got ${response.status}`)
  const bytes = new Uint8Array(await response.arrayBuffer())
  const magic = new TextDecoder().decode(bytes.slice(0, 7))
  if (magic !== 'PMTiles') throw new Error(`Production object does not look like PMTiles for ${artifact.id}; magic=${magic}`)
  console.log(JSON.stringify({ verified: true, id: artifact.id, publicUrl: url, status: response.status }))
}

async function verifyPublicJson(url) {
  const response = await fetch(url, { headers: { 'cache-control': 'no-cache' } })
  if (!response.ok) throw new Error(`Expected public JSON fetch to pass for ${url}, got ${response.status}`)
  return response.json()
}

function signedS3Request({ method, bucket, objectPath, query = {}, payloadHash, size, headers = {}, now = new Date() }) {
  const url = new URL(`${endpoint}/${bucket}/${encodePath(objectPath)}`)
  const queryString = canonicalQuery(query)
  if (queryString) url.search = queryString
  const date = amzDate(now)
  const dateStamp = date.slice(0, 8)
  const signedHeaderValues = {
    ...headers,
    host: url.host,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': date,
  }
  if (size !== undefined) signedHeaderValues['content-length'] = String(size)
  if (sessionToken) signedHeaderValues['x-amz-security-token'] = sessionToken
  const sortedHeaderKeys = Object.keys(signedHeaderValues).sort()
  const signedHeaders = sortedHeaderKeys.join(';')
  const canonicalHeaders = sortedHeaderKeys.map(key => `${key}:${signedHeaderValues[key]}\n`).join('')
  const canonicalRequest = [
    method,
    url.pathname,
    queryString,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n')
  const credentialScope = `${dateStamp}/auto/s3/aws4_request`
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    date,
    credentialScope,
    hash(canonicalRequest),
  ].join('\n')
  const signature = hmac(signingKey(secretAccessKey, dateStamp), stringToSign, 'hex')
  return {
    url,
    headers: {
      ...signedHeaderValues,
      authorization: `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    },
  }
}

function amzDate(date) {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, '')
}

function hmac(key, value, encoding) {
  return createHmac('sha256', key).update(value).digest(encoding)
}

function hash(value) {
  return createHash('sha256').update(value).digest('hex')
}

function signingKey(secret, dateStamp) {
  const kDate = hmac(`AWS4${secret}`, dateStamp)
  const kRegion = hmac(kDate, 'auto')
  const kService = hmac(kRegion, 's3')
  return hmac(kService, 'aws4_request')
}

function encodePath(path) {
  return path.split('/').map(part => encodeURIComponent(part)).join('/')
}

function encodeCanonical(value) {
  return encodeURIComponent(value).replace(/[!'()*]/g, char => `%${char.charCodeAt(0).toString(16).toUpperCase()}`)
}

function canonicalQuery(query = {}) {
  return Object.entries(query)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${encodeCanonical(key)}=${encodeCanonical(String(value))}`)
    .join('&')
}

function copySourceHeader(bucket, objectPath) {
  return `/${bucket}/${encodePath(objectPath)}`
}

function xmlValue(xml, tag) {
  const match = xml.match(new RegExp(`<${tag}>([^<]+)</${tag}>`))
  return match ? decodeXml(match[1]) : ''
}

function decodeXml(value) {
  return value
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&amp;', '&')
}

function artifactArray(entry) {
  if (!entry) return []
  return Array.isArray(entry) ? entry : [entry]
}

function artifactCounts(manifest) {
  return Object.fromEntries(
    Object.entries(manifest.artifacts || {}).map(([kind, entry]) => [kind, artifactArray(entry).length]),
  )
}

function stripTrailingSlash(value) {
  return String(value || '').replace(/\/$/, '')
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
