# Poster Editor Strategy

Date: June 7, 2026
Purpose: decide the direction for the poster editor after repeated struggle with
the homegrown grid editor. Explores three customization tiers against the product
constraints, and recommends a path.

## Product principles (ranked — these decide trade-offs)

1. **The product is a printed map, excellent to 24×36".** WYSIWYG print parity is
   sacred. `MapPreview.vue` → AWS renderer screenshot → Gelato is the crown jewel:
   the editor *is* the renderer *is* the print file. Nothing may break that.
2. **The hero value is opinionated, adaptive design.** Quick workflow + themes
   auto-compose a stunning poster from route/location/title. Most customers should
   never need a layout tool. This is the moat.
3. **Customization is real but secondary, and constrained.** "Stunning themes" and
   "customization" only conflict if customization is unbounded.

## The constant spine (true for all three tiers)

Whatever ceiling we pick, the architecture underneath is the same — so we build it
once and don't rewrite:

- **`MapPreview.vue` stays the only renderer.** No second renderer, no raw
  HTML/CSS export (rules out GrapesJS-style builders).
- **One anchor / constraint layout model** (an evolution of the slot/band model —
  see "Layout model" below). Elements are anchored frames with constraints +
  snapping, theme-owned defaults, and a per-theme **editable allowlist**. Bands
  are just edge-pinned, full-width anchors; over-map slots are free anchors. Serves
  Quick *and* customization. Foundation from `docs/LAYOUT_EDITOR_OVERLAY_REVIEW.md`.
- **Interaction via Vue-native libs we already have:** `vue3-moveable`
  (drag/resize/rotate) + `interactjs`, operating **only** on bounded slots.
- **Auto-fit + containment** (`docs/POSTER_TEXT_FIT_PLAN.md`) keeps every edit
  print-safe.
- **Drop Puck + React.** Puck is a React page-builder forced into a Vue app for a
  free-form-blocks model that fights the renderer. The spike already concluded the
  native path wins — remove `@puckeditor/core`, `react`, `react-dom`.

**Key insight:** the homegrown "visual grid editor" you've fought is hard because
it's trying to be a *general grid/page builder*. On the anchor model it becomes a
**thin manipulation layer**, not a framework. The fix is to narrow ambition, not
add a library to build the general thing faster.

## Layout model: anchors generalize bands (drag/resize/snap, still adaptive)

A more drag-and-drop editor — resizable chrome/map regions, draggable text/images
with snapping/guides — is **achievable and print-safe**. Print fidelity comes from
the render pipeline (vector/high-DPI/AWS renderer), not from how an element was
placed, as long as positions are stored as data MapPreview reproduces. The real
tension is **adaptivity**, not print quality: free *pixel* positioning stops the
poster adapting to a new route/title/location. The resolution is a
**constraint/anchor layout** (think Figma auto-layout / SwiftUI for posters):

- **Resizable regions:** chrome bands and the map area have draggable dividers;
  sizes stored as fractions/constraints so they still reflow.
- **Anchored elements:** text/images have anchor + offset + constraints (snap to
  region edges, center, or another element), with guide marks. The anchor lets an
  element survive a content change instead of drifting.
- **Still adapts:** relative positions + text auto-fit reflow for a new
  route/title; free pixel coords cannot.
- **Manual takeover:** a user may pin an element absolutely; it then becomes a
  fixed artboard position for that element (deliberately opting out of adaptivity)
  — the same takeover idea as the text-fit plan.
- **Print-safe by construction:** all layout data MapPreview reproduces;
  snapping/guides are editor-only.

**Anchors generalize bands — this is an evolution, not a rewrite.** A band is an
anchored frame pinned to a poster edge, full width. So existing band-based
compositions become the *default anchor preset* and keep working; over-map slots
become *free anchors* (the new capability). Build the anchor model **once** as the
foundation; do not big-bang replace.

## Impact on current work (what survives, what changes)

- **App / render / print pipeline:** **no impact.** `MapPreview.vue` → AWS renderer
  → Gelato is unchanged; the model only changes how positions are computed/stored.
- **Recent theme work (parity):** **preserved.** Palette, route, map styling,
  typography, motifs, IBM Plex Mono, the semantic/chrome contracts, the 27 themes
  are *style*, orthogonal to the layout model. Each composition's *layout
  definition* is recast from band-order to anchored-frame — mechanical — and the
  over-map themes (Cartouche, Sea Chart, Art Wash) get **easier**, not redone.
- **Recent chrome-grid editor work:** **most impacted, but retargeted not deleted.**
  The grid-cell mechanics (add/remove column, row `fr`, cell tombstones in
  `FixedPosterTemplateEditor.vue` / `posterLayoutDraft.ts`) are superseded or
  simplified — and that is the part that's been the struggle. The scaffolding
  carries over: external-shell-drives-MapPreview, selection events, inline text
  editing, Insert/Layers panels, `vue3-moveable` integration, persistence plumbing,
  and the test/fixture harness.
