# Poster Text Auto-Fit & Slot Containment — Plan

Date: June 7, 2026
Status: **W2 — ready to execute. Phase 0 (the anchor model) is DONE via W0**
(`AnchorFrame`/`AnchorBox` landed, golden parity 0px). Reconciled with Codex
review. Separate initiative from theme parity. Single renderer only
(`MapPreview.vue`); must hold print/AWS renderer parity.

## The goal / Codex prompt (paste this)

> Execute W2 — poster text auto-fit & slot containment — per this doc. Phase 0 is
> already done (the `AnchorFrame`/`AnchorBox` model from W0 — commits 4bc517a /
> a61e067 / 0990b27). Build the fit engine **on that model**.
>
> GOAL: replace the character-count guess (`lengthFitScale`) with a measured
> **fit-to-box** engine. Each text slot fits within **its `AnchorFrame` box** (a
> band box OR a free over-map box) by scaling from the block's target size DOWN to
> a per-block-kind `minScale` floor; if it still overflows at the floor, **clip**
> (overflow hidden / clamp) — never grow the slot, never change map geometry.
>
> Build a NEW shared `fitTextToBox(el, box, { targetSizeCqh, minScale, maxLines,
> overflow })` helper (do NOT reuse the Moveable resize code at `MapPreview.vue:4249`).
> It must: wait for `document.fonts.ready`; measure `scrollWidth`/`scrollHeight`
> against the element's actual `AnchorFrame` box; binary-search/bounded-step from
> target to `target*minScale`, never above target; apply via CSS var/inline style
> so both legacy direct chrome and chrome-grid blocks consume the same fitted size.
>
> Fit metadata lives on the chrome/layout layer with **defaults by block kind**
> (title multi-line; subtitle/occasion/meta/brand mostly single-line; stats
> conservative), composition overrides near `utils/posterLayout.ts`, theme
> overrides only where typography forces it.
>
> MANUAL TAKEOVER — inferred, no new flag: a slot with an existing
> `poster_text_overrides[slot].font_size_pt` is user-sized (skip auto-fit, honor
> it); an edited `poster_layout` box (band height / row `fr` / cell `fr` / padding)
> is user-shaped (keep the box, still clip inside it). A manual size ALWAYS wins
> over auto-fit.
>
> PRINT READINESS: add a text-fit-settled state to `markPrintRenderReady()` before
> `window.__RENDER_READY = true`; refit only on relevant changes (text, font,
> typography, poster size, slot box, layout). Editor == proof == print.
>
> CORRECTED INVARIANT (from W0): content/free-anchor/text changes never move the
> map; only a deliberate band-height edit may, within clamped bounds.
>
> PHASES: (1) containment + measured fit-down + clip across all slots, fixing the
> H&H Connector overflow + un-editable-size repro first as the proof; (2) manual
> takeover (inferred); (3) per-block/per-theme `minScale`/`maxLines` tuning.
>
> GATES per commit: `npx vue-tsc --noEmit --pretty false`, focused Vitest, golden
> render-parity (themes with no manual edits must stay byte-stable where untouched),
> and the map-geometry-invariant test. One logical commit at a time; clean
> worktree; never proceed on red; `MapPreview.vue` stays the only renderer.
>
> A Claude review runs periodically and writes to `docs/TEXT_FIT_FEEDBACK.md` — read
> its newest entries before continuing and resolve anything flagged. Write live
> renders (incl. a long-title fixture and the over-map themes) to
> `docs/theme_audit_output/` (`npm run themes:capture-audit -- --base-url=http://localhost:3003 --out=docs/theme_audit_output`)
> so the review can verify fit + containment. DONE when: a long title cannot change
> the map rect; the H&H repro is fixed; manual size overrides auto-fit; text clips
> at the floor instead of overflowing; print readiness waits for fit; tests green.

## Problem

Title (and other chrome text) sizing is currently a blind character-count guess
with no containment, producing two failures:

- **Overflow pushes the layout around.** Long or multi-line titles grow vertically
  and, because the map area is `flex-1` in the same column, steal the map's space
  and shove the map/footer out of the fixed 2:3 template.
