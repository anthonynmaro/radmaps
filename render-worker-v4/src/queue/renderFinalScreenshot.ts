import { insertProductRender, loadOrderSnapshot, lookupProductRender } from '../cache.js'
import { CONFIG } from '../config.js'
import { createSignedStorageUrl, uploadBuffer } from '../storage.js'
import { takeRemoteRendererScreenshot } from '../remoteRenderer.js'
import { takeLocalChromiumScreenshot } from '../localChromium.js'
import type { BrowserScreenshotOptions } from '../screenshotProtocol.js'
import type { RenderFinalResponse } from './processJob.js'
import { normalizeFinalScreenshot } from './normalizeFinalScreenshot.js'
import { validateBrowserScreenshot } from './validateBrowserScreenshot.js'
import { getPrintFraming } from '~/utils/print/printFraming'
import { getProviderProfile } from '~/utils/print/providerProfile'
import { computePrintHash } from '~/utils/render/hash'
import { resolveBrowserRenderViewport } from '~/utils/render/renderViewport'
import { getFinalPrintPath } from '~/utils/render/storagePaths'
import { createRenderTicket } from '~/utils/render/renderTicket'
import { RENDER_READY_EXPRESSION } from '~/utils/render/readiness'
import type { StyleConfig } from '~/types'
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

  // Keep the CSS layout close to the saved editor map width, then use DPR to
  // reach the physical pixel target. This avoids changing MapLibre's label and
  // collision behavior just because the product render is high resolution.
  const renderViewport = resolveBrowserRenderViewport(framing, snapshot.style_config as Pick<StyleConfig, 'map_editor_width'>, {
    fallbackDeviceScaleFactor: 2,
  })
  const deviceScaleFactor = renderViewport.deviceScaleFactor
  const viewportWidthPx = renderViewport.viewportWidthPx
  const viewportHeightPx = renderViewport.viewportHeightPx
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
  const payloadUrl = new URL('/api/render/payload', CONFIG.appUrl)
  payloadUrl.searchParams.set('ticket', ticket)

  await preflightRenderEndpoint(payloadUrl, 'payload')
  await preflightRenderEndpoint(url, 'page')

  const screenshotOptions: BrowserScreenshotOptions = {
    url: url.toString(),
    widthPx: viewportWidthPx,
    heightPx: viewportHeightPx,
    deviceScaleFactor,
    format: 'jpeg',
    quality: 95,
    waitUntil: 'domcontentloaded',
    waitForFunction: RENDER_READY_EXPRESSION,
    timeoutMs: CONFIG.renderTimeoutMs,
  } as const
  const screenshot = CONFIG.renderBackend === 'local-chromium'
    ? await takeLocalChromiumScreenshot(screenshotOptions)
    : await takeRemoteRendererScreenshot(screenshotOptions)

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

function getPreflightHeaders(url: URL): Record<string, string> | undefined {
  return url.hostname.endsWith('.ngrok-free.dev')
    ? { 'ngrok-skip-browser-warning': 'true' }
    : undefined
}

function redactTicket(url: URL): string {
  const copy = new URL(url.toString())
  if (copy.searchParams.has('ticket')) copy.searchParams.set('ticket', '[redacted]')
  return copy.toString()
}

async function preflightRenderEndpoint(url: URL, label: 'payload' | 'page'): Promise<void> {
  const res = await fetch(url, {
    method: 'GET',
    headers: getPreflightHeaders(url),
  })
  const contentType = res.headers.get('content-type') ?? ''
  const body = await res.text()
  if (!res.ok) {
    throw new Error(`Render ${label} preflight failed (${res.status}) at ${redactTicket(url)}: ${body.slice(0, 500)}`)
  }
  if (label === 'payload' && !contentType.includes('application/json')) {
    throw new Error(`Render payload preflight returned ${contentType || 'unknown content type'} at ${redactTicket(url)}`)
  }
}
