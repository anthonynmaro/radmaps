# Editor UX North Star — Canva feel on the anchor model

Date: June 10, 2026. Companion to docs/GO_TO_MARKET_COURSE_CORRECTION.md and docs/POSTER_EDITOR_STRATEGY.md. This doc defines the target interaction model; it does not change the layout architecture.

## North star

The poster is the interface. A user should be able to make every common customization by clicking and dragging on the poster itself, with properties appearing contextually on the selected element. Panels exist only for things that are genuinely not direct-manipulable (map style internals). Test: a first-time user personalizes a poster — text, sizes, colors, an added photo over the map — without ever opening a side panel.

## Why not literal Canva

Canva is a free canvas; its templates are just pre-placed free elements, and when swapped content overflows, the *user* fixes it. RadMaps templates auto-fill with route/location data and must stay print-safe at 300dpi — that promise structurally requires constraints. The anchor/frame model (AnchorFrame in utils/posterLayout.ts: edge-pinned band frames + free anchors, incl. `anchorTo: 'map'`) is the Figma-style middle point: constrained structure, free placement, one renderer. **The model is settled. This doc is about the interaction grammar on top of it.**

Standing rejections (re-affirmed): no third-party visual editor (second renderer kills print parity — the moat); no free-canvas default (Tier 3 stays a deferred opt-in); no general-purpose grid editor.

## The five gestures

1. **Click anything → handles + contextual toolbar.** Every element — theme-owned slot or user-added overlay — selects the same way: Moveable handles + a floating toolbar (font, size px/pt, weight, italic, color, align, opacity, padding, delete). Double-click enters text editing. An overflow "…" opens the rare properties (letter-spacing, line-height, background chip). No element requires the side panel.
2. **Drag band dividers.** The header/map/footer boundaries are draggable. Bands trade height inside the locked 2:3/3:2 frame; min/max clamps protect print legibility; slot text refits live via the text-fit engine. This is the only structural gesture in the default editor. Map container size *is* this gesture.
3. **Drag free elements over the map.** Stats, text, icons, images are free anchors. Snap guides: poster center lines, map-frame edges, other elements' edges, safe-area inset. Guides appear only while dragging. Position serializes as AnchorFrame offsets (relative units, never px).
4. **One + button.** Add menu: Text / Stat (data-bound picker: distance, gain, date, coords…) / Icon / Image-logo. New element drops centered on the map area, selected, toolbar open. Data-bound stats added this way participate in the theme data contract (real data or not insertable).
5. **Click empty band space → band properties.** Background color, padding, per-band reset-to-template. Click the map area background → map style entry point (the Advanced drawer).

Plus two universals: per-element and whole-poster **Reset to template** (the safety that makes exploration free), and the existing delete/restore tombstone list.

## Two unification moves (the real work)

- **One selection model.** Today slots use contenteditable + InlineTextToolbar; overlays use Moveable. Merge into a single "element" selection grammar. Under the hood slots stay data-bound/refitting and overlays stay free — the user never sees the seam. This is the keystone change; everything else hangs off it.
- **Demote the StylePanel.** The 11-section accordion stops being the primary surface. It becomes an "Advanced" drawer scoped to map style (preset, contours, hillshade, tiles, route styling) and order-level options. Everything text/layout/color moves to contextual toolbars. Mobile keeps the bottom-sheet pattern with the same contextual contents.

## Guardrails (invisible until needed)

- Print guards stay hard at render: ≥6pt effective font, ≥150dpi raster assets, safe-area containment. In-editor they surface as gentle inline warnings on the element, blocking only at checkout.
- Text-fit engine (Prompt B) is a **hard prerequisite** for gesture 2 — band resize without live refit feels broken.
- Every gesture's output must round-trip: AnchorFrame/poster_layout → render hash → golden-diff CI. No editor state that the print renderer can't reproduce.
- Map geometry invariant holds: content edits never move the map rect; only the deliberate divider gesture does, clamped.

## Sequencing

After Prompt B (text-fit + editability) and behind the goldens:
1. Unify selection (slots + overlays → one grammar)
2. Contextual toolbar everywhere (retire per-surface toolbars)
3. Band-divider drag with live refit
4. + Add menu (text/stat/icon/image)
5. StylePanel → Advanced drawer
6. Polish: snap guides set, empty-space band properties, reset-to-template

Each step ships independently behind FLAGS.POSTER_TIER2_EDITOR (or a successor `editor_v2` flag) with golden + Playwright coverage.

## STATUS — June 12, 2026 (editor-v2 D1)

What of the five gestures is live, all behind `FLAGS.EDITOR_V2` (flag-off is
byte-identical legacy):

1. **Click anything → handles + contextual toolbar: LIVE** for map elements
   and poster text. One arbiter (`composables/useElementSelection.ts`,
   54e3984) makes selection mutually exclusive across the map and poster
   domains; one toolbar family (`ElementToolbar.vue` +
   `ElementTextControls.vue`, a935b25) presents route/segment/label
   selections (`MapSelectionOverlay.vue`) and poster slot/text-overlay
   selections (6d6b94b) in the same visual language, with Moveable handles on
   the poster side. Click = select, click-again/double-click = inline text
   edit; slots stay data-bound + auto-fitting, overlays stay free.
   D3 update: image assets and icon overlays joined the grammar — clicking
   them opens the same ElementToolbar shell with object-domain controls
   (`ElementObjectControls.vue`: icon swap/color, opacity, allow-bleed for
   images, delete) plus the existing Moveable handles; intra-poster
   transitions between text and object selections are settled in MapPreview's
   selectedPosterElementId watcher (the arbiter deliberately doesn't referee
   intra-domain moves). Remaining inside gesture 1: chrome-grid blocks
   (guided/template surfaces) keep their own selection path; padding control
   is not yet in the unified toolbar.
