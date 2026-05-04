import sharp from 'sharp'
import type { Metadata } from 'sharp'

import { insertProductRender, loadOrderSnapshot, lookupProductRender } from '../cache.js'
import { CONFIG } from '../config.js'
import { uploadBuffer } from '../storage.js'
import { takeBrowserlessScreenshot } from '../browserless.js'
import type { RenderFinalResponse } from './processJob.js'
import { getPrintFraming } from '../../../utils/print/printFraming.js'
import { getProviderProfile } from '../../../utils/print/providerProfile.js'
import { computePrintHash } from '../../../utils/render/hash.js'
import { getFinalPrintPath } from '../../../utils/render/storagePaths.js'
import { createRenderTicket } from '../../../utils/render/renderTicket.js'
import type { ValidationIssue, ValidationResult } from '../types.js'

const VALIDATOR_VERSION = 'print-validator-v1' as const

async function validateBrowserScreenshot(input: {
  jpegBuffer: Buffer
  expectedWidth: number
  expectedHeight: number
  maxFileSizeMb: number
}): Promise<ValidationResult> {
  const errors: ValidationIssue[] = []
  const warnings: ValidationIssue[] = []
  const push = (issue: ValidationIssue) => {
    if (issue.severity === 'error') errors.push(issue)
    else warnings.push(issue)
  }

  let meta: Metadata
  try {
    meta = await sharp(input.jpegBuffer).metadata()
  } catch (err) {
    push({ check: 'jpeg_readable', severity: 'error', message: `JPEG unreadable: ${(err as Error).message}` })
    return {
      errors,
      warnings,
      checked_at: new Date().toISOString(),
      validator_version: VALIDATOR_VERSION,
      passed: false,
    }
  }

  if (meta.format !== 'jpeg') {
    push({ check: 'jpeg_format', severity: 'error', message: `expected jpeg, got ${meta.format ?? 'unknown'}` })
  }
  if (meta.width !== input.expectedWidth || meta.height !== input.expectedHeight) {
    push({
      check: 'dimensions',
      severity: 'error',
      message: `dimensions mismatch: got ${meta.width}x${meta.height}, expected ${input.expectedWidth}x${input.expectedHeight}`,
    })
  }

  const sizeMb = input.jpegBuffer.byteLength / (1024 * 1024)
  if (input.jpegBuffer.byteLength < 100_000) {
    push({ check: 'minimum_file_size', severity: 'error', message: `file is only ${input.jpegBuffer.byteLength} bytes` })
  }
  if (sizeMb > input.maxFileSizeMb) {
    push({ check: 'file_size', severity: 'error', message: `file size ${sizeMb.toFixed(1)} MB exceeds cap ${input.maxFileSizeMb} MB` })
  }
  if (meta.space && meta.space !== 'srgb') {
    push({ check: 'icc_srgb', severity: 'warning', message: `colour space is "${meta.space}", expected sRGB` })
  }

  try {
    const sample = await sharp(input.jpegBuffer)
      .resize(96, 96, { fit: 'inside' })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true })
    const px = sample.data
    const channels = sample.info.channels
    let sum = 0
    let sumSq = 0
    const colours = new Set<number>()
    let count = 0
    for (let i = 0; i < px.length; i += channels) {
      const r = px[i]!
      const g = px[i + 1]!
      const b = px[i + 2]!
      const lum = 0.299 * r + 0.587 * g + 0.114 * b
      sum += lum
      sumSq += lum * lum
      colours.add(((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4))
      count++
    }
    const mean = sum / Math.max(1, count)
    const stdev = Math.sqrt(Math.max(0, sumSq / Math.max(1, count) - mean * mean))
    if (colours.size < 8 || stdev < 3) {
      push({ check: 'blank_canvas', severity: 'error', message: `low visual variation (colours=${colours.size}, stdev=${stdev.toFixed(1)})` })
    }
  } catch (err) {
    push({ check: 'blank_canvas', severity: 'warning', message: `blank-canvas sampling failed: ${(err as Error).message}` })
  }

  return {
    errors,
    warnings,
    checked_at: new Date().toISOString(),
    validator_version: VALIDATOR_VERSION,
    passed: errors.length === 0,
  }
}

