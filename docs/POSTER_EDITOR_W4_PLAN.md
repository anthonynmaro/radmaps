# W4 — Editor Tier 2 (Structured) Execution Plan

Date: June 8, 2026
Workstream **W4** in `docs/POSTER_PLATFORM_ROADMAP.md`. Builds on W0 (`AnchorFrame`),
W2 (text fit), and W3 (Tier 1 guided editor). **W4 is a product call** — how far to
open customization. This plan includes a scope dial; pick a tier before executing.

## What already exists (don't rebuild)

W3 deliberately left the free-form machinery built but **buried**:
- `utils/posterEditorElements.ts` — `createTextOverlay`, `createIconOverlay`,
  `addPosterEditorText/Icon`, `duplicatePosterEditorElement`; `TextOverlay` /
  `IconOverlay` models; `tests/poster-editor-elements.test.ts`.
- An overlay layer in `MapPreview.vue` (~L2055) + the `overlay-updated` toolbar path.
- `vue3-moveable` + `interactjs` already in deps for drag/resize.

So W4 is mostly **surface + align to the anchor model + add snapping/guides + print
guards**, not a from-scratch build.

## The one architectural rule (do not skip)

**Express every user-added/moved element as a free `AnchorFrame`** (`anchorTo:'map'`
or `'poster'`, `displacesMap:false`), not as a parallel free-pixel overlay system.
Unify the existing `TextOverlay`/`IconOverlay` machinery onto `AnchorFrame` so there
is ONE layout model. This is what keeps it print-safe, adaptive, and consistent with
W0/W2/W3. Two overlay systems = the bloat that started all this.

## Scope dial (pick one before executing)

- **W4-min (recommended start):** add/remove **text** and **image/logo** overlays as
  free anchors; **snap + guide marks**; **resizable bands** (drag dividers, clamped);
  z-order. Defer icons and band-internal grid editing.
- **W4-full:** W4-min + icon overlays, curated font picker per overlay, band/cell
  reorder, and richer alignment tools.
- **W4-max:** near-free placement (relaxed snapping). Highest risk to print quality +
  adaptivity; only behind strong guards and a deliberate decision.

Recommendation: ship **W4-min** behind a flag, validate with real users, then widen.

## Requirements

- **Free-anchor overlays:** insert text/image(/icon) as free `AnchorFrame`s; drag with
  **snapping** (to slot edges, centers, map box, other frames) and **guide marks**;
  resize within bounds; delete; z-order. Reuse `vue3-moveable` + `interactjs`.
- **Resizable regions:** drag header/footer/map dividers; band heights **clamped**
  (W0 rule); the map keeps a minimum area. A deliberate band-height edit may move the
  map (allowed, clamped); content/overlay edits never do.
- **Manual takeover (W2 model):** a user-added or user-moved overlay is user-shaped;
  it keeps its box and `font_size_pt`, bypassing auto-fit, but still **clips** within
  its box.
- **Print-safety guards (the part free editors get wrong):** enforce min font size,
  bleed-safe placement (no critical content in trim/bleed), image **min DPI** for
  24×36, and label/background contrast. Block or warn on violations at edit time;
  hard-guard at render.
- **Flagging:** behind a Tier-2 flag distinct from Tier-1 (e.g. `FLAGS.POSTER_TIER2`
  or a level on the existing flags). Tier 1 and default render unaffected.
- **Single renderer / parity:** `MapPreview.vue` only; editor == proof == print;
  golden parity for themes with Tier-2 off stays byte-stable; `markPrintRenderReady`
  still waits for fit + any added-overlay fit.

## Phasing

1. **Unify overlays onto `AnchorFrame`.** Adapt `posterEditorElements.ts` so
   user overlays are free anchors; persist via the sparse `anchors` field from W0.
   No UI yet; tests for the model + persistence round-trip.
2. **Surface add/move/resize with snapping + guides** (text + image/logo for W4-min),
   behind the Tier-2 flag. `vue3-moveable` snapping + alignment guides.
3. **Resizable bands/regions** (clamped dividers).
4. **Print guards** (min font, DPI, bleed, contrast) + z-order; edit-time warn +
   render-time hard guard.
5. **Tests + flag rollout:** snapping behavior, map-geometry invariant under free
   anchors, print-guard enforcement, Tier-1-off golden parity, overlay persistence.

## Tests / gates

- Map-geometry invariant holds for free-anchor add/move (content edits don't move
  `[data-testid="poster-map"]`).
- Print guards reject sub-DPI images / sub-min fonts / bleed violations.
- Snapping lands on slot/edge/center targets; guides render in editor only.
- Tier-1-off + default render golden parity byte-stable.
- Overlay persistence (`anchors`) round-trips; editor == proof == print.
- `npx vue-tsc` + `test:style-graph` + focused Playwright, per commit.

## Activation (same goal + check-in pattern as W0/W2/W3)

When you greenlight: I create `docs/W4_FEEDBACK.md` and retarget the periodic
reviewer to W4 (free-anchor/snapping correctness, print guards, no Tier-1 regression,
flag-gating, discipline). The goal prompt below is the hand-off.

## The goal / Codex prompt (paste this when ready)

> Execute W4 — Editor Tier 2 (Structured), scope **W4-min**, per
> `docs/POSTER_EDITOR_W4_PLAN.md`. Build on W0 (`AnchorFrame`), W2 (fit), W3 (guided
> editor). GOAL: surface add/remove **text + image/logo** overlays as **free
> `AnchorFrame`s** with **snapping + guide marks**, plus **resizable bands** (clamped),
> behind a Tier-2 feature flag. Reuse the existing buried machinery
> (`utils/posterEditorElements.ts`, `vue3-moveable`, `interactjs`) — do NOT build a
> second overlay system; unify user overlays onto `AnchorFrame`.
>
> HARD RULES: `MapPreview.vue` is the only renderer; editor == proof == print; Tier 1
> + default render (Tier-2 flag off) must stay byte-stable (golden parity). Content/
> overlay edits never move the map; only deliberate clamped band-height edits may.
> User-added/moved overlays are user-shaped (W2 takeover: keep box + `font_size_pt`,
> still clip). Enforce print guards: min font size, image min DPI for 24×36, bleed-safe
> placement, label/background contrast — warn at edit time, hard-guard at render.
>
> PHASES: (1) unify overlays onto `AnchorFrame` + persistence (no UI, tests); (2)
> surface add/move/resize text+image/logo with snapping + guides behind the Tier-2
> flag; (3) resizable bands (clamped dividers); (4) print guards + z-order; (5) tests +
> flag rollout. STOP at W4-min — do not build icons / W4-full / W4-max without a human
> go.
>
> GATES per commit: `npx vue-tsc --noEmit --pretty false`, `npm run test:style-graph`,
> focused Playwright, golden parity (Tier-2 off). One isolated commit at a time; clean
> worktree; never proceed on red. A Claude review writes verdicts to `docs/W4_FEEDBACK.md`
> — read its newest entries before continuing and resolve anything flagged. Write
> editor + print renders (incl. an overlay-added fixture and a sub-DPI/over-bleed
> negative case) to `docs/theme_audit_output/`. DONE: W4-min overlays + snapping +
> resizable bands ship behind the flag, print guards enforced, no Tier-1/default
> regression, tests green.