2. **Drag band dividers: LIVE** (D2, closed out June 12). The header/map and
   map/footer boundaries drag via editor-only `band-divider` affordances in
   `MapPreview.vue` (transit-diagram excluded). Bands trade height with the
   map inside the locked aspect, with pure clamps in `utils/posterLayout.ts`
   (band floor/ceiling = `CHROME_BAND_HEIGHT_BOUNDS` 8–34%; map floor =
   `BAND_DIVIDER_MAP_MIN_PCT` 40% of poster height). Heights persist through
   the existing `poster_layout.bands.<band>.height` field — no parallel
   system — so per-band and theme resets already restore template defaults.
   Slot text refits live (rAF-coalesced emits, drag-debounced serialized
   fitTextToBox); the MapLibre canvas re-fits through its existing
   ResizeObserver. The map-geometry invariant is test-pinned
   (`tests/band-divider.test.ts`): only this gesture and the pre-existing
   chrome row/band resize write band heights.
   D2 close-out details: (a) the divider strip wins pointerdown at capture
   phase on the poster canvas (the divider element is clipped by the map
   container's overflow, so band-side presses used to land on slot hit boxes
   — the trail_name slot swallowed the pill drag on title-bottom themes); a
   pointer-tracked `is-strip-hover` class surfaces the pill across the full
   14px strip. (b) Divider adjacency resolves from the RENDERED flex
   order/flow of the band elements (`resolveDividerAdjacency` in
   posterLayout.ts), not composition constants — usgs-vintage, classic-trail,
   editorial-minimal and relief-shaded flip title-bottom via `!important`
   theme CSS, and dark-sky/copper-night absolutize the header (out-of-flow
   bands get no divider). (c) Flag-on, a USER band-height override emits
   `!important` inline styles (band `flex/height`, map `flex: 1 1 0%`) so the
   gesture beats those same theme pins; flag-off and no-override emit the
   legacy non-important values, byte-identical.
3. **Drag free elements over the map: PARTIAL (pre-existing)** — overlays drag
   via Moveable with snap guides under the poster-elements editor; not yet
   reconciled with the unified grammar's flag story.
4. **One + button: LIVE** (D3). `PosterAddMenu.vue` floats at the poster's
   bottom center (editor-only chrome, same mount rule as the dividers):
   Text / Stat / Icon / Image. New elements drop centered over the map area,
   selected, with their contextual toolbar open. The Stat picker is
   data-bound through the theme data contract — options come from
   `availablePosterStatBindings(ThemeDataContext)` (distance, gain, date,
   coords) and values without real data are not offered, so fabricated stats
   are not insertable by construction (`tests/poster-add-menu.test.ts`).
   Stat chips serialize as text overlays plus a `data_binding` field; their
   display text derives live from the same formatters the footer band uses
   (editor == print by construction), inline editing is disabled on them and
   the toolbar shows the value read-only. Image adds ride the existing asset
   upload pipeline, then center + select when the asset lands.
5. **Click empty band space → band properties: LIVE** (D4). Empty band space
   selects the band through the same poster-element id grammar
   (`band:header`/`band:footer` — arbiter claims, mutual eviction and
   intra-poster transitions all reuse the existing plumbing); the
   ElementToolbar shell presents `ElementBandControls.vue` (background color,
   vertical/horizontal padding nudges seeded from the rendered padding,
   per-band reset-to-template). Writes ride the existing poster_layout band
   paths (updateChromeBand/resetChromeBand). Band background overrides emit
   `!important` flag-on, mirroring the D2 height pin-yield — themes like
   editorial-minimal pin band backgrounds with `!important` rules that would
   silently defeat the recolor gesture. Clicking empty MAP space (no
   selectable element hit, nothing to dismiss) opens the Advanced drawer on
   the Map tab — the StylePanel's new role.
   Panel demotion (D4): flag-on the panel starts collapsed on desktop (an
   explicit stored preference wins), the reopen affordance reads "Advanced",
   and the toolbar-owned poster-chrome cards (Title & text, Poster colors,
   Icons, Selection, Text overlays, Viewpoint) no longer render flag-on.
   Mobile keeps the bottom sheet. The buried Viewpoint card became an
   on-canvas pill on the map area (lock framing / re-center, editor-only).
   Dead code swept: FreezeControl.vue deleted; the superseded
   _startChromeBandResize chain removed (the divider gesture is the only
   band-height drag besides chrome row resize, test-pinned).

Universals: per-element reset exists for text (toolbar "Reset to imported
text" / reset-to-theme via E1) and per-band reset-to-template (D4);
whole-poster reset-to-template not built.

ACCEPTANCE: the §Acceptance demo runs as a Playwright spec —
`tests/style-browser/editor-v2-acceptance.spec.ts` on
/style-browser-fixture?surface=1 (editorial-minimal, real route geometry,
deterministic `?flags=` override): title recolor from the floating toolbar,
divider drag with live refit and no mis-selection, image dragged over the
map, data-bound elevation-gain stat chip added centered/selected/read-only,
band recolored from an empty-space click, per-band reset — with the side
panel closed throughout. Plus: empty-map-click opens the Advanced drawer,
the viewpoint pill locks/unlocks framing, and flag-off mounts none of the
editor-v2 chrome. ("Order a proof" stays with the golden/render-hash CI
gates — not executable headless.)

## Acceptance (the demo)

On editorial-minimal with a real GPX: click the title and change its color from the floating toolbar; drag the header divider down and watch the title refit; add a photo, drag it over the map, snap it to center; add an elevation-gain stat chip over the map; recolor the footer band from empty-space click; hit Reset on one element. Order a proof — it matches the editor exactly. Zero side-panel opens.
