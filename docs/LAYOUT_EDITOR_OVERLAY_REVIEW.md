# Layout Editor × Over-Map Themes — Compatibility Review

Date: June 7, 2026
Question: is the new chrome-grid / fixed-template layout editor compatible with
themes whose text sits **over the map**, and should it ship before
`POSTER_TEXT_FIT_PLAN.md`?

## What the layout editor actually models today

`MapPreview.vue` composes a poster from **two layers**:

1. **Bands (the editable chrome grid).** `poster-header` / `poster-map` /
   `poster-footer` stacked by flex `order` (`headerOrder`/`mapOrder`/`footerOrder`
   in `utils/posterCompositions.ts`). The map is a **locked center band**; header
   and footer hold the editable text slots and grid rows/cells. This is what
   `FixedPosterTemplateEditor.vue` + `posterLayoutDraft.ts` edit.
   `docs/POSTER_CONTENT_EDITOR.md` is explicit: *"the route map remains the locked
   center band"*, *"the map band is visually locked and is not edited through the
   content editor."*
2. **Poster-level overlays (mostly theme-owned).** Absolute, z-indexed children
   rendered **over the map**: composition decorations (cartouche corners/seal,
   bib ghost numeral, star field, grid overlay, inset frame, legend, elevation
   profile) plus a user **text/image overlay layer** that "can span header, map,
   footer."

So **most** editable text (title, subtitle, footer, stats) is **band** text, and
the layout editor handles it well. The risk is the themes whose **title/caption
lives over the map**, which is not a band cell.

## The incompatibility

Some compositions deliberately place **editable text over the map**, not in a
header/footer band:

- **`place-frame` (Cartouche)** — centered cartouche plate + title over the
  street map.
- **`art-wash` (Contour Wash, Plein Air)** — small centered caption over a
  full-bleed wash.
- **`sea-chart`** — integrated titleblock sitting directly on the chart field
  (no panel), over the map.
- **map-bleed / framed cases** (`modernist-block` map bleed, `botanical-plate`
  centered plate) where text and map share space rather than stacking.

For these, the title/caption is currently rendered as **composition-specific
absolute placement over the map** — it is *not* a first-class editable grid cell
or a normal overlay. Two consequences:

1. **Editor coercion.** A band-only editor (header / locked-map / footer) cannot
   represent "title floating over the map." Routing these themes through it tends
   to **evict the title into a header/footer band** — which is almost certainly
   what produced the earlier "generic stats-template fallback" we saw on
   overlay-style themes. When the editor fully launches, these themes degrade.
2. **The fit plan inherits a wrong assumption.** `POSTER_TEXT_FIT_PLAN.md` v1
   says "bound every text slot to header/footer bands; the map fills the
   remainder; text never over the map." That is correct for band slots and
   **wrong for over-map slots** — it would push the cartouche title, the chart
   titleblock, and the wash caption off the map and break those designs.

## The fix: one slot model with two slot classes

Both the editor and the fit engine must share a **single slot/box model** with an
explicit slot class:

- **Band slot** — lives in a header/footer band; bounded by the band box; the map
  band fills the remainder. (Most themes.)
- **Over-map / anchored slot** — floats over the map at a composition-defined
  anchor + box (e.g. cartouche center plate, sea-chart bottom-left titleblock,
  art-wash centered caption). Editable and fit-contained **within its own
  over-map box**, but **not evicted into a band**.

The invariant is the same for both: **text may shrink or clip within its box, but
it must never change the approved 2:3 map geometry.** The difference is only
*where the box is* (band vs floating over the map).

This means: the layout editor must let over-map slots be selected/moved/resized
as map-anchored elements (or as managed overlays), and the fit engine must fit
within a band box **or** an over-map box.

## Sequencing recommendation

**Do not gate on fully launching the editor** (drag-reorder, mobile bottom
sheets, image/logo blocks are not prerequisites — that's scope creep). **But do
lock the shared slot model — including the over-map slot class — first**, because
both the editor rollout and the fit plan depend on it. Recommended order:

1. **Phase 0 — slot model + over-map audit (prerequisite, small).**
   - Add the typed slot class (band vs over-map/anchored) to the layout/slot
     model (`posterLayout.ts` / `posterLayoutDraft.ts` / composition profiles).
   - Audit all 27 themes: tag each editable text slot as band or over-map. The
     known over-map set: `place-frame`, `art-wash` (contour-wash, plein-air),
     `sea-chart`, plus any map-bleed/framed title (`modernist-block`,
     `botanical-plate`) — verify each.
   - Confirm the editor can select/edit an over-map slot without evicting it to a
     band (fixes the coercion/fallback class for good).
2. **Phase 1 — fit engine on that model.** Build `fitTextToBox` to fit within a
   band box **or** an over-map box; map geometry invariant for both. (This is
   `POSTER_TEXT_FIT_PLAN.md`, amended to carry the slot class.)
3. **Editor rollout continues in parallel**, gated on Phase 0's slot model, and
   can finish/launch after the fit work without redoing the foundation.

In short: **lock the slot model (with over-map slots) first; then fit; then
finish/launch the editor.** Not "ship the whole editor first." The editor and the
fit engine are the same containment problem viewed from two sides — define the box
model once, build both on it.

## What to change in the existing docs

- `POSTER_TEXT_FIT_PLAN.md`: add the **band vs over-map slot class** so containment
  fits within the slot's own box and never evicts over-map text or alters map
  geometry. (Patched.)
- Treat **Phase 0 (slot model + over-map audit)** as the first task, before the
  fit engine.
