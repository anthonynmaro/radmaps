# Refined Themes And Compositions

The design update introduces refined themes as full poster recipes. The current
implementation is additive: old maps keep rendering, defaults are unchanged, and
new themes opt into composition-aware poster chrome.

## Types

Source-of-truth type additions live in [types/index.ts](/Users/anthonymaro/Documents/apps/trailmaps/trailmaps-app/types/index.ts):

- `CompositionId` covers the 13 planned poster compositions.
- `ColorTheme` includes the existing ids plus the refined design ids.
- `StyleConfig` has optional `composition`, `audience`, `dark`, and grid
  controls: `show_grid`, `grid_scope`, `grid_color`, `grid_opacity`,
  `grid_weight`, and `grid_spacing`.
- `ThemeDefinition` can now declare `composition`, `audience`, `family`,
  `legacy`, `migration_target`, and graph-friendly `map_defaults`.

Do not change `DEFAULT_STYLE_CONFIG` until the data migration phase. Existing
maps without refined fields should keep rendering through the legacy classic
layout.

## Refined Registry

[utils/themes/refined.ts](/Users/anthonymaro/Documents/apps/trailmaps/trailmaps-app/utils/themes/refined.ts) contains the 22 refined themes:

- `editorial-minimal`
- `usgs-vintage`
- `midcentury-travel`
- `risograph`
- `blueprint`
- `blueprint-strava`
- `field-journal`
- `bold-modern`
- `contour-wash`
- `splits-stats`
- `marathon-bib`
- `dark-sky`
- `botanical`
- `brutalist`
- `classic-trail`
- `ranch-ochre`
- `blackline`
- `copper-night`
- `moonstone`
- `night-ride`
- `daybreak-trace`
- `electric-atlas`

Each refined theme declares palette, typography, composition, audience, and
`map_defaults`. The map defaults are intent fields; the layer graph still decides
what each preset can consume.

Blueprint and Blueprint Strava default their grids to the map area, not the full
poster. Most refined contour defaults are intentionally quieter than the legacy
editor contour defaults so roads, water, labels, and route linework can remain
legible when several map-context layers are enabled. Mid-Century declares dark
map-label ink separately from its cream footer text so place labels remain
readable on the warm map field.

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
instead of sparse incidental lines. Themes that use Atlas house styles should
prefer graph-friendly layer defaults over renderer-specific overrides so map
previews and live posters stay in parity.

Start and finish pins use contrast-safe defaults derived from the map background:
route color first, then label band/text colors, falling back to black or white.
User overrides are still preserved, but theme defaults should never make pin
labels disappear on the map.

The design handoff suggested wrapping React components for v1. We intentionally
did not add a React subtree because the production renderer screenshots the real
Nuxt page. Keeping compositions in the existing Vue path avoids a second poster
renderer and keeps Browserless readiness unchanged.

## Fast Theme Picker

The first-run picker uses the same refined theme registry through
[utils/themeOptions.ts](/Users/anthonymaro/Documents/apps/trailmaps/trailmaps-app/utils/themeOptions.ts).
The Quick tab and picker must stay on that shared source so labels, thumbnail
metadata, classic theme fallback, and refined ordering remain aligned.

The picker renders live previews with `MapPreview.vue`; it does not create proof
renders or introduce a second thumbnail path. Theme cards and the hero use the
same derived preview config so colors and layers do not drift between small and
large previews.

For implementation details, review
[docs/THEME_PICKER.md](/Users/anthonymaro/Documents/apps/trailmaps/trailmaps-app/docs/THEME_PICKER.md).

## Legacy Policy

Existing theme ids remain valid. Legacy ids are marked on `COLOR_THEMES` with a
`migration_target`, but they should not be removed or data-migrated in this pass.

Premade map migration can later use `LEGACY_THEME_MIGRATION_TARGETS` from the
refined registry. User maps should remain unchanged until the refined renderer is
fully compatible.

Applying a refined theme clears stale `poster_layout` so the selected theme can
load its own composition-aware starter template. Existing saved maps are not
rewritten automatically; their stored layouts continue to render until the user
chooses a new theme/template.

For the poster content editor architecture and rollout notes, see
[docs/POSTER_CONTENT_EDITOR.md](/Users/anthonymaro/Documents/apps/trailmaps/trailmaps-app/docs/POSTER_CONTENT_EDITOR.md).

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
/style-browser-fixture?themePicker=1
```

## Tests

Run:

```bash
npm run test:style-graph
npm run test:style-browser
npm run test:style
```

The refined theme tests verify that all refined themes exist, composition ids
are valid, old defaults are unchanged, and legacy migration targets are declared.

The Playwright browser harness renders all 13 compositions on desktop and mobile,
verifies the selected theme/composition attributes, checks top-title versus
bottom-title ordering, and asserts composition-specific overlays such as
blueprint grid, dark-sky stars, and journal side rails. It also exercises the
theme picker fixture to confirm card selection previews do not mutate saved
style, applying a theme closes the picker, and manual design exits without
applying the preview.
