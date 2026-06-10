# Anchor Layout Model — W0 Execution Plan

Date: June 7, 2026
Workstream **W0** in `docs/POSTER_PLATFORM_ROADMAP.md`. Foundation for text
auto-fit (W2) and the editor tiers (W3+). Codex-ready.

## Goal

Introduce a typed **anchor / constraint layout model** where **anchors generalize
the current bands** — an evolution of `PosterLayout`, not a rewrite. Bands stay as
the default preset; over-map slots become free anchors. The 27 themes must render
**identically to today** after the change; the map geometry must never move.

## Non-negotiables

- `MapPreview.vue` stays the only renderer; editor == proof == print.
- **No big-bang migration.** `poster_layout` stays sparse; anchors are added
  additively; `DEFAULT_STYLE_CONFIG` unchanged; legacy/default configs keep
  rendering byte-stable.
- **Map-geometry invariant (corrected per Codex review):** *free-anchor, text, and
  content* changes must never move the map. Bands are `displacesMap: true` and
  header/footer height already reflows the map today (`MapPreview.vue:5115`,
  `:5306`), so an **explicit band-height edit may move the map** — that is allowed,
  but governed by separate bounded editor rules (clamped band heights). The
  invariant is: *content/free-anchor edits don't move the map; only deliberate
  band-size edits do.*

## Current model (what exists)

- `types/index.ts`: `PosterLayout { bands: Record<ChromeBandId, ChromeBand> }`,
  `ChromeBandId = 'header' | 'footer' | 'railLeft' | 'railRight'`. Bands hold
  rows → cells → `ChromeBlock` (`kind`, `slot`, `align`, `valign`, ...).
- The **map is the implicit center**; bands surround it. Composition profiles set
  `headerOrder` / `mapOrder` / `footerOrder` (flex order) in
  `utils/posterCompositions.ts`.
- `StyleConfig.poster_layout?: PartialPosterLayout` — sparse user overrides;
  merged by `mergePosterLayout` / `effectivePosterLayout` in `utils/posterLayout.ts`.
- Over-map content today (Cartouche plate, Sea Chart titleblock, Art Wash caption,
  bib numeral, star field) is composition-specific absolute markup in
  `MapPreview.vue`, **not** part of `PosterLayout`.

## Target model

Add a typed **`AnchorFrame`** as the unifying layout primitive:

```
AnchorFrame {
  id: string
  anchorTo: 'poster' | 'map' | ChromeBandId | { elementId: string }
  // where it attaches: poster edge (band-like), the map box (over-map), or another frame
  edge: 'top'|'bottom'|'left'|'right'|'center'|'fill'   // attachment + alignment
  offset?: { x?: cqUnit; y?: cqUnit }                   // relative offset
  size?: { width?: cqUnit|'fr'; height?: cqUnit|'fr' }  // fraction or container unit
  displacesMap: boolean   // true = band (reflows map); false = floats over map
  z?: number              // stacking when over map
  slot?: PosterTextSlot   // bound theme slot (title, footer, ...)
  fit?: FitConfig         // from POSTER_TEXT_FIT_PLAN (target/minScale/maxLines/overflow)
  rows?: ChromeRow[]      // existing row/cell content lives inside a frame
  userPinned?: boolean    // manual takeover: absolute, opts out of adaptivity
  box?: AnchorBox         // v0 PARITY ESCAPE HATCH — see below
}
```

**`box` / v0-parity model (per Codex review — the `edge`/`offset`/`size` triple is
NOT decision-complete).** Current layouts use constraints these fields can't
express: `width: min(82cqw, 54cqh)`, `calc(... + var(--print-bleed))`, transforms,
padding, max-width, and frame decorations/pseudo-elements. For **v0 the goal is
byte-parity, not normalization**, so `AnchorFrame` must be able to carry the
*existing* box as a constrained style token set (`AnchorBox`: width/maxWidth/
height/padding/transform/bleed/decoration), reproducing today's CSS exactly.
Define `AnchorBox` as a closed set of allowed tokens (not arbitrary CSS, to keep
print-safety and render parity). Normalizing these into clean
`edge`/`offset`/`size` semantics is a **later** step, after parity is green.

Mapping (this is the "anchors generalize bands" part):

