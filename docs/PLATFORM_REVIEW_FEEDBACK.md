# Poster Platform — Claude Review Feedback (rolling)

Written by Claude's periodic review automation and **read by Codex** during the
autonomous run of the remaining roadmap (`docs/POSTER_PLATFORM_ROADMAP.md` →
"Autonomous execution goal"). Covers **Track A (theme cleanup)** and **Track B
(W3 Tier 1 editor)**.

How it works:
- Codex lands a change, runs gates, writes affected renders to
  `docs/theme_audit_output/`, commits, notes progress.
- Each run, Claude reviews the active track's commits and appends a timestamped
  verdict below.
- **Codex: before continuing, read the newest entries and resolve anything marked
  `CHANGES REQUESTED` / `REGRESSION` first. Do not start W4; pause when W3 is done.**

Verdict legend: `LGTM` · `CHANGES REQUESTED` · `REGRESSION` · `BLOCKED-CONFIRMED`.

What the review checks per track:

**Track A — theme cleanup (vision):** compare the live render to the target in
`docs/theme_screenshots/`. (1) `contour-wash` reads as crisp concentric contour
lines (not a mottled wash) with a visible thin dark echo route + top eyebrow;
(2) `sea-chart` compass rose is magenta; (3) `copper-night` stars read warm copper.
No other theme should change (Round-2 notes pending).

**Track B — W3 Tier 1 editor:**
- **No theme regression:** golden parity for untouched themes stays byte-stable;
  the editor is behind `FLAGS.POSTER_*` and default render is unchanged.
- **Editable allowlist:** only allowlisted controls are exposed; no
  visible-but-dead controls; locked tokens stay theme-owned.
- **On the anchor + fit model:** nudge/resize operate within a slot's `AnchorFrame`
  box; manual edits honored; map geometry invariant holds.
- **Puck/React removed:** `@puckeditor/core`, `react`, `react-dom` gone from
  package.json; `puckSpike`/`layoutSpike` fixtures retired.
- **Print-safe:** editor == proof == print; `MapPreview.vue` still the only renderer.
- **Discipline:** isolated commits; gates green; W3 work separate from pre-existing
  dirty files.

---

<!-- Claude appends review passes below this line, newest at the bottom. -->

## 2026-06-08 22:02 UTC (17:02 CDT) — first PLATFORM_REVIEW pass — TRACK A (3 refinements)

Reviewed the three newest commits, which map exactly to the Track A punch list:
`6b97bf2 refined(contour-wash)`, `dd9095f refined(sea-chart)`,
`e5d1e64 refined(copper-night)`. Net: **3 LGTM.** Verified all three changes are
correctly theme-scoped and confirmed no other theme changed. Parity report
(2026-06-08T21:38) audited only these three; all show `visual review: pending`
(expected — that flag is set by this review). No Track B / W4 work in this batch.

### Scope check — clean, no bleed
All three diffs touch only their own theme:
- `contour-wash`: `utils/themes/refined.ts` edits are inside the contour-wash recipe
  only; `utils/mapStyle.ts` dark-echo layer is gated behind `isContourWashRoute`;
  `utils/posterLayout.ts` adds the header-decor eyebrow via an explicit
  `color_theme === 'contour-wash'` guard.
- `sea-chart`: single `.sea-chart-rose` rule (compass tint) — scoped.
- `copper-night`: every changed selector is `[data-theme="copper-night"]`. The
  dark-sky star-field block (`MapPreview.vue` 10105–10141) is a separate selector
  and is untouched → **no dark-sky regression.** Confirmed.

### contour-wash — LGTM
The mottled-wash field is gone — it now reads as fine concentric **contour lines**
(`contour_detail 5→2`, minor width 1.32→0.54, opacity 0.48→0.36). The thin dark
**echo route** is present (the new `route-line-contour-wash-dark-echo` layer:
label-text color, width −3.7, ~0.46 opacity, offset translate). The top
`ITALIA · 46.6186°N` eyebrow now renders (header-decor guard). TRE CIME slab +
`DOLOMITI, ITALIA` caption read correctly. Matches the target's intent. Minor only
(not blocking): the contour lines read a touch busier/swirlier than the target's
very clean concentric rings — optional small density trim if you want a closer match.

### sea-chart — LGTM
Compass rose is now the **magenta accent** (`color: var(--route-color, #a6245d)` +
subtle drop-shadow) — exactly the lone open item from the 2026-06-07 16:00 note.
Magenta dotted course, soundings, `CHART NO. 1 · SCOTLAND` eyebrow, `The Cobbler`
title, and pale mint field all still read. No regression on the rest of the chart.

### copper-night — LGTM
The star field finally lands **and** reads **warm copper** (star-field +
constellation colors re-mixed toward `--route-color` at 68–78%, star density
tightened 13–23cqw→4–7cqw, opacity →1). Constellation, `Tre Cime` title up in the
sky, eyebrow, soft copper route low in the frame, and `Dolomiti, Italia / 10.5 km ·
JUL 2025` footer all present. Reads like the target. Minor only (not blocking):
field carries slightly more contour-swirl texture than the target's cleaner dark
sky, and the starfield is a hair denser — optional polish, not required.

