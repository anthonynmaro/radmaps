import type { StyleConfig } from '~/types'

export interface SavedTheme {
  id: string
  name: string
  savedAt: string
  config: Partial<StyleConfig>
}

const STORAGE_KEY = 'radmaps_saved_themes'

// Keys that are content/state rather than style — excluded from saved themes
const EXCLUDED_KEYS: (keyof StyleConfig)[] = [
  'trail_name', 'occasion_text', 'location_text',
  'text_overlays', 'trail_segments', 'trail_legend',
  'map_frozen', 'map_zoom', 'map_center',
]

export function useSavedThemes() {
  const themes = ref<SavedTheme[]>([])

  function load() {
    if (import.meta.server) return
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      themes.value = raw ? JSON.parse(raw) : []
    } catch {
      themes.value = []
    }
  }

  function saveTheme(name: string, config: StyleConfig): SavedTheme {
    const styleOnly: Partial<StyleConfig> = { ...config }
    for (const key of EXCLUDED_KEYS) delete styleOnly[key]

    const theme: SavedTheme = {
      id: crypto.randomUUID(),
      name: name.trim() || 'My Theme',
      savedAt: new Date().toISOString(),
      config: styleOnly,
    }
    themes.value = [theme, ...themes.value]
    persist()
    return theme
  }

  function removeTheme(id: string) {
    themes.value = themes.value.filter(t => t.id !== id)
    persist()
  }

  function persist() {
    if (import.meta.server) return
    localStorage.setItem(STORAGE_KEY, JSON.stringify(themes.value))
  }

  onMounted(load)

  return { themes, saveTheme, removeTheme }
}