- **Band = preset anchor:** `header` → `{ anchorTo:'poster', edge:'top', size:{height:'fr'}, displacesMap:true }`; `footer` → bottom; rails → left/right. Existing
  `ChromeBand` rows/cells/blocks move into the frame's `rows` unchanged.
- **Over-map = free anchor wrapping the WHOLE titleblock (per Codex review).**
  `place-frame`, `sea-chart`, and `art-wash` are NOT simple text slots — they make
  `.poster-header` itself an absolute over-map titleblock with theme-specific
  width, bleed offsets, transforms, pseudo-elements, and nested kicker/meta/title
  (`MapPreview.vue:12812`, `:12958`, `:13027`). So a free anchor for v0 wraps the
  *entire existing titleblock/frame* (carrying its `box`), preserving the DOM/CSS
  contract — it does **not** try to reduce it to a text slot yet.
- `displacesMap` is the key bit: band anchors reflow the map (today's behavior);
  free anchors float over it and **never change map geometry**.

## Renderer changes (`MapPreview.vue`)

- Render `displacesMap:true` frames through the **exact existing header/footer
  DOM** (flex order) — output must be byte-identical to today for all 27 themes.
- Render `displacesMap:false` frames by **wrapping the existing over-map titleblock
  markup** (carrying its `box`) as a free anchor against the map box — preserve the
  current DOM/CSS first; do not rewrite the titleblock internals in v0.
- Both paths consume the same `AnchorFrame` data. No second layout path.

## Backward compatibility / migration

- Keep `PosterLayout.bands` working. Provide an adapter: `bandsToAnchorFrames()`
  derives the four band anchors from existing bands so current data renders
  unchanged. New free anchors are additive.
- `poster_layout` stays sparse; add an optional `anchors?: PartialAnchorFrame[]`
  alongside `bands` for free anchors. `mergePosterLayout` / `effectivePosterLayout`
  extend to merge anchors. **No DB migration**; old rows render via the band
  adapter; default configs unchanged.
- Composition profiles gain anchor presets but keep `headerOrder`/`mapOrder`/
  `footerOrder` honored through the band adapter during transition.

## Audit — by slot occurrence and location (broadened per Codex review)

Classify **every rendered `PosterTextSlot` occurrence by location**, not just one
slot per theme — a foundation model must cover them all. Buckets:

- **Band anchors:** header/footer/rail text (most themes).
- **Free over-map titleblocks:** `place-frame`, `sea-chart`, `art-wash`
  (Contour Wash / Plein Air); check map-bleed/framed cases (`modernist-block`,
  `botanical-plate`).
- **Map-level labels also rendered over the map:** USGS coordinate/scale labels
  (`MapPreview.vue:1217`), side-rail / map-inside labels, and composition-specific
  title/data elements.

Record the classification (slot id, theme, location, anchor type) in the
composition profiles / style inventory so nothing over-map is missed.

## Phasing (within W0)

Parity-first, decompose-later (per Codex's recommended adjustment):

1. **Types + adapter + tests only — no render change.** Add `AnchorFrame` /
   `AnchorBox` + `bandsToAnchorFrames()`; keep `PosterLayout.bands` persisted.
2. **Render band anchors through the exact existing header/footer DOM.** Byte-
   identical output; golden parity must stay green.
3. **Wrap existing over-map titleblocks as free `AnchorFrame`s without changing
   their CSS** (carry the `box`). Parity-preserving — no internal rewrite.
4. **Audit + tag** every `PosterTextSlot` occurrence by location (above).
5. **Contract tests** (below). Lock before any editor work builds on it.
6. **(Later, separate)** Only after parity is green across W0, normalize the
   titleblock internals into reusable slot/fit primitives. Not part of v0.

## Tests (the gate)

- **Golden render parity:** for all 27 themes, band-anchor output is pixel/geometry
  identical to pre-change (snapshot before vs after) — proves "evolution, not
  regression."
- **Map geometry invariant:** content/free-anchor changes (free-anchor add, long
  title, text edit) do **not** move the `[data-testid="poster-map"]` rect. A
  deliberate band-height edit **may** move it, but only within clamped bounds —
  test the clamp, not "never moves."
- **Over-map titleblocks:** Cartouche/Sea Chart/Art Wash render as free anchors
  over the map (wrapping the existing titleblock, CSS preserved), not evicted to a
  band; their `box` reproduces today's layout.
- **Compat:** legacy `poster_layout` (bands only) + default configs render
  unchanged; sparse anchor merge round-trips.
- `npm run typecheck` + `test:style-graph` + `test:style-browser`.

## Definition of done

- `AnchorFrame` model + band adapter landed; `poster_layout` carries optional
  anchors additively; no migration; defaults unchanged.
- All 27 themes render byte-identical to today (golden parity green).
- Over-map titleblocks are wrapped as free anchors (CSS preserved); map geometry
  invariant under content/free-anchor changes (band-height edits clamped).
- Every `PosterTextSlot` occurrence classified by location.
- Editor and text-fit can now build on `AnchorFrame` (W2/W3 unblocked).
- Titleblock-internal normalization is explicitly **out of v0 scope** (later).

## First moves

1. Snapshot all 27 themes (editor + print) as the golden baseline **before** any
   change.
2. Land types (`AnchorFrame` + `AnchorBox`) + `bandsToAnchorFrames()` adapter with
   no render change; confirm golden parity still green.
3. Render band anchors through the exact existing header/footer DOM; re-confirm
   golden parity. Then **wrap** the over-map titleblocks (Cartouche/Sea Chart/Art
   Wash) as free anchors carrying their existing `box` (no CSS rewrite); verify
   map-geometry invariance.

## The goal / Codex prompt (paste this)

> Execute W0, the anchor layout model, per `docs/ANCHOR_LAYOUT_MODEL_PLAN.md`
> (read it fully — it incorporates the code-review fixes). GOAL: introduce a typed
> `AnchorFrame` model where **anchors generalize the current bands** (band =
> edge-pinned preset anchor that displaces the map; over-map titleblock = free
> anchor floating over the map). The 27 themes must render **byte-identical to
> today**. Evolution of `PosterLayout`, not a rewrite; **no DB migration**
> (`poster_layout` stays sparse, anchors additive, `DEFAULT_STYLE_CONFIG`
> unchanged, legacy/default configs render byte-stable).
>
> CORRECTED INVARIANT: content/free-anchor/text changes must never move the map;
> a deliberate band-height edit MAY move it but only within clamped bounds. Do not
> write a "map never moves" test — test the clamp.
>
> PARITY-FIRST, DECOMPOSE-LATER. Phases: (1) types (`AnchorFrame` + a closed
> `AnchorBox` style-token model that can carry existing constraints like
> `min(82cqw,54cqh)`, `calc(+var(--print-bleed))`, transforms, padding, max-width,
> decorations) + `bandsToAnchorFrames()` adapter + tests, **no render change**;
> (2) render band anchors through the **exact existing header/footer DOM** (byte
> parity); (3) **wrap the existing over-map titleblocks** (`place-frame`,
> `sea-chart`, `art-wash` — these are whole absolute `.poster-header` titleblocks
> with theme-specific CSS at `MapPreview.vue:12812/12958/13027`, NOT text slots) as
> free anchors carrying their `box`, **preserving DOM/CSS** — do not rewrite their
> internals in v0; (4) audit + classify **every `PosterTextSlot` occurrence by
> location** (incl. USGS coord/scale labels `:1217`, side-rail/map-inside labels);
> (5) contract tests. Normalizing titleblock internals into slot/fit primitives is
> a LATER, separate step — out of v0 scope.
>
> SNAPSHOT all 27 themes (editor + print) as the golden baseline BEFORE any change.
> GATES before each commit: `npx vue-tsc --noEmit --pretty false`, the focused
> Vitest contract suite, and golden render-parity (band output identical to
> baseline). One logical commit at a time; clean worktree; never proceed on red;
> `MapPreview.vue` stays the only renderer.
>
> A Claude review runs periodically and writes verdicts to
> `docs/ANCHOR_MODEL_FEEDBACK.md` — before continuing, read its newest entries and
> resolve anything flagged. After phase 3, write live renders for `cartouche-place`,
> `sea-chart`, `contour-wash`, and `plein-air` to `docs/theme_audit_output/`
> (`npm run themes:capture-audit -- --base-url=http://localhost:3003
> --out=docs/theme_audit_output`) so the review can verify the wrapped titleblocks.
> DONE when all phases ship, golden parity is green for 27/27, over-map titleblocks
> are wrapped free anchors, and the clamped band-height + map-geometry tests pass.
