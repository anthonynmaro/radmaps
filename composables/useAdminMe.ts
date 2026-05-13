import type { Ref } from 'vue'
import type { AdminRole } from '~/types'

export interface AdminMe {
  staff: null | {
    user_id?: string
    email?: string
    role: AdminRole
    staff_id?: string | null
  }
}

interface AdminMeState extends AdminMe {
  /** ID of the user the cached row was loaded for. Null = not loaded yet. */
  loadedFor: string | null
}

/**
 * Shared `/api/admin/me` lookup, cached for the lifetime of the user session.
 *
 * Previously the default layout fetched this once and AdminShell.vue re-fetched
 * it on every admin tab navigation — every admin page click waited on a fresh
 * HTTP round-trip before the new page would render. Centralising the lookup in
 * a `useState` slot means the first paint of any admin page can use cached data
 * and only the very first call after sign-in actually hits the network.
 */
export function useAdminMe(): {
  state: Ref<AdminMeState>
  staff: Ref<AdminMe['staff']>
  pending: Ref<boolean>
  isStaff: Ref<boolean>
  ensureLoaded: () => Promise<void>
  refresh: () => Promise<void>
  reset: () => void
} {
  const user = useSupabaseUser()
  const state = useState<AdminMeState>('admin-me', () => ({ staff: null, loadedFor: null }))
  const pending = useState<boolean>('admin-me:pending', () => false)

  const staff = computed(() => state.value.staff)
  const isStaff = computed(() => Boolean(state.value.staff))

  async function fetchNow() {
    const userId = user.value?.id ?? null
    pending.value = true
    try {
      // `useRequestFetch` on the server forwards the incoming request's cookies
      // so admin/me sees the authenticated user; on the client it's plain $fetch.
      const fetcher = import.meta.server ? (useRequestFetch() as typeof $fetch) : $fetch
      const data = await fetcher<AdminMe>('/api/admin/me')
      state.value = { staff: data.staff ?? null, loadedFor: userId }
    } catch {
      state.value = { staff: null, loadedFor: userId }
    } finally {
      pending.value = false
    }
  }

  function ensureLoaded(): Promise<void> {
    const userId = user.value?.id ?? null
    if (!userId) {
      // Signed out — nothing to load, clear any stale staff row.
      if (state.value.staff || state.value.loadedFor !== null) {
        state.value = { staff: null, loadedFor: null }
      }
      return Promise.resolve()
    }
    if (state.value.loadedFor === userId) return Promise.resolve()
    return fetchNow()
  }

  async function refresh() {
    await fetchNow()
  }

  function reset() {
    state.value = { staff: null, loadedFor: null }
  }

  return { state, staff, pending, isStaff, ensureLoaded, refresh, reset }
}
