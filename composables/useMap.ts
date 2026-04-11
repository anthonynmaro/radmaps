/**
 * useMap — reactive map state management.
 * Handles loading, optimistic updates, and debounced API persistence of StyleConfig.
 */
import type { TrailMap, StyleConfig } from '~/types'

export function useMap(mapId: Ref<string> | string) {
  const id = isRef(mapId) ? mapId : ref(mapId)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = useSupabaseClient() as any

  const map = ref<TrailMap | null>(null)
  const loading = ref(true)
  const saving = ref(false)
  const error = ref<string | null>(null)

  // Fetch map on mount / id change
  watchEffect(async () => {
    if (!id.value) return
    loading.value = true
    error.value = null

    const { data, error: fetchError } = await supabase
      .from('maps')
      .select('*')
      .eq('id', id.value)
      .single()

    if (fetchError) {
      error.value = fetchError.message
    } else {
      map.value = data as TrailMap
    }
    loading.value = false
  })

  // Debounced style update — saves 500ms after the last change
  let saveTimer: ReturnType<typeof setTimeout>

  async function updateStyle(updates: Partial<StyleConfig>) {
    if (!map.value) return

    // Optimistic update
    map.value.style_config = { ...map.value.style_config, ...updates }

    clearTimeout(saveTimer)
    saveTimer = setTimeout(async () => {
      saving.value = true
      const { error: updateError } = await supabase
        .from('maps')
        .update({ style_config: map.value!.style_config, updated_at: new Date().toISOString() })
        .eq('id', id.value)

      if (updateError) {
        console.error('Failed to save style:', updateError.message)
      }
      saving.value = false
    }, 500)
  }

  async function updateMeta(updates: { title?: string; subtitle?: string }) {
    if (!map.value) return
    Object.assign(map.value, updates)
    await supabase
      .from('maps')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id.value)
  }

  return { map, loading, saving, error, updateStyle, updateMeta }
}