- **Auto-fit doesn't actually fit, and manual size is dead.** `lengthFitScale`
  scales only on string length (ignores font, weight, wrapping, and the real box),
  so a short-but-large title (e.g. "H&H CONNECTOR", ~13 chars) gets no downscale,
  wraps to 3 lines, and overflows; meanwhile a user's manual size edit isn't
  honored.

### Where it lives today (code map)
- `lengthFitScale(text, soft, hard, min)` — char-count heuristic: `MapPreview.vue:5120`
- `trailNameAutoScale` (per-composition limits): `:5128`
- `effectiveSlotFontSizeCqh()` — honors `override.font_size_pt` if present, else
  `base * scale * autoScale`: `:5062`
- `trailNameStyle` — title `<h1>`: `width/maxWidth:100%`, `overflowWrap:anywhere`,
  **no max-height / no bounded box**: `:5135`
- Map area is `flex-1` in the same column: `:958`
- An existing **measured** size path to reuse: around `:4249`
- Edit emit: `InlineTextToolbar.vue:240` → `applyToolbarPatch` `MapPreview.vue:5998`
- Persistence: `utils/posterLayoutDraft.ts` (font_size_pt ~143/405/428); slot
  override round-trip via `poster-text-override` handlers in
  `MapEditorSurface.vue` / `FixedPosterTemplateEditor.vue`.

## Target behavior (requirements)

1. **Per-block target size, set at the layout/chrome layer.** Each chrome text
   slot (title, subtitle, location, footer fields, kicker, etc.) has a target size
   with defaults **by block kind** (composition layer), and theme overrides only
   where a theme's typography forces it. Auto-fit starts from that target.
2. **Auto-scale DOWN within reason, measured.** Fit the rendered text (actual
   font, weight, tracking, wrapping) to the slot's box by scaling down from target
   to a **minimum scale floor that differs by block kind** (a big display title
   can shrink more before it looks wrong than an already-small footer line).
0. **Two slot classes (see `docs/LAYOUT_EDITOR_OVERLAY_REVIEW.md`).** A text slot
   is either a **band slot** (lives in a header/footer band) or an **over-map /
   anchored slot** (floats over the map at a composition anchor: e.g. Cartouche
   plate title, Sea Chart titleblock, Art Wash / Plein Air caption). Fit and
   containment operate on the slot's **own box** — a band box OR an over-map box.
   Over-map text must **never be evicted into a band**; it stays over the map,
   fit/clipped within its floating box. The map geometry invariant holds for both.
3. **Bounded slot regions.** Each slot occupies a bounded region of the 2:3
   template (a header/footer band box **or** an over-map anchored box). A slot can
   **never** reflow
   the map or other slots out of the poster. The map keeps its space regardless of
   text length.
4. **Overflow hidden to preserve layout.** If text still doesn't fit at the
   minimum scale, **clip** it (`overflow:hidden`, optional line-clamp/ellipsis) so
   the composition stays intact — rather than letting it grow the slot.
5. **Manual takeover wins.** Once the user manually sets a size OR resizes/reshapes
   a slot, auto-fit **disengages for that slot**: the manual size/box is honored,
   and overflow becomes user-driven (they can enlarge the slot to reveal clipped
   text). Auto-fit is the default only while the slot is untouched.

## Proposed model

> Reconciled with Codex's review (it inspected the code). Three accepted
> adjustments: (1) fit policy lives on the **poster chrome/layout layer**, not on
> themes; (2) build a **new DOM fit helper** — the `:4249` path is Moveable
> resize plumbing, not a text measurer; (3) **infer manual takeover from existing
> overrides** instead of adding a new persisted flag.

**Fit metadata lives on chrome blocks / layout recipes (the composition layer),
with defaults by block kind — not per-theme.** Add typed fit fields:

```
fit: {
  targetSizeCqh: number
  minScale: number          // floor; differs by block kind, not by theme
  maxLines?: number
  overflow: 'clip' | 'clamp'
  fitMode?: 'multi-line' | 'single-line'
}
```

- **Defaults by block kind:** title fits multi-line; subtitle / occasion / meta /
  brand fit mostly single-line; stats stay conservative.
- **Composition overrides** live near `utils/posterLayout.ts`.
- **Theme-specific overrides only where a theme's typography makes a default bad**
  — the exception, not the rule.

