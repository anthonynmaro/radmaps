#!/usr/bin/env node
/**
 * Upload RadMaps atlas artifacts to Cloudflare R2 using the S3-compatible API.
 *
 * Required env:
 * - CLOUDFLARE_ACCOUNT_ID
 * - R2_ACCESS_KEY_ID
 * - R2_SECRET_ACCESS_KEY
 *
 * Optional env:
 * - ATLAS_STORAGE_BUCKET
 * - ATLAS_STORAGE_OBJECT_PATH
 * - ATLAS_PUBLIC_BASE_URL
 * - ATLAS_R2_ENDPOINT
 */

import { createHash, createHmac } from 'node:crypto'
import { readFileSync, statSync } from 'node:fs'
import { basename } from 'node:path'

const args = parseArgs(process.argv.slice(2))
const env = { ...loadEnv('.env'), ...process.env }
const source = args.source || 'public/atlas/radmaps-driftless-planetiler.pmtiles'
const bucket = args.bucket || env.ATLAS_STORAGE_BUCKET || 'radmaps-atlas-prod'
const objectPath = args.object || env.ATLAS_STORAGE_OBJECT_PATH || `atlas/v1/manual/${basename(source)}`
const contentType = args.contentType || guessContentType(source)
const verifyMode = args.verify || guessVerifyMode(source)
const accountId = args.accountId || env.CLOUDFLARE_ACCOUNT_ID
const accessKeyId = args.accessKeyId || env.R2_ACCESS_KEY_ID
const secretAccessKey = args.secretAccessKey || env.R2_SECRET_ACCESS_KEY
const endpoint = args.endpoint || env.ATLAS_R2_ENDPOINT || (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : '')
const publicBaseUrl = args.publicBaseUrl || env.ATLAS_PUBLIC_BASE_URL || ''
const dryRun = Boolean(args.dryRun)

if (!source || !bucket || !objectPath) throw new Error('Missing source, bucket, or object path')
if (!dryRun && (!accountId || !accessKeyId || !secretAccessKey || !endpoint)) {
  throw new Error('Missing CLOUDFLARE_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, or R2 endpoint')
}

function parseArgs(argv) {
  const parsed = {}
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--source') parsed.source = argv[++i]
    else if (arg === '--bucket') parsed.bucket = argv[++i]
    else if (arg === '--object') parsed.object = argv[++i]
    else if (arg === '--content-type') parsed.contentType = argv[++i]
    else if (arg === '--verify') parsed.verify = argv[++i]
    else if (arg === '--public-base-url') parsed.publicBaseUrl = argv[++i]
    else if (arg === '--endpoint') parsed.endpoint = argv[++i]
    else if (arg === '--account-id') parsed.accountId = argv[++i]
    else if (arg === '--access-key-id') parsed.accessKeyId = argv[++i]
    else if (arg === '--secret-access-key') parsed.secretAccessKey = argv[++i]
    else if (arg === '--dry-run') parsed.dryRun = true
    else if (arg === '--help' || arg === '-h') {
      console.log(`Usage: node scripts/upload-atlas-object.mjs [options]

Options:
  --source <path>             Local file to upload
  --bucket <name>             R2 bucket name
  --object <key>              R2 object key
  --content-type <mime>       Override content type
  --verify <pmtiles|json|none> Public verification mode
  --public-base-url <url>     R2 managed/custom public base URL
  --endpoint <url>            S3 endpoint, defaults to https://<account>.r2.cloudflarestorage.com
  --dry-run                   Print the planned upload without sending it

Examples:
  npm run atlas:upload-pmtiles -- --source public/atlas/radmaps-driftless-planetiler.pmtiles
  npm run atlas:publish-manifest -- --source public/atlas/manifests/production.json`)
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

function guessContentType(path) {
  if (path.endsWith('.json')) return 'application/json; charset=utf-8'
  if (path.endsWith('.pmtiles')) return 'application/octet-stream'
  if (path.endsWith('.mbtiles')) return 'application/octet-stream'
  return 'application/octet-stream'
}

function guessVerifyMode(path) {
  if (path.endsWith('.json')) return 'json'
  if (path.endsWith('.pmtiles')) return 'pmtiles'
  return 'none'
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

function encodePath(path) {
  return path.split('/').map(part => encodeURIComponent(part)).join('/')
}

function signingKey(secret, dateStamp) {
  const kDate = hmac(`AWS4${secret}`, dateStamp)
  const kRegion = hmac(kDate, 'auto')
  const kService = hmac(kRegion, 's3')
  return hmac(kService, 'aws4_request')
}

function signedPutRequest({ body, now = new Date() }) {
  const url = new URL(`${endpoint.replace(/\/$/, '')}/${bucket}/${encodePath(objectPath)}`)
  const date = amzDate(now)
  const dateStamp = date.slice(0, 8)
  const payloadHash = hash(body)
  const cacheControl = contentType.startsWith('application/json') ? 'max-age=60' : 'public, max-age=31536000, immutable'
  const headers = {
    'cache-control': cacheControl,
    'content-type': contentType,
    host: url.host,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': date,
  }
  const signedHeaders = Object.keys(headers).sort().join(';')
  const canonicalHeaders = Object.keys(headers).sort().map(key => `${key}:${headers[key]}\n`).join('')
  const canonicalRequest = [
    'PUT',
    url.pathname,
    '',
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
      ...headers,
      authorization: `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    },
  }
}

function publicUrl() {
  if (!publicBaseUrl) return ''
  return `${publicBaseUrl.replace(/\/$/, '')}/${encodePath(objectPath)}`
}

async function verifyPublicUrl(url) {
  if (!url || verifyMode === 'none') return { mode: verifyMode, publicUrl: url, ok: false, skipped: true }

  if (verifyMode === 'pmtiles') {
    const response = await fetch(url, { headers: { range: 'bytes=0-16383' } })
    if (response.status !== 206) throw new Error(`Expected 206 Partial Content from atlas object, got ${response.status}`)
    const bytes = new Uint8Array(await response.arrayBuffer())
    const magic = new TextDecoder().decode(bytes.slice(0, 7))
    if (magic !== 'PMTiles') throw new Error(`Uploaded object does not look like PMTiles, magic=${magic}`)
    return { mode: verifyMode, publicUrl: url, ok: true, status: response.status }
  }

  if (verifyMode === 'json') {
    const response = await fetch(url)
    if (!response.ok) throw new Error(`Expected public JSON fetch to pass, got ${response.status}`)
    const json = await response.json()
    return { mode: verifyMode, publicUrl: url, ok: true, status: response.status, schemaVersion: json.schemaVersion }
  }

  throw new Error(`Unknown verify mode: ${verifyMode}`)
}

const body = readFileSync(source)
const size = statSync(source).size
const planned = {
  bucket,
  objectPath,
  source,
  bytes: size,
  contentType,
  verify: verifyMode,
  publicUrl: publicUrl() || null,
}

if (dryRun) {
  console.log(JSON.stringify({ dryRun: true, ...planned }, null, 2))
  process.exit(0)
}

const request = signedPutRequest({ body })
const uploadResponse = await fetch(request.url, {
  method: 'PUT',
  headers: request.headers,
  body,
})

if (!uploadResponse.ok) {
  throw new Error(`R2 upload failed: ${uploadResponse.status} ${uploadResponse.statusText}\n${await uploadResponse.text()}`)
}

const verification = await verifyPublicUrl(publicUrl())

console.log(JSON.stringify({
  ...planned,
  etag: uploadResponse.headers.get('etag')?.replace(/^"|"$/g, '') ?? null,
  uploaded: true,
  verification,
}, null, 2))
