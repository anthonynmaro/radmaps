# Poster Content And Template Editor

RadMaps now has a dev-gated poster content/template editor path that keeps
`MapPreview.vue` as the only render truth. The goal is a constrained, polished
poster editor: users can change header/footer content and template structure,
while the route map remains the locked center band and the existing right style
panel remains focused on map, route, trail, theme, terrain, and print controls.

## Current Entry Points

- Integrated style surface:
  `/style-browser-fixture?surface=1&posterEditor=1&surfaceTemplateEditor=1`
- Standalone template fixture:
  `/style-browser-fixture?puckSpike=1`
- Puck reference fixture:
  `/style-browser-fixture?puckReference=1`
- Native structured reference fixture:
  `/style-browser-fixture?layoutSpike=1`

Production rollout is gated by
`FLAGS.POSTER_ELEMENTS_EDITOR` and `FLAGS.POSTER_TEMPLATE_EDITOR`. The dev
fixture query params exist only for local/Playwright review.

## Architecture

`MapPreview.vue` remains the only poster renderer. The template editor passes
`chromeEditing` plus `chromeExternalShell` into MapPreview, which keeps the
editable chrome DOM active but hides the old floating chrome toolbar and
builder. MapPreview emits `chrome-selection-changed` events so an external
editor shell can drive selected-state controls without introducing a second
poster renderer.

`FixedPosterTemplateEditor.vue` owns the product-facing editor shell:

- left panel for Insert and Layers,
- center `MapPreview.vue` poster,
- optional right inspector for the standalone fixture,
- compact left selected-state controls when embedded beside the real
  `StylePanel.vue`.

`MapEditorSurface.vue` embeds `FixedPosterTemplateEditor.vue` on the left/center
and keeps `MapStylePanel` on the right. Map view methods such as freeze, reset,
segment draw save, and route fitting are forwarded through the template editor
to the underlying MapPreview instance.

The draft model lives in `utils/posterLayoutDraft.ts` and adapts existing
`StyleConfig.poster_layout` chrome rows/cells/blocks into a structured
`PosterLayoutDraft`. Persistence still writes back to existing `poster_layout`
and `poster_text_overrides`; raw HTML/CSS is never persisted.

## UX Decisions

- The map band is visually locked and is not edited through the content editor.
- Header and footer whitespace is represented as explicit spacer rows.
- Inline text editing happens directly in the poster; there is no duplicate text
  input in the inspector.
- In the integrated style editor, selected content controls stay in the left
  panel so the right panel can remain the map/style designer.
- The old chrome toolbar, chrome layout builder, and floating cell popovers are
  hidden when the external template shell is active.
- The Layers panel separates Header and Footer so header blocks do not appear
  nested under footer.
- The standalone fixture keeps a right inspector for rapid prototype review,
  while the integrated editor hides it.

## Theme And Template Recipes

`utils/posterLayout.ts` now creates composition-aware default chrome recipes.
Each recipe sets header/footer height, spacer rows, content row proportions,
and typography scale. This makes intentional blank areas editable as spacer
rows instead of being implicit padding.

Applying a refined theme clears stale `poster_layout` so the selected theme can
load its intended starter template. Existing saved maps are still compatible
because old `poster_layout` data continues to render until the user applies a
new theme/template.

The refined registry now contains 22 recipes. The newest theme directions add
more classical and expressive poster language:

- `classic-trail`
- `ranch-ochre`
- `blackline`
- `copper-night`
- `moonstone`
- `night-ride`
- `daybreak-trace`
- `electric-atlas`

## Library Spike Outcome

The committed spike code keeps library exploration separate from production
state:

- Puck remains a reference for component config, categories, field conventions,
  and slots.
- Craft-style node/rule ideas remain architectural input rather than a runtime
  dependency.
- GrapesJS-style raw HTML/CSS export remains a poor fit for RadMaps render
  parity.
- The native Vue template path is currently the control path because it preserves
  MapPreview render truth and writes structured poster layout data.

## Testing

Run the full style verification suite before shipping editor/theme changes:

```bash
npm run typecheck
npm run test:style-graph
PLAYWRIGHT_PORT=3002 npm run test:style-browser -- --workers=1
```

The unit/contract suite covers:

- poster layout defaults and explicit spacers,
- draft-to-layout and layout-to-draft adapters,
- poster editor element mapping,
- icon overlays and printed grid density fields,
- refined theme registry and theme application reset behavior,
- Puck reference export shape.

The Playwright suite covers:

- all composition renders on desktop and mobile,
- legacy chrome layout editing fallback,
- poster editor v2 selectable text/image/icon layers and non-printing guides,
- native layout spike drag/drop, row resize, column resize, duplicate/delete,
- fixed template editor inline text, add column, duplicate/delete, spacer resize,
- integrated style surface with left selected controls and right map/style panel,
- integrated StylePanel tab coverage across Quick, Design, Map, Style, and Text,
- render parity between thumbnail and final-print geometry.

## Code Review Notes

Resolved during implementation:

- Standalone template inspector was accidentally hidden by Vue boolean prop
  casting. `showInspector` now defaults to `true`; integrated mode passes
  `false` explicitly.
- External selection initially depended only on a watcher and could miss
  same-cell clicks. MapPreview now emits selection directly from band/row/cell
  selection handlers.
- Integrated mode initially had no visible duplicate/delete controls because the
  standalone right inspector is hidden. Selected block/row controls now render
  compactly in the left panel.
- The native layout spike row resize handle was clipped below the fixed header
  band. The spike edit layer and bands now allow visible/hit-testable resize
  handles.
- Poster element selection now clears stale text/image targets when switching
  to icons, theme items, or deleted elements.
- Poster element opacity is clamped in the adapter to match the inspector range
  instead of relying only on UI sliders.
- Dev-only fixture/test hooks are gated to development builds.

## Next Steps

- Decide whether to retire the older `layoutSpike=1` reference once the fixed
  template editor fully replaces it.
- Add image/logo and icon block insertion to the fixed template editor using the
  existing upload flow and local icon registry.
- Add desktop drag-to-reorder and drag-beside-to-column behavior to the fixed
  template editor, borrowing only the proven parts of the native spike.
- Build the mobile bottom-sheet variant for the fixed template editor:
  Insert, Layers, Selected, Style.
- Add visual regression snapshots for the 22 refined themes once the theme set
  is approved.
- Revisit landscape aspect support as a separate product project; do not mix it
  into this fixed 2:3 editor rollout.