- **Net-new cost:** the constraint/reflow engine + adapt-on-content behaviors +
  interaction polish (drag/resize/snap/guides on `vue3-moveable`).
- **Cheapest path:** the slot-model work (Phase 0) is imminent and required anyway;
  **design it anchor-based from the start** so it isn't rebuilt for Tier 2. Deciding
  the *model* now costs ~nothing extra; building the full canvas can still wait.

## The three tiers (explored)

The tiers are **additive on the same spine** — an incremental ladder, not three
forks. Each ships on the previous.

### Tier 1 — Light / Guided
- **User can:** pick theme/composition; edit text content (title, subtitle,
  footer fields); swap colorway; toggle a small layer allowlist; adjust map
  framing (zoom/center) and route style within the allowlist; nudge/resize text
  **within its bounded slot**.
- **UX:** the existing right `StylePanel` + inline text editing; `vue3-moveable`
  handles constrained to slot boxes.
- **Build:** smallest. Mostly: finalize the allowlist, inline editing, and the
  fit/containment engine. Reuses most of what exists.
- **Print safety:** by construction — layout is theme-owned, everything bounded.
- **Risk:** low. This is the floor every tier needs and what the Quick workflow +
  theme parity already assume.
- **Serves:** the 80–90% who want "make it mine a little," and protects "every
  poster looks designed."

### Tier 2 — Structured / Medium
- **Adds:** insert/remove **text and image/logo overlays**; reposition within
  **snap guides** (including over-map slots); reorder and resize bands; pick fonts
  from a curated set; manage layer z-order.
- **UX:** Insert + Layers panels; `vue3-moveable` with snapping/alignment guides;
  overlays become first-class slots in the model.
- **Build:** meaningfully bigger — this is where the historical pain lives
  (drag/snap/guides/selection/z-order + the image upload pipeline). The way to
  win it: constrain everything to the slot model and lean on `vue3-moveable`,
  rather than building generic grid mechanics.
- **Print safety:** still constrained to slots + fit, but **user-added content
  needs print guards** (min font size, bleed-safe placement, contrast, image DPI)
  and print smoke tests.
- **Risk:** medium — interaction polish. Mitigated by the slot constraint.
- **Serves:** prosumers personalizing for gifts/events/merch.

### Tier 3 — Free-form / High
- **Adds:** near-arbitrary element placement; blank-canvas freedom.
- **Build:** largest and never "done"; ongoing maintenance.
- **Print safety:** hardest — arbitrary content at 24×36 needs strong guards
  (DPI, bleed, min sizes, overflow) or quality drops.
- **Risk:** high; fights both print quality and the adaptive-theme value; average
  output gets *worse* in real hands; support burden grows.
- **Recommendation:** **not the primary path.** If ever pursued, build it as a
  separate opt-in "Pro/Advanced" surface **layered on the same slot model** (free
  placement = an over-map slot with relaxed bounds + print guards), so it never
  dilutes the default guided experience.

## Comparison

| | Tier 1 Light | Tier 2 Structured | Tier 3 Free-form |
|---|---|---|---|
| Print-safe | by construction | with guards | hardest |
| Build cost | small | medium | large + ongoing |
| Protects adaptive themes | yes | yes | dilutes |
| Library need | existing | existing + snapping | existing + heavy guards |
| Avg. output quality | high | high | variable |
| Recommended | **ship first** | **ship next, on usage** | separate future bet |

## Recommendation

1. **Build the spine + Tier 1 now.** It's on the critical path for *all* tiers and
   is what theme parity + the text-fit plan already need. It also lets you finally
   stop fighting the general grid editor.
2. **Then evaluate Tier 2 against real usage** and build it on the same slot model
   — most likely worth it for the personalization market, but let demand confirm
   scope before hardening the interaction layer.
3. **Treat Tier 3 as a separate, opt-in product bet**, not the default editor.
   Same model, relaxed bounds, strong print guards — only if a clear customer
   need appears.

So the decision today is **how far to commit, not which to pick**: ship Light,
keep Structured as the planned next step on the same foundation, and keep
Free-form behind a deliberate later product decision. The foundation (slot model
+ MapPreview + Vue-native manipulation, minus Puck/React) is identical regardless,
so starting now costs nothing against any future ceiling.

## Sequencing with current initiatives

1. **Phase 0 — slot/box model** (band + over-map slots, editable allowlist).
   Prerequisite for everything; see `LAYOUT_EDITOR_OVERLAY_REVIEW.md`.
2. **Text auto-fit + containment** on that model (`POSTER_TEXT_FIT_PLAN.md`).
3. **Tier 1 editor** finalized on the model; remove Puck/React; retire the
   general grid-builder spikes (`puckSpike`, `layoutSpike`).
4. **Tier 2** when validated; **Tier 3** only as a deliberate later bet.
