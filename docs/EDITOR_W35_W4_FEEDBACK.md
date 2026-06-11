# Editor W3.5 + W4-min — Claude Review Feedback (rolling)

Written by Claude's periodic review automation, **read by Codex** during the
combined run: **W3.5 (structural delete) first, then W4-min (overlays)**.
Plans: `docs/POSTER_STRUCTURAL_DELETE_PLAN.md`, `docs/POSTER_EDITOR_W4_PLAN.md`.

Loop: Codex lands a change → runs gates → writes editor/print renders to
`docs/theme_audit_output/` → commits → notes progress. Each run Claude reviews the
active phase and appends a timestamped verdict below. **Codex: read the newest
entries before continuing; resolve `CHANGES REQUESTED` / `REGRESSION` first.**

Verdict legend: `LGTM` · `CHANGES REQUESTED` · `REGRESSION` · `BLOCKED-CONFIRMED`.

## Phase 1 — W3.5 structural delete (do first)
- **Tombstone, not blank:** deleting an element sets `deleted: true` in sparse
  `poster_layout`; it does **not** reappear after reload / theme re-resolve.
- **Dividers follow their cell:** a divider tied to a removed cell/row is removed
  with it (the original bug).
- **Reflow:** remaining cells expand; emptied rows collapse; band holds a minimum.
- **Map invariant:** deleting content reflows WITHIN the band and does NOT move
  `[data-testid="poster-map"]`; only a deliberate clamped band-height edit may.
- **Everything removable:** text slots, stat/metric cells, dividers, spacers, and
  the whole Strava-metrics group (group delete).
- **Restore/undo:** un-tombstone brings the theme default back.
- Flag-off / untouched-theme golden parity byte-stable. Discipline: isolated commits.

## Phase 2 — W4-min overlays (after W3.5)
- Behind `FLAGS.POSTER_TIER2_EDITOR`; Tier-1 + default render (flag off) byte-stable
  vs the W3 baseline (0px/54 PNGs).
- User text + image/logo overlays are free `AnchorFrame`s (no second overlay
  system); `poster_layout.anchors` is the positional truth; legacy overlays derive
  anchors at render time without changing default render. No icons in W4-min.
- Snapping (poster/map/band/slot/overlay edges+centers) + guides (editor-only,
  never in print); z-order; clamped band resize (only deliberate band edits move
  the map).
- **Print guards** reuse existing helpers (`computeEffectiveDpi`, contrast, bleed):
  min font, image DPI for the print size, safe-area/bleed, ≥4.5:1 contrast — warn
  in editor, hard-guard at render. Verify a negative-case fixture is rejected.
- `MapPreview.vue` only renderer; map-rect stable for overlay add/move/resize.

## W-guard
W4-min excludes icons, font-library expansion, band/cell reorder, and free-form
canvas (W4-full/max). Flag any of those — Codex must stop at W4-min.

---

<!-- Claude appends review passes below this line, newest at the bottom. -->

## 2026-06-08 19:02 CDT — first review pass

New editor commits since last review: `a4a873d` (ship guided poster slot
editing) and `d28ab66` (keep guided poster editing slot-only). `657772d`
(Mapbox typeahead) is non-editor, skipped. **Gates not run in sandbox** —
`node_modules` is macOS-arm64-native, so vitest/vue-tsc fail on
`@rollup/rollup-linux-arm64-gnu`. Verdicts below are from code reading; Codex
must confirm golden parity + suites locally.

**Phase read:** these are NOT the W3.5 structural-delete or W4-min overlay
plans. They are the guided slot-editing foundation that sits *before* W3.5. The
tombstone/delete infra the W3.5 checklist targets (`deleted:true`,
`effectivePosterLayout` filter, divider-follows-cell, row reflow/collapse) was
already in tree from earlier W3-era commits (`c50982b` chrome grid editor,
`8a5a996`), not from these two. So this pass reviews the new commits against
the W-guard + renderer/map invariants, and flags that W3.5/W4-min proper have
not started.

- **W-guard (slot-only, no free-form): LGTM.** Guided mode correctly suppresses
  the legacy free-form system rather than adding a new one. In `StylePanel.vue`
  the Images, Icons, Text-overlays cards and image/logo file inputs are all
  `v-if="!guidedPosterEditor"`; element list filters to `theme`/`system`
  sources (no user overlays). In `MapPreview.vue` asset/icon/text-overlay
  `is-editable`/`is-selected`/`tabindex`/click + `contenteditable` are all gated
  off under `guidedPosterEditor`, and `data-poster-element-id` is dropped so
  only `slot:*` elements are selectable. No icons / font-library / reorder /
  free-form canvas introduced.
