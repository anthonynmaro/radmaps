# Style System Evolution — one selection grammar, three domains

Date: June 10, 2026. Companion to docs/EDITOR_UX_NORTH_STAR.md (gestures) and docs/GO_TO_MARKET_COURSE_CORRECTION.md. This extends the north star from poster chrome to the map surface and the segment editor, and disposes of the StylePanel section-by-section.

## The model

Everything selectable, one grammar, three domains:

1. **Poster elements** — text slots, overlays, images. (North star Prompt D; already specced.)
2. **Map elements** — place labels, POI labels, elevation/contour labels, start/finish pins, route, segments. Click on the map selects the element under the cursor; the same floating toolbar appears with element-appropriate controls.
3. **Surfaces** — click empty band space → band properties; the Advanced drawer owns global map style (preset, tiles, contours, hillshade, terrain, atlas layer toggles).

The user never learns three systems; they learn "click the thing you want to change."

### Camera vs selection (the map-click ambiguity)

The map is also a pannable viewport. Resolve with the existing FreezeControl, reframed: **frozen (default in editor) = selection mode** — clicks hit-test elements; **unfrozen = camera mode** — drag pans, scroll zooms, clicks do nothing. One toggle, already shipped, no new concept.

## Domain 2: map elements

### Feasibility is per-source, and the graph already knows

- **Vector (Atlas MVT layers, contour labels, route/segments/pins):** symbol/line layers → `queryRenderedFeatures` hit-testing, per-feature overrides via filters/feature-state. Any override that lives in StyleConfig flows through `buildMapStyle()` → render ticket → AWS renderer with zero extra parity work. Fully editable.
- **Baked raster (CARTO, Stadia, MapTiler):** labels are pixels. Not clickable, not editable — and per the standing rule, we expose no fake controls for them. Selectability is per-SOURCE, not per-preset: the route and trail segments are app-owned vector layers on every preset, so they remain selectable even on raster bases; only the label/POI domain goes dark there. (Corrected 2026-06-10 — the original blanket "nothing selectable on raster" rule contradicted the source-feasibility model.)

Implication to decide consciously: if click-to-edit labels becomes a headline feature, raster presets are second-class. Options: (a) accept and graph-gate (cheap, consistent); (b) migrate the minimalist preset to Atlas vector for label parity (real project; touches mapToolCatalog, attribution, spend). Recommend (a) for launch, revisit (b) with Streets mode.

### Override persistence (new StyleConfig field)

```
map_element_overrides: {
  [elementKey: string]: {
    hidden?: true
    text?: string        // rename (vector labels only)
    color?: string
    size_scale?: number
  }
}
```

- `elementKey` must be **stable across zooms and renders**. Atlas tiles are self-generated — guarantee a stable feature `id` in the tile build (place: source id; POI: source id; contour label: elevation+geohash). This is the hard engineering nugget; do it in the atlas pipeline, not with geometry heuristics client-side.
- Applied in `buildMapStyle()` as layer filters (hidden) and data-driven properties (text/color/size) → editor, proof, and final renders agree by construction.
- Render hashes must include `map_element_overrides`.
- Unknown/legacy keys: preserve in JSON, ignore at render (same posture as effectiveStyleConfig).

### Per-element toolbars (selection → controls)

- **Place/POI label:** rename · hide · size · color | "hide all POIs of this kind" shortcut.
- **Elevation label:** hide · size | "fewer/more elevation labels" (density) shortcut.
- **Start/finish pin:** edit label text · style (existing pin options) · hide.
- **Route:** color · width · opacity · smoothing (today's Route section, contextualized).
- **Segment:** see below.

Each toolbar ends with the same "…" overflow and Reset-to-theme affordance as poster elements.

## Domain 2b: segment editor v2

Today: plot mode + draw/extend + geometry drag exists; section_start/end percentage slicing; draggable labels; **no in-place rename, no split, no reorder, no click-to-style**. Recent mapStyle parity fix (June 2) touched segment layer generation — segments are already vector layers with a `segments-handles` slot, making them the easiest map-element class to wire first.

V2 = segments join the selection grammar:
- **Click a segment** → toolbar: name (inline edit), color, width, line style, delete, **split at point** (cursor position → two segments), zoom-to.
- **Drag endpoints** to adjust section_start/end (existing handles, kept).
- **Labels**: in-place rename on double-click (drag already works).
- Segment list view lives in the Advanced drawer for reorder + overview; the map is the primary editor.
- Persistence: existing segment structures + the same override grammar; no parallel system.

## Theme switching must preserve user intent (blocking fix)

`applyThemeToStyleConfig` + `THEME_RESET_FIELDS` currently clobbers 30+ fields (manual map tweaks, effects, route styling) with no warning or undo; only poster text overrides survive.

Fix: split StyleConfig fields into a **theme-owned vs user-owned registry** (the data contract already established this concept for text). On theme switch:
- Theme-owned aesthetics reset (that's the point of switching).
- User-owned survive: `poster_text_overrides`, `poster_layout`, `map_element_overrides`, segments, route geometry edits, print size.
- Ambiguous middle (route color, label colors the user manually set): carry over with a one-time toast — "Kept your customizations · Reset all to theme" — the toast's reset button is the undo.

This lands before or with the map-element work; otherwise every new override class becomes new data to lose.

## StylePanel disposition (by section class)

- **Poster-chrome (~45% of controls):** dissolve into Prompt D contextual toolbars (text, band colors, padding, grid, logo/images). Kill the duplicated grid controls and the dual logo storage during migration.
- **Map-style (~40%):** Advanced drawer, graph-gated exactly as today (preset, base tiles, theme colorway, contours, hillshade, 3D/terrain, atlas layer toggles, effects). Consolidate the atlas dual-sync (`local.contour_*` vs `atlas_layer_settings.contour.*`) to one write path.
- **Segments/route (~15%):** dissolve into map-element selection (above); segment list/reorder stays in the drawer.
- **Order/meta:** unchanged, checkout-adjacent.

The drawer is reached by: clicking map empty-space in selection mode, the "…" on map-element toolbars, or an explicit Advanced button. The panel stops being the front door; it becomes the engine room.

## Implications & invariants (the nuances, named)

1. **Parity by construction:** map edits may ONLY exist as StyleConfig → buildMapStyle effects. No DOM overlays over the map for label edits — they'd vanish in print.
2. **Graph gating extends, not bends:** new per-element controls register in styleLayerGraph as capabilities; baked presets show nothing. No hardcoded preset checks.
3. **Stable feature IDs are the foundation** — atlas pipeline work, schedule it first inside this epic.
4. **Hashing:** `map_element_overrides` + theme-ownership registry version join the render hash.
5. **Goldens:** selection UI is editor-only chrome; flag-off renders stay byte-identical. Override effects DO change renders — goldens update only with intended diffs.
6. **Raster presets** advertise honestly: picker badges "editable labels" on vector-capable looks (graph-driven, like the quick-pick).

## Sequencing (Prompt E, after D)

1. Theme-ownership registry + preserve-on-switch (trust fix, unblocks everything)
2. Stable feature IDs in atlas tile build
3. Selection mode on the map (hit-testing + highlight + toolbar shell), FreezeControl reframe
4. Segments v2 (closest to done: rename, style toolbar, split)
5. Label/POI/elevation overrides (`map_element_overrides` + buildMapStyle + hashes)
6. StylePanel disposition (drawer consolidation + dual-write cleanup)
