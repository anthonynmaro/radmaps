# Poster Platform Roadmap (master plan)

Date: June 7, 2026
This is the single ordered plan that ties together theme parity, text auto-fit,
the layout model, and the poster editor tiers. It is the source of truth for
sequencing; the linked docs hold the detail.

## Non-negotiables (decide every trade-off by these, in order)

1. **The product is a printed map, excellent to 24×36".** WYSIWYG print parity is
   sacred: `MapPreview.vue` → AWS renderer screenshot → Gelato is the only render
   path and the print file. Never broken; no second renderer; no raw-HTML export.
2. **Hero value = opinionated, adaptive design.** Quick workflow + themes
   auto-compose a stunning poster from route/location/title. Most users never open
   a layout tool.
3. **Customization is real but constrained.** Bounded, structured edits — not a
   blank canvas.

## Foundation: the anchor / constraint layout model

One layout model underlies everything (`docs/POSTER_EDITOR_STRATEGY.md`,
`docs/LAYOUT_EDITOR_OVERLAY_REVIEW.md`):

- Elements are **anchored frames** (anchor + offset + constraints + snapping),
  theme-owned defaults, per-theme **editable allowlist**.
- **Bands are edge-pinned, full-width anchors; over-map slots are free anchors.**
  Anchors **generalize** today's band/grid model — this is an evolution, not a
  rewrite. Existing compositions become the default anchor preset.
- Positions are **data MapPreview reproduces** → print-safe and adaptive (relative
  positions + auto-fit reflow for new content). Manual takeover pins an element
  absolutely (opting out of adaptivity for that element).
- Manipulation via Vue-native `vue3-moveable` + `interactjs`. **Drop Puck/React.**

## Impact on existing work

- **Render/print pipeline:** no impact.
- **Theme parity (style):** preserved (palette, route, map styling, typography,
  motifs, contracts, 27 themes). Composition *layout* defs recast band→anchor
  (mechanical); over-map themes get easier.
- **Chrome-grid editor:** grid-cell mechanics superseded/simplified (the troubled
  part); shell, selection, inline edit, persistence plumbing, moveable, tests carry
  over. Retarget, not delete.

## Workstreams & order

Dependency graph:

```
W1 Theme parity (STYLE)  ── independent, runs in parallel ──┐
                                                            │
W0 Anchor layout model ──► W2 Text auto-fit ──► W3 Editor Tier 1 ──► W4 Tier 2 ──► (W5 Tier 3, deferred)
```

`W1` is style-only and does **not** depend on the layout model — finish it in
parallel. `W0` is the gate for `W2`/`W3`/`W4`.

### W1 — Theme parity finish (style) — IN FLIGHT, ~26/27 done
- **Goal:** all 27 themes read like the Claude Design targets/spec.
- **Depends on:** nothing (style tokens, orthogonal to layout model).
- **State:** 26/27 LGTM; `contour-wash` open; minor nits (sea-chart compass
  magenta, copper-night star warmth); per-theme Round-2 notes pending.
- **Docs:** `THEME_PARITY_EXECUTION_PLAN.md`, `THEME_PARITY_FEEDBACK.md`,
  `THEME_FEEDBACK_ROUND2.md`.
- **Done:** 27/27 pass token contract + human review; nits closed.

### W0 — Anchor layout model + over-map audit (FOUNDATION) — ✅ DONE
- **Shipped (2026-06-08):** `AnchorFrame`/`AnchorBox` closed model, `bandsToAnchorFrames()`,
  free over-map anchors (place-frame/sea-chart/art-wash), `posterSlotAnchors.ts`
  audit, clamped band-height; golden parity 0px/54 PNGs; commits 4bc517a / a61e067
  / 0990b27. Unblocks W2 + W3.
- **Goal:** the anchor/constraint model (bands = edge-pinned anchors; over-map =
  free anchors), theme slots tagged, editable allowlist defined; editor can select
  an over-map slot without evicting it to a band.
- **Depends on:** nothing. Build first among the editor track.
- **Key files:** `utils/posterLayout.ts`, `utils/posterLayoutDraft.ts`,
  `utils/posterCompositions.ts`, `types/index.ts`. Evolve `poster_layout` to carry
  anchors with "band" as the default preset (no big-bang; legacy/default configs
  keep rendering).
- **Docs:** `LAYOUT_EDITOR_OVERLAY_REVIEW.md`, `POSTER_EDITOR_STRATEGY.md`.
- **Done:** every theme's slots expressed as anchors; band + over-map render
  identically to today via MapPreview; contract test asserts rendered anchor/slot
  matches the theme; no map-geometry change from any text slot.

### W2 — Text auto-fit & containment — ✅ DONE
- **Shipped (2026-06-08):** `utils/textFit.ts` measured `fitTextToBox`, fit-down +
  clip, inferred manual `font_size_pt` takeover, `textFitSettled` gates print.
  Commits fc1644d / c89b2a3 / caa2db7. Closes the two founding bugs (title overflow
  pushing the map; size not editable).
