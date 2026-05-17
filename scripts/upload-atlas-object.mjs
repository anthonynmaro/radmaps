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
 * - R2_SESSION_TOKEN (required for temporary R2 credentials)
 */

import { createHash, createHmac } from 'node:crypto'
import { createReadStream, readFileSync, statSync } from 'node:fs'
import { open } from 'node:fs/promises'
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
const sessionToken = args.sessionToken || env.R2_SESSION_TOKEN
const endpoint = args.endpoint || env.ATLAS_R2_ENDPOINT || (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : '')
const publicBaseUrl = args.publicBaseUrl || env.ATLAS_PUBLIC_BASE_URL || ''
const dryRun = Boolean(args.dryRun)
const multipartThresholdBytes = 4.5 * 1024 * 1024 * 1024
const multipartPartBytes = 256 * 1024 * 1024

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
    else if (arg === '--session-token') parsed.sessionToken = argv[++i]
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
  --session-token <token>     Temporary credential session token, if needed
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

async function hashFile(path) {
  const digest = createHash('sha256')
  await new Promise((resolve, reject) => {
    createReadStream(path)
      .on('data', chunk => digest.update(chunk))
      .on('error', reject)
      .on('end', resolve)
  })
  return digest.digest('hex')
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

function encodeCanonical(value) {
  return encodeURIComponent(value).replace(/[!'()*]/g, char => `%${char.charCodeAt(0).toString(16).toUpperCase()}`)
}

function canonicalQuery(query = {}) {
  return Object.entries(query)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${encodeCanonical(key)}=${encodeCanonical(String(value))}`)
    .join('&')
}

function signedS3Request({ method, query = {}, payloadHash, size, headers = {}, now = new Date() }) {
  const url = new URL(`${endpoint.replace(/\/$/, '')}/${bucket}/${encodePath(objectPath)}`)
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
  const signedHeaders = Object.keys(signedHeaderValues).sort().join(';')
  const canonicalHeaders = Object.keys(signedHeaderValues).sort().map(key => `${key}:${signedHeaderValues[key]}\n`).join('')
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

function objectHeaders() {
  const cacheControl = contentType.startsWith('application/json') ? 'max-age=60' : 'public, max-age=31536000, immutable'
  return {
    'cache-control': cacheControl,
    'content-type': contentType,
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

function xmlValue(xml, tag) {
  const match = xml.match(new RegExp(`<${tag}>([^<]+)</${tag}>`))
  return match?.[1] || ''
}

async function readPart(file, start, length) {
  const handle = await open(file, 'r')
  try {
    const buffer = Buffer.allocUnsafe(length)
    const { bytesRead } = await handle.read(buffer, 0, length, start)
    return bytesRead === length ? buffer : buffer.subarray(0, bytesRead)
  } finally {
    await handle.close()
  }
}

async function singlePutUpload({ size }) {
  const payloadHash = await hashFile(source)
  const request = signedS3Request({
    method: 'PUT',
    payloadHash,
    size,
    headers: objectHeaders(),
  })
  const uploadResponse = await fetch(request.url, {
    method: 'PUT',
    headers: request.headers,
    body: createReadStream(source),
    duplex: 'half',
  })

  if (!uploadResponse.ok) {
    throw new Error(`R2 upload failed: ${uploadResponse.status} ${uploadResponse.statusText}\n${await uploadResponse.text()}`)
  }

  return {
    etag: uploadResponse.headers.get('etag')?.replace(/^"|"$/g, '') ?? null,
    multipart: false,
  }
}

async function multipartUpload({ size }) {
  const emptyHash = hash('')
  const initiate = signedS3Request({
    method: 'POST',
    query: { uploads: '' },
    payloadHash: emptyHash,
    size: 0,
    headers: objectHeaders(),
  })
  const initiateResponse = await fetch(initiate.url, {
    method: 'POST',
    headers: initiate.headers,
    body: '',
  })
  const initiateText = await initiateResponse.text()
  if (!initiateResponse.ok) {
    throw new Error(`R2 multipart initiation failed: ${initiateResponse.status} ${initiateResponse.statusText}\n${initiateText}`)
  }

  const uploadId = xmlValue(initiateText, 'UploadId')
  if (!uploadId) throw new Error(`R2 multipart initiation did not return UploadId:\n${initiateText}`)

  const parts = []
  const totalParts = Math.ceil(size / multipartPartBytes)
  try {
    for (let index = 0; index < totalParts; index += 1) {
      const partNumber = index + 1
      const start = index * multipartPartBytes
      const partSize = Math.min(multipartPartBytes, size - start)
      const part = await readPart(source, start, partSize)
      const payloadHash = createHash('sha256').update(part).digest('hex')
      const request = signedS3Request({
        method: 'PUT',
        query: { partNumber, uploadId },
        payloadHash,
        size: part.length,
      })
      const response = await fetch(request.url, {
        method: 'PUT',
        headers: request.headers,
        body: part,
      })
      if (!response.ok) {
        throw new Error(`R2 multipart part ${partNumber}/${totalParts} failed: ${response.status} ${response.statusText}\n${await response.text()}`)
      }
      const etag = response.headers.get('etag')
      if (!etag) throw new Error(`R2 multipart part ${partNumber}/${totalParts} did not return an ETag`)
      parts.push({ partNumber, etag })
      console.log(JSON.stringify({ multipart: true, uploadedPart: partNumber, totalParts, bytes: part.length }))
    }

    const completeBody = [
      '<CompleteMultipartUpload>',
      ...parts.map(part => `<Part><PartNumber>${part.partNumber}</PartNumber><ETag>${part.etag}</ETag></Part>`),
      '</CompleteMultipartUpload>',
    ].join('')
    const payloadHash = hash(completeBody)
    const complete = signedS3Request({
      method: 'POST',
      query: { uploadId },
      payloadHash,
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
      throw new Error(`R2 multipart completion failed: ${completeResponse.status} ${completeResponse.statusText}\n${completeText}`)
    }

    return {
      etag: xmlValue(completeText, 'ETag').replace(/^"|"$/g, '') || null,
      multipart: true,
      parts: parts.length,
    }
  } catch (error) {
    const abort = signedS3Request({
      method: 'DELETE',
      query: { uploadId },
      payloadHash: emptyHash,
      size: 0,
    })
    await fetch(abort.url, { method: 'DELETE', headers: abort.headers, body: '' }).catch(() => {})
    throw error
  }
}

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

const upload = size > multipartThresholdBytes ? await multipartUpload({ size }) : await singlePutUpload({ size })
const verification = await verifyPublicUrl(publicUrl())

console.log(JSON.stringify({
  ...planned,
  etag: upload.etag,
  uploaded: true,
  multipart: upload.multipart,
  parts: upload.parts,
  verification,
}, null, 2))
