# Base-Layer Quick-Pick — Spec

Date: June 9, 2026
Owner: theme parity / refinement work (folds into `THEME_PARITY_EXECUTION_PLAN.md`
Decision 0.1 — "a theme controls which layers are on").

## Problem

Contour/topo maps are meaningless for flat-city routes. A Boston marathon or a
Chicago ride has near-zero relief, so the adaptive DEM contour renderer has
almost no signal: the map comes out empty (current `brutalist`), and the only way
to "fill" it is to fabricate contour geometry — which violates the no-invented-
artifacts rule and is why the design targets' tidy concentric rings (e.g. the
Boston `brutalist` target) are themselves idealized, not real terrain.

The honest fix is not more contour. It is letting a flat route show a **street
network** (or nothing) instead, styled to the theme.

## What already exists (don't rebuild)

- `StylePreset` already includes `'road-network'`, `'route-only'`, and
  `'minimalist'` alongside the topo presets (`radmaps-topographic`,
  `radmaps-simple-contour`, `radmaps-contour-wash`, …). (`types/index.ts`)
- Atlas has a first-party `transportation` vector layer with a full token set in
  `AtlasLayerSettings.transportation` (`major_color`, `minor_color`, `road_color`,
  `trail_color`, `opacity`, `show_major/minor/trails`, `*_width`, `density`,
  `labels`). Roads are **owned data (Atlas PMTiles)**, not a third-party basemap.
- `StyleConfig` carries the contour tokens (`show_contours`, `contour_color`,
  `contour_major_color`, `contour_opacity`, `contour_detail` 0–5,
  `contour_minor_width`, `contour_major_width`) and the full `AtlasLayerSettings`
  config panel.

So this is mostly **wiring + a smart default + a per-theme token derivation**, not
new infrastructure.

## UX

A compact **segmented control on the theme selection step**
(`components/map/ThemeLineupStep.vue`), in the picker hero near the selected theme
label — so users choose both the look and the map base *before* entering the editor.
Four options:

- **Auto** — shows the resolved recommendation from the route's data/relief (see
  Default logic). The default selection.
- **Terrain** — DEM contours (`show_contours` on, adaptive `contour_detail`).
- **Streets** — `road-network` preset over the Atlas `transportation` layer, styled
  from theme tokens.
- **Minimal** — `route-only`: route on themed paper, contours + roads off.

Behavior:

- Apply the selected mode to the **hero preview and all live theme cards** through
  `deriveThemePreviewConfig(...)`; manual choices preview immediately. When the user
  clicks **"Use this look,"** emit the theme **plus the resolved base mode** in the
  selected `StyleConfig`, carrying the choice into the editor.
- The quick-pick is **global for the selected theme preview, not per-card**, to keep
  the selection step calm.
- This is the **calm default**. The existing full `AtlasLayerSettings` panel stays as
  the **power-on-demand** surface in the editor; the quick-pick just sets the few
  tokens below, and the panel can still override any of them afterward.
- No labels by default in any mode (clutter + localization fragility — cf. the
  cartouche `MÉXICO` line bug).

## Token mapping (theme → base layer)

Each base-layer choice resolves to a fixed token set. Streets derives its roads
from the theme's existing contour/route tokens so **no theme needs new authored
values** to get a coherent street layer (the full panel can refine later):

| Quick-pick | Sets |
|---|---|
| **Terrain** | `show_contours: true`; contours use the theme's authored `contour_*` tokens; `transportation.show_*: false`. |
| **Streets** | `show_contours: false`; enable Atlas `transportation` with `road_color`/`minor_color` ← `contour_color`, `major_color` ← `contour_major_color`, `opacity` ← clamp(`contour_opacity` + 0.1, ≤1) for legibility, `major_width` ← `contour_major_width × W`, `minor_width` ← `contour_minor_width × W`, `show_trails: true` (`trail_color` ← `contour_color`), `labels: false`, `density: 'balanced'`. |
| **Minimal** | `route-only`: `show_contours: false`, `transportation.show_*: false`; route over `background_color`/paper only. |

