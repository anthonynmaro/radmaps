# Style Layer Graph

RadMaps style fields are stored intent. They are not a direct promise that every
preset can render every field. The layer graph is the compatibility layer between
saved `StyleConfig` JSON and actual MapLibre style construction.

## Source Of Truth

[utils/styleLayerGraph.ts](/Users/anthonymaro/Documents/apps/trailmaps/trailmaps-app/utils/styleLayerGraph.ts) defines one graph per `StylePreset`.

Each graph declares:

- feature support: `editable-vector`, `baked-raster`, `required`, or `unsupported`
- required fields, such as contour art forcing `show_contours = true`
- ignored fields, such as road opacity on baked raster tile presets
- consumed fields used by controls or layers
- sources used by the preset
- graph layers and their canonical slot
- update mode per field: `full-reload`, `paint`, `source`, `chrome`, or `ignored`
- viewport scaling metadata for MapLibre layer paint/layout properties

The canonical slot order is:

```text
background -> base -> water-land-buildings -> terrain -> contours -> editable-roads -> route-casing -> route -> labels-pois -> segments-handles
```

Route linework should sit below map labels so place, road, water, POI, and contour labels remain readable. Interactive segment handles and editing overlays remain above labels.

## Example

Contour art requires contour lines, keeps water editable, and can still draw
optional Mapbox Streets roads/place/POI overlays above the contours:

```ts
makeGraph({
  preset: 'contour-art',
  features: {
    contours: 'required',
    roads: 'editable-vector',
    placeLabels: 'editable-vector',
    pois: 'editable-vector',
    water: 'editable-vector',
    route: 'required',
    routeCasing: 'required',
  },
  requiredFields: { show_contours: true },
  sources: ['mapbox-dem', 'contours', 'mapbox-streets', 'route'],
})
```

If an older saved map has fields that the active graph does not consume, those
values remain in `style_config`, but `effectiveStyleConfig()` hides them from
the generated MapLibre style. Switching back to a preset that supports those
fields can reuse the stored intent.

## Public Helpers

- `getPresetGraph(preset)` returns the graph for a preset.
- `getVisibleStyleControls(configOrPreset)` returns graph-gated UI controls.
- `styleUsesField(configOrPreset, field)` answers whether a field matters for
  the active graph.
- `effectiveStyleConfig(config)` applies required fields and ignores unsupported
  fields without mutating or deleting saved intent.
- `getGraphFullReloadFields(configOrPreset)` drives full MapLibre reload
  dependencies in the editor.

## UI Rules

`StylePanel.vue` must not hardcode broad assumptions like “all presets support
road opacity.” It should ask `computeSectionVisibility()`, which delegates map
control visibility to the graph.

Controls must be hidden when:

- the feature is unsupported
- the feature is baked into a raster tile and cannot be styled independently
- the graph requires the feature and exposing a toggle would be destructive

Controls may remain visible for baked raster behavior only when the graph
declares a real operation. `stadia-toner` is the current example: the map-label
toggle switches between labeled and label-free tile families, but label color,
opacity, and density remain hidden because those fields cannot affect baked
labels.

## Renderer Rules

`buildMapStyle()` keeps its public API, but internally renders an effective
config derived from the graph. This means hidden/ignored fields are not allowed
to leak into the generated style JSON.

Product contours come only from the runtime `contours` source supplied by
`MapPreview.vue` through `maplibre-contour`. `buildMapStyle()` intentionally
omits contour sources/layers when no runtime contour protocol URL is supplied;
do not add Mapbox Terrain v2 or cached PMTiles as an implicit fallback in the
customer editor, proof, checkout, or final render path.

Viewport scaling is metadata-driven. MapLibre layers that need visual scaling
carry:

```ts
metadata: { radmaps: { scale: ['line-width', 'text-size'] } }
```

[utils/render/viewportScale.ts](/Users/anthonymaro/Documents/apps/trailmaps/trailmaps-app/utils/render/viewportScale.ts) must read that metadata. Do not reintroduce layer-ID regex scaling.

## Tests

Run the Phase 0A graph harness before changing presets, graph behavior, map
layer construction, or style-panel gating:

```bash
npm run test:style-graph
```

This verifies:

- every current preset has a graph
- slot ordering follows the canonical order
- visible controls map to consumed fields
- baked/unsupported features do not expose fake controls
- required features do not expose destructive toggles
- unsupported saved fields are ignored without deletion
- style JSON contains expected graph-supported layers
- viewport scaling follows graph metadata

`npm run test:style-browser` runs the Playwright browser harness against the
dev-only `/style-browser-fixture` page. It renders every refined composition on
desktop and mobile and verifies layout routing in the real Nuxt/MapPreview path.
Add pixel-level assertions there as new map or panel behavior becomes visually
critical.

`npm run test:style` runs both the graph harness and the browser harness.

## Design Handoff Integration

The `design update/implementation-plan.md` direction is compatible with this
graph reset. Poster composition is now implemented as profile-driven Vue chrome
inside `MapPreview.vue` instead of a wrapped React subtree, so editor and
AWS renderer render parity stay on the existing single renderer. Map controls and
map-layer construction must still use graph capabilities.

`18x24` is a legacy alias for `24x36`, not a current product size. Keep it
parseable through provider profile normalization, but do not expose it in new UI
or theme plans.