- **Renderer discipline: LGTM.** `MapPreview.vue` stays the sole renderer; the
  parallel `PosterLayoutSpike.vue` and `PuckPosterSpike.client.vue` + their
  tests/utils are deleted (~4.9k lines), removing the competing spike paths.
- **Map invariant: LGTM (by reading).** Changes are editor-interaction-only
  (class/tabindex/contenteditable/`data-*`); no band geometry or
  `[data-testid="poster-map"]` rect touched. New test asserts Tier-1 slot edits
  route through `poster_text_overrides` only.
- **Flag gating: CHANGES REQUESTED (forward-looking, non-blocking now).** Guided
  editor is gated by the `posterElementsAvailable` prop, and **`FLAGS.POSTER_
  TIER2_EDITOR` does not exist** (grep: 0 hits). Fine while no overlays ship,
  but W4-min requires the overlay editor behind that flag with flag-off byte
  parity. Add the flag before starting Phase 2; don't let the prop become the
  de-facto Tier-2 gate.
- **Golden parity: UNVERIFIED.** Could not run the 0px/54 golden suite here.
  Slot-only gating is editor-DOM only and *should* be print-stable, but Codex
  must confirm flag-off/default render is byte-stable vs the W3 baseline before
  this is considered done.
- **Commit hygiene: CHANGES REQUESTED.** The two editor commits are isolated,
  but the working tree carries a large pile of unrelated dirty files
  (auth/oauth confirm.vue, magic_link.html, nuxt.config, AGENTS/CLAUDE.md,
  several `??` docs + `oauth-branding-config.test.ts`). Keep W3.5/W4 work off
  this dirty base — commit or stash the auth/oauth churn separately so editor
  diffs stay clean and reviewable.

**Net:** good foundational cleanup that tightens the W-guard; nothing here
regresses W3. Phase 1 (W3.5 structural delete) and Phase 2 (W4-min overlays)
are still to come — next editor commits should target the W3.5 checklist
(tombstone group-delete + reflow renders in `docs/theme_audit_output/`).

## 2026-06-08 20:56 CDT — second review pass (W3.5 + W4-min landed)

New editor commits since last pass: `2faadee` (Enable structural chrome deletes
= Phase 1 / W3.5) and `f83120d` (Enable tier 2 poster overlays = Phase 2 /
W4-min). `657772d` (Mapbox typeahead) non-editor, skipped. **Gates not run in
sandbox** — same `@rollup/rollup-linux-arm64-gnu` block as last pass
(`node_modules` is darwin-arm64); vitest/vue-tsc cannot execute here. Verdicts
are from code reading + the committed render JSONs in
`docs/theme_audit_output/{w35-structural-delete,w4-min-overlays}/`. Codex must
re-confirm suites + golden locally.

### Phase 1 — W3.5 structural delete (`2faadee`)

- **Tombstone + reflow + row collapse: LGTM.** `removeCell`
  (`MapPreview.vue`) now tombstones the *cell* when the row keeps ≥1 visible
  cell, and tombstones the *whole row* (`deleted:true`) when it was the last
  visible cell — the previous "≤1 visible row can't delete" branch is gone.
  `effectivePosterLayout` filter drives reflow. Tests in
  `poster-layout.test.ts` cover all three: cell tombstone reflow, full
  `footer-primary` row collapse with band height preserved, and stat blocks
  gone.
- **Map invariant: LGTM — verified numerically.**
  `w35-structural-delete/footer-metrics-delete-editor.json` shows
  `beforeMap` == `afterMap` to the pixel (`x 280.671875 / y 111 / w 466.65625 /
  h 503.984375`). Footer-metrics delete reflows within the band; the
  `[data-testid="poster-map"]` rect does not move.
- **Divider-follows-cell: LGTM (by reading).** Cell tombstone clears
  `block: undefined` and the cell is filtered out of the visible set, so a
  divider bound to that cell is dropped with it; the row-collapse test confirms
  no stat/divider survivors. Codex: a render capture of a *single* mid-row cell
  delete (divider + sibling reflow, map fixed) would make this airtight — the
  current capture is the whole-group case.
- **Everything removable + restore: LGTM.** `deleteSelectedRow` drops its
  `rows.length <= 1` guard (last row now deletable). New "Removed" restore list
  (`FixedPosterTemplateEditor.vue`, `data-testid=template-restore-list`)
  un-tombstones rows and cells via `restoreSparseChromeTombstone`; the
  `restores a tombstoned theme cell` test confirms `deleted:false` brings the
  theme default back. Group delete of the Strava footer-metrics row covered.