`W` is a single base road-width constant tuned once for print legibility at 24×36.
Route tokens (`route_color`, `route_width`, …) are unchanged across all three.

## Default logic

Reuse the **relief measure** the v3 adaptive-contour-density work already computes
for the crop (max−min elevation / stddev from the DEM — see
`THEME_REFINEMENT_V3_PLAN.md` density spec). One measurement drives both
`contour_detail` and this default:

```
R = relief(crop)                       # same signal as adaptive contour density
if R < FLAT_THRESHOLD:                  # ~tune at 60–80 m over the crop
    default = Streets if atlasCovers(crop) else Minimal
else:
    default = Terrain
```

- Flat city, Atlas-covered → **Streets**. Flat, uncovered → **Minimal** (honest,
  zero-dependency). Mountainous → **Terrain**.
- Override always wins and persists.

## Data-source decision (the "OSM" question)

Roads need a **vector source** regardless (contours come from the DEM; this is the
one place the contour path's "DEM-only, no tiles" stance is relaxed). Options:

- **(a) Atlas `transportation` only, Minimal fallback — RECOMMENDED.** Use the
  existing first-party Atlas PMTiles layer where it covers the crop; outside
  coverage, fall back to **Minimal** and auto-enqueue the uncovered bbox into
  `atlas/coverage-targets.json` for the next coverage build. Keeps everything owned
  (no third-party basemap dependency — consistent with the Atlas program and parity
  Decision 0.1), one styling path. The flat cities that need Streets most (Boston,
  Chicago, NYC marathon routes) are exactly the high-value coverage targets, so
  prioritize them in the coverage queue.
- **(b) Third-party vector fallback (Maptiler/Carto) for uncovered crops.** Fastest
  national coverage, but reintroduces the third-party dependency the Atlas program
  is removing and gives Streets a second styling path. Not recommended as default;
  revisit only if coverage can't keep pace with demand.

Decision: **(a)** — Atlas where covered, Minimal elsewhere, enqueue uncovered
city bboxes; prioritize flat marathon/metro routes in `coverage-targets.json`.

## Reconciliation with the theme data contract (one system, not two)

These three modes ARE the `THEME_DATA_CONTRACT_PLAN.md` "map purpose / mode" axis
(dimension 1: city→roads, hike→contours, POI→minimal). They must be a **single
system**: the quick-pick is the user-facing surface; the contract's `mapMode` (via the
existing `preset` / `atlas_style_id` / `atlas_layers` / `map_defaults` vocabulary) is
the engine. Do not build a parallel control. Sequencing (see
`POST_PARITY_NEXT_STEPS.md`): **Minimal** ships standalone during/after parity;
**Auto/Terrain/Streets** land as part of the Phase-2 contract work. The selected mode
travels in `StyleConfig` and is folded into render hashes alongside
`THEME_DATA_CONTRACT_VERSION`.

## Phasing

1. **Minimal now** — zero new infra (`route-only` preset + themed paper already
   exist). Ships immediately as the honest flat-route fallback and unblocks
   `brutalist`-style empty maps today. Implement as a mode overlay that preserves each
   refined theme's `radmaps-*` preset contract.
2. **Streets next** — `road-network` over Atlas `transportation`, the token
   derivation above, gated to Atlas coverage with Minimal fallback.
3. **Auto-default** — wire the relief→default rule once the v3 relief measure lands
   and is committed.
4. **Quick-pick UI** — segmented control beside the theme selector; full
   `AtlasLayerSettings` panel remains the power surface.

## Verification

- Per-theme render at 24×36 in all three modes; confirm Streets inherits theme
  ink/weights legibly and Minimal is clean (route on paper, no empties).
- Flat-route case (`brutalist` / Boston): auto-defaults to Streets where Atlas
  covers, Minimal otherwise — never an empty contour field.
- Mountain route (e.g. Tre Cime): auto-defaults to Terrain, unchanged from today.
- Editor == print in every mode.
