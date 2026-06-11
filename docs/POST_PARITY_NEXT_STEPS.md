# Post-Parity Theme Data + Base Mode Plan

Date: June 9, 2026 (redrafted with Anthony's review)
Source: loose ends from the theme-parity review thread, consolidated and reviewed.

## Summary

Aligned with the post-parity docs (`BASE_LAYER_QUICKPICK_SPEC.md`,
`THEME_DATA_CONTRACT_PLAN.md`), with one addition: the **base-layer quick-pick
appears on the theme selection step** so users choose both the look and the map base
before entering the editor.

Locked decisions:

- Ship **Minimal now** as a parity bridge for flat routes.
- Treat **Terrain / Streets / Minimal as one map-mode system** under the data contract.
- Add the quick-pick to `components/map/ThemeLineupStep.vue`, not only the later editor
  panel.
- Placeholder content may appear at **Order click only with explicit approval**;
  approved placeholders become **user-owned poster data** (not canonical route/elevation
  stats).

This plan sequences **after** theme parity stabilizes (per the data-contract
sequencing rule — don't layer data/purpose logic on an unstable renderer), with the
one exception of Minimal, which may land during parity (narrow blast radius, no
fabricated terrain).

---

## Gate — Phase 0: finish theme parity refinement (precondition)

Open punch list as of review pass 10 (`THEME_REFINEMENT_FEEDBACK.md`):

- **Relief-noise trio** — blueprint-strava, splits-stats, night-ride: one shared fix,
  faint/simplify the busy background contour field.
- **Tonal-band themes** — midcentury-travel, ranch-ochre: smooth radial tonal bands,
  not a contour weave.
- **Finish the recovered pair** — brutalist (faint-grey minor tier under the bold-black
  index; smooth toward concentric), botanical (densify + differentiate index tier).
- **Density/sharpen** — classic-trail (sparse), contour-wash (grainy), blueprint (blobby).
- **Confirm** daybreak-trace didn't over-soften (be698a3).

DoD: 27/27 read like targets at editor + print; renderer committed (done, a174faa);
contract visual-review state marks each approved. Keep committing per theme — the
working tree still carries uncommitted changes.

---

## Key Changes

- Add a compact segmented control in the theme-picker hero, near the selected theme
  label: **Auto / Terrain / Streets / Minimal**. Auto shows the resolved
  recommendation; manual choices preview immediately.
- Apply the selected base mode to the hero preview and all live theme cards through
  `deriveThemePreviewConfig(...)`; when the user clicks **"Use this look,"** emit the
  theme plus the resolved base mode in the selected `StyleConfig`.
- During parity, implement only the low-risk **Minimal** mode: route on themed paper,
  contours/roads off. Prefer a mode overlay that **preserves the refined themes'
  `radmaps-*` preset contracts**.
- After parity, implement `utils/themeDataContract.ts` with canonical
  `ThemeDataContext`, render mode, purpose, slot contracts, missing-data resolver, and
  contract version.
- Resolve missing slots **ephemerally** before merging user `poster_layout`; never write
  data-missing tombstones.
- Fold Terrain/Streets/Minimal into the contract's map-mode axis. Streets uses the
  existing Atlas `transportation` fields; Minimal is the fallback for flat relief or
  missing Atlas coverage.
- At Order click, detect unresolved placeholders. Require user approval; store approved
  values as **user-owned poster overrides / approved metadata**, not canonical
  route/elevation stats.
- Include contract version + resolved context/mode in render hashes.

---

## Sequenced build

### Phase 1 — Minimal base mode (may land during parity)

`route-only` preset + themed paper already exist. Implement Minimal as a mode overlay
that keeps each refined theme's `radmaps-*` preset contract intact, defaulting
flat/low-relief routes to it via the existing stats-based adaptive contour relief
profile, `resolveAdaptiveContourReliefProfile(stats)`, extracting/reusing it as
needed. This is how brutalist/Boston and any flat route reach "done" without
fabricated contours. Add the **Auto/Terrain/Streets/Minimal** control to
`ThemeLineupStep.vue`; during parity Auto, Terrain, and Minimal are selectable, while
Streets is visible but disabled until Phase 2.

### Phase 2 — Theme data contract (main post-parity workstream)

Per `THEME_DATA_CONTRACT_PLAN.md` (authoritative architecture + build order), with the
rest of the quick-pick folded in as the map-mode axis:

1. `utils/themeDataContract.ts` — `ThemeDataContext`, `ThemeRenderMode`, purpose, slot
   contracts, `MissingDataPolicy`, `THEME_DATA_CONTRACT_VERSION`.
2. `buildThemeDataContext(map)` — one canonical detection; replace scattered place
   detection.
3. Ephemeral resolver — omit default cells before merging user edits; no tombstones.
4. Shared formatters (`posterFormatters.ts`) so editor preview and render agree.
5. Server-side + cached derivation (reverse geocode / elevation at creation/enrichment);
   the screenshot renderer/render worker makes no external calls during render.
6. **Map mode = the quick-pick** — Terrain/Streets/Minimal through existing
   `preset`/`atlas_*`/`map_defaults`; this is where Streets + the Auto default land.
7. Picker — purpose-organized, recommend from `DataContext`, all themes still selectable.
8. Hashing — fold `THEME_DATA_CONTRACT_VERSION` + resolved context/mode into render hashes.
9. Order-click placeholder gate — approval flow; approved → user-owned overrides;
   unapproved placeholders blocked from checkout/final.

---

## Test Plan

- **Theme picker:** quick-pick changes hero/card previews; "Use this look" persists the
  selected base mode; Auto defaults deterministically from context.
- **Unit — `buildThemeDataContext`:** route, place-only, flat route, missing elevation,
  missing location metadata.
- **Resolver:** POI removes route-only defaults, preserves user overrides, permits
  approved placeholders, blocks unapproved placeholders from checkout/final.
- **Map mode:** flat route can use Minimal now; later, flat Atlas-covered route defaults
  to Streets; mountain route remains Terrain.
- **Playwright:** POI with `splits-stats` and `marathon-bib` reflows without route
  stats/profile; theme-picker quick-pick previews match editor output.

---

## Assumptions

- Full data-contract work waits until theme parity is stable.
- Minimal may land during parity (avoids fabricated terrain, narrow blast radius).
- The quick-pick is **global for the selected theme preview, not per-card**, to keep the
  selection step calm.
- `MapPreview.vue` remains the only poster renderer.

---

## The goal / Codex prompt (paste when ready; <4000 chars)

> Implement the base map-mode quick-pick + theme data contract per docs/POST_PARITY_NEXT_STEPS.md, reconciled with docs/THEME_DATA_CONTRACT_PLAN.md (AUTHORITATIVE architecture + build order) and docs/BASE_LAYER_QUICKPICK_SPEC.md. Terrain/Streets/Minimal and the data contract are ONE system. MapPreview.vue stays the only renderer. One commit per piece; vue-tsc + `npm run test:style-graph` + focused Playwright green per commit.
>
> GATE: Phase 0 parity is signed off (27/27) — proceed Phase 1 then Phase 2 without stopping.
>
> PHASE 1 — Minimal base mode: implement Minimal (route on themed paper, contours/roads OFF) as a mode OVERLAY preserving each theme's radmaps-* preset. Add an Auto/Terrain/Streets/Minimal segmented control to components/map/ThemeLineupStep.vue (picker hero, near the theme label), global-not-per-card; Auto/Terrain/Minimal selectable, Streets visible but DISABLED until Phase 2. Apply the mode to hero + all theme-card previews via deriveThemePreviewConfig(...). On "Use this look," emit theme + resolved base mode in StyleConfig. Default flat/low-relief routes to Minimal via the existing resolveAdaptiveContourReliefProfile(stats).
>
> PHASE 2 — Theme data contract: (1) utils/themeDataContract.ts: ThemeDataContext, ThemeRenderMode (picker-preview|editor|proof|checkout|final|share), purpose, slot contracts, MissingDataPolicy, THEME_DATA_CONTRACT_VERSION. (2) buildThemeDataContext(map) = the ONE canonical detector, replacing scattered place detection. (3) Renderer PURE/deterministic — resolveThemeDataContract(theme,composition,context,mode) resolves from the STORED map payload only; render worker makes NO external calls. (4) Missing slots removed EPHEMERALLY at layout-resolution time, merged with user poster_layout edits — NEVER write data-missing tombstones (tombstones = user intent only). (5) Derivation (reverse geocode/elevation) server-side at creation/enrichment and cached (migrations + supabase/schema.sql). (6) Population in shared posterFormatters.ts so editor preview and render agree. (7) Map mode = the quick-pick via existing preset/atlas_style_id/atlas_layers/map_defaults/styleLayerGraph/mapToolCatalog — no second vocabulary; Streets uses Atlas transportation fields, Minimal is fallback for flat relief or missing coverage. (8) Purpose-organized picker: recommend from DataContext, all themes still selectable. (9) Fold THEME_DATA_CONTRACT_VERSION + resolved context + base mode into render hashes.
>
> HARD RULE: a real/ordered poster NEVER shows silently fabricated data — missing route data -> remove (ephemeral) or derive from genuine location metadata, never invent. Bind every location slot to the user's real data, never a hardcoded region (fixes "Massachusetts on an Illinois map"). PLACEHOLDERS: preview/picker only by default; on an order ONLY at Order click with EXPLICIT approval, after which the approved value is user-owned poster data (override/approved metadata), NOT a canonical route/elevation stat; block unapproved from checkout/final/share. Users override within the editable allowlist; generalize the existing defaultPosterLayout() elevation-gain omission, no parallel system.
>
> TESTS: picker — quick-pick changes hero/card previews, "Use this look" persists the mode, Auto deterministic from context. Unit buildThemeDataContext: route / place-only / flat route / missing elevation / missing location. Resolver: POI removes route-only defaults, preserves user overrides, permits approved placeholders, blocks unapproved from checkout/final. Map mode: flat route -> Minimal now; later flat Atlas-covered -> Streets; mountain -> Terrain. Playwright: POI on splits-stats + marathon-bib reflows without route stats/profile (map rect stable); quick-pick previews match editor output.
