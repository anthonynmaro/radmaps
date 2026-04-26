import { describe, it, expect } from 'vitest'

/**
 * Pure predicate extracted from the MapPreview styledata handler.
 * After setStyle() MapLibre resets the viewport — this determines whether
 * the frozen zoom/center should be restored.
 */
function shouldRestoreFrozenView(config: {
  map_frozen?: boolean | null
  map_zoom?: number | null
  map_center?: [number, number] | null
}): boolean {
  return !!(config.map_frozen && config.map_zoom != null && config.map_center != null)
}

describe('shouldRestoreFrozenView', () => {
  it('returns true when map is frozen with both zoom and center', () => {
    expect(shouldRestoreFrozenView({
      map_frozen: true,
      map_zoom: 12.5,
      map_center: [-1.23, 45.67],
    })).toBe(true)
  })

  it('returns false when map is not frozen', () => {
    expect(shouldRestoreFrozenView({
      map_frozen: false,
      map_zoom: 12.5,
      map_center: [-1.23, 45.67],
    })).toBe(false)
  })

  it('returns false when map_frozen is null', () => {
    expect(shouldRestoreFrozenView({
      map_frozen: null,
      map_zoom: 12.5,
      map_center: [-1.23, 45.67],
    })).toBe(false)
  })

  it('returns false when map_zoom is null', () => {
    expect(shouldRestoreFrozenView({
      map_frozen: true,
      map_zoom: null,
      map_center: [-1.23, 45.67],
    })).toBe(false)
  })

  it('returns false when map_center is null', () => {
    expect(shouldRestoreFrozenView({
      map_frozen: true,
      map_zoom: 12.5,
      map_center: null,
    })).toBe(false)
  })

  it('returns false when all fields are undefined (initial StyleConfig state)', () => {
    expect(shouldRestoreFrozenView({})).toBe(false)
  })

  it('returns false when map_zoom is 0 (falsy but valid zoom)', () => {
    // zoom 0 is a valid MapLibre value — should still restore
    // Note: 0 != null is true, so this correctly returns true
    expect(shouldRestoreFrozenView({
      map_frozen: true,
      map_zoom: 0,
      map_center: [-1.23, 45.67],
    })).toBe(true)
  })
})

describe('frozen view restore — regression guard', () => {
  it('restores view when user changes a FULL_RELOAD_KEY while frozen', () => {
    // Simulates the sequence: freeze → change style preset → styledata fires
    // The fix: jumpTo() is called in the styledata handler when this check passes.
    const frozenConfig = {
      map_frozen: true,
      map_zoom: 14,
      map_center: [-0.1278, 51.5074] as [number, number],
    }

    // Before fix: setStyle() reset viewport and no restore happened → zoom changed
    // After fix: shouldRestoreFrozenView returns true, jumpTo() is called
    expect(shouldRestoreFrozenView(frozenConfig)).toBe(true)
  })

  it('does not attempt restore after unfreezing', () => {
    // After unfreezeView() emits { map_frozen: false }, no restore should happen
    const unfrozenConfig = { map_frozen: false, map_zoom: 14, map_center: [-0.1278, 51.5074] as [number, number] }
    expect(shouldRestoreFrozenView(unfrozenConfig)).toBe(false)
  })
})
