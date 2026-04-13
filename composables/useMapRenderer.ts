/**
 * useMapRenderer — trigger a 300 DPI render job and poll for completion.
 *
 * Flow:
 *   1. POST /api/maps/:id/render  → fires render worker (fire-and-forget)
 *   2. Poll the map record in Supabase every 3s until status → 'rendered'
 *   3. Expose isRendering / isComplete / renderUrl / error for the UI
 */
export function useMapRenderer(mapId: Ref<string> | string) {
  const id = isRef(mapId) ? mapId : ref(mapId)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = useSupabaseClient() as any

  const isRendering = ref(false)
  const isComplete  = ref(false)
  const renderUrl   = ref<string | null>(null)
  const pdfUrl      = ref<string | null>(null)
  const error       = ref<string | null>(null)

  let pollInterval: ReturnType<typeof setInterval> | null = null
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null

  // ── Trigger ──────────────────────────────────────────────────────────────────

  async function triggerRender() {
    if (isRendering.value) return
    isRendering.value = true
    isComplete.value  = false
    error.value       = null

    try {
      await $fetch(`/api/maps/${id.value}/render`, { method: 'POST' })
      startPolling()
    } catch (e) {
      error.value = (e as Error).message ?? 'Failed to start render'
      isRendering.value = false
    }
  }

  // ── Poll Supabase map record every 3s ─────────────────────────────────────────

  function startPolling() {
    stopPolling()
    pollInterval = setInterval(checkStatus, 3000)
    // Safety timeout: stop polling after 2 minutes
    timeoutHandle = setTimeout(() => {
      if (isRendering.value) {
        error.value = 'Render timed out. Please try again.'
        isRendering.value = false
        stopPolling()
      }
    }, 2 * 60 * 1000)
  }

  async function checkStatus() {
    try {
      const { data: map } = await supabase
        .from('maps')
        .select('status, render_url, pdf_url')
        .eq('id', id.value)
        .single()

      if (!map) return

      // Detect worker error sentinel written on failure
      if (typeof map.render_url === 'string' && map.render_url.startsWith('error:')) {
        error.value = map.render_url.slice(6) || 'Render failed. Please try again.'
        isRendering.value = false
        stopPolling()
        // Clear the sentinel so a retry starts fresh
        await supabase.from('maps').update({ render_url: null }).eq('id', id.value)
        return
      }

      if (map.status === 'rendered') {
        renderUrl.value   = map.render_url ?? null
        pdfUrl.value      = map.pdf_url ?? null
        isRendering.value = false
        isComplete.value  = true
        stopPolling()
      }
      // 'draft' = still rendering or not started; keep polling
    } catch (e) {
      console.error('Render status poll error:', e)
    }
  }

  function stopPolling() {
    if (pollInterval !== null) { clearInterval(pollInterval); pollInterval = null }
    if (timeoutHandle !== null) { clearTimeout(timeoutHandle); timeoutHandle = null }
  }

  onUnmounted(stopPolling)

  return { triggerRender, isRendering, isComplete, renderUrl, pdfUrl, error }
}
