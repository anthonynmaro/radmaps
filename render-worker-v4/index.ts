// render-worker-v4/index.ts
//
// Express bootstrap + routes + auth middleware. Mirrors the legacy worker's
// auth pattern: every request except /health requires a Bearer token equal
// to RENDER_WORKER_SECRET.
//
// Endpoints (plan v4 §"Render flows"):
//   • POST /render-proof — synchronous-ish proof render (returns when done)
//   • POST /render-final — internal endpoint for the print queue consumer
//   • GET  /health       — liveness + version info
//
// Phase 8 will add the actual queue-polling consumer (using src/db.ts +
// pg's SELECT … FOR UPDATE SKIP LOCKED). The /render-final endpoint
// already accepts the snapshot lookup payload so the consumer can call it
// directly once wired.

import express, { type NextFunction, type Request, type Response } from 'express'

import { computeMapContentHash, computeChromeHash, computeProofRenderHash, computePrintHash, computeRenderCacheKey } from '../utils/render/hash.js'
import { getPrintFraming } from '../utils/print/printFraming.js'
import { getProviderProfile } from '../utils/print/providerProfile.js'
import { getMapCachePath, getProofPath, getFinalPrintPath } from '../utils/render/storagePaths.js'
import { HASH_VERSION } from '../utils/render/hashVersion.js'
import { buildMapStyle } from '../utils/mapStyle.js'

import { CONFIG, VERSION } from './src/config.js'
import {
  insertProductRender,
  insertRenderCache,
  loadOrderSnapshot,
  lookupProductRender,
  lookupRenderCache,
  touchRenderCache,
  updateMapProofUrl,
} from './src/cache.js'
import { compositePoster } from './src/chrome/compositor.js'
import { fetchLogo, validateLogoUrl } from './src/chrome/logoFetch.js'
import { buildChromeSvg } from './src/chrome/svgTemplate.js'
import { withPgClient } from './src/db.js'
import { log, logRenderComplete, logRenderFailed } from './src/log.js'
import { placeGelatoOrder } from './src/queue/gelato.js'
import { renderMapLayer } from './src/renderer/index.js'
import { nativeAvailable } from './src/renderer/native.js'
import { downloadBuffer, uploadBuffer } from './src/storage.js'
import {
  pickBackend,
  renderFinalRequestSchema,
  renderProofRequestSchema,
  type StyleConfig,
} from './src/types.js'
import { validatePoster } from './src/validation.js'

const app = express()

// 25 MB JSON cap — geojson can get large for long routes (~thousands of
// points). The Phase 8 final render reads from the snapshot row in DB
// rather than this body so there's no size pressure on /render-final.
app.use(express.json({ limit: '25mb' }))

// ─── Auth middleware ──────────────────────────────────────────────────────────
app.use((req: Request, res: Response, next: NextFunction) => {
  if (req.path === '/health') return next()
  const auth = req.headers.authorization ?? ''
  if (auth !== `Bearer ${CONFIG.workerSecret}`) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }
  next()
})

// ─── Health ──────────────────────────────────────────────────────────────────
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    ok: true,
    version: VERSION,
    native_available: nativeAvailable(),
    browser_fallback: 'not_wired_v1',
    pg_configured: !!CONFIG.databaseUrl,
  })
})