export async function renderFinalWithScreenshot(input: {
  stripeSessionId: string
  printHash: string
}): Promise<RenderFinalResponse> {
  const started = Date.now()
  const snapshot = await loadOrderSnapshot(input.stripeSessionId)
  if (!snapshot) {
    throw new Error(`order_snapshot not found for ${input.stripeSessionId}`)
  }

  const productUid = snapshot.product_uid
  const framing = getPrintFraming(productUid, 'final')
  const profile = getProviderProfile(productUid)
  const expectedPrintHash = computePrintHash({
    mapContentHash: snapshot.map_content_hash,
    chromeHash: snapshot.chrome_hash,
    productUid,
    dpi: framing.dpi,
    bleedMm: profile.bleedMm,
  })
  if (expectedPrintHash !== input.printHash) {
    throw new Error(`print_hash mismatch: expected ${expectedPrintHash}, got ${input.printHash}`)
  }

  const existing = await lookupProductRender({
    stripe_session_id: input.stripeSessionId,
    product_uid: productUid,
    print_hash: input.printHash,
  })
  if (existing?.validation_result?.passed) {
    return {
      status: 'rendered',
      artifact_path: existing.artifact_path,
      render_url: `${CONFIG.supabaseUrl}/storage/v1/object/public/maps/${existing.artifact_path}`,
      validation_result: existing.validation_result,
      render_ms: Date.now() - started,
    }
  }

  // Use exact final pixel dimensions. 24×36 with 3mm bleed is 7271×10871,
  // so DPR 2 half-viewports would require post-capture crop/pad correction.
  const deviceScaleFactor = 1
  const ticket = createRenderTicket({
    kind: 'session',
    subject: input.stripeSessionId,
    renderClass: 'final',
    widthPx: framing.fullWidthPx,
    heightPx: framing.fullHeightPx,
    deviceScaleFactor,
    productUid,
    printHash: input.printHash,
    expiresAt: Date.now() + 15 * 60_000,
  }, CONFIG.renderTicketSecret)

  const url = new URL(`/render/session/${input.stripeSessionId}`, CONFIG.appUrl)
  url.searchParams.set('ticket', ticket)

  const screenshot = await takeBrowserlessScreenshot({
    url: url.toString(),
    widthPx: Math.round(framing.fullWidthPx / deviceScaleFactor),
    heightPx: Math.round(framing.fullHeightPx / deviceScaleFactor),
    deviceScaleFactor,
    format: 'jpeg',
    quality: 95,
    waitForFunction: 'window.__RENDER_READY === true && window.__RADMAPS_RENDER_STATUS?.routeLayerPresent === true',
    timeoutMs: CONFIG.browserlessTimeoutMs,
  })

  const validation = await validateBrowserScreenshot({
    jpegBuffer: screenshot.buffer,
    expectedWidth: framing.fullWidthPx,
    expectedHeight: framing.fullHeightPx,
    maxFileSizeMb: profile.maxFileSizeMb,
  })

  if (!validation.passed) {
    return {
      status: 'invalid',
      validation_result: validation,
      render_ms: Date.now() - started,
    }
  }

  const artifactPath = getFinalPrintPath(input.stripeSessionId, productUid, input.printHash)
  const renderUrl = await uploadBuffer(artifactPath, screenshot.buffer, {
    contentType: screenshot.contentType,
    cacheControl: '3600',
  })

  await insertProductRender({
    stripe_session_id: input.stripeSessionId,
    product_uid: productUid,
    trim_width_in: framing.trimWidthIn,
    trim_height_in: framing.trimHeightIn,
    dpi: framing.dpi,
    bleed_mm: profile.bleedMm,
    render_backend: 'browser',
    map_content_hash: snapshot.map_content_hash,
    chrome_hash: snapshot.chrome_hash,
    print_hash: input.printHash,
    artifact_path: artifactPath,
    validation_result: validation,
  })

  return {
    status: 'rendered',
    artifact_path: artifactPath,
    render_url: renderUrl,
    validation_result: validation,
    render_ms: Date.now() - started,
  }
}
