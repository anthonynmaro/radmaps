# Post-Parity Phase 1 Watcher — Progress Log

## BOUNDARY REVIEW

2026-06-10 ~17:05 UTC — HEAD `7b93085`. Phase 1 (base map-mode quick-pick) landed in `84b0991` and was reviewed at HEAD, which includes a same-day reversal commit. Lead finding first.

### Lead: BROKEN (vs. plan) — Minimal was removed after landing; flat routes no longer resolve to it

`7b93085` ("Remove minimal base mode from quick pick", authored by Anthony, 11:46 CDT — six minutes after `962867e`) removed Minimal from `baseModeOptions` in `ThemeLineupStep.vue` **and** rewrote `recommendedBaseMapModeForContext()` in `utils/themeDataContract.ts` so auto never returns `'minimal'`: place/no-route → `terrain` (was `minimal`); flat low-relief uncovered → `terrain` (was `minimal`); flat Atlas-covered → `streets` (unchanged). Tests were updated to match, so this is deliberate, not a regression. Consequence: Minimal is now unreachable from UI and from Auto — the plan's designed answer for flat terrain (POST_PARITY_NEXT_STEPS.md "Ship Minimal now"; review C3 closure path) no longer exists at HEAD. Flat uncovered routes — the exact case Minimal was built for — now default to Terrain with adaptive-sparse contours, the look the low-relief punch list flagged as weakest. If the reversal is an intentional product call (e.g., Terrain's adaptive relief profile now reads well enough on flat routes), update POST_PARITY_NEXT_STEPS.md, BASE_LAYER_QUICKPICK_SPEC.md, and formally re-open or re-close review item C3 with the new rationale. If not intentional, restore is one line in `baseModeOptions` plus reverting the two branches in `recommendedBaseMapModeForContext` — the mode implementation itself is intact and healthy (see below).

### Check 1 — Minimal mode implementation: OK (as code; currently unreachable)

`applyMinimalBaseMapMode()` (`utils/themeOptions.ts`) does exactly what the spec asked: route on themed paper — `show_contours/show_hillshade/show_roads/show_place_labels/show_poi_labels/map_3d` all off, every atlas layer (contour, water, transportation, building, place, poi, …) off, transportation opacity 0. No fabricated terrain. It spreads the existing config and never touches `preset`, so each theme's `radmaps-*` preset contract is preserved. `'minimal'` also remains in `ThemeBaseMapMode` and `StyleConfig.base_map_mode` (types/index.ts:96, :557), so a persisted config with `base_map_mode: 'minimal'` still renders correctly — it's a hidden-but-live mode, not dead code. Decide: keep as hidden mode or prune the type.

### Check 2 — Control placement & behavior: OK, with one deviation

Control is on the theme-selection step (`ThemeLineupStep.vue`), a single global `selectedBaseMode` ref applied to the hero and all live cards through `previewConfigFor()` → `deriveThemePreviewConfig(..., { baseMapMode })` — global, not per-card, as specified. Auto chip shows the resolved recommendation (`resolvedBaseModeLabel`). Apply emits the theme plus the resolved `StyleConfig` (with `base_map_mode` set), as specified. Deviation: spec said Streets visible but **disabled** until Phase 2; at HEAD Streets is enabled — but `applyStreetsBaseMapMode()` is fully implemented (atlas `transportation` fields, theme-derived road colors/widths, water/park/landcover on, contours off), i.e., Phase 2 item 6 landed early rather than Streets being a dead button. MINOR: confirm Streets previews acceptably for routes with `atlas_coverage_status: 'missing'`, since the option isn't gated on coverage.

### Check 3 — Flat/low-relief default: BROKEN (vs. spec) — covered by the lead finding

Spec: flat/low-relief routes default to Minimal via the stats-based relief profile. At HEAD: flat uncovered → Terrain, flat covered → Streets, Minimal never. `resolveAdaptiveContourReliefProfile(stats)` (utils/mapStyle.ts, MapPreview.vue) is used for adaptive contour density, not the base-mode default. See lead.

### Check 4 — 27-theme parity spot-check: MINOR (stale renders, no regression observed)

`docs/theme_audit_output/poster-themes/` (editor/print/reference/diff) was generated Jun 9 — 8 commits behind HEAD, including four Jun-10 contour tunings (brutalist `5efb0fb`, botanical `b6af4d8`, classic-trail `959d6f3`, blueprint `a79bc95`). Spot-checked prints (brutalist, night-ride): coherent, on-target; brutalist's jagged route is the known boston-fixture sawtooth (test artifact, not a renderer bug). No regression observed, but current HEAD is unverified by renders — re-render the 27 at HEAD and lock goldens (review C2), fixing the boston fixture first so goldens are comparable to targets.

### Punch list

1. Decide the Minimal reversal (lead): intentional → update POST_PARITY_NEXT_STEPS.md + BASE_LAYER_QUICKPICK_SPEC.md and re-resolve C3; unintentional → restore option + the two `recommendedBaseMapModeForContext` branches.
2. Re-render 27-theme audit at HEAD (renders are Jun 9-stale) and lock golden snapshots in CI (C2); fix boston fixture first.
3. Verify Streets preview quality when Atlas coverage is `missing` (option is ungated).
4. Decide fate of hidden `'minimal'` mode in types/StyleConfig — keep as persisted-config mode or prune.
5. Still open from the Jun 10 review: ~116 uncommitted files in the working tree (C1).

BOUNDARY REVIEW COMPLETE
