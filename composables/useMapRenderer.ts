/**
 * useMapRenderer — trigger and poll a high-resolution render job.
 */
import type { RenderJobStatus } from '~/types'

export function useMapRenderer(mapId: Ref<string> | string) {
  const id = isRef(mapId) ? mapId : ref(mapId)

  const jobId = ref<string | null>(null)
  const status = ref<RenderJobStatus | null>(null)
  const renderUrl = ref<string | null>(null)
  const pdfUrl = ref<string | null>(null)
  const error = ref<string | null>(null)
  const loading = ref(false)

  let pollInterval: ReturnType<typeof setInterval>

  async function triggerRender() {
    loading.value = true
    error.value = null

    try {
      const result = await $fetch<{ job_id: string; status: string }>(
        `/api/maps/${id.value}/render`,
        { method: 'POST' },
      )
      jobId.value = result.job_id
      status.value = 'queued'
      startPolling()
    } catch (e) {
      error.value = (e as Error).message
    } finally {
      loading.value = false
    }
  }

  function startPolling() {
    pollInterval = setInterval(async () => {
      if (!jobId.value) return
      try {
        const result = await $fetch<{
          status: RenderJobStatus
          render_url?: string
          pdf_url?: string
          error?: string
        }>(`/api/maps/${id.value}/render/status?job_id=${jobId.value}`)

        status.value = result.status

        if (result.status === 'complete') {
          renderUrl.value = result.render_url ?? null
          pdfUrl.value = result.pdf_url ?? null
          stopPolling()
        }

        if (result.status === 'failed') {
          error.value = result.error ?? 'Render failed'
          stopPolling()
        }
      } catch (e) {
        console.error('Poll error:', e)
      }
    }, 2000) // Poll every 2 seconds
  }

  function stopPolling() {
    clearInterval(pollInterval)
  }

  onUnmounted(stopPolling)

  const isRendering = computed(() =>
    status.value === 'queued' || status.value === 'rendering',
  )

  const isComplete = computed(() => status.value === 'complete')

  return { triggerRender, status, isRendering, isComplete, renderUrl, pdfUrl, error, loading }
}
