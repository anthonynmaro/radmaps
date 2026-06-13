# Poster Content And Template Editor

RadMaps now has a dev-gated guided poster editor path that keeps
`MapPreview.vue` as the only render truth. The Tier 1 goal is constrained:
users can edit allowlisted text slots, colorway, map framing, and small layer
controls while theme-owned layout structure remains locked.

## Current Entry Points

- Integrated style surface:
  `/style-browser-fixture?surface=1&posterEditor=1`
- Standalone template fixture:
  `/style-browser-fixture?templateEditor=1`

Production rollout is gated by
`FLAGS.POSTER_ELEMENTS_EDITOR` and `FLAGS.POSTER_TEMPLATE_EDITOR`. The dev
fixture query params exist only for local/Playwright review.

The old `puckSpike`, `puckReference`, and `layoutSpike` routes are retired.

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

## Unified Element Selection (FLAGS.EDITOR_V2) — June 12, 2026

Editor-v2 D1 (docs/EDITOR_UX_NORTH_STAR.md gesture 1) gives the poster the
same selection grammar map elements use. Behavior is split by
`FLAGS.EDITOR_V2`:

**Flag ON (unified grammar):**

- Clicking a poster text slot or a free text overlay selects it: Moveable
  handles mount around the element and the shared floating
  `ElementToolbar.vue` + `ElementTextControls.vue` card opens (text input,
  font, B/I, align, color, size pt with log slider, opacity, delete for
  overlays, "…" overflow with highlight/reset). This is the same card family
  `MapSelectionOverlay.vue` uses for route/segment/label selections, so map
  and poster elements read as one system.
- Click = select; clicking the already-selected element (or double-clicking)
  enters the existing contenteditable inline edit. A capture-phase pointerdown
  guard on the poster canvas suppresses caret focus on first click only;
  all selection events and write paths are unchanged underneath.
- Under the hood nothing moved: slots remain data-bound and auto-fitting
  (`poster_text_overrides` writes; Moveable resize writes the existing
  `font_size_pt` fit-bypass), overlays remain free anchors (`text_overlays`
  writes via `overlay-updated`/`poster-element-patched`). Overlay delete moves
  from the bespoke corner button into the toolbar.
- Selection arbitration is global through
  `composables/useElementSelection.ts`: selecting a map element closes any
  poster selection and vice versa, in both directions
  (`MapPreview.vue` claims for toolbar state, `MapEditorSurface.vue` co-claims
  for Moveable state with the same `slot:`/`text:`/`asset:` keys).
- Chrome-grid blocks (guided/template editor surfaces) are deliberately
  excluded from the first-click guard; they keep their
  `selectChromeCellFromInteraction` focus behavior.
- Image assets and icon overlays keep their existing selection/drag grammar
  for now; they join the unified grammar with the + Add menu work (gesture 4).

**Flag OFF (legacy, byte-identical):**

- Slots and overlays select through `InlineTextToolbar.vue`; overlays keep
  the bespoke move/resize/delete handles and interactjs drag; first click
  focuses the contenteditable immediately. No arbiter claims are ever made.

## Band-Divider Drag (FLAGS.EDITOR_V2) — June 12, 2026

Editor-v2 D2 (docs/EDITOR_UX_NORTH_STAR.md gesture 2) makes the header/map and
map/footer boundaries directly draggable — the only structural gesture in the
default editor.

- Affordances are two `band-divider` strips at the map container's top/bottom
  edges in `MapPreview.vue` (subtle pill + seam line on hover/drag). They are
  **editor-only chrome** under the MapSelectionOverlay rule: mounted only when
  the unified grammar is active (editable, not print render, FLAGS.EDITOR_V2),
  never on `/render` pages. Adjacency is resolved from the composition's flex
  order, so title-bottom layouts drag the header at the map's bottom edge.
  `transit-diagram` (hard-coded band geometry) shows no dividers.
- Dragging trades height between the adjacent band and the map area inside the
  locked 2:3 poster. Clamps are pure functions in `utils/posterLayout.ts`:
  bands stay inside `CHROME_BAND_HEIGHT_BOUNDS` (8–34%, the existing chrome
  resize print-legibility bounds) and the map area never drops below
  `BAND_DIVIDER_MAP_MIN_PCT` (40% of poster height).
- Persistence is the EXISTING `poster_layout.bands.<band>.height` mechanism —
  the same field the chrome row-resize writes; no parallel system. Reset is
  therefore already wired: per-band reset deletes the band override and theme
  reset clears `poster_layout`, both restoring recipe heights.
- Live refit: pointermove emissions are rAF-coalesced; the slot text-fit
  watcher debounces to 80ms during the drag and settles immediately on
  release (text-fit runs are serialized so searches never interleave). The
  MapLibre canvas re-fits through its existing `mapContainer` ResizeObserver
  (`syncCameraToFrame`: `resize()` + saved-camera restore or `fitBounds`).
- Map-geometry invariant (test-pinned in `tests/band-divider.test.ts`): ONLY
  this gesture and the pre-existing chrome row/band resize write band heights,
  and no clamp output can push the map below its floor.
- `editorial-minimal` pins its map area to a fixed 64% flex share; once a
  band-height override exists (flag on), that pin yields to `flex-1` so the
  trade is real. Gated on the flag only, so print resolves identical geometry.

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
- Refined themes use self-hosted local fonts for editor and AWS renderer render
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

6. Keep Tier 2 separate.
   Insert/remove overlays, free-anchor drag/snap, and region resizing are Tier 2
   work. Do not reintroduce the retired spike routes as a shortcut.

8. Treat landscape aspect support as a separate product project.
   Do not mix 3:2 landscape into this rollout. It requires explicit aspect
   state, render hashes, camera framing, product catalog, checkout, and physical
   sample validation.
