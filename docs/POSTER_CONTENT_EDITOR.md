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

The June 4, 2026 theme pass reduced default composition gutters and spacer row
fractions so the fixed 2:3 poster area feels deliberately designed rather than
boxed inside excessive chrome. The June 5, 2026 typography pass then reviewed
all 22 refined themes as a product set, upgraded display/body font pairings,
restored mixed-case serif titles in the fixed-template path, aligned theme
picker thumbnail typography, and tuned footer hierarchy by composition. A
follow-up pass added the live owned/Beta Atlas map styles to the Quick tab as
map-only themes, so the review surface includes the same RadMaps-hosted map
directions available in the real editor's Map tab. The whitespace is still
represented as explicit spacer rows, which means themes can include it and users
can remove or resize it.

The June 6, 2026 corrective pass locked the 27-theme design handoff inventory
as the source of truth for labels, compositions, fonts, and owned Atlas map
defaults. It also removed speculative non-editable overlay art from the poster
renderer so theme character now comes from editable chrome, typography, palette,
and live MapLibre/Atlas route styling rather than pasted-on static decoration.
For the full theme review, see
[docs/POSTER_THEME_REFINEMENT_REVIEW.md](/Users/anthonymaro/Documents/apps/trailmaps/trailmaps-app/docs/POSTER_THEME_REFINEMENT_REVIEW.md).

The refined registry now contains 27 renderable poster recipes. The newest
theme directions add more classical, expressive, technical, and terrain-forward
poster language:

- `classic-trail`
- `ranch-ochre`
- `blackline`
- `copper-night`
- `moonstone`
- `night-ride`
- `daybreak-trace`
- `electric-atlas`
- `cartouche-place`
- `sea-chart`
- `relief-shaded`
- `transit-diagram`
- `plein-air`

## Current Status - June 6, 2026

The fixed-template editor is the current control path for the poster content
editor. It is not production-ready yet, but it is now the most credible path
because it keeps `MapPreview.vue` as the render truth, keeps map/style controls
in the existing right panel, and writes only structured `poster_layout` plus
`poster_text_overrides` data.

Recent stabilization work:

- Row and cell delete now write tombstones into `poster_layout` so deleted
  default rows/cells do not immediately reappear from theme defaults.
- Deleting a column keeps the row and lets remaining columns expand instead of
  deleting the entire row.
- Grid controls were de-layered so trash/add-column/row handles are not stacked
  on top of each other in normal fixed-template use.
- Row resize handles now exist independently for top and bottom edges; column
  resize handles are centered vertically on the column boundary.
- The left template panel is compact, single-column, and uses icon-forward
  controls for common actions.
- The map-locked badge was removed from the visual center of the map in the
  fixed-template path; map lock behavior is tested through camera stability.
- Preview/edit mode keeps the same poster geometry; preview only hides editing
  controls and contenteditable state.
- Footer stat typography was reworked so distance, gain, date, location, and
  brand are no longer equal-looking generic text blocks. Default recipes now use
  unequal footer column fractions, larger numeric first lines, quieter
  metadata/brand opacity, and composition-specific scale differences.
- The draft adapter now preserves theme-owned slot blocks as renderer-driven
  slots when writing back to `poster_layout`. This prevents generated text like
  `19.1 miles` from freezing into raw block text and bypassing the designed
  footer renderer.

Current manual review URL:

```text
http://localhost:3003/style-browser-fixture?surface=1&composition=travel-banner&theme=midcentury-travel&posterEditor=1&surfaceTemplateEditor=1&width=1180&height=820
```

Current quality bar:

- The fixed 2:3 poster shape is preserved.
- Header/footer blank areas are explicit spacer rows.
- Inline text editing is direct on the poster.
- Theme-owned text/chrome remains editable through the fixed-template path.
- Refined themes use self-hosted local fonts for editor and Browserless render
  parity; Google Fonts is not a runtime dependency.
- Left-side selected controls can edit font, emphasis, alignment, duplicate,
  delete, row size, and column operations.
- The existing right style panel remains responsible for theme, route, map,
  terrain, grid, typography, and text settings.
- Browser tests cover map lock, edit/preview parity, footer slot hierarchy,
  deletion behavior, compact margins, and embedded style-surface mounting.
- `npm run themes:capture-audit` captures all 27 poster themes and 11 owned
  Atlas presets for visual review.

Known gaps:

- Image/logo and icon blocks are not yet integrated into the fixed-template
  editor path.
- Drag-to-reorder rows/blocks and drag-beside-to-create-columns are still not
  production-grade in the fixed-template editor.
- Mobile fixed-template editing still needs the planned bottom-sheet workflow.
- Physical print proofing has not yet validated these refined footer and
  template treatments at 24x36 inches.

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

1. Add screenshot-based visual regression for approved theme templates.
   Start with a smaller accepted set before snapshotting all 27 themes. Capture
   editor geometry and final-print geometry so edit mode cannot drift away from
   render output.

2. Finish fixed-template structure interactions.
   Prioritize row delete, column delete, add column, independent top/bottom row
   resizing, and selected-control placement before adding more block types.

3. Add image/logo and icon blocks.
   Use the existing trusted upload flow for images/logos and the local SVG icon
   registry for icons. Do not introduce remote image URLs or raw HTML export.

4. Build mobile editing as a separate focused pass.
   Use bottom sheets for Insert, Layers, Selected, and Style. Keep precise
   drag-to-column and row resizing desktop-only until they can be made genuinely
   good on touch.

5. Run print-render smoke tests.
   Generate proof/final smoke renders for heritage, expressive, data-forward,
   and atmospheric themes and inspect route placement, zoom level,
   footer/header chrome, and 24x36 print pixel output before promoting the
   editor path.

6. Decide what to retire.
   Once the fixed-template editor is validated, retire or quarantine
   `layoutSpike=1`, `puckSpike=1`, and any old chrome-grid UI that no longer
   informs the production path.

8. Treat landscape aspect support as a separate product project.
   Do not mix 3:2 landscape into this rollout. It requires explicit aspect
   state, render hashes, camera framing, product catalog, checkout, and physical
   sample validation.
