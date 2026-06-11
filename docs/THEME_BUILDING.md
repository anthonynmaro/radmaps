# Building And Polishing Themes

How the refined theme system is put together after the treatment/token
refactor, and the workflow that makes polish compound across themes instead of
improving exactly one.

## The pieces

A refined theme is assembled from named, shared primitives plus a small set of
theme-specific values:

| Layer | File | What it owns |
|---|---|---|
| Composition | `utils/posterCompositions.ts` | Poster layout routing: title position/alignment, band paddings, map margins/frames, footer variant, overlays (grid/stars/texture). |
| Chrome recipe | `utils/posterLayout.ts` | Band heights, row weights, per-slot type scales for each composition. |
| Poster tokens | `utils/themes/posterTokens.ts` | The shared chrome vocabulary: type scale tiers, band height tiers, edge margins, bleed-aware padding builders, rule weights/ink, letter-spacing tiers. |
| Map treatment | `utils/themes/mapTreatments.ts` | The contour/relief primitives: treatment clusters, adaptive contour behavior (smoothing, detail clamps, sea-level suppression, high-relief response tables, low-relief floors), and the recipe defaults every member theme shares. |
| Theme recipe | `utils/themes/refined.ts` | Palette, typography pairing, composition reference, audience, and map intent — referencing its treatment via `themedMapDefaults(themeId, overrides)`. |
| Typography | `utils/posterData.ts` | Per-theme display/body profiles; tracking values reference `TRACKING` tiers. |

`utils/mapStyle.ts` no longer hardcodes per-theme id checks for contour/relief
handling — it resolves `resolveAdaptiveContourBehavior(config.color_theme)`
from the treatment registry. (Per-theme route *ornament* stacks in
`routeLayers()` — riso overprint, dark-sky constellation, bib mile ticks — are
a separate axis and still live in mapStyle.ts.)

## Treatment clusters

| Treatment | Member themes | Character |
|---|---|---|
| `even-concentric` | editorial-minimal, contour-wash, classic-trail, blueprint, bold-modern | Smoothed, evenly spaced rings; detail floor keeps big relief concentric. |
| `two-tier-index` | usgs-vintage, botanical, blackline, brutalist, moonstone | Bold index line over faint minors; authored detail honored. |
| `travel-poster-index` | midcentury-travel, ranch-ochre, daybreak-trace | Two-tier with smoothing, warm low-relief floors, pins on. |
| `dark-data-quiet` | blueprint-strava, splits-stats, electric-atlas, night-ride | Recessed contours under data chrome; sea-level contours suppressed. |
| `night-glow-mound` | dark-sky, copper-night | Radial tonal-band night mound + faint glow index overlay. |
| `wash-echo` | plein-air, field-journal, marathon-bib, risograph | Soft painterly field, dense balanced contours, route wash/echo ornaments. |
| `shaded-relief` | relief-shaded | Hillshade-lit terrain with contour overlay. |
| `no-contour` | transit-diagram, cartouche-place | Diagrammatic; grid on map, contours off. |
| *(bespoke)* | sea-chart | Nautical depth-curve contours kept inline; matches no cluster. |

Legacy theme ids (chalk, topaz, dusk, …) have no treatment and resolve to stock
adaptive behavior — exactly as before.

## How to build a new theme

1. **Pick a composition** (`CompositionId`) — or add one only if no existing
   layout fits; new compositions get a chrome recipe in `posterLayout.ts`
   built from `CHROME_BAND_HEIGHTS` / `CHROME_TYPE_SCALE` tiers.
2. **Pick a map treatment** — add the theme to `THEME_MAP_TREATMENTS` in
   `utils/themes/mapTreatments.ts`. If its settings genuinely match no
   cluster, leave them inline in the recipe and add it to
   `BESPOKE_MAP_TREATMENT_THEME_IDS` with a note (do not force-fit).
