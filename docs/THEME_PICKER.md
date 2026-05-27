# Fast Theme Picker

The fast theme picker is the first styling step for newly created custom maps.
It lets users compare their own map across the quick theme lineup before they
enter the full editor.

## Entry Points

New custom maps should redirect to the style page with `themePicker=1`:

```text
/create/:mapId/style?themePicker=1
```

Current entry points:

- GPX upload
- Strava import
- draw-your-own routes
- place maps
- the Quick tab's `Browse themes` action

The picker is gated by `FLAGS.THEME_PICKER_STEP`. In development, the query
parameter can force the picker so local review does not require flag setup. In
production, rollout should remain flag-controlled.

## Components

The picker is composed of:

- [ThemeLineupStep.vue](/Users/anthonymaro/Documents/apps/trailmaps/trailmaps-app/components/map/ThemeLineupStep.vue) for the full step, hero preview, actions, and lineup.
- [ThemePreviewCard.vue](/Users/anthonymaro/Documents/apps/trailmaps/trailmaps-app/components/map/ThemePreviewCard.vue) for each theme card.
- [utils/themeOptions.ts](/Users/anthonymaro/Documents/apps/trailmaps/trailmaps-app/utils/themeOptions.ts) for shared quick theme lists, thumbnail metadata, deterministic ordering, and preview config derivation.

The Quick tab and picker must use the same quick-theme source. Do not duplicate
theme arrays in components.

## Preview Behavior

Picker previews use the existing [MapPreview.vue](/Users/anthonymaro/Documents/apps/trailmaps/trailmaps-app/components/map/MapPreview.vue)
renderer. The picker does not introduce a second poster renderer and does not
call Browserless proof rendering.

Preview configs are derived with `deriveThemePreviewConfig(baseConfig, theme,
context)`. This helper deep-clones the base `StyleConfig`, applies the theme,
and returns an unsaved preview config. Selecting cards updates only the hero
preview until the user confirms.

`Use this look` emits the selected preview config back to the style page, closes
the picker, clears the query, and lets the existing style watcher persist the
change. `Design myself` closes the picker without mutating `style_config`.

## Ordering

The lineup uses deterministic priority ordering, not visible recommendation
badges. The first few themes are chosen from route stats and geometry so the
initial set is sensible, but the UI presents them as ordinary themes.

Current priority rules:

- High-elevation or mountain/trail activity: `usgs-vintage`, `field-journal`,
  `contour-wash`
- Run, ride, cycling, Strava, or long-distance activity:
  `splits-stats`, `blueprint-strava`, `marathon-bib`
- Place/no-route maps: `editorial-minimal`, `usgs-vintage`, `risograph`
- General maps: `editorial-minimal`, `midcentury-travel`, `bold-modern`

Do not surface recommendation labels in this picker. Keep the choice explicit:
pick a card, use the look, or design manually.

## Place Maps

Place maps are zero-distance maps with no renderable line geometry. They need
map context more than route emphasis, so picker previews enrich theme configs
with:

- roads and transportation layers
- water, waterways, parks, landcover, buildings
- place labels and POI labels

This enrichment must preserve each theme's contour intent. Themes with
`show_contours: false` stay no-contour in the picker.

Place previews also use quieter roads, place labels, and POI label opacity than
route posters so dense city maps do not overpower the poster chrome.

## Theme Defaults

Some theme defaults exist specifically to keep picker previews readable:

- Blueprint and Blueprint Strava keep grids scoped to the map area by default.
- Refined contour defaults are intentionally lower contrast than the legacy
  editor defaults.
- Mid-Century uses separate dark map-label ink for place and POI labels, rather
  than reusing its cream footer text color.

If a new quick theme looks good for route maps but poor for place maps, prefer
theme defaults or `deriveThemePreviewConfig` context handling over ad hoc card
styles. The hero and cards should render from the same preview config.

## Tests

Relevant tests:

- [tests/theme-options.test.ts](/Users/anthonymaro/Documents/apps/trailmaps/trailmaps-app/tests/theme-options.test.ts) verifies shared ordering, preview cloning, place-map enrichment, no-contour preservation, and Mid-Century label ink.
- [tests/theme-application.test.ts](/Users/anthonymaro/Documents/apps/trailmaps/trailmaps-app/tests/theme-application.test.ts) verifies applying themes clears stale user-owned visual overrides and preserves text edits.
- [tests/refined-themes.test.ts](/Users/anthonymaro/Documents/apps/trailmaps/trailmaps-app/tests/refined-themes.test.ts) verifies refined theme defaults, including Blueprint map-scoped grids.
- [tests/style-browser/style-browser.spec.ts](/Users/anthonymaro/Documents/apps/trailmaps/trailmaps-app/tests/style-browser/style-browser.spec.ts) verifies the picker renders, selection previews do not mutate saved style, applying saves, and manual design exits without applying.

Run focused coverage with:

```bash
npx vitest run tests/theme-options.test.ts tests/theme-application.test.ts tests/refined-themes.test.ts
npm run test:style-browser
```
