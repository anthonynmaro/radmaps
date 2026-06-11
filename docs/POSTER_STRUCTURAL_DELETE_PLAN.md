# W3.5 — Structural Delete / Remove Plan

Date: June 8, 2026
Workstream **W3.5** in `docs/POSTER_PLATFORM_ROADMAP.md`. Closes the original
chrome-editor pain: **any element in the poster chrome must be removable** — not
just text content, but the structural cell, its divider, and grouped blocks (e.g.
the footer Strava-metrics row). Sequenced **before W4** (higher priority, lower
risk, mostly surfaces existing machinery).

## The problem (your words)

"We could delete text, but that didn't change layout or delete dividers in areas
like footer Strava metrics." Blanking a cell's text leaves the empty cell + its
divider; the structural element survives. True deletion must remove the element,
drop dividers tied to it, and reflow — and not reappear from theme defaults.

## What already exists (surface, don't rebuild)

The anchor model already carries structural-delete machinery:
- `deleted?: boolean` tombstones on `AnchorFrame`, `ChromeGridCell`, `ChromeGridRow`
  (`types/index.ts:269/295/302/370`).
- `effectivePosterLayout` filters deleted anchors/cells/rows
  (`utils/posterLayout.ts:591/618/642`).
- `deleteDraftBlock` / `removeBlockFromDraft` in `utils/posterLayoutDraft.ts`.

What's missing: the editor never **surfaces** delete (the W3 allowlist
`posterEditorAllowlist.ts` is text-slot only), reflow/divider-removal isn't
guaranteed correct, and there's no map-geometry-safe rule or restore path.

## Goal

Make **every chrome element selectable and removable** through the editor, with
correct reflow, divider removal, tombstone persistence, a map-geometry-safe rule,
and restore — gated behind a flag, on the anchor model.

## Scope of "every chrome element"

Removable: text slots, **stat/metric cells** (incl. each Strava footer metric),
**dividers** (`poster-footer-rule` and band/cell rules), **spacers**, and
**grouped blocks** (delete the whole footer metrics row in one action, or an
individual cell). Theme-owned and user-added alike.

## Requirements

- **Delete = tombstone, not blank.** Removing an element sets `deleted: true` in
  the sparse `poster_layout` (reuse the existing filter path) so it does not
  reappear from theme defaults.
- **Dividers follow their cell.** A divider tied to a removed cell/row is removed
  with it — fixes the "divider stayed" bug. Dividers between two cells re-resolve
  when one side is deleted.
- **Reflow.** Remaining cells in the row/band expand to fill; an emptied row
  collapses out; band keeps a sensible minimum.
- **Map-geometry rule (W0/W2 invariant).** Deleting cells reflows **within** the
  band — the `[data-testid="poster-map"]` rect must not move. Only a deliberate,
  clamped band-height change may grow the map. Decide the empty-band case: a band
  with all content removed holds a minimum height by default (map stable); fully
  collapsing a band is a separate, explicit band-resize action.
- **Restore / undo.** Deletion is reversible — un-tombstone restores the theme
  default. Surface an undo and/or a "restore removed element" affordance.
- **Selection.** Any structural element (not just text) is selectable for delete:
  cell, row, divider, group. Add the delete affordance to the editor selection UI.
- **Flag + scope.** Gate behind the editor flag; this is guided structural editing,
  distinct from W4 free overlays. No free placement, no print-DPI concerns here.

## Phasing

1. **Model correctness.** Verify/extend `deleteDraftBlock` + tombstone merge so
   deleting a cell removes its divider and reflows siblings; an emptied row
   collapses; tombstones round-trip in sparse `poster_layout`. Unit tests first.
2. **Map-geometry-safe reflow.** Ensure band content reflow never moves the map;
   band keeps a min height; only explicit clamped band-resize moves it. Test.
3. **Surface delete in the editor.** Make structural elements selectable; add a
   delete control + restore/undo; gate behind the flag.
4. **Group delete.** Delete a whole metrics row/group in one action.
5. **Tests + renders.** Browser tests + a footer-metrics delete render to
   `docs/theme_audit_output/`.

## Tests / gates

- Delete a footer stat cell → the cell **and its divider** are gone, siblings
  reflow, and `[data-testid="poster-map"]` rect is unchanged.
- Deleted element does **not** reappear after reload / theme re-resolve (tombstone
  persists in sparse `poster_layout`).
- Restore/undo brings the theme default back.
- Delete the whole Strava-metrics group in one action; band holds min height; map
  stable.
- Default render (flag off) + untouched themes stay byte-stable (golden parity).
- `npx vue-tsc` + `test:style-graph` + focused Playwright, per commit.

## The goal / Codex prompt (paste this)

> Execute W3.5 — structural delete/remove — per `docs/POSTER_STRUCTURAL_DELETE_PLAN.md`.
> GOAL: make **every** poster chrome element removable through the editor — text
> slots, stat/metric cells, dividers, spacers, and grouped blocks (e.g. the whole
> footer Strava-metrics row) — with correct reflow, divider removal, tombstone
> persistence, restore/undo, and the map-geometry invariant. SURFACE the existing
> machinery (don't rebuild): `deleted` tombstones on `AnchorFrame`/`ChromeGridCell`/
> `ChromeGridRow`, `effectivePosterLayout`'s deleted-filter, and
> `deleteDraftBlock`/`removeBlockFromDraft`.
>
> RULES: delete = tombstone in sparse `poster_layout` (must NOT reappear from theme
> defaults); a divider tied to a removed cell is removed with it; remaining cells
> reflow and emptied rows collapse; deleting content reflows WITHIN the band and
> never moves `[data-testid="poster-map"]` — only a deliberate clamped band-height
> edit may; deletion is reversible (un-tombstone restores the default). Gate behind
> the editor flag; `MapPreview.vue` stays the only renderer; no DB migration (state
> stays in `StyleConfig.poster_layout`).
>
> PHASES: (1) model correctness — deleting a cell removes its divider + reflows,
> emptied rows collapse, tombstones round-trip (unit tests first); (2) map-geometry-
> safe reflow (band min-height; map invariant); (3) surface select + delete +
> restore/undo in the editor, flag-gated; (4) group delete (whole metrics row);
> (5) tests + a footer-metrics delete render to `docs/theme_audit_output/`.
>
> GATES per commit: `npx vue-tsc --noEmit --pretty false`, `npm run test:style-graph`,
> focused Playwright, golden parity (flag off / untouched themes byte-stable). One
> isolated commit at a time; clean worktree; never proceed on red. A Claude review
> writes to `docs/W3_5_FEEDBACK.md` — read its newest entries before continuing and
> resolve anything flagged. DONE: any chrome element (incl. dividers + the Strava
> metrics group) is deletable with correct reflow, tombstone persistence, restore,
> and a stable map rect; flag-off parity green.