**Build a new shared `fitTextToBox(el, box, { targetSizeCqh, minScale, maxLines,
overflow })` helper.** Do NOT repurpose the size logic near `MapPreview.vue:4249`
— that is the Moveable drag-resize preview, not a text measurer. The helper:
1. waits for `document.fonts.ready`,
2. measures `scrollWidth`/`scrollHeight` against the element's actual cell/slot box,
3. binary-search / bounded-step scales from `targetSizeCqh` down to
   `targetSizeCqh * minScale`, never above target,
4. applies the fitted scale via a CSS variable / inline style so both the legacy
   direct chrome nodes and the chrome-grid blocks consume the same value.

**Containment — bound every chrome text slot:**
- Header/footer bands keep fixed `%` heights from `posterLayout`.
- Grid rows/cells: `min-height: 0`, `overflow: hidden`, block `max-height: 100%`.
- Change `.chrome-grid-block--title` from `overflow: visible` / `max-height: none`
  to bounded overflow.
- Direct legacy title/location/footer nodes get equivalent max-height/overflow
  rules until chrome-grid is render-truth everywhere.

**Manual takeover — inferred from existing state, no new flag:**
- An existing `poster_text_overrides[slot].font_size_pt` ⇒ treat the slot as
  **user-sized**; skip auto-fit for it.
- An edited `poster_layout` band height / row `fr` / cell `fr` / cell padding ⇒
  treat as **user-shaped**; keep the new box but still clip overflow inside it.
- Do **not** add a persisted `userSized` flag unless implementation reveals an
  ambiguous case that can't be inferred from existing overrides (then revisit; no
  DB migration without cause).

## Print / AWS renderer parity (must-handle)

- Fit needs DOM measurement (`scrollHeight`/`scrollWidth` or range measurement),
  which must run **after web fonts are loaded** (`document.fonts.ready`) and on
  container resize — otherwise it measures the fallback font and mis-fits.
- The AWS renderer capture must not screenshot until fit has settled: add a
  text-fit-settled state and include it in `markPrintRenderReady()` before
  `window.__RENDER_READY = true`.
- Refit on relevant changes only: text, font, typography, poster size, slot box,
  and layout changes.
- Editor preview, proof, and final print must run the identical fit so sizes match
  across all surfaces (no second path).

## Phasing

- **Phase 0 — anchor-based slot model + over-map audit (prerequisite).** Define
  the **anchor/constraint layout model** (bands = edge-pinned full-width anchors;
  over-map slots = free anchors), tag every theme's editable text slots, and
  confirm the editor can edit an over-map (free-anchor) slot without evicting it to
  a band. Design it anchor-based now so it isn't rebuilt for the editor's later
  tiers. See `docs/LAYOUT_EDITOR_OVERLAY_REVIEW.md` and
  `docs/POSTER_EDITOR_STRATEGY.md`. Unblocks both this plan and the editor.
- **Phase 1 — containment + measured fit-down + clip, across all slots/themes.**
  Bound every chrome slot so text can't push the map; build `fitTextToBox` and
  replace `lengthFitScale`; scale target→floor and clip at the floor. Covers all
  refined/new themes from the start (the chrome grid already gives bounded cells
  for every slot), not just `trail_name` — but verify the H&H Connector title
  repro first as the proof before extending. Land the geometry-stability test as
  the regression guard before any visual tuning.
- **Phase 2 — manual takeover (inferred).** Skip auto-fit for slots with an
  existing `font_size_pt` (user-sized) or edited `poster_layout` box (user-shaped);
  honor the manual size/box and reveal clipped text inside it. No new flag.
- **Phase 3 — per-block/per-theme tuning + tests.** Tune `minScale`/`maxLines`
  defaults by block kind, with theme overrides only where typography forces it;
  lock with tests.

## Constraints / risks

- Single renderer; no second sizing path; editor == proof == print.
- Measurement timing vs `__RENDER_READY` and font loading (above) is the main risk.
- Avoid layout thrash / CLS: run fit once per relevant change (text, box, font,
  container), not every frame.
- Keep `cqh`/container-query units so existing scale math and zoom still work.

## Acceptance criteria

