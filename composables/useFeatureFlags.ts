import type { ComputedRef, Ref } from 'vue'
import type { KnownFlagKey } from '~/utils/knownFlags'

type EnabledFlags = Record<string, true>

export function useFeatureFlags(): {
  flags: Ref<EnabledFlags>
  refreshFeatureFlags: () => Promise<void>
} {
  const flags = useState<EnabledFlags>('feature-flags', () => ({}))

  async function refreshFeatureFlags() {
    try {
      const response = await $fetch<{ flags: EnabledFlags }>('/api/flags')
      flags.value = response.flags || {}
    } catch {
      flags.value = {}
    }
  }

  return { flags, refreshFeatureFlags }
}

export function useFeatureFlag(key: KnownFlagKey | string): ComputedRef<boolean> {
  const { flags } = useFeatureFlags()
  return computed(() => flags.value[key] === true)
}
