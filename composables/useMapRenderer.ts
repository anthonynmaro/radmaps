/**
 * useMapRenderer — trigger a render and poll for completion.
 *
 * Two protocols, auto-detected from the server response:
 *
 *   v4 path — POST returns `{ status, proof_render_hash, render_url? }`:
 *     • status === 'cached'      → resolve immediately, no polling
 *     • status === 'compositing' → poll every 1 s for `proof_render_hash`
 *                                   to land on the maps row, 15 s timeout
 *     • status === 'rendering'   → exponential backoff (1, 2, 4, 8, 10 s),
 *                                   2-minute total timeout
 *
 *   Legacy path — POST returns `{ job_id, status: 'queued' }`:
 *     • flat 3 s polling on `maps.status === 'rendered'`, 2-minute cap
 *     • mirrors the original Puppeteer-worker behaviour exactly
 *
 * The composable picks the path automatically based on the presence of
 * `proof_render_hash` in the trigger response, so the consuming UI does
 * not need to know which pipeline served the request.
 */
export type MapRenderIntent = 'editor-thumbnail' | 'share' | 'checkout'

export function useMapRenderer(mapId: Ref<string> | string) {
  const id = isRef(mapId) ? mapId : ref(mapId)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = useSupabaseClient() as any

  const isRendering = ref(false)
  const isComplete  = ref(false)
  const renderUrl   = ref<string | null>(null)
  const pdfUrl      = ref<string | null>(null)
  const error       = ref<string | null>(null)
  const retryAfterSeconds = ref<number | null>(null)

  // Polling state — shared between paths so stopPolling() is one source of truth.
  let nextTimeout: ReturnType<typeof setTimeout> | null = null
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null

  function stopPolling() {
    if (nextTimeout !== null)   { clearTimeout(nextTimeout);   nextTimeout = null }
    if (timeoutHandle !== null) { clearTimeout(timeoutHandle); timeoutHandle = null }
  }

  function settleComplete(url: string | null) {
    renderUrl.value   = url
    isRendering.value = false
    isComplete.value  = true
    stopPolling()
  }

  function settleError(msg: string) {
    error.value = msg
    isRendering.value = false
    stopPolling()
  }

  // ── Trigger ──────────────────────────────────────────────────────────────────

  async function triggerRender(options: { intent?: MapRenderIntent } = {}) {
    if (isRendering.value) return
    isRendering.value = true
    isComplete.value  = false
    error.value       = null
    renderUrl.value   = null
    retryAfterSeconds.value = null

    try {
      const resp = await $fetch<{
        status?: 'cached' | 'compositing' | 'rendering' | 'queued'
        render_url?: string
        proof_render_hash?: string
        job_id?: string
      }>(`/api/maps/${id.value}/render`, {
        method: 'POST',
        body: options.intent ? { render_intent: options.intent } : undefined,
      })

      // v4 path: response includes proof_render_hash.
      if (resp && typeof resp.proof_render_hash === 'string') {
        if (resp.status === 'cached' && resp.render_url) {
          settleComplete(resp.render_url)
          return
        }
        const targetHash = resp.proof_render_hash
        if (resp.status === 'compositing') {
          startV4Polling({ targetHash, intervalMs: 1000, totalTimeoutMs: 15_000, backoff: false })
        } else {
          // 'rendering' or anything else → backoff polling.
          startV4Polling({ targetHash, intervalMs: 1000, totalTimeoutMs: 120_000, backoff: true })
        }
        return
      }

      // Legacy path.
      startLegacyPolling()
    } catch (e) {
      const err = e as Error & {
        response?: { status?: number; headers?: Headers }
        statusCode?: number
        status?: number
      }
      const retryAfter = err.response?.headers?.get?.('Retry-After')
      retryAfterSeconds.value = retryAfter ? Number.parseInt(retryAfter, 10) : null
      settleError(err.message ?? 'Failed to start render')
    }
  }

  // ── v4 polling ───────────────────────────────────────────────────────────────
  //
  // Polls maps row for the new `proof_render_hash` to land. When the hash
  // matches what the server told us to expect, the worker has finished
  // composing the proof and `proof_render_url` is set.

  function startV4Polling(opts: {
    targetHash: string
    intervalMs: number
    totalTimeoutMs: number
    backoff: boolean
  }) {
    stopPolling()
    let delay = opts.intervalMs
    const MAX_DELAY = 10_000

    const tick = async () => {
      try {
        const { data } = await supabase
          .from('maps')
          .select('proof_render_hash, proof_render_url, render_url')
          .eq('id', id.value)
          .single()
        if (!data) return scheduleNext()

        // Worker error sentinel (legacy + v4 both use this on failure).
        if (typeof data.render_url === 'string' && data.render_url.startsWith('error:')) {
          settleError(data.render_url.slice(6) || 'Render failed. Please try again.')
          await supabase.from('maps').update({ render_url: null }).eq('id', id.value)
          return
        }

        if (data.proof_render_hash === opts.targetHash && data.proof_render_url) {
          settleComplete(data.proof_render_url)
          return
        }
      } catch (e) {
        console.error('Render status poll error (v4):', e)
      }
      scheduleNext()
    }

    const scheduleNext = () => {
      if (opts.backoff) {
        delay = Math.min(delay * 2, MAX_DELAY)
      }
      nextTimeout = setTimeout(tick, delay)
    }

    timeoutHandle = setTimeout(() => {
      if (isRendering.value) {
        settleError('Render timed out. Please try again.')
      }
    }, opts.totalTimeoutMs)

    nextTimeout = setTimeout(tick, opts.intervalMs)
  }

  // ── Legacy polling (3s flat, 2-min timeout) ─────────────────────────────────

  function startLegacyPolling() {
    stopPolling()
    const tick = async () => {
      try {
        const { data: map } = await supabase
          .from('maps')
          .select('status, render_url, pdf_url')
          .eq('id', id.value)
          .single()
        if (!map) return scheduleNext()

        if (typeof map.render_url === 'string' && map.render_url.startsWith('error:')) {
          settleError(map.render_url.slice(6) || 'Render failed. Please try again.')
          await supabase.from('maps').update({ render_url: null }).eq('id', id.value)
          return
        }

        if (map.status === 'rendered') {
          renderUrl.value = map.render_url ?? null
          pdfUrl.value    = map.pdf_url ?? null
          settleComplete(renderUrl.value)
          return
        }
      } catch (e) {
        console.error('Render status poll error:', e)
      }
      scheduleNext()
    }

    const scheduleNext = () => {
      nextTimeout = setTimeout(tick, 3000)
    }

    timeoutHandle = setTimeout(() => {
      if (isRendering.value) {
        settleError('Render timed out. Please try again.')
      }
    }, 2 * 60 * 1000)

    nextTimeout = setTimeout(tick, 3000)
  }

  onUnmounted(stopPolling)

  return { triggerRender, isRendering, isComplete, renderUrl, pdfUrl, error, retryAfterSeconds }
}
