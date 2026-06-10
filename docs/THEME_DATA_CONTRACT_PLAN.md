# Theme Data Contract — Plan

Date: June 8, 2026 (extended June 9)
Concept (Anthony): themes should **adapt to purpose and to the data that exists** —
not show blank/wrong slots. Three connected dimensions:

1. **Map purpose / mode.** A cityscape wants a road-network base (toner / Alidade
   street tiles, roads + labels) and NO contours; a hike wants contours and no
   roads; a place/POI wants a minimal base. The theme's base map + which layers
   (contours / roads / labels / relief) it shows must fit the purpose.
2. **Data-presence adaptation.** No route uploaded → the elevation profile,
   distance, gain, and splits slots make no sense → **remove them and reflow** (not
   leave them blank). Same for any slot whose source data is absent.
3. **Slot population + fallback.** Text slots must populate from the user's ACTUAL
   location/route data — region, place name, coordinates, elevation — not a
   hardcoded fixture. (Today many slots show "Massachusetts"/"Boston" — the design
   fixture's location — even for an Illinois POI. That is a population bug.) When we
   can't generate the right value, fall back to a sensible placeholder or remove.

Original concept: every theme declares, per element, what data populates it, what to
remove when absent, and where to derive/placeholder. A POI with no elevation change
should not show an elevation profile or "0 ft gain" — remove it and reflow.

## Decisions (2026-06-09, Anthony)

- **Picker = purpose-organized + adaptive.** The theme picker groups/tags themes by
  purpose (Trail/Route, City/Street, Place/POI, Nautical, …) and recommends themes
  suited to what the user uploaded (route vs place vs city), AND every theme still
  adapts its map mode + slots to the actual data. Not purpose-gated (a "trail" look
  can still be used for a city), not detect-only (themes are organized, not a flat
  list).
- **Sequencing: this whole workstream comes AFTER the theme refinement / regression
  stabilization.** Rendering must be correct first (autosizing, DEM contours,
  layout). Then build the data contract as a dedicated effort: map purpose/mode →
  data-presence slot removal → slot population (the Massachusetts fix) + fallback →
  the purpose-organized picker. The wrong-location bug persists until then; accept
  that to avoid layering data logic on an unstable renderer.

## CRITICAL: screenshot text CONTENT is placeholder, not the target

The design-target screenshots use fixture content ("Massachusetts", "Boston",
"Mount Whitney"). That text is **placeholder**, not what production should print.
Match the slot's **style/treatment/position** to the screenshot; populate its
**content from the user's real data**. Do NOT treat "Massachusetts" in a render as
"correct because it matches the screenshot" — it's a population bug if the user
picked Illinois. (This is "parity is style, not content," same spirit as "parity is
style, not geometry.")

## Map purpose / mode (the new axis)

Each theme declares a **purpose** (or set of supported purposes) and a **map mode**
per purpose, driving the base tileset + visible layers:

```
themePurpose: 'route-terrain' | 'route-urban' | 'place' | 'city' | 'nautical' | ...
mapMode: {
  baseTiles: 'dem-contour' | 'toner-roads-labels' | 'alidade-street' | 'minimal' | 'natural'
  layers: { contours: bool, roads: bool, labels: bool, relief: bool, water: bool }
}
```

- **City / street** (cityscape) → `toner-roads-labels` or `alidade-street`, roads +
  labels ON, contours OFF.
- **Route / terrain** (hike) → `dem-contour`, contours ON (adaptive density), roads
  OFF/subtle.
- **Place / POI** → minimal base, no route, no profile.
- Themes already declare a default owned Atlas preset (toner-light/dark, alidade,
  simple-contour, natural, night-relief, watercolor) — this formalizes that into a
  purpose-driven mode so cityscape themes stop trying to render contours and trail
  themes stop trying to render a street grid.

## Slot population + fallback (the "Massachusetts" fix)

Populate text/data slots from the real context, in order:
1. **Route/GPX** present → distance, gain, profile, duration, splits, endpoints.
2. **Location metadata** → place name + coordinates (from the search); **derive**
   region/admin/state via reverse geocode (Mapbox typeahead `657772d` is in tree),
   point elevation via an elevation lookup, formatted lat/long.
3. **Fallback** → a sensible, theme-appropriate placeholder ONLY if generation
   fails — and clearly not a wrong real place. On a real order, prefer **remove**
   over a wrong/placeholder value.

The "Massachusetts on an Illinois POI" bug = the slot is bound to the fixture/default
location, not the user's. Fix: bind every location-derived slot to the user's actual
place/route data; never fall back to a hardcoded region.

## Why this matters

- The refined themes assume **route/GPX data** (distance, gain, profile, splits,
  start/finish). Apply one to a **place/POI** (no track) and you get empty/zero
  stats and broken layout — part of the current "layouts off" symptom.
- It's foundational for the product direction (POI maps, place/city maps, national
  parks, statewide POIs) — most of those are **location-only, not routes**.
- It generalizes existing partial behavior — `defaultPosterLayout()` already omits
  elevation gain when missing (`utils/posterLayout.ts:306`). Extend that, don't build
  a parallel system beside it.

## Architecture (reconciled with Codex review — AUTHORITATIVE)

These rules supersede any "tombstone"/persistence language elsewhere in this doc.

1. **Data-driven removal is EPHEMERAL, never a tombstone.** Tombstones (`deleted` in
   `poster_layout`) represent **user intent** — do not write them for missing data,
   or a transient/failed derivation would *permanently* delete a slot. Resolve data
   absence at **layout-resolution time** and merge with user edits; never persist it.
2. **One canonical typed `DataContext`.** Add `utils/themeDataContract.ts` with
   `ThemeDataContext`, `ThemeRenderMode`, `ThemePurpose`, `ThemeSlotContract`,
   `DataSource`, `MissingDataPolicy`, `ResolvedThemeDataContract`, and
   `THEME_DATA_CONTRACT_VERSION`. Add `buildThemeDataContext(map)` deriving
   `hasRoute`/`hasElevation`/`hasLocation`/`coords`/`region`/`date` from `geojson`,
   `stats`, `bbox`, and location columns — and **replace** the scattered place
   detection (`utils/themeOptions.ts:237`, weak seeding in
   `server/api/maps/index.post.ts:106`) so there's one brain, not three hunches.
3. **Renderer is pure/deterministic — no external service calls mid-render.**
   `resolveThemeDataContract(theme, composition, context, mode)` returns resolved
   slot values, omitted slot ids, omitted map features (route/profile/pins), and
   warnings — from the **stored** map payload only. `defaultPosterLayout()` /
   `effectivePosterLayout()` consume the resolution and omit default cells **before**
   merging user `poster_layout` edits. AWS renderer never discovers new facts.
4. **Derivation is server-side + cached.** Reverse geocode / elevation happen at map
   **creation or explicit enrichment** time and are stored (forward + rollback
   migrations; sync `supabase/schema.sql` if needed). AWS renderer must not call
   Mapbox/elevation during the screenshot.
5. **Population lives in shared formatters.** Extend
   `utils/render/posterFormatters.ts` (region, coords, point elevation, distance,
   gain, date, endpoints, composition meta) so `MapPreview.vue`, the fixed-template
   editor preview, and the render page all use the **same** values.
6. **Map mode reuses existing graph/catalog language — no second vocabulary.**
   Express purpose-aware map defaults via existing `preset` / `atlas_style_id` /
   `atlas_layers` / `map_defaults` / `styleLayerGraph` / `mapToolCatalog`, applied
   through `deriveThemePreviewConfig()` and the real theme application. (The
   `baseTiles` sketch below is conceptual only.)
7. **Placeholder needs an explicit runtime mode.** `ThemeRenderMode =
   'picker-preview' | 'editor' | 'proof' | 'checkout' | 'final' | 'share'`.
   Placeholders are allowed ONLY in `picker-preview` (and maybe `editor`); `proof` /
   `checkout` / `final` / `share` must never show placeholder facts.
8. **Hashing/caching includes contract version + resolved context.** Render hashes
   must fold in `THEME_DATA_CONTRACT_VERSION` and the resolved data context, or
   proof/final caches can reuse the wrong image. (Chrome resolution + map mode both
   affect output.)

## The contract (per theme/composition slot)

For each populated slot/element, declare:

```
slotData: {
  slot: PosterTextSlot | statBlock | profileChart | routeLayer | pins | ...
  source:   // where the value comes from
    | 'gpx.distance' | 'gpx.elevation_gain' | 'gpx.elevation_profile'
    | 'gpx.duration' | 'gpx.splits' | 'route.geometry' | 'route.endpoints'
    | 'location.name' | 'location.coords' | 'location.point_elevation'
    | 'location.region'            // reverse-geocoded admin/region
    | 'derived.<x>' | 'static'
  requires: 'route' | 'location' | 'always'
  ifMissing: 'remove' | 'derive' | 'placeholder'
  deriveFrom?: source[]            // e.g. region from coords via reverse geocode
}
```

At render time the input is the **available data context** (is there a route? only
a location?). The renderer applies the contract per element:
- value present → populate from `source`;
- required data absent + `ifMissing: 'remove'` → **ephemerally omitted during layout
  resolution** (NOT a tombstone); the element + its divider drop, siblings reflow,
  map rect stable — then user `poster_layout` edits merge on top;
- `ifMissing: 'derive'` → compute from genuine location metadata (e.g. region from
  coordinates via the new Mapbox geocoding; point elevation from an elevation
  lookup; formatted lat/long from coords);
- `ifMissing: 'placeholder'` → **preview/sample only** (see hard rule).

## Hard rule (non-negotiable for print)

**A real poster never shows fabricated data.** A POI poster must not invent an
elevation gain, distance, or splits. Missing real route data → **remove** the
element (reflow) or **derive** from genuine location metadata. **Placeholder data is
for theme PREVIEWS only** (the picker, the design audit) — never on a poster the
user is ordering. This is the same "no fabricated artifacts" principle as the theme
motif work.

## Data tiers (what we can populate from)

1. **Route / GPX** — distance, elevation gain + profile, duration, splits, route
   line, start/finish endpoints. Absent for POIs.
2. **Location metadata** — place name + coordinates (from the search), and
   **derivable**: region/admin/country via reverse geocode (Mapbox typeahead is now
   in tree, `657772d`), point elevation via an elevation lookup, formatted lat/long.
3. **Derived** — anything computed from the above (e.g. "Sierra Nevada, California"
   from coords; "2,240 m" point elevation).
4. **Placeholder** — theme-appropriate sample values, **preview-only**.

## Examples

- `splits-stats` / `marathon-bib` applied to a **POI**: remove the elevation
  profile, splits table, distance and gain stats and the route line; keep title +
  coords + region; reflow. (Or block these route-first themes for POIs in the
  picker — a product call.)
- `cartouche-place` (place-frame) is the **canonical POI theme** — already
  route-optional; the contract makes it the reference for "location-only" data.
- `dark-sky` / `editorial-minimal` with a POI: remove distance/gain stats, keep
  coords + point-elevation + region; route layer removed; title + place stay.
- A route theme **with** a GPX track: everything populates as today.

## Reuse / integration

- **Auto-remove = EPHEMERAL resolution** (the resolver omits the cell at layout time;
  `effectivePosterLayout` applies it, then user edits merge), NOT a `deleted`
  tombstone — tombstones stay reserved for user intent. Same map-geometry invariant
  (reflow within the band; map rect stable).
- Contract lives alongside the theme/composition definitions (next to the editable
  allowlist + `specContract`), so each theme's data policy is declared, not ad-hoc.
- The editor still lets users override (re-add a removed element, edit text) — the
  contract sets the **default**, the user can adjust within the allowlist.

## Resolved decision (product call — Anthony, 2026-06-09)

- **Placeholder on orders: allowed ONLY at Order click with explicit user approval.**
  Placeholders never appear silently on a purchased poster. At Order click, detect any
  unresolved placeholder and require the user to approve it; once approved, the value
  becomes **user-owned poster data** (an override / approved metadata) — NOT a canonical
  route/elevation stat. Unapproved placeholders are blocked from checkout/final/share.
  This keeps the hard rule intact (no *silently* fabricated data) while letting a user
  knowingly opt into a sample value they then own. See `POST_PARITY_NEXT_STEPS.md`.

## Sequencing

Do this **after the theme regression stabilizes rendering** — don't layer
data-contract logic on a broken render path. Build order (per Codex's plan):
1. **Contract foundation** — `utils/themeDataContract.ts` with the typed
   `DataContext`/`RenderMode`/`Purpose`/`SlotContract`/`DataSource`/`MissingDataPolicy`/
   `ResolvedThemeDataContract` + `THEME_DATA_CONTRACT_VERSION`.
2. **Centralize detection** — `buildThemeDataContext(map)`; replace the scattered
   place detection (themeOptions, weak server seeding).
3. **Ephemeral resolver** — `resolveThemeDataContract(theme, composition, context,
   mode)` returns resolved values + omitted slot ids + omitted map features +
   warnings; `defaultPosterLayout()`/`effectivePosterLayout()` omit default cells
   **before** merging user edits. No tombstones.
4. **Shared formatters** — extend `posterFormatters.ts` so editor preview and render
   use one source of values.
5. **Server-side + cached derivation** — enrich maps at creation/retrieve; migrations
   + `supabase/schema.sql`; AWS renderer never calls external APIs.
6. **Map mode via existing style application** — purpose-aware `map_defaults` through
   existing Atlas/`StyleConfig` fields + `deriveThemePreviewConfig()`.
7. **Picker last** — group by purpose, sort recommendations from `DataContext`, keep
   all themes selectable, badge "best for route/place/city".
8. **Hashing** — fold `THEME_DATA_CONTRACT_VERSION` + resolved context into render
   hashes so proof/final caching can't reuse a wrong image.
9. **Tests** — route / place-only / no-elevation route / preview-vs-final placeholder;
   Playwright: POI on `splits-stats` + `marathon-bib` → route-only elements disappear,
   layout reflows, map rect stable, proof/final never show placeholder facts.

## The goal / Codex prompt (paste when ready)

> Implement the theme data contract per `docs/THEME_DATA_CONTRACT_PLAN.md` (AFTER the
> theme regression is stabilized). Follow the AUTHORITATIVE architecture section and
> the build order. KEY RULES: (1) data-driven removal is **EPHEMERAL** — resolve at
> layout-resolution time and merge with user edits; NEVER write `deleted` tombstones
> for missing data (tombstones = user intent only). (2) One typed `DataContext` via
> `buildThemeDataContext(map)` replacing scattered place detection. (3) The renderer
> is **pure/deterministic** — `resolveThemeDataContract(theme, composition, context,
> mode)` resolves from the STORED map payload; AWS renderer makes NO external calls.
> (4) Derivation (reverse geocode / elevation) is **server-side at creation/enrichment
> and cached** (migrations + `supabase/schema.sql`). (5) Population lives in shared
> `posterFormatters` so editor preview and render agree. (6) Map mode reuses existing
> `preset`/`atlas_style_id`/`atlas_layers`/`map_defaults`/`styleLayerGraph`/
> `mapToolCatalog` — no second vocabulary. (7) Explicit `RenderMode`
> (`picker-preview|editor|proof|checkout|final|share`) gates placeholders — proof/
> checkout/final/share NEVER show placeholder facts. (8) Fold
> `THEME_DATA_CONTRACT_VERSION` + resolved context into render hashes.
>
> HARD RULE: a real/ordered poster NEVER shows fabricated data — missing route data →
> remove (ephemeral) or derive, never invent. The "Massachusetts on an Illinois POI"
> bug = bind location slots to the user's real data, never a hardcoded region. Users
> can still override within the editable allowlist. Generalize the existing
> `defaultPosterLayout()` elevation-gain omission, don't build a parallel system.
> Tests: route / place-only / no-elevation route / preview-vs-final placeholder; a POI
> on `splits-stats` + `marathon-bib` → route-only elements disappear, layout reflows,
> map rect stable, proof/final never show placeholder facts. One commit per piece;
> gates green; `MapPreview.vue` the only renderer.