// ─── /render-proof ───────────────────────────────────────────────────────────
app.post('/render-proof', async (req: Request, res: Response) => {
  const t0 = Date.now()
  const parse = renderProofRequestSchema.safeParse(req.body)
  if (!parse.success) {
    res.status(400).json({ error: 'Invalid request body', issues: parse.error.issues })
    return
  }
  const body = parse.data

  try {
    // 1. Compute framing from product_uid + 'proof' class.
    const framing = getPrintFraming(body.product_uid, 'proof')
    const profile = getProviderProfile(body.product_uid)

    // 2. Verify hashes the caller supplied — if drift, refuse rather than
    //    silently re-hash (the cache key would mismatch). Defence in depth:
    //    the editor + worker share utils/render/hash.ts so this should
    //    always match.
    const styleConfig = body.style_config as StyleConfig
    const expectedMapHash = computeMapContentHash(
      styleConfig,
      body.geojson as GeoJSON.FeatureCollection,
      framing,
    )
    const expectedChromeHash = computeChromeHash(styleConfig, body.stats as never)
    if (expectedMapHash !== body.map_content_hash) {
      res.status(400).json({
        error: 'map_content_hash mismatch (caller and worker disagree)',
        expected: expectedMapHash,
        got: body.map_content_hash,
      })
      return
    }
    if (expectedChromeHash !== body.chrome_hash) {
      res.status(400).json({
        error: 'chrome_hash mismatch (caller and worker disagree)',
        expected: expectedChromeHash,
        got: body.chrome_hash,
      })
      return
    }
    const proofRenderHash = computeProofRenderHash(body.map_content_hash, body.chrome_hash)
    const backend = pickBackend(styleConfig.preset, body.render_backend)

    // 3. Cache key (with render_backend baked in).
    const renderCacheKey = computeRenderCacheKey({
      mapContentHash: body.map_content_hash,
      renderClass: 'proof',
      width: framing.fullWidthPx,
      height: framing.fullHeightPx,
      dpi: framing.dpi,
      renderBackend: backend,
    })

    // 4. render_cache lookup.
    const cached = await lookupRenderCache(renderCacheKey)
    let mapPng: Buffer
    let cacheHit = false
    let renderMs = 0

    if (cached) {
      cacheHit = true
      const cachedBuffer = await downloadBuffer(cached.map_image_path)
      if (!cachedBuffer) {
        res.status(500).json({
          error: 'render_cache row exists but storage object is missing',
          path: cached.map_image_path,
        })
        return
      }
      mapPng = cachedBuffer
      // Best-effort touch.
      touchRenderCache(renderCacheKey).catch(() => {})
    } else {
      if (body.skip_map_render) {
        res.status(422).json({
          error: 'caller asserted cache hit but render_cache miss',
          render_cache_key: renderCacheKey,
        })
        return
      }
      // Build the MapLibre style JSON. The worker mirrors the browser's
      // builder by importing utils/mapStyle.ts directly.
      const styleJson = buildMapStyle(
        styleConfig as never,
        CONFIG.mapboxToken || undefined,
        CONFIG.maptilerToken || undefined,
        undefined,
        CONFIG.stadiaToken || undefined,
      )

      // Bbox-derived fallback camera if style_config is missing one.
      const bboxCenter: [number, number] = [
        (body.bbox[0] + body.bbox[2]) / 2,
        (body.bbox[1] + body.bbox[3]) / 2,
      ]
      const rendered = await renderMapLayer({
        styleJson,
        styleConfig,
        framing,
        backendOverride: body.render_backend,
        fallbackCenter: bboxCenter,
        fallbackZoom: 11,
      })
      mapPng = rendered.pngBuffer
      renderMs = rendered.renderMs

      // Upload raw map to render_cache storage path.
      const mapPath = getMapCachePath(renderCacheKey)
      await uploadBuffer(mapPath, mapPng, { contentType: 'image/png' })
      await insertRenderCache({
        render_cache_key: renderCacheKey,
        map_content_hash: body.map_content_hash,
        render_class: 'proof',
        render_backend: backend,
        map_image_path: mapPath,
        width_px: framing.fullWidthPx,
        height_px: framing.fullHeightPx,
        dpi: framing.dpi,
        render_ms: renderMs,
      })
    }

    // 5. Pre-fetch logo (fail early per locked decision #12).
    const wantsLogo = !!styleConfig.show_logo && !!styleConfig.logo_url
    let logo: Awaited<ReturnType<typeof fetchLogo>> = null
    let logoOk = !wantsLogo
    if (wantsLogo) {
      try {
        logo = await fetchLogo(styleConfig.logo_url)
        logoOk = !!logo
      } catch (err) {
        logoOk = false
        // Fail the render at this step — do NOT silently skip the logo.
        res.status(422).json({
          error: 'logo pre-fetch failed',
          message: err instanceof Error ? err.message : String(err),
        })
        return
      }
    }

    // 6. Composite chrome.
    const chromeSvg = buildChromeSvg({
      framing,
      styleConfig,
      stats: body.stats as never,
      logoDataUri: logo
        ? `data:${logo.contentType};base64,${logo.buffer.toString('base64')}`
        : undefined,
    })
    const composite = await compositePoster({
      mapPng,
      framing,
      styleConfig,
      stats: body.stats as never,
      logo,
    })

    // 7. Validation (proof checks are non-blocking — we still upload).
    const validation = await validatePoster({
      jpegBuffer: composite.jpegBuffer,
      framing,
      profile,
      styleConfig,
      logoOk,
      chromeSvg,
      renderClass: 'proof',
    })

    // 8. Upload composited proof JPEG.
    const proofPath = getProofPath(body.map_id, proofRenderHash)
    const renderUrl = await uploadBuffer(proofPath, composite.jpegBuffer, {
      contentType: 'image/jpeg',
    })

    // 9. Update maps row.
    await updateMapProofUrl({
      map_id: body.map_id,
      proof_render_url: renderUrl,
      proof_render_hash: proofRenderHash,
      map_content_hash: body.map_content_hash,
      chrome_hash: body.chrome_hash,
    })

    const totalMs = Date.now() - t0
    const memMb = Math.round(process.memoryUsage().rss / (1024 * 1024))
    logRenderComplete({
      render_class: 'proof',
      render_backend: backend,
      render_ms: totalMs,
      product_size: body.product_uid,
      memory_peak_mb: memMb,
      cache_hit: cacheHit,
      map_id: body.map_id,
    })

    res.json({
      status: 'rendered',
      render_url: renderUrl,
      proof_render_hash: proofRenderHash,
      render_ms: totalMs,
      cache_hit: cacheHit,
      validation,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logRenderFailed({
      render_class: 'proof',
      render_backend: pickBackend(req.body?.style_config?.preset, req.body?.render_backend),
      reason: message,
      map_id: req.body?.map_id,
      product_size: req.body?.product_uid,
    })
    res.status(500).json({ error: 'render failed', message })
  }
})

// ─── /render-final ───────────────────────────────────────────────────────────
//
// Reads the immutable `order_snapshots` row, renders at the 'final' class
// per the snapshot's provider_profile (max DPI cap), validates, uploads,
// inserts product_renders. Returns 'rendered' or 'invalid'.
//
// Phase 8: the print-queue consumer claims jobs via pg SKIP LOCKED, then
// posts here with { stripe_session_id, print_hash }.
app.post('/render-final', async (req: Request, res: Response) => {
  const t0 = Date.now()
  const parse = renderFinalRequestSchema.safeParse(req.body)
  if (!parse.success) {
    res.status(400).json({ error: 'Invalid request body', issues: parse.error.issues })
    return
  }
  const { stripe_session_id, print_hash } = parse.data

  try {
    const snapshot = await loadOrderSnapshot(stripe_session_id)
    if (!snapshot) {
      res.status(404).json({ error: 'order_snapshot not found', stripe_session_id })
      return
    }

    const styleConfig = snapshot.style_config as StyleConfig
    const productUid = snapshot.product_uid
    const framing = getPrintFraming(productUid, 'final')
    const profile = getProviderProfile(productUid)

    // print_hash supplied by caller is the source of truth — it was computed
    // and stored in print_render_jobs.print_hash at queue time. Re-derive it
    // here as a defence-in-depth check.
    const expectedPrintHash = computePrintHash({
      mapContentHash: snapshot.map_content_hash,
      chromeHash: snapshot.chrome_hash,
      productUid,
      dpi: framing.dpi,
      bleedMm: profile.bleedMm,
    })
    if (expectedPrintHash !== print_hash) {
      res.status(400).json({
        error: 'print_hash mismatch with reconstructed hash',
        expected: expectedPrintHash,
        got: print_hash,
      })
      return
    }

    // 1. product_renders cache: if already valid, reuse.
    const existing = await lookupProductRender({
      stripe_session_id,
      product_uid: productUid,
      print_hash,
    })
    if (existing && (existing.validation_result?.passed ?? false)) {
      res.json({
        status: 'rendered',
        artifact_path: existing.artifact_path,
        validation_result: existing.validation_result,
        cache_hit: true,
        render_ms: Date.now() - t0,
      })
      return
    }

    // 2. render_cache (per-backend).
    const backend = pickBackend(styleConfig.preset)
    const renderCacheKey = computeRenderCacheKey({
      mapContentHash: snapshot.map_content_hash,
      renderClass: 'final',
      width: framing.fullWidthPx,
      height: framing.fullHeightPx,
      dpi: framing.dpi,
      renderBackend: backend,
    })

    const cached = await lookupRenderCache(renderCacheKey)
    let mapPng: Buffer
    if (cached) {
      const cachedBuffer = await downloadBuffer(cached.map_image_path)
      if (!cachedBuffer) {
        res.status(500).json({
          error: 'render_cache row exists but storage object is missing',
          path: cached.map_image_path,
        })
        return
      }
      mapPng = cachedBuffer
      touchRenderCache(renderCacheKey).catch(() => {})
    } else {
      const styleJson = buildMapStyle(
        styleConfig as never,
        CONFIG.mapboxToken || undefined,
        CONFIG.maptilerToken || undefined,
        undefined,
        CONFIG.stadiaToken || undefined,
      )
      const bbox = snapshot.bbox
      const bboxCenter: [number, number] = [
        (bbox[0] + bbox[2]) / 2,
        (bbox[1] + bbox[3]) / 2,
      ]
      const rendered = await renderMapLayer({
        styleJson,
        styleConfig,
        framing,
        fallbackCenter: bboxCenter,
        fallbackZoom: 11,
      })
      mapPng = rendered.pngBuffer
      const mapPath = getMapCachePath(renderCacheKey)
      await uploadBuffer(mapPath, mapPng, { contentType: 'image/png' })
      await insertRenderCache({
        render_cache_key: renderCacheKey,
        map_content_hash: snapshot.map_content_hash,
        render_class: 'final',
        render_backend: backend,
        map_image_path: mapPath,
        width_px: framing.fullWidthPx,
        height_px: framing.fullHeightPx,
        dpi: framing.dpi,
        render_ms: rendered.renderMs,
      })
    }

    // 3. Logo pre-fetch (snapshot is frozen — logo_url is fixed per session).
    const wantsLogo = !!styleConfig.show_logo && !!styleConfig.logo_url
    let logo: Awaited<ReturnType<typeof fetchLogo>> = null
    let logoOk = !wantsLogo
    if (wantsLogo) {
      try {
        logo = await fetchLogo(styleConfig.logo_url)
        logoOk = !!logo
      } catch (err) {
        // Final renders MUST have the logo if requested. Fail loudly.
        res.status(422).json({
          error: 'logo pre-fetch failed (final render)',
          message: err instanceof Error ? err.message : String(err),
        })
        return
      }
    }

    // 4. Compose + validate.
    const chromeSvg = buildChromeSvg({
      framing,
      styleConfig,
      stats: snapshot.stats as never,
      logoDataUri: logo
        ? `data:${logo.contentType};base64,${logo.buffer.toString('base64')}`
        : undefined,
    })
    const composite = await compositePoster({
      mapPng,
      framing,
      styleConfig,
      stats: snapshot.stats as never,
      logo,
    })

    const validation = await validatePoster({
      jpegBuffer: composite.jpegBuffer,
      framing,
      profile,
      styleConfig,
      logoOk,
      chromeSvg,
      renderClass: 'final',
    })

    if (!validation.passed) {
      res.status(200).json({
        status: 'invalid',
        validation_result: validation,
        render_ms: Date.now() - t0,
      })
      return
    }

    // 5. Upload.
    const artifactPath = getFinalPrintPath(stripe_session_id, productUid, print_hash)
    const renderUrl = await uploadBuffer(artifactPath, composite.jpegBuffer, {
      contentType: 'image/jpeg',
    })

    // 6. Insert product_renders row.
    await insertProductRender({
      stripe_session_id,
      product_uid: productUid,
      trim_width_in: framing.trimWidthIn,
      trim_height_in: framing.trimHeightIn,
      dpi: framing.dpi,
      bleed_mm: profile.bleedMm,
      render_backend: backend,
      map_content_hash: snapshot.map_content_hash,
      chrome_hash: snapshot.chrome_hash,
      print_hash,
      artifact_path: artifactPath,
      validation_result: validation,
    })

    const totalMs = Date.now() - t0
    const memMb = Math.round(process.memoryUsage().rss / (1024 * 1024))
    logRenderComplete({
      render_class: 'final',
      render_backend: backend,
      render_ms: totalMs,
      product_size: productUid,
      memory_peak_mb: memMb,
      cache_hit: !!cached,
      stripe_session_id,
    })

    res.json({
      status: 'rendered',
      artifact_path: artifactPath,
      render_url: renderUrl,
      validation_result: validation,
      render_ms: totalMs,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logRenderFailed({
      render_class: 'final',
      render_backend: 'native',
      reason: message,
      stripe_session_id,
    })
    res.status(500).json({ error: 'render failed', message })
  }
})

// ─── Admin / Manual Review Operations ───────────────────────────────────────
//
// These endpoints are intentionally minimal — they exist to give ops a
// way to unstick orders that have flipped to fulfillment_status='manual_review'
// without needing to write SQL by hand. Auth is the same Bearer token as
// the rest of the worker; ops should pull the secret from the same vault
// the queue consumer reads from.
//
//   POST /admin/jobs/:job_id/retry           — bump max_attempts and
//                                              re-queue. Picked up on the
//                                              next poll.
//   POST /admin/jobs/:job_id/force-submit    — skip /render-final and
//                                              submit the most recent
//                                              product_renders artifact
//                                              for this job to Gelato.
//                                              For overriding spurious
//                                              validation failures.
//   POST /admin/orders/:order_id/manual-upload
//          { artifact_url }                  — record an externally-rendered
//                                              file as a valid product_renders
//                                              row and patch the order. For
//                                              cases where ops repaired
//                                              the artifact in Photoshop.
//
// All three are sync (no queue interaction beyond the `retry` re-queue).

app.post('/admin/jobs/:job_id/retry', async (req: Request, res: Response) => {
  const jobId = req.params.job_id
  try {
    const updated = await withPgClient(async (client) => {
      const { rows } = await client.query(
        `UPDATE print_render_jobs
            SET status = 'queued',
                max_attempts = max_attempts + 1,
                last_error = NULL,
                worker_id = NULL,
                claimed_at = NULL
          WHERE id = $1
          RETURNING id, status, attempts, max_attempts`,
        [jobId],
      )
      return rows[0]
    })
    if (!updated) {
      res.status(404).json({ error: 'job not found' })
      return
    }
    log.info('admin_job_retry', { job_id: jobId, new_max_attempts: updated.max_attempts })
    res.json({ ok: true, job: updated })
  } catch (err) {
    res.status(500).json({ error: 'admin retry failed', message: (err as Error).message })
  }
})

app.post('/admin/jobs/:job_id/force-submit', async (req: Request, res: Response) => {
  const jobId = req.params.job_id
  try {
    const result = await withPgClient(async (client) => {
      // Load the job, snapshot, order, and most-recent product_renders for
      // this (session, print_hash) — preferring the validation_result.passed
      // row if one exists.
      const jobRow = (
        await client.query(
          `SELECT id, stripe_session_id, print_hash FROM print_render_jobs WHERE id = $1`,
          [jobId],
        )
      ).rows[0] as { id: string; stripe_session_id: string; print_hash: string } | undefined
      if (!jobRow) return { error: 'job not found' as const }

      const snap = (
        await client.query(
          `SELECT product_uid FROM order_snapshots WHERE stripe_session_id = $1`,
          [jobRow.stripe_session_id],
        )
      ).rows[0] as { product_uid: string } | undefined
      if (!snap) return { error: 'snapshot not found' as const }

      const order = (
        await client.query(
          `SELECT id, user_id, guest_email, quantity, shipping_address
             FROM orders
            WHERE active_stripe_session_id = $1
            LIMIT 1`,
          [jobRow.stripe_session_id],
        )
      ).rows[0] as
        | {
            id: string
            user_id: string | null
            guest_email: string | null
            quantity: number | string | null
            shipping_address: Record<string, string> | null
          }
        | undefined
      if (!order) return { error: 'order not found' as const }

      const render = (
        await client.query(
          `SELECT id, artifact_path FROM product_renders
            WHERE stripe_session_id = $1 AND print_hash = $2
            ORDER BY created_at DESC
            LIMIT 1`,
          [jobRow.stripe_session_id, jobRow.print_hash],
        )
      ).rows[0] as { id: string; artifact_path: string } | undefined
      if (!render) return { error: 'no product_renders row available' as const }

      // Get a public URL for the artifact_path. Reuse storage.uploadBuffer's
      // bucket convention: artifact_path is stored as the storage key, so
      // we fabricate the public URL from SUPABASE_URL + bucket. Since this
      // is admin-tier and the bucket layout is stable, that's ok.
      const printFileUrl = `${CONFIG.supabaseUrl}/storage/v1/object/public/maps/${render.artifact_path}`

      const gelato = await placeGelatoOrder({
        order: {
          id: order.id,
          quantity: order.quantity,
          user_id: order.user_id,
          guest_email: order.guest_email,
        },
        shippingAddress: (order.shipping_address ?? {}) as never,
        printFileUrl,
        productUid: snap.product_uid,
        gelatoApiKey: process.env.GELATO_API_KEY ?? '',
      })

      await client.query(
        `UPDATE orders
            SET gelato_order_id = $1,
                fulfillment_status = 'submitted_to_gelato',
                status = 'in_production',
                print_file_url = COALESCE(print_file_url, $2),
                print_render_id = COALESCE(print_render_id, $3)
          WHERE id = $4`,
        [gelato.gelato_order_id, printFileUrl, render.id, order.id],
      )
      await client.query(
        `UPDATE print_render_jobs
            SET status = 'submitted',
                completed_at = now(),
                last_error = NULL
          WHERE id = $1`,
        [jobId],
      )
      return { ok: true as const, gelato_order_id: gelato.gelato_order_id }
    })
    if ('error' in result) {
      res.status(404).json({ error: result.error })
      return
    }
    log.info('admin_force_submit', { job_id: jobId, gelato_order_id: result.gelato_order_id })
    res.json(result)
  } catch (err) {
    res.status(500).json({ error: 'force submit failed', message: (err as Error).message })
  }
})

app.post('/admin/orders/:order_id/manual-upload', async (req: Request, res: Response) => {
  const orderId = req.params.order_id
  const artifactUrl = (req.body?.artifact_url as string | undefined)?.trim()
  if (!artifactUrl) {
    res.status(400).json({ error: 'missing artifact_url' })
    return
  }
  try {
    const result = await withPgClient(async (client) => {
      const order = (
        await client.query(
          `SELECT id, active_stripe_session_id FROM orders WHERE id = $1`,
          [orderId],
        )
      ).rows[0] as { id: string; active_stripe_session_id: string | null } | undefined
      if (!order || !order.active_stripe_session_id) {
        return { error: 'order or stripe session not found' as const }
      }
      const snap = (
        await client.query(
          `SELECT product_uid, map_content_hash, chrome_hash, provider_profile
             FROM order_snapshots
            WHERE stripe_session_id = $1`,
          [order.active_stripe_session_id],
        )
      ).rows[0] as
        | {
            product_uid: string
            map_content_hash: string
            chrome_hash: string
            provider_profile: { bleedMm?: number; maxDpi?: number } | null
          }
        | undefined
      if (!snap) return { error: 'snapshot not found' as const }

      const validationResult = {
        manual: true,
        uploaded_by: 'admin',
        uploaded_at: new Date().toISOString(),
        passed: true,
        errors: [],
        warnings: [],
        validator_version: 'manual-upload-v1',
        checked_at: new Date().toISOString(),
      }
      const inserted = await client.query(
        `INSERT INTO product_renders
           (stripe_session_id, product_uid, trim_width_in, trim_height_in,
            dpi, bleed_mm, render_backend, map_content_hash, chrome_hash,
            print_hash, artifact_path, validation_result)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         RETURNING id`,
        [
          order.active_stripe_session_id,
          snap.product_uid,
          0,
          0,
          snap.provider_profile?.maxDpi ?? 300,
          snap.provider_profile?.bleedMm ?? 3,
          'native',
          snap.map_content_hash,
          snap.chrome_hash,
          `manual-${Date.now()}`,
          artifactUrl,
          validationResult,
        ],
      )
      await client.query(
        `UPDATE orders
            SET print_file_url = $1,
                print_render_id = $2,
                fulfillment_status = 'print_ready'
          WHERE id = $3`,
        [artifactUrl, (inserted.rows[0] as { id: string }).id, orderId],
      )
      return { ok: true as const, product_render_id: (inserted.rows[0] as { id: string }).id }
    })
    if ('error' in result) {
      res.status(404).json({ error: result.error })
      return
    }
    log.info('admin_manual_upload', { order_id: orderId, product_render_id: result.product_render_id })
    res.json(result)
  } catch (err) {
    res.status(500).json({ error: 'manual upload failed', message: (err as Error).message })
  }
})

// ─── 404 ─────────────────────────────────────────────────────────────────────
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'not found' })
})

// ─── Boot ────────────────────────────────────────────────────────────────────
function main(): void {
  // Re-export validateLogoUrl so unit tests + observers can import it cheaply.
  void validateLogoUrl
  void HASH_VERSION

  app.listen(CONFIG.port, '0.0.0.0', () => {
    log.info('boot', {
      port: CONFIG.port,
      version: VERSION,
      native_available: nativeAvailable(),
      pg_configured: !!CONFIG.databaseUrl,
    })
  })
}

main()
