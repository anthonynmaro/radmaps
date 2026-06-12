# Claude Code Handoff — RadMaps editor-v2 + launch queue

Date: 2026-06-12. Author: Fable (Cowork orchestrator). Read this first, then `HANDOFF.md` (worktree root — the full decision log), then the specs it references. Work happens in **this worktree** (`apps/trailmaps/editor-v2`, branch `fable/editor-v2`). The sibling `trailmaps-app/` checkout is the Codex lane — never run two agents in one tree (we lost files to that once).

## Operating rules (non-negotiable, inherited from the epic)

1. One commit per logical piece. Per-commit gates: `npx vue-tsc --noEmit` clean · `npm run test:style-graph` (315) · `tests/theme-resolution-snapshot.test.ts` **byte-identical** (it is the flag-off law; regen ONLY with `UPDATE_THEME_RESOLUTION_SNAPSHOT=1` and only with an intended, declared reason) · suites relevant to the step.
2. Everything user-visible behind `FLAGS.EDITOR_V2`. Flag off = byte-identical renders.
3. No DOM overlays over the map for anything that must print; map effects only via StyleConfig → buildMapStyle. Editor chrome (selection rings, dividers, toolbars) never mounts on render pages.
4. Print contract is sacred: 2:3 lock, `getPrintFraming` for all dimensions, 300dpi at 24x36, editor == proof == final.
5. New controls register in styleLayerGraph capabilities — no hardcoded preset checks.
6. **Verify in the browser, not just in tests.** Run `npm run dev` and actually click the thing. Two of this epic's worst bugs (selection behind a buried toggle; divider hit-zone shadowing) shipped with green tests and failed first human click.
7. Update docs with every step: `docs/EDITOR_UX_NORTH_STAR.md` STATUS, `docs/POSTER_CONTENT_EDITOR.md`, and append progress to `HANDOFF.md`.

## Current state (verified)

Branch `fable/editor-v2`, ~39 commits ahead of main, **unpushed**. Live-verified working (flag-on): modeless click-to-edit (click selects, drag pans — segments/route/title all produce the unified ElementToolbar), segments v2 (rename/recolor/width/dash/split/delete), theme switches preserve user work + undo toast, double-title fixed, titles never break mid-word. D2 band-divider drag is code-complete (62 tests) but **blocked by one bug** (below). The `rm_id` atlas pipeline stage is ready and untested against a real region build.

## Work queue, in order

### 1. D2 close-out: divider hit-zone bug (small, do first)
Dragging the divider pill selects the title slot instead — the slot's clickable area shadows the 14px divider strip (title-bottom compositions, e.g. modernist). Fix: capture-phase pointerdown priority / z-order for `band-divider`, and slot hit boxes must not extend into the strip. Then browser-verify the actual drag on modernist AND a title-top theme, confirm clamps (band 8–34%, map ≥40%) and live text refit. DoD: gesture works by hand, gates green.

### 2. D3: + Add menu
Per `docs/CODEX_GTM_PROMPTS.md` Prompt D step 3 and north-star gesture 4: one + button → Text / Stat (data-bound picker from the theme data contract — distance, gain, date, coords; no fabricated values insertable) / Icon / Image. Drops centered over the map, selected, toolbar open. **Image + icon overlays adopt the unified grammar here** (deliberately excluded from D1). Reuse the Tier-2 overlay plumbing (it already has snap guides + print guards).

### 3. D4: empty-space properties + StylePanel → Advanced drawer
Click empty band space → background color, padding, per-band reset-to-template; click map background → Advanced drawer. THEN the panel demotion per `docs/STYLE_SYSTEM_EVOLUTION.md` §disposition: map-style sections into the drawer (graph gating intact), poster-chrome controls retired to the contextual toolbars, segments section slims (map is primary). Includes the dead-code sweep: `FreezeControl.vue`, `_startChromeBandResize`, and an on-canvas viewpoint affordance replacing the buried card. Mobile keeps the bottom sheet.
DoD: the north-star acceptance demo as a Playwright spec (edit text, drag divider, add a photo over the map, recolor a band, reset an element, order a proof — zero panel opens).

### 4. Print-fit completion (queued bug, high print-quality value)
D2 discovered the print path historically had NO text fitting (the fit engine ran only on editor-mode chrome blocks). Titles are fixed flag-on; extend the same fit policy to subtitle/stats/coords on the legacy/print path. Use the D2 piece-3 pattern (`data-poster-fit-mode`, per-kind policies).

### 5. Ship mechanics (Claude Code CAN do these — they were waiting on Anthony only for lack of machine access)
- `git push origin fable/editor-v2`, open the PR (`gh pr create`), watch CI.
- **Goldens job will fail on platform fonts** (baselines captured on macOS, runner is Linux). Use the job's uploaded artifact: download (`gh run download`), build the contact sheet, get Anthony's eyeball-approval in chat, then commit those renders as the CI baseline (separate commit, declared). macOS-local diff stays the advisory pre-push check.
- **Atlas runs for E5**: `gh workflow run atlas-build.yml -f region=driftless-lab -f environment=staging -f stage=all` (feature-ids stage runs automatically). Re-run ~a week later on a newer Geofabrik extract, then `npm run atlas:add-feature-ids -- --diff old.pmtiles new.pmtiles` — high id-overlap = E5 unblocked (label hide/rename per `docs/ATLAS_STABLE_FEATURE_IDS.md`).
- **Theme matrix generation**: `npm run dev` + `npm run themes:matrix` (~20–45 min, 108 renders) → contact sheets in `docs/theme_matrix/`. Present to Anthony for A/B/C grading (the grading itself is his taste, the generation isn't).
- Verify the Supabase migration + `is_public` backfill actually applied in prod (supabase CLI / dashboard; premade/shop maps must be flagged public or the shop 404s silently).

### 6. After the above
- E5: map_element_overrides (hide/rename labels) once the two atlas builds prove id stability — full consumption design is in `ATLAS_STABLE_FEATURE_IDS.md` §Consumption. Pin selection + per-elevation contour hide need no tiles and can ship sooner.
- Theme polish: `docs/THEME_BUILDING.md` workflow against Anthony's A/B/C grading; the 7 near-miss candidates are pre-seeded. Finite punch lists, hard stops — never an open-ended refinement loop (see THEME_REFINEMENT_FEEDBACK.md for why).
- Flag flip: recommend `editor_v2` on for Anthony first (beta), default-on only after the D4 acceptance spec passes in CI.

## Decisions parked on Anthony (surface, don't decide)
Consolidated from HANDOFF.md "ANTHONY TO BLESS": E1 sticky-field list; dark-sky low-contrast segment carryover; pin fields still theme-owned (recommend user-owned); watercolor vector-label selectability (one-line flip); E6a fresh-segments-are-sticky nuance; D2 judgment calls (single-line title preference, editorial-minimal flex change, usgs footer 5.05→8% snap); `stash@{0}` (half-done eyedropper color-picker WIP, unknown author — resurrect or drop); logo dual-storage migration plan (documented, deliberately not executed).

## Environment notes
- Worktree `.git` link is RELATIVE (`gitdir: ../trailmaps-app/.git/worktrees/editor-v2`) so both macOS and sandboxes resolve it; if a git op re-absolutizes it, restore.
- `node_modules` is symlinked to `../trailmaps-app/node_modules`; Linux native bindings were added there additively (harmless on macOS).
- Dev server: `npm run dev` from the worktree; flag UI at `/admin/flags` (the `editor_v2` row already exists, enabled in Anthony's local env).
