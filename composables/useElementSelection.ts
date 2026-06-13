// Editor-v2 D1 unified selection arbiter (docs/EDITOR_UX_NORTH_STAR.md "Two
// unification moves", docs/STYLE_SYSTEM_EVOLUTION.md "The model").
//
// ONE selection across every editor domain: selecting anything anywhere must
// deselect everything else everywhere. The poster text system (MapPreview's
// activeTextTarget), the poster element system (MapEditorSurface's
// selectedPosterElementId + Moveable), and the map element system
// (useMapElementSelection) each keep their own rich local state, but they all
// register their selection with this arbiter. When ownership moves to another
// domain, the previous owner's eviction watcher clears its local state.
//
// Domains (deliberately coarse):
// - 'poster' — text slots, text/image/icon overlays, guided poster elements.
//   Slot clicks claim the same domain+key from BOTH MapPreview (toolbar state)
//   and MapEditorSurface (Moveable state); claims are idempotent so the two
//   holders never evict each other. Intra-poster key changes are handled by
//   the poster systems' existing transitions, not by eviction.
// - 'map' — route, trail segments, vector labels (useMapElementSelection).
//
// Editor-only chrome: callers only claim behind FLAGS.EDITOR_V2, so flag-off
// this store stays permanently null and changes nothing. Selection is always
// a client gesture — the store is never written during SSR — so a per-tab
// module singleton is safe and keeps the composable unit-testable.

import { ref, watch, type Ref } from 'vue'

export type ElementSelectionDomain = 'poster' | 'map'

export interface ElementSelectionClaim {
  domain: ElementSelectionDomain
  /** Stable element key within the domain, e.g. 'slot:trail_name', 'text:<id>', 'segment:<id>', 'route'. */
  key: string
}

export interface ElementSelectionArbiter {
  /** Current owner (readonly by convention — mutate through claim/release). */
  current: Ref<ElementSelectionClaim | null>
  /** Take ownership. Idempotent for the same domain+key. */
  claim: (domain: ElementSelectionDomain, key: string) => void
  /** Give up ownership iff this domain (and key, when given) still holds it. */
  release: (domain: ElementSelectionDomain, key?: string) => void
  /** Clear ownership unconditionally (Esc / empty-space click). */
  releaseAll: () => void
  /**
   * Register an eviction callback for a domain: fires whenever the domain
   * held the selection and lost it (to another domain or to null). Does NOT
   * fire on intra-domain key changes — domains manage their own transitions.
   * Returns the watcher stop handle.
   */
  onEvicted: (domain: ElementSelectionDomain, callback: (previous: ElementSelectionClaim) => void) => () => void
}

export function createElementSelectionArbiter(): ElementSelectionArbiter {
  const current = ref<ElementSelectionClaim | null>(null)

  function claim(domain: ElementSelectionDomain, key: string) {
    if (current.value?.domain === domain && current.value.key === key) return
    current.value = { domain, key }
  }

  function release(domain: ElementSelectionDomain, key?: string) {
    if (!current.value || current.value.domain !== domain) return
    if (key != null && current.value.key !== key) return
    current.value = null
  }

  function releaseAll() {
    if (current.value) current.value = null
  }

  function onEvicted(domain: ElementSelectionDomain, callback: (previous: ElementSelectionClaim) => void) {
    return watch(current, (next, previous) => {
      if (previous?.domain === domain && next?.domain !== domain) callback(previous)
    })
  }

  return { current, claim, release, releaseAll, onEvicted }
}

// Per-tab singleton. Never written during SSR (claims happen only on user
// gestures behind FLAGS.EDITOR_V2), so module scope is not a cross-request
// leak the way SSR-rendered state would be.
const arbiter = createElementSelectionArbiter()

export function useElementSelection(): ElementSelectionArbiter {
  return arbiter
}
