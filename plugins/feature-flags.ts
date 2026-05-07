type EnabledFlags = Record<string, true>

export default defineNuxtPlugin(async () => {
  const flags = useState<EnabledFlags>('feature-flags', () => ({}))

  async function loadFlags(fetcher: typeof $fetch) {
    try {
      const response = await fetcher<{ flags: EnabledFlags }>('/api/flags')
      flags.value = response.flags || {}
    } catch {
      flags.value = {}
    }
  }

  if (import.meta.server) {
    await loadFlags(useRequestFetch() as typeof $fetch)
  } else if (!flags.value || Object.keys(flags.value).length === 0) {
    await loadFlags($fetch)
  }
})
