# Theme Refinement v3 — Get to Parity (overnight)

Date: June 9, 2026
Goal: bring all 27 refined themes to real parity with the design targets in
`docs/theme_screenshots/`, on every axis — **layout, colors, font sizing,
font-family, contour density (DEM-rendered, adaptive), and artifact cleanup** —
tested live on the dev site and validated as print renders. Anchor verification on
the **design targets**, not on a moving golden baseline.

## Principles (decide every call by these)

- **Targets are truth.** Match `docs/theme_screenshots/<name>.png` per theme. The
  semantic/style contract is the encoding; the screenshot is the arbiter.
- **DEM contours, NOT tiles.** Map terrain comes from the **DEM renderer**
  (`maplibre-contour` from terrain DEM), styled per theme as contour lines — never
  a raw hillshade dump and never dependent on Atlas vector tiles. The current "dark
  relief" maps are the raw DEM hillshade with no contour styling applied; that is a
  bug to fix, not a capture artifact.
- **Adaptive contour density (inverse to relief).** See spec below — flat/low-relief
  areas get **dense** contours (so the map isn't empty); high-relief/mountain areas
  get **sparser** contours (so it isn't a solid black tangle).
- **Authored title sizes.** Restore the hand-tuned per-theme display sizes; auto-fit
  scales **down only on overflow**, never shrinks a title that fits.
- **No fabricated artifacts.** Remove any overlay/mark/item Codex invented that is
  NOT in the target (this regressed before — re-enforce it). Theme character comes
  from palette, typography, layout, motif (only motifs that are in the target), and
  the styled map — nothing pasted on.
- **Print-validated.** Every theme must render clean at 24×36 print geometry and
  correct DPI, no blank fills, no overflow, parity with the target.

## Phase 1 — Foundation fixes (do first; refinement on a broken base is wasted)

1. **Title autosizing.** Fit target = each theme's authored title size; scale down
   ONLY when the text overflows its box; never below the per-block floor; never
   shrink a title that fits. (Restores WONDERLAND filling the bold-modern band,
   BOSTON monumental on brutalist, etc.) Either revert the W2 commits
   (`fc1644d`/`c89b2a3`/`caa2db7`) and redo, or fix-forward — but the behavior above
   is the spec.
2. **Three render failures:**
   - `transit-diagram` renders blank (no chrome/theme) — it's erroring during render;
     find and fix.
   - `cartouche-place` drops the "MÉXICO" title line (overflow deleting content) —
     fit must wrap/scale, not drop lines.
   - `contour-wash` print map renders blank/white (fill missing; editor shows
     texture) — print/editor parity break.
3. **DEM contour renderer + adaptive density** (see spec) — replace the raw
   hillshade with styled, adaptive DEM contours per theme.
4. **Artifact audit** — list every element each theme renders that is NOT in its
   target; remove the fabricated ones.

## Adaptive contour density spec (the novel piece)

Goal: a roughly consistent visual contour density across any location, by varying
the contour interval with local relief.

- Source: the **DEM** (terrain-RGB) via `maplibre-contour` — compute contours from
  elevation, not from tiles.
- Measure the map extent's **relief** (max−min elevation, or stddev) from the DEM.
- Set the contour **interval inversely** to relief:
  - **Low relief** (urban/POI/flat, small elevation range) → **small interval**
    (dense contours, near max density) so the field reads as a map, not empty paper.
  - **High relief** (mountains, large range) → **large interval** (sparse contours)
    so it reads as clean lines, not a black mass.
  - Target a stable on-screen line count band regardless of terrain.
- Per theme, style the resulting contours (color, weight, opacity, index-contour
  emphasis, interval bounds) via the existing `contour_*` tokens; keep print-legible.
- Keep `relief-shaded` as the one theme that intentionally shows shaded terrain.
- **Flat routes have no contour signal — do NOT fabricate it.** Where relief is
  near-zero (Boston, Chicago), the adaptive contours come out empty; that is
  correct, not a bug to fill with invented geometry. These routes default to a
  non-contour base layer (themed streets or route-only) via the **base-layer
  quick-pick** — see `docs/BASE_LAYER_QUICKPICK_SPEC.md`. Reuse this same relief
  measure to pick the quick-pick's default (low relief → Streets/Minimal).

## Phase 2 — Per-theme parity (all 27)

For each theme, drive to parity vs its target on every axis, one theme per commit:
- **Layout** — bands, title/footer position, map ratio, framing, motif placement.
- **Colors** — paper/field, route, contour, accents (sample the target pixels).
- **Font sizing** — authored display sizes (Phase 1 makes this hold).
- **Font-family** — title/body faces per target (self-hosted; confirm IBM Plex Mono
  etc. resolve).
- **Contour density** — adaptive DEM contours read like the target's map character.
- **No fabricated artifacts** — only what's in the target.

## Verification (required)

- **Dev site, live:** run the dev server; confirm each theme renders correctly in the
  live editor (the real product path, with the DEM renderer working).
- **Print validation:** capture all 27 at print geometry (24×36, correct DPI) with
  the DEM contours actually rendering; confirm no blank fills, no overflow, parity
  with the target. Capture editor geometry too (editor == print).
- Renders to `docs/theme_audit_output/poster-themes/{editor,print}/`.
- Gates per commit: `npx vue-tsc --noEmit --pretty false`, `npm run test:style-graph`,
  focused Playwright.

## Check-in loop (overnight)

Codex refines a theme → regenerates its editor+print render (DEM renderer working)
→ commits. A Claude review compares each current render to the target across all
axes and writes a per-theme punch list (severity + layout/color/size/font/contour/
artifact) to `docs/THEME_REFINEMENT_FEEDBACK.md`. Codex reads it before continuing
and resolves BROKEN first. Repeat until 27/27 read like their targets at editor and
print geometry.

## The goal / Codex prompt (Anthony to edit, then hand off)

> Bring all 27 refined themes to parity with the design targets in
> `docs/theme_screenshots/`, refining layout, colors, font sizing, font-family,
> contour density, and removing fabricated artifacts — per
> `docs/THEME_REFINEMENT_V3_PLAN.md`. Verify live on the dev site AND validate print
> renders.
>
> PHASE 1 (foundation, first): (a) fix title autosizing — fit target = each theme's
> AUTHORED title size, scale DOWN only on overflow, never shrink a title that fits,
> never below the per-block floor (restore the hand-tuned display sizes; revert the
> W2 text-fit commits and redo if cleaner); (b) fix the three render failures —
> transit-diagram blank/erroring, cartouche-place dropping the "MÉXICO" title line,
> contour-wash blank print map; (c) MAP = DEM CONTOURS, NOT TILES: render terrain as
> styled DEM contour lines via maplibre-contour (not a raw hillshade, not Atlas
> tiles), with ADAPTIVE DENSITY — contour interval inversely proportional to local
> relief (low/flat → dense/maxed contours so the map isn't empty; high mountains →
> sparser so it isn't a black mass; aim for a stable on-screen line count), styled
> per theme via the contour tokens; keep relief-shaded as the intentional shaded
> terrain; (d) audit every theme and REMOVE any overlay/mark/item not present in its
> target — no fabricated artifacts.
>
> PHASE 2: drive each theme to parity vs its target — layout, colors (sample target
> pixels), authored font sizes, font-family, adaptive contour density, no invented
> elements. One theme per commit.
>
> VERIFY: run the dev server and confirm each theme live; capture all 27 at editor
> AND print (24×36, correct DPI) with the DEM contours actually rendering, to
> docs/theme_audit_output/poster-themes/{editor,print}/; confirm no blank fills, no
> overflow, parity with targets, editor==print. Gates green per commit (npx vue-tsc
> --noEmit --pretty false, npm run test:style-graph, focused Playwright); one isolated
> commit at a time; clean worktree; never proceed on red; MapPreview.vue the only
> renderer; no fabricated data on real posters.
>
> A Claude review compares each regenerated render to the target across all axes and
> writes per-theme punch lists to docs/THEME_REFINEMENT_FEEDBACK.md — read the newest
> entries before continuing each theme and resolve BROKEN items first. Done = 27/27
> read like their targets at editor and print geometry, print-validated, with no
> fabricated artifacts.