### W4 guard
No Tier 2 / overlay / free-anchor drag-snap work in these commits. Track A only.
Codex remains correctly stopped before W4.

## 2026-06-08 23:02 UTC (18:02 CDT) — second PLATFORM_REVIEW pass — TRACK B (W3 Tier 1 editor)

Two new commits since the last pass: `a4a873d editor: ship guided poster slot
editing` and `d28ab66 editor: keep guided poster editing slot-only`. These are the
W3 Tier 1 editor. Net: **6 LGTM + 1 NOTE (latent W4 surface to keep buried).** No
regression. Gates not run locally (sandbox `node_modules/rollup` native binary
missing → vitest/vue-tsc both abort with MODULE_NOT_FOUND); this is a static review
— **Codex must confirm CI gates green.**

**Read the d28ab66 story first.** `a4a873d` shipped the editor but still surfaced
free-form text/image/icon tools + free drag (`poster-tool-text/image/icon`, "Upload
logo", "Icons", a draggable `text:` element). `d28ab66` correctly walks all of that
back to **slot-only** editing. The final tree is Tier-1 compliant; just be aware the
intermediate commit briefly exposed W4-flavored tooling.

### No theme regression — LGTM
Editor is gated behind `FLAGS.POSTER_ELEMENTS_EDITOR` / `FLAGS.POSTER_TEMPLATE_EDITOR`
(`MapEditorSurface.vue:365-366`, defined `utils/knownFlags.ts:4-5`), so default render
is unchanged with flags off. Neither commit touches any theme recipe
(`utils/themes/*`, `mapStyle.ts`, `posterLayout.ts`) — only editor/preview/panel/
tests/utils. Couldn't byte-compare goldens here (gates didn't run), but there is no
theme-file delta to regress. Confirm golden parity in CI.

### Editable allowlist — LGTM
`utils/posterEditorAllowlist.ts` exposes only `TIER1_TEXT_SLOTS` plus slots derived
from `theme.editable_fields`, plus pin labels conditioned on `show_*_pin`. `d28ab66`
removes the free-form add-tools, so no visible-but-dead controls: the spec now
asserts `text:` / `asset:` / `icon:` elements all `toHaveCount(0)` and the
`poster-tool-*` buttons / "Upload logo" / "Icons" all gone
(`style-browser.spec.ts` editor tests). Moveable handles within a slot = 8 (was 9).

### Anchor + fit model / map invariant — LGTM
`style-browser.spec.ts:1273` "keeps the map rect stable for content and free-anchor
edits": a long `trail_name` text override leaves `poster-map` rect `toEqual(initial)`,
and a `displacesMap:false` free anchor likewise doesn't move it. Map-geometry
invariant holds; nudge/resize stay inside the slot's box.

### Puck/React removed — LGTM
`package.json` clean — no `@puckeditor/core`, `react`, or `react-dom`. Spike files
deleted (`PuckPosterSpike.client.vue`, `PosterLayoutSpike.vue`, `puckPosterSpike.ts`,
`puck-poster-spike.test.ts`); no `puckSpike`/`layoutSpike` refs remain in source.
Only residuals, both fine: a guard test asserting `puck-poster-spike` `toHaveCount(0)`
(good), and a stale untracked `.vercel/output/.../package.json` build artifact (ignore).

### Print-safe / single renderer — LGTM
`MapPreview.vue` remains the only renderer; the editor surface composes it rather than
forking a second path. No alternate renderer introduced.

### Discipline — LGTM
W3 landed in two isolated commits. The dirty working tree is pre-existing and
unrelated, and correctly kept OUT of the W3 commits: uncommitted `StylePanel.vue` /
`knownFlags.ts` edits are the separate theme-picker-step removal
(`THEME_PICKER_STEP` / `showThemeBrowser`); untracked `docs/ANCHOR_LAYOUT_MODEL_PLAN.md`
(W0 plan, Jun 7) and `docs/LAYOUT_EDITOR_OVERLAY_REVIEW.md` (compat review, Jun 7) are
planning docs, not W4 code.

### W4 guard — NOTE (not a blocker)
No Tier 2 UI ships in the final tree (d28ab66 ensured slot-only). **But** the
underlying free-form element machinery still lives in `utils/posterEditorElements.ts`
— `createTextOverlay`, `createIconOverlay`, `addPosterEditorText`,
`addPosterEditorIcon`, `duplicatePosterEditorElement`, plus the `TextOverlay` /
`IconOverlay` models and `tests/poster-editor-elements.test.ts`. It's allowlist-gated
and unsurfaced, so acceptable for W3. Keep it buried: do not wire any add-text /
add-image / add-icon / free-drag control back into the editor until a human gives the
W4 go. Stop at W4 as instructed.
