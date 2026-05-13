# Refined Themes And Compositions

The design update introduces refined themes as full poster recipes. The current
implementation is additive: old maps keep rendering, defaults are unchanged, and
new themes opt into composition-aware poster chrome.

## Types

Source-of-truth type additions live in [types/index.ts](/Users/anthonymaro/Documents/apps/trailmaps/trailmaps-app/types/index.ts):

- `CompositionId` covers the 13 planned poster compositions.
- `ColorTheme` includes the existing ids plus the 13 refined design ids.
- `StyleConfig` has optional `composition`, `audience`, `dark`, and grid
  controls: `show_grid`, `grid_scope`, `grid_color`, `grid_opacity`, and
  `grid_weight`.
- `ThemeDefinition` can now declare `composition`, `audience`, `family`,
  `legacy`, `migration_target`, and graph-friendly `map_defaults`.

Do not change `DEFAULT_STYLE_CONFIG` until the data migration phase. Existing
maps without refined fields should keep rendering through the legacy classic
layout.

## Refined Registry

[utils/themes/refined.ts](/Users/anthonymaro/Documents/apps/trailmaps/trailmaps-app/utils/themes/refined.ts) contains the 13 design-update themes:

- `editorial-minimal`
- `usgs-vintage`
- `midcentury-travel`
- `risograph`
- `blueprint`
- `blueprint-strava`
- `field-journal`
- `bold-modern`
- `splits-stats`
- `marathon-bib`
- `dark-sky`
- `botanical`
- `brutalist`

Each refined theme declares palette, typography, composition, audience, and
`map_defaults`. The map defaults are intent fields; the layer graph still decides
what each preset can consume.

Theme fonts are loaded from the typed self-hosted registry in
[utils/render/fontRegistry.ts](/Users/anthonymaro/Documents/apps/trailmaps/trailmaps-app/utils/render/fontRegistry.ts).
Nuxt injects `@font-face` rules for `/fonts/*.ttf`, served by the local font
route, so editor previews and Browserless render pages use the same available
families and weights. Google Fonts remains a browser fallback, not the source of
truth.

## Composition Registry

[utils/posterCompositions.ts](/Users/anthonymaro/Documents/apps/trailmaps/trailmaps-app/utils/posterCompositions.ts) is the source of truth for poster layout routing.

It defines:

- one profile for each `CompositionId`,
- the internal `legacy-classic` fallback for old rows with no stored
  composition,
- picker labels/audiences for the Layout control,
- layout metadata used by [MapPreview.vue](/Users/anthonymaro/Documents/apps/trailmaps/trailmaps-app/components/map/MapPreview.vue).

`MapPreview.vue` remains the only poster renderer. Composition profiles adjust
the real Vue/MapLibre poster chrome: title position, alignment, map margins,
frame treatment, footer/stat emphasis, star fields, paper texture, and side
rails. Grid is a normal style option, not an implicit composition effect: themes
may default it on, but users can target it to the whole poster or map only and
adjust color, opacity, and weight. This keeps editor, proof, thumbnail, and final
Browserless render parity intact.

Refined contour themes should set `contour_detail: 5` in `map_defaults`. Low
relief routes need denser contour intervals to read as intentional terrain art
instead of sparse incidental lines. Mid-Century and Brutalist use the
`contour-art` preset by default so their map previews and live posters both
render themed water/contours instead of a blank route-only field.

Start and finish pins use contrast-safe defaults derived from the map background:
route color first, then label band/text colors, falling back to black or white.
User overrides are still preserved, but theme defaults should never make pin
labels disappear on the map.

The design handoff suggested wrapping React components for v1. We intentionally
did not add a React subtree because the production renderer screenshots the real
Nuxt page. Keeping compositions in the existing Vue path avoids a second poster
renderer and keeps Browserless readiness unchanged.

## Legacy Policy

Existing theme ids remain valid. Legacy ids are marked on `COLOR_THEMES` with a
`migration_target`, but they should not be removed or data-migrated in this pass.

Premade map migration can later use `LEGACY_THEME_MIGRATION_TARGETS` from the
refined registry. User maps should remain unchanged until the refined renderer is
fully compatible.

## Scripts

`scripts/ai-style-agent.mjs` now accepts refined theme ids and validates
`composition`.

`scripts/bulk-marathon-premade.mjs` now creates new premade variants with refined
theme ids and composition values. It still preserves the existing script flow and
does not run a data migration by itself.

## Browser Fixture

[pages/style-browser-fixture.vue](/Users/anthonymaro/Documents/apps/trailmaps/trailmaps-app/pages/style-browser-fixture.vue) is a dev-only fixture for Playwright. The Supabase redirect allowlist includes this path, but the page throws a 404 outside dev builds.

Use query parameters to exercise combinations:

```text
/style-browser-fixture?composition=blueprint-grid&theme=blueprint
```

## Tests

Run:

```bash
npm run test:style-graph
npm run test:style-browser
npm run test:style
```

The refined theme tests verify that all 13 refined themes exist, composition ids
are valid, old defaults are unchanged, and legacy migration targets are declared.

The Playwright browser harness renders all 13 compositions on desktop and mobile,
verifies the selected theme/composition attributes, checks top-title versus
bottom-title ordering, and asserts composition-specific overlays such as
blueprint grid, dark-sky stars, and journal side rails.
