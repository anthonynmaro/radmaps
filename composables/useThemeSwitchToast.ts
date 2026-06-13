// E1 follow-up (docs/STYLE_SYSTEM_EVOLUTION.md "Theme switching must preserve
// user intent"): when FLAGS.EDITOR_V2 preserves user customizations across a
// theme switch, surface a toast with a "Reset all to theme" escape hatch.
// Callers are responsible for flag-gating — flag off, theme application never
// preserves fields, so `preservedCount` is 0 and this never fires.

const THEME_SWITCH_TOAST_ID = 'theme-switch-preserved-customizations'

export function useThemeSwitchToast() {
  const toast = useToast()

  function notifyThemeSwitchPreserved(options: {
    /** Number of customized fields that survived the switch. */
    preservedCount: number
    /** Applies the full legacy clobber (resetAllToTheme) — the toast's undo. */
    onResetAll: () => void
  }) {
    if (options.preservedCount <= 0) return
    // Replace any previous theme-switch toast so rapid theme browsing doesn't stack.
    toast.remove(THEME_SWITCH_TOAST_ID)
    toast.add({
      id: THEME_SWITCH_TOAST_ID,
      title: `Kept ${options.preservedCount} of your customizations`,
      description: 'Your manual tweaks survived the theme switch.',
      icon: 'i-heroicons-paint-brush',
      color: 'green',
      timeout: 8000,
      actions: [
        {
          label: 'Reset all to theme',
          click: options.onResetAll,
        },
      ],
    })
  }

  return { notifyThemeSwitchPreserved }
}
