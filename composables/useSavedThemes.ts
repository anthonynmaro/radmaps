import type { StyleConfig } from '~/types'

export interface SavedTheme {
  id: string
  name: string
  savedAt: string
  config: Partial<StyleConfig>
}

const STORAGE_KEY = 'radmaps_saved_themes'

// Style-only keys — excludes content (text, overlays) and transient map state
export const SAVED_THEME_EXCLUDED_KEYS: (keyof StyleConfig)[] = [
  'trail_name', 'occasion_text', 'location_text',
  'text_overlays', 'trail_segments', 'trail_legend',
  'map_frozen', 'map_zoom', 'map_center',
]

// Pure helpers — used by the composable and importable in tests

export function createSavedTheme(name: string, config: StyleConfig): SavedTheme {
  const styleOnly: Partial<StyleConfig> = { ...config }
  for (const key of SAVED_THEME_EXCLUDED_KEYS) delete styleOnly[key]
  return {
    id: crypto.randomUUID(),
    name: name.trim() || 'My Theme',
    savedAt: new Date().toISOString(),
    config: styleOnly,
  }
}

export function loadThemesFromStorage(raw: string | null): SavedTheme[] {
  if (!raw) return []
  try { return JSON.parse(raw) } catch { return [] }
}

// Composable — manages the reactive list and syncs with localStorage

export function useSavedThemes() {
  const themes = ref<SavedTheme[]>([])

  function load() {
    if (import.meta.server) return
    themes.value = loadThemesFromStorage(localStorage.getItem(STORAGE_KEY))
  }

  function saveTheme(name: string, config: StyleConfig): SavedTheme {
    const theme = createSavedTheme(name, config)
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
