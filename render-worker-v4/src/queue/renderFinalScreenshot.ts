import { insertProductRender, loadOrderSnapshot, lookupProductRender } from '../cache.js'
import { CONFIG } from '../config.js'
import { createSignedStorageUrl, uploadBuffer } from '../storage.js'
import { takeBrowserlessScreenshot } from '../browserless.js'
import type { RenderFinalResponse } from './processJob.js'
import { normalizeFinalScreenshot } from './normalizeFinalScreenshot.js'
import { validateBrowserScreenshot } from './validateBrowserScreenshot.js'
import { getPrintFraming } from '~/utils/print/printFraming'
import { getProviderProfile } from '~/utils/print/providerProfile'
import { computePrintHash } from '~/utils/render/hash'
import { getFinalPrintPath } from '~/utils/render/storagePaths'
import { createRenderTicket } from '~/utils/render/renderTicket'
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
      render_url: await createSignedStorageUrl(existing.artifact_path),
      validation_result: existing.validation_result,
      render_ms: Date.now() - started,
    }
  }

  // Browserless caps screenshot timeouts at 60s on the current plan. Keep the
  // physical output exact by rendering a half-size CSS viewport at DPR 2, then
  // cropping any one-pixel bleed rounding surplus before validation/upload.
  const deviceScaleFactor = 2
  const viewportWidthPx = Math.ceil(framing.fullWidthPx / deviceScaleFactor)
  const viewportHeightPx = Math.ceil(framing.fullHeightPx / deviceScaleFactor)
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
    widthPx: viewportWidthPx,
    heightPx: viewportHeightPx,
    deviceScaleFactor,
    format: 'jpeg',
    quality: 95,
    waitForFunction: 'window.__RENDER_READY === true && window.__RADMAPS_RENDER_STATUS?.routeLayerPresent === true',
    timeoutMs: CONFIG.browserlessTimeoutMs,
  })

  const finalBuffer = await normalizeFinalScreenshot({
    buffer: screenshot.buffer,
    expectedWidth: framing.fullWidthPx,
    expectedHeight: framing.fullHeightPx,
    maxOversizePx: deviceScaleFactor,
    quality: 95,
  })

  const validation = await validateBrowserScreenshot({
    jpegBuffer: finalBuffer,
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
  const renderUrl = await uploadBuffer(artifactPath, finalBuffer, {
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