- A long or multi-line title never changes the map area's geometry (map box is
  byte-for-byte stable across title lengths).
- Each theme's title fits its bounded box, scaling down only to its floor, then
  clipping — no overflow into other slots.
- A manual size edit (and a manual slot resize) overrides auto-fit, persists, and
  reveals clipped text by enlarging the slot.
- Editor, proof, and final print render identical text sizes.

## Tests

Playwright on `/style-browser-fixture`:
- Short vs long title keeps `[data-testid="poster-map"]` rect stable **for every
  refined theme/composition**.
- `H&H CONNECTOR` and a very long route name fit or clip inside the title slot
  without escaping the poster or overlapping other chrome.
- Manual `font_size_pt` renders the requested size and bypasses auto-fit.
- Final-print mode waits for text-fit-settled before `__RENDER_READY`; editor vs
  print size parity.
- Update the existing long-title stress test: internal clipping at min scale is
  acceptable; escaping bounds / overlapping chrome / changing map geometry fails.

Unit / contract:
- Every refined theme composition has title/subtitle/footer fit defaults.
- Per-composition / per-block `minScale` floors stay within sane bounds.

## First moves

1. Build the shared `fitTextToBox(el, box, { targetSizeCqh, minScale, maxLines,
   overflow })` helper (new — do NOT repurpose the Moveable resize code at
   `MapPreview.vue:4249`).
2. Phase 1 across all chrome slots (the grid already bounds every cell), behind
   the block fit config; verify the H&H Connector title repro first as the proof.
3. Land the long-title geometry-stability test as the regression guard before any
   visual tuning.

## Amendment — word-break policy for title-kind slots (editor-v2 D2, June 12, 2026)

The Phase 1 fit measured wrapped text but left `overflow-wrap: anywhere` on
title nodes, so a large display title could break MID-WORD ("KICKAPO/O" on
modernist at 175pt): under anywhere-wrap the width never overflows scrollWidth,
so the fitter saw nothing to shrink — and a manual `font_size_pt` bypasses the
fitter entirely while the CSS still mid-word-breaks.

Fix, behind `FLAGS.EDITOR_V2` (it changes fitted/print output, so it is
flag-gated rather than fit-path-only):

- Title-kind slots carry `data-poster-fit-mode="shrink-before-wrap"`. Matching
  styling pins `overflow-wrap: normal` + `word-break: keep-all` + `hyphens:
  manual` (chrome-grid blocks via an attribute CSS rule; the legacy direct
  `<h1>` via `trailNameStyle`). Mid-word breaks become impossible at ANY size,
  including manual `font_size_pt` takeover — oversized manual titles wrap at
  word boundaries and clip instead of splitting words.
- `fitTextToBox` gains `fitMode: 'shrink-before-wrap'`: Stage A pins
  `white-space: nowrap` (restored after) and searches [floor, target] for the
  largest single-line fit — shrinking is preferred over wrapping. Only when
  even the floor cannot hold one line does Stage B run the legacy wrap search,
  which under keep-all wraps at word boundaries only. A single very-long word
  shrinks to the floor then clips (unchanged plan posture). Default 'wrap'
  mode is byte-identical to the original algorithm.
- The legacy direct trail-name `<h1>` (the print render path and the non-grid
  editor view) now participates in the fit engine flag-on: it carries the
  data-poster-fit attributes with the title-kind policy and consumes
  `--poster-fit-font-size`, so editor, proof, and final print agree. Print
  readiness already waits on text-fit-settled. Its fit box is self-measured
  (the node is width:100% of the band content box; the band rect would
  overstate width by the band padding). Flag-off the attributes are absent and
  the anywhere-wrap styling is byte-identical.
- Fixtures pinned in `tests/text-fit.test.ts` with a measured layout model:
  "KICKAPOO" (single word: shrink, never split), "H&H Connector" (short
  multi-word: single line preferred over wrap), "Yosemite Valley Loop Trail
  via Mirror Lake" (long multi-word: may wrap at word boundaries within
  maxLines), and a single very-long-word floor-then-clip case.
- Compositions that force the title size via `!important` CSS (riso-stack,
  place-frame, transit-diagram) self-cap; the fitter measures at the forced
  size and is effectively a no-op there — they already declare their own
  wrap policy.