- **Golden parity: LGTM.** `w35-structural-delete/golden-parity-54.json` =
  54 PNGs, 0 changed / 0 missing / 0 extra vs baseline. Flag-off / untouched
  render byte-stable.

### Phase 2 — W4-min overlays (`f83120d`)

- **Flag gating: LGTM — resolves last pass's CHANGES REQUESTED.**
  `FLAGS.POSTER_TIER2_EDITOR` now exists (`knownFlags.ts`) and is the gate:
  `posterTier2Editor = posterElementsEditor && (flag || dev query)`
  (`MapEditorSurface.vue`), threaded as `posterTier2Available` /
  `posterTier2Editor` into StylePanel + MapPreview. `freeOverlayEditorBlocked =
  guided && !tier2` cleanly re-enables free overlays only under the flag.
- **Flag-off byte parity: LGTM.** `w4-min-overlays/golden-parity-54.json` =
  54 compared, 0 changed. Default render unchanged; `overlayStyle` /
  `imageAssetStyle` untouched.
- **Print guards: LGTM.** New `posterPrintGuards.ts` reuses `contrastRatio`,
  `computeEffectiveDpi`; enforces min 6pt font, ≥150 DPI, ≥4.5:1 contrast,
  4% safe-area/bleed. Editor surfaces them as amber warnings
  (`data-testid=poster-print-guard-warning`); the **hard guard runs at render**
  — `markPrintRenderReady` throws on `isPrintRender` when any `error`-severity
  violation exists (`MapPreview.vue:6096`). Negative fixture rejected:
  `w4-negative-print-guard.json` → `ready:false` with all 5 messages
  (2.6pt / contrast / safe-area / 27 DPI / image safe-area).
- **Snapping/guides + z-order + map-rect: LGTM (by reading).**
  `posterGuidePixels` adds overlay edge/center guides only under
  `tier2PosterEditor` (editor-only, never print). Overlay anchors carry
  `displacesMap:false`, so add/move/resize cannot push the map; flag-off golden
  confirms no geometry drift. *Gap (non-blocking):* unlike Phase 1, there is no
  numeric `beforeMap/afterMap` capture for an overlay move/resize — add one to
  match the W3.5 evidence bar.
- **Anchors vs overlays: LGTM with a noted caveat.** No second overlay system —
  `text_overlays`/`image_overlays` stay the single content+position store and
  `syncPosterOverlayAnchors` derives `poster_layout.anchors` from them on every
  add/patch/duplicate/remove; `resolveFreeOverlayBox` reads the anchor and falls
  back to `overlay.x/y`, so render and print guards stay consistent (tests in
  `poster-editor-elements.test.ts` assert overlay fields and resolved anchor box
  match after move/resize). **Caveat for W4-full:** the checklist wants anchors
  as *primary* positional truth, but here they are a derived mirror of
  `overlay.x/y`. The watcher in `MapEditorSurface.vue` re-syncs on overlay
  count change, not on position — a position-only mutation outside
  `patchPosterEditorElement` would leave the anchor stale (render still correct
  via fallback). Fine for W4-min; before W4-full, invert the write path (move →
  write anchor, overlay derives) or sync on position too.
- **W-guard: LGTM.** Guided+tier2 tool modes add only Text + Image (no Icon);
  element filter admits only `free-text`/`image`/`logo`. No font-library, no
  band/cell reorder, no free-form canvas. Constrained free overlays are the
  sanctioned W4-min surface — within bounds.

**Net:** Phase 1 is solid and proven by the map-rect-stable + golden-54 + 0
captures — LGTM. Phase 2 is a clean, flag-gated W4-min with a real render-time
print guard — LGTM, with two follow-ups that are non-blocking now: (1) capture a
numeric map-rect before/after for an overlay move, and (2) treat the
anchor-as-mirror inversion as W4-full scope. Both commits are isolated; the
pre-existing dirty pile (auth/oauth `confirm.vue`, `magic_link.html`,
`nuxt.config.ts`, `AGENTS/CLAUDE.md`, the `??` plan docs) still rides alongside
— keep stashing it off the editor base so diffs stay reviewable.

## 2026-06-08 21:01 CDT — no new work (HEAD `f83120d`, already reviewed in 20:56 pass)
## 2026-06-08 22:01 CDT — no new work (HEAD `f83120d`, already reviewed in 20:56 pass)
