# Theme-Aware Trail Colors — Plan (corrected)

Date: June 8, 2026
Goal: when a route has named trails/segments, assign colors that **read as the
active theme** and stay readable on the map — **scaling cleanly to ~10–12+ trails
and degrading gracefully beyond that** — while preserving user customizations
unless the user opts to overwrite. (There is a real upper bound: within one hue
arc + 3:1 contrast + ΔE spacing you eventually run out of distinct theme-coherent
colors; see the graceful-degradation ladder.)

This is the original plan with corrections from two review rounds folded in
(Claude + Codex). The corrections are what make multi-trail routes look
theme-coherent instead of falling back to a rainbow or black/white after ~5 trails.

## Corrections from review (the substance)

1. **Scalable theme-derived ramp, not a fixed 5-token candidate list.** The
   biggest gap: picking from `route_color` + ~4 semantic tokens runs out on routes
   with 6–10+ trails (bike networks, multi-trail systems) → repeats or black/white.
   Generate a **sequence** of N distinct colors derived from the theme's accent
   family (see "Palette generation").
2. **Don't use map-feature colors as trail colors.** `contour_color` and
   `water_color` are the colors of the features the trail sits *on*; a
   contour-colored trail over contours camouflages even if it passes contrast vs a
   flat background. Drop them from the candidate set (or down-rank hard), and
   measure contrast against the **dominant map fills**, not just `mapBg`.
3. **Distinctness.** Enforce a minimum perceptual distance (ΔE) between each
   segment color and (a) the **primary route color** and (b) the other segments.
   "Non-repeating" isn't enough — near-duplicates read as the same trail.
4. **Legacy = `custom` by default (no brittle rainbow-index matching).** A saved
   segment with **missing** `color_source` is treated as **custom (preserve)** —
   full stop. The earlier "exact match to the rainbow color at the auto-assign
   index" heuristic is dropped: it's brittle after segment delete/reorder and misses
   the `dark-sky` all-route-color case. Only **segments generated fresh in the
   current session** (batch import/extract/draw/add) are marked `theme` and
   recolored on theme switch. Never auto-recolor pre-existing saved segments.
5. **Determinism / stability.** The palette helper must be **pure and stable**:
   same route + theme → same color sequence on every render. Otherwise editor and
   AWS renderer print disagree and re-renders reshuffle colors. Test it.
6. **Supersede existing one-offs.** `utils/trail.ts` already special-cases
   `dark-sky` to return `route_color` for *every* segment (all named trails come
   out identical gold today). The new helper replaces that with a distinct
   gold-family ramp; remove the one-off, don't leave a competing path.

## Palette generation (the core, new)

Centralize in `utils/trailPalette.ts`.

- **Contrast checks use `contrastRatio()` directly, NOT `pickContrastSafeColor` as
  the main mechanism.** `pickContrastSafeColor` evaluates against a *single*
  background and appends a black/white fallback — which fights the "black/white
  rare" rule. Use `contrastRatio()` to filter candidates across the relevant
  backgrounds, and reserve `pickContrastSafeColor(bg, candidates, 3)` only for the
  final fallback step.

Generate up to N theme-coherent segment colors:
- **Derive strictly from `route_color` via HSL/Lab transforms** (do NOT reference
  `accent`/`accent2` — `ThemeDefinition` does not expose them; those live in the
  spec contracts, not the app theme type). Optional: add a real optional theme
  palette seed field later if curated multi-color seeds are wanted; v1 derives from
  `route_color`.
- **Build a sequence** by stepping **hue within a constrained arc** (analogous,
  ~±60–90°) and/or stepping **lightness/saturation**, staying within the theme's
  value range (light/paper themes → mid-dark trail lines; dark themes → lighter
  lines) so the set reads as one family.
- **Filter each candidate:**
  - contrast ≥ **3:1** against the **dominant area fills** (paper/land/water area
    background) via `contrastRatio()` — NOT against contour lines (contour is thin
    linework, not a dominant fill; requiring contrast to it over-constrains the
    palette);
  - ΔE ≥ threshold vs the **primary route color**, vs **already-assigned segments**,
    AND vs the **contour and water colors** (ΔE separation, not contrast, is what
    prevents camouflage against those features).
- **Deterministic: index-ordered assignment.** Generated theme colors are assigned
  by **segment index order** (segment 0 → ramp[0], etc.). This is the single
  determinism rule — it does not depend on segment IDs (current extraction uses
  random IDs). Stable IDs are optional, not required.
- **Graceful-degradation ladder (the real upper bound):** theme ramp → widen the
  hue arc → step lightness/saturation further → neutral theme-tinted greys → and
  only if distinctness still can't be met, **reuse a theme color differentiated by
  a dash/casing variation** (or, last resort, black/white). Define the explicit
  behavior at the bound rather than silently repeating or dumping to black/white.

The intent: warm earth tones for ranch/USGS, cool technical hues for blueprint,
gold-family for dark-sky, etc. — derived from `route_color`, scaling to ~10–12+
trails and degrading gracefully past the distinctness bound.

## Key changes (kept + corrected)

- Add `color_source?: 'theme' | 'custom'` to `TrailSegment` (no migration —
  segments live in JSONB `style_config`).
  - Segments **generated fresh this session** (import/extract/draw/add) → `theme`.
    Explicit color edits → `custom`.
  - Legacy segments without the field → **`custom` by default, always** (no
    rainbow-index matching). Never auto-recolor pre-existing saved segments.
- Replace the hardcoded `SEGMENT_COLORS` rainbow (and the `i % length` cycling at
  `utils/trail.ts:640`, and the `dark-sky` one-off) with the `trailPalette.ts`
  ramp above.