- **Goal:** measured fit-to-box (target→floor, clip), bounded slots, manual
  takeover; titles never push the map; manual size always wins.
- **Depends on:** W0 (fits within an anchor's box — band or over-map).
- **Docs:** `POSTER_TEXT_FIT_PLAN.md` (Phase 0 there == W0).
- **Done:** long title can't change map geometry; H&H Connector repro fixed;
  manual size honored; print readiness waits for fit.

### W3 — Editor Tier 1 (Light / Guided) — ✅ DONE (flag-gated)
- **Shipped (2026-06-08):** constrained guided editor on the anchor+fit model,
  `posterEditorAllowlist.ts` slot-only editing, `vue3-moveable` nudge/resize within
  slot boxes, behind `FLAGS.POSTER_*`. Puck/React removed; puckSpike/layoutSpike
  retired. Default render parity 0px/54 PNGs. Commits a4a873d / d28ab66.
- **Note:** free-form overlay machinery (`utils/posterEditorElements.ts`) still
  exists but is unsurfaced + allowlist-gated — keep buried until the W4 go.
- **Goal:** edit text content, colorway, layer allowlist, map framing, nudge/resize
  within a slot's anchor box. Remove Puck/React; retire grid-builder spikes.
- **Depends on:** W0 (+ W2 for safe sizing).
- **Key files:** `StylePanel.vue`, `FixedPosterTemplateEditor.vue` (retargeted to
  anchors), `MapEditorSurface.vue`.
- **Done:** Tier 1 controls work on the anchor model in editor==proof==print;
  Puck/React removed; spikes retired; behind feature flag for rollout.

### W3.5 — Structural delete/remove — ✅ DONE (`2faadee`)
- **Shipped (2026-06-08):** any chrome element removable (cells, dividers, whole
  footer Strava-metrics group) via `deleted` tombstones + `effectivePosterLayout`
  reflow; divider-follows-cell; last-row deletable; "Removed" restore list
  (`restoreSparseChromeTombstone`). Footer-metrics delete: map rect pixel-stable;
  golden parity 54/0. Closes the original chrome-editor pain.

### W3.5 — Structural delete/remove — plan: `docs/POSTER_STRUCTURAL_DELETE_PLAN.md`
- **Goal:** every chrome element removable (text slots, stat/metric cells,
  dividers, the whole Strava-metrics group) with reflow, divider removal, tombstone
  persistence, restore, and a stable map rect. Surfaces existing `deleted`-tombstone
  machinery (`effectivePosterLayout` filter, `deleteDraftBlock`) — mostly UI + reflow
  correctness, lower-risk than W4. Closes the original chrome-editor pain.
- **Depends on:** W0/W2/W3. **Sequence: before W4.**

### W4 — Editor Tier 2 (Structured) — ✅ W4-min DONE (`f83120d`); W4-full/max deferred
- **W4-min shipped (2026-06-08):** behind `FLAGS.POSTER_TIER2_EDITOR`; text +
  image/logo overlays as free `poster_layout.anchors`; snapping/guides + z-order;
  clamped band resize; `posterPrintGuards.ts` (min font/DPI/contrast/bleed) — editor
  warnings + render hard-guard. Flag-off golden parity 54/0; negative fixture
  rejected. No icons/font-library/reorder/free-form (W4-full/max remain a product
  call). Plan: `docs/POSTER_EDITOR_W4_PLAN.md`.
- **Goal:** add/remove text & image/logo overlays; reposition with snap guides
  (incl. over-map free anchors); resize regions/bands; curated fonts; z-order.
- **Depends on:** W3 + the anchor model proven in production.
- **Done:** drag/resize/snap on anchors, print-safe with guards (min font, bleed,
  DPI, contrast) and print smoke tests.

### Theme Data Contract — PLANNED (after regression triage); plan: `docs/THEME_DATA_CONTRACT_PLAN.md`
- **Goal:** each theme declares per element what data populates it (gpx/location/
  derived), what to **remove** when absent (POI with no elevation → drop profile/
  splits/gain, reflow via W3.5 tombstones), what to **derive** from location
  metadata (region/elevation/coords via Mapbox geocode), and what may use
  **placeholder** (preview-only — orders never show fabricated data). Foundational
  for POI/place/city map product lines. **Sequence: after the regression triage.**

### W5 — Editor Tier 3 (Free-form) — deferred product bet
- Separate opt-in "Pro" surface on the same anchor model with strong print guards.
  Only if clear demand; never the default path.

## Recommended execution order

1. **W1 finishes in parallel** (it's nearly done and independent).
2. **W0 anchor model** — the foundation; build it anchor-based now.
3. **W2 text auto-fit** on the anchor model.
4. **W3 Tier 1 editor** on the anchor model; drop Puck/React; retire spikes.
5. **Evaluate W4 Tier 2** against real usage; build on the same model.
6. **W5 Tier 3** only as a later, opt-in bet.

## Autonomous execution goal (hand to Codex)

Status: W0 ✅ and W2 ✅ done. Remaining unattended scope = **theme-parity cleanup
(Track A)** + **W3 Tier 1 editor (Track B)**. **Stop before W4** (Tier 2 needs a
human product decision). Review loop writes to `docs/PLATFORM_REVIEW_FEEDBACK.md`.

### The goal / Codex prompt (paste this)

> Work the remaining RadMaps poster roadmap autonomously, per
> `docs/POSTER_PLATFORM_ROADMAP.md`. Two tracks; commit one logical change at a
> time; keep your work isolated from the pre-existing unrelated dirty files
> (auth/oauth, theme picker, knownFlags). `MapPreview.vue` stays the only renderer;
> no DB migration; editor == proof == print.
>
> TRACK A — theme-parity cleanup (small, do first). Fix only these known items;
> do NOT invent other per-theme changes (Anthony's Round-2 notes are still
> pending): (1) `contour-wash` — replace the mottled wash with crisp fine
> concentric contour LINES, add a visible thin dark echo route, add the top
> `ITALIA · 46.6186°N` eyebrow (see `docs/THEME_PARITY_FEEDBACK.md`); (2)
> `sea-chart` — recolor the compass rose to the magenta accent; (3) `copper-night`
> — warm the star field to copper vs cream. Regenerate each theme's render into
> `docs/theme_audit_output/` and commit per theme.
>
> TRACK B — W3 Tier 1 editor (main), on the W0 `AnchorFrame` + W2 fit model. Build
> the constrained "Light/Guided" editor (see `docs/POSTER_EDITOR_STRATEGY.md` Tier
> 1 + decision 0.4): a per-theme/composition **editable allowlist**; `StylePanel`
> + inline editing expose ONLY allowlisted controls (text content, colorway, a few
> layer toggles, map framing, and nudge/resize WITHIN a slot's anchor box via
> `vue3-moveable`); everything else theme-owned/locked. **Remove `@puckeditor/core`,
> `react`, `react-dom`; retire the `puckSpike`/`layoutSpike` fixtures.** The editor
> must be behind the existing `FLAGS.POSTER_*` feature flags and must NOT regress
> the 27 themes (golden parity for untouched themes must stay byte-stable).
>
> STOP at W4 (Tier 2 — overlays/free-anchor drag/snap). Do not start it; mark W3
> done, flag W4 readiness, and wait for a human go.
>
> GATES per commit: `npx vue-tsc --noEmit --pretty false`, `npm run
> test:style-graph`, focused Playwright, and golden parity for untouched themes.
> Never proceed on red; clean worktree. A Claude review runs periodically and
> writes verdicts to `docs/PLATFORM_REVIEW_FEEDBACK.md` — read its newest entries
> before continuing and resolve anything flagged. Write affected renders to
> `docs/theme_audit_output/` so the review can verify. DONE (this run): Track A
> three items LGTM-ready; W3 Tier 1 editable allowlist works on the anchor model,
> Puck/React removed, spikes retired, themes not regressed, behind flag; paused at
> W4.

## Guardrails (all workstreams)

- `MapPreview.vue` stays the only renderer; editor == proof == final print.
- One commit per logical change; clean worktree; never proceed on red.
- `npm run typecheck` + `test:style-graph` + `test:style-browser` before commits;
  `npm run themes:capture-audit` for visual review.
- No DB migration without cause; bands-as-default-anchor keeps legacy/default
  configs rendering.
- Vue-native interaction only (`vue3-moveable`, `interactjs`); no React/Puck.

## Decisions log (accumulated)

- Parity is **style, not geometry**; verify token contracts, not pixels.
- **Disciplined motifs allowed** (parameterized, data-derived, print-safe, tested).
- **Theme fidelity decoupled from the editor**; per-theme editable allowlist.
- **Anchor model generalizes bands**; evolution, not rewrite; over-map slots are
  free anchors.
- **Constrained customization**, additive tiers; Tier 3 is a separate opt-in bet.
- **Drop Puck/React**; keep `MapPreview` render truth + Vue-native manipulation.

## Doc index

- `POSTER_PLATFORM_ROADMAP.md` — this master plan.
- `POSTER_EDITOR_STRATEGY.md` — editor direction, tiers, anchor model, impact.
- `LAYOUT_EDITOR_OVERLAY_REVIEW.md` — band vs over-map / anchor compatibility.
- `POSTER_TEXT_FIT_PLAN.md` — text auto-fit & containment.
- `THEME_PARITY_EXECUTION_PLAN.md` / `THEME_PARITY_FEEDBACK.md` /
  `THEME_FEEDBACK_ROUND2.md` — theme parity (style).