3. **Pick a palette + typography pairing** in the recipe; tracking values
   should come from `TRACKING` tiers, contrast must pass the 4.5:1 label-band
   gate enforced by the unit suite.
4. **Override sparingly.** The recipe's `themedMapDefaults('<id>', {...})`
   call should carry only palette-specific values (colors, widths, opacities)
   and genuine deviations. Behavior deviations go in the assignment's
   `behavior` override — every one of them is a flag that either the theme or
   the treatment needs another look.

The strict rule for treatment recipe defaults: a key may only live on the
treatment when **every member sets the identical value**
(`tests/map-treatments.test.ts` enforces this). If one member needs a
different value, the key moves back to the recipes — members never silently
override treatment defaults.

## The polish workflow

Treatments and tokens exist so one fix lands everywhere it should:

1. Change the token/treatment value (e.g. `LOW_RELIEF_CONTOUR_FLOORS.standard`
   or `CHROME_TYPE_SCALE.stat.data`).
2. `npx vitest run tests/theme-resolution-snapshot.test.ts` — the failures
   enumerate exactly which themes the change touches. That list is your review
   scope.
3. Review every affected theme visually: `npm run themes:golden:diff` plus the
   matrix (`npm run themes:matrix`) across route archetypes.
4. Once the diff is intended and approved, regenerate the snapshot —
   `UPDATE_THEME_RESOLUTION_SNAPSHOT=1 npx vitest run
   tests/theme-resolution-snapshot.test.ts` — and declare the affected themes
   in the commit message. Never regenerate to make an "equivalent refactor"
   pass; byte-identity is the definition of equivalent.

`tests/theme-resolution-snapshot.test.ts` pins, for all 40 renderable theme
ids: the applied StyleConfig, adaptive contour resolution across four relief
archetypes, full `buildMapStyle()` JSON for two archetypes, poster layouts,
typography, and the composition registry.

## Known polish candidates (preserved, not fixed)

Per-theme values that look unintentionally divergent. Each is byte-preserved
by the refactor; fixing any of them is a deliberate polish pass via the
workflow above:

- **moonstone vs blueprint** (colorway pair): blueprint has smoothed contours
  + detail floor 2; moonstone has neither (it preserves authored detail
  instead).
- **blackline vs bold-modern** (colorway pair): bold-modern is smoothed with
  detail floor 2 and a hold-bold-index relief response; blackline has no
  adaptive opt-ins at all.
- **night-ride vs splits-stats** (colorway pair): night-ride opts out of
  smoothing, the detail cap, and sea-level suppression, and uniquely caps
  non-low-relief detail at 0.
- **usgs-vintage vs classic-trail**: classic-trail (its colorway) smooths
  contours; usgs-vintage does not, despite sharing the detail floor.
- **dark-sky vs copper-night** contour widths: minor 0.56 vs 0.58, major 0.86
  vs 1.08 — the only divergent map values in an otherwise shared treatment.
- **midcentury-travel vs ranch-ochre** atlas contour opacities: 0.22/0.58 vs
  0.20/0.56 (widths identical at 0.68/1.34).
- **bold-modern** is the only even-concentric member without an explicit
  `tile_effect: 'none'` (harmless — theme application resets it — but it kept
  `tile_effect` off the treatment).
- **risograph** is the only wash-echo member at `contour_detail: 3` (others 5).

## Bespoke-by-design (not candidates)

- `sea-chart` map settings (depth-curve look).
- The usgs-vintage and night-ride special chrome recipes in
  `posterLayout.ts` (theme-level header/footer overrides).
- Modernist's 4-edge hero padding, journal/bib/botanical gutters, over-map
  margins in `posterCompositions.ts` (annotated inline).
- Route ornament stacks in `mapStyle.ts` `routeLayers()` — a future
  route-treatment axis if they start needing shared polish.
- Legacy Family A/B typography tables in `posterData.ts` (legacy themes are
  frozen; only refined typography uses `TRACKING` tiers).