- Route every segment-creation path through the helper: manual `+ Add segment`
  (`StylePanel.vue`), drawn segments (`MapEditorSurface.vue`), GPX upload
  (`server/api/maps/[id]/tracks.post.ts`), named-track extraction (`utils/trail.ts`,
  recolored once a theme is chosen).
- Theme application (`utils/themeApplication.ts`, extending the existing
  `stripThemeOwnedTrailSegmentState`): default recolors only `theme`-owned
  segments to the new theme ramp; preserves `custom`; add an explicit
  `overwriteCustomTrailColors` option.
- Confirmation UX when custom colors exist (Quick theme buttons in `StylePanel`,
  `ThemeLineupStep`): "Keep custom colors" vs "Use theme colors"
  (`overwriteCustomTrailColors: true`).
- Segment color picker shows the **theme-safe ramp swatches** (not the static
  rainbow) + a custom input; any user pick is marked `custom`.

## Tests

- **Palette generation:**
  - For N = 1…12 segments, colors are mutually distinct (ΔE ≥ threshold), ΔE-distinct
    from the primary route, and pass ≥3:1 (`contrastRatio`) vs the dominant area
    fills for light, dark, and atlas/refined backgrounds.
  - Generated colors keep ΔE separation from `contour_color`/`water_color` (no
    camouflage), and those tokens are never selected as trail colors.
  - **Graceful degradation:** beyond the distinctness bound, the ladder kicks in
    (greys → dash/casing-differentiated reuse → B/W last); assert B/W is the
    exception, and that N=20 still produces a usable, non-crashing result.
  - **Determinism:** index-ordered assignment → same route + theme yields the
    identical sequence across repeated calls (independent of random segment IDs).
- `tests/trail-slice.test.ts`: `defaultTrailSegmentColor()` uses the theme ramp,
  not the rainbow; named-track extraction marks generated colors `theme`; the
  `dark-sky` one-off is gone.
- `tests/theme-application.test.ts`: theme-owned recolor on switch; custom
  preserved by default; overwritten when `overwriteCustomTrailColors`; legacy
  no-`color_source` inferred **custom** when ambiguous.
- `tests/style-control-sync.test.ts`: explicit route/segment color changes mark
  propagated segment colors `custom`.
- Print parity: a multi-trail route renders identical segment colors in editor and
  AWS renderer print (helper determinism); re-render doesn't reshuffle.

## Assumptions

- No DB migration (`trail_segments` in JSONB `style_config`); missing
  `color_source` = `custom` (preserved), never auto-recolored.
- Contrast target for non-text linework is **3:1**, measured with `contrastRatio()`
  against dominant area fills; `pickContrastSafeColor(..., 3)` used only for the
  final fallback. Theme colors preferred; black/white last-resort only.
- Derivation is from `route_color` (+ HSL/Lab transforms) — no `accent`/`accent2`
  dependency (not on `ThemeDefinition`). Index-ordered assignment is the
  determinism rule.
- Existing user maps stay valid.

## The goal / Codex prompt (paste this)

> Implement theme-aware trail/segment colors per
> `docs/THEME_AWARE_TRAIL_COLORS_PLAN.md`. CORE: build `utils/trailPalette.ts` that
> generates N **theme-coherent, mutually distinct, contrast-safe** segment colors as
> a **ramp derived from `route_color`** via HSL/Lab transforms (hue-arc + lightness
> steps) — NOT a fixed token list, and NOT `accent`/`accent2` (those aren't on
> `ThemeDefinition`). It must scale to ~10–12+ trails and **degrade gracefully**
> beyond the distinctness bound (greys → dash/casing-differentiated reuse → B/W
> last; B/W must be rare). Use `contrastRatio()` directly to require ≥3:1 vs the
> **dominant area fills** (NOT vs contour linework); reserve
> `pickContrastSafeColor(..., 3)` only for the final fallback. Exclude
> `contour_color`/`water_color` as candidates AND keep generated colors
> ΔE-separated from them (anti-camouflage), plus ΔE separation from the primary
> route and from each other. **Determinism = index-ordered assignment** (segment i →
> ramp[i]), independent of the random segment IDs, for editor==print parity.
>
> Add `color_source?: 'theme'|'custom'` to `TrailSegment` (no migration — JSONB
> `style_config`). Segments generated fresh this session = `theme`; explicit edits =
> `custom`; **legacy without the field = `custom` by default, always — never
> auto-recolor pre-existing saved segments** (drop any rainbow-index matching).
> Route ALL segment-creation paths through the helper (StylePanel add,
> MapEditorSurface draw, tracks.post.ts upload, trail.ts extraction) and remove the
> `SEGMENT_COLORS` rainbow + its `i % length` cycling + the `dark-sky` one-off.
> Theme application recolors only theme-owned segments by default, preserves custom,
> and takes an `overwriteCustomTrailColors` option; add the keep-vs-use confirmation
> UX. Picker shows theme ramp swatches; user picks → `custom`.
>
> GATES per commit: `npx vue-tsc --noEmit --pretty false`, `npm run test:style-graph`,
> focused Playwright. Tests must cover N=1..12 distinctness + ≥3:1 contrast vs area
> fills across light/dark/atlas backgrounds, ΔE-separation from contour/water, no
> map-feature-color selection, graceful degradation at N=20 (B/W rare), index-ordered
> determinism, legacy = custom (never auto-recolored), and editor==print color
> parity. One isolated commit at a time; clean worktree; never proceed on red;
> `MapPreview.vue` stays the only renderer.
