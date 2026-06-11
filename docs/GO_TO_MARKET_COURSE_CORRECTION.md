# Go-to-Market Course Correction — June 10, 2026

Goal restated: location/GPX/Strava in → pick a beautiful template that's already filled with the user's real data → optional customization → 300dpi+ 24x36 print via AWS renderer → Gelato. Primary goals: **high-fidelity printing** and **beautifully filled themes**. Drag-and-drop editing is a bonus, not the spine.

This doc: what's actually broken (with root causes), what to keep, alternatives considered, and a sequenced plan.

---

## 1. The three complaints, diagnosed

### A. "Text slots don't prepopulate beyond Title/trail name" — a one-wire gap, not a pipeline failure

The hard part already works. Server-side enrichment (Mapbox reverse geocode + Terrarium elevation, `dc6abf8`) runs and stores `location_label` / `location_city` / `location_region` on the map row. The theme data contract (`utils/themeDataContract.ts`) defines 14 slot types with data sources.

The break: `defaultSlotText()` in `MapPreview.vue` (~line 3925) falls back to `stats.location` — **which the GPX parser never populates** — instead of `formatPosterLocationLine(themeDataContext)`. Composition decorations use the context; the core slots don't. So enriched data sits in the DB while slots render empty/placeholder.

**Fix:** wire `defaultSlotText()` (and any sibling slot resolvers) through the theme data context, and finish the shared `posterFormatters.ts` so editor and render agree. Days, not weeks. This single change is most of "beautifully filled."

### B. "Text doesn't resize automatically / template formatting breaks" — the fit engine was removed and never replaced

Shrink-to-fit was *deliberately* deleted during parity (the targets demanded full authored title sizes; the old character-count heuristic was making everything timid). The replacement — measured fit-to-box per `docs/POSTER_TEXT_FIT_PLAN.md` — is **spec only, zero implementation**. Today a long title ("Yosemite Valley Loop Trail via Mirror Lake") renders at full authored size, wraps without bounds, and because the title band and map share a flex column, it **physically shrinks the map**. No max-height, no overflow hidden, nothing.

**Fix:** implement the plan's Phase 1: bounded containers on every text slot (`max-height` + `overflow: hidden`), a `fitTextToBox()` helper (wait `document.fonts.ready`, measure, binary-search font size down from authored target to `target × minScale`, clip at floor), manual `font_size_pt` override bypasses auto-fit, and `markPrintRenderReady()` waits for fit settlement. ~500–800 LOC in `MapPreview.vue` + a new `utils/textFit.ts`. This is the highest-leverage item in the codebase: it fixes formatting complaints, protects the map-geometry invariant, and makes every real-world title print-safe.

One architectural note: because there is exactly one renderer, DOM-measured fitting is deterministic across editor/proof/final by construction. Don't build a parallel canvas-metrics system; just gate render-readiness on fit settlement.

### C. "Elements that should be editable/removable aren't" — a 9-slot hardcoded allowlist

Inline editing, the toolbar (font/size/color/align/opacity), deletion with tombstones, and a restore list **all exist and work**. The gate is `TIER1_TEXT_SLOTS` in `utils/posterEditorAllowlist.ts:4-12`: seven core slots + two pin labels. The composition chrome slots (`composition_kicker`, `composition_meta`, `composition_footer`, `composition_side_rail`) — i.e., the eyebrows, coord lines, footers users most want to tweak — are deliberately locked "to preserve design intent."

**Fix:** invert the default. Every text slot editable and removable; design intent is protected by the restore list and by themes still owning *styling* defaults. ~20 lines plus making the Layers panel render the chrome slots. No schema change (`poster_text_overrides` already persists any slot).

### D. (Bonus diagnosis) "Older templates were removed"

They weren't deleted. All legacy themes (chalk/topaz/dusk/obsidian/forest/midnight + 6 more) are marked `legacy: true` and filtered from the picker at `themeOptions.ts:159`, each with a `migration_target`. Saved maps still resolve. Decision needed, not code: keep them hidden for launch (recommended — 27 is already a lot to maintain), or promote the best 2–3 into refined recipes later. Nothing was lost.

---

## 2. What to keep — the architecture verdict

**Keep the one-renderer screenshot architecture.** `MapPreview.vue` rendering editor, proof, and final from the same DOM is the only reason editor==print parity was achievable, fonts are self-hosted (no CDN at render time), print framing is exact (`7271×10871` at 24x36+bleed), and proof/final share viewport-scale logic. Alternatives were considered and rejected:

- *Server-side vector/PDF composition* (re-render poster as SVG/PDF): true vector text, but you'd maintain two renderers forever and re-fight parity on every theme. Wrong trade.
- *Canvas-based client renderer*: loses MapLibre's label engine and CSS typography; massive rewrite.
- *Free-form canvas editor (fabric.js/Puck-style)*: already analyzed and correctly rejected in `POSTER_EDITOR_STRATEGY.md` — unconstrained placement is how users break print safety.

**Keep the slot/grid model as the structural contract.** It's what lets you guarantee a 300dpi-safe poster. The drag-and-drop you want (see §4) layers on top of it; it doesn't replace it.

The real architectural debt is `MapPreview.vue` at ~15.9K lines — but decompose it *behind golden snapshots, after launch*, not now.

---

## 3. Print fidelity — the gap between "renders" and "certified 300dpi"

Confirmed solid: exact pixel framing, self-hosted fonts, deviceScaleFactor logic (proof 1x, final 2–4x), proof and final normalized through the same framing math.

Open risks, in order of print-quality impact:

1. **Raster/tile resolution at print zoom.** No zoom-boost logic for print mode; at 24x36 the map may request the same tile zoom as the editor. Vector contours (Atlas/maplibre-contour) scale fine; raster hillshade and any raster base tiles will soften. Needs an empirical answer, not speculation → physical samples (below).
2. **Bleed/safe margins are placeholders.** `providerProfile.ts` carries TODOs — values never verified against Gelato's actual product PDFs. A wrong bleed silently trims poster chrome.
3. **Proof (150dpi) vs final (300dpi).** Same CSS viewport and label layout, different capture DPR — layout should match, sharpness differs. Verify once with a side-by-side; don't rework unless it fails.
4. **Tile 404 = hard-fail** (correct per RENDERING.md) and long-settle timeouts at 32x48 — confirm timeout headroom with the worker's largest size.

**The certification move:** before launch, order real Gelato prints (use `GELATO_ORDER_TYPE=draft` for dry runs, then 3–4 real orders) of the flagship themes at 24x36 — one contour-heavy (usgs-vintage), one hillshade (relief-shaded), one dark data theme (night-ride), one typography-led (editorial-minimal). A $150 sample order answers every question in this section definitively. No amount of code review substitutes for holding the print.

---

## 4. Drag-and-drop — you already half-built it

The Tier 2 editor behind `FLAGS.POSTER_TIER2_EDITOR` (`f83120d`) already has: free text + image/logo overlays, **reposition with snap guides**, z-order, and print guards (min 6pt, ≥150dpi assets, contrast, safe-area). That *is* the drag-and-drop-with-guides experience — scoped to an overlay layer floating above the structural grid, which is exactly the right shape: the grid guarantees the poster can't be broken; the overlay layer gives the freedom.

Recommendation: don't build anything new here now. After the §5 P0s ship, polish Tier 2 (band reorder/resize are the documented gaps) and flip the flag as the "Advanced" mode. Skip Tier 3 free-form entirely for v1, per your own strategy doc.

---

## 5. The plan

### P0 — "Beautifully filled" (1–2 weeks, ship before anything else)
1. **Commit the working tree** (~116 files). Still item zero; nothing below is verifiable until pixels == HEAD.
2. **Slot binding fix** (§1A): `defaultSlotText()` → theme data context; finish `posterFormatters.ts`; ensure enrichment runs on *every* create path (GPX, Strava, place, draw).
3. **Text-fit Phase 1** (§1B): containment + measured fit-down + readiness gating. Test with the brutal fixtures: 50-char titles, 2-char titles, all 27 themes.
4. **Editability inversion** (§1C): all text slots editable/removable.
5. **Golden snapshots in CI** — lock the 27 themes (with the loop-shaped boston fixture fix) so items 2–4 can't silently regress parity. This was C2 in the post-parity review; it's now also the safety net for this very work.

### P1 — "Certified printable" (parallel where possible, ~1 week)
6. **Physical sample orders** (§3) + verify bleed/safe margins against Gelato PDFs; fix `providerProfile.ts` placeholders with real numbers.
7. **Proof/final side-by-side** check; tile-zoom/hillshade verdict from the samples — add print-mode zoom boost only if the samples demand it.
8. **E2E money path**: one Playwright run, GPX → theme → edit → checkout (Stripe test) → proof.
9. **Security gate**: fix the public-maps IDOR (`maps/public/[id].get.ts`) and the logo upload MIME/path issues from REMEDIATION.md — these are pre-launch blockers for a paid product.

### P2 — Post-launch
10. Tier 2 flag-flip as "Advanced editor" (snap-guide overlays), band reorder/resize polish.
11. Multi-waypoint entry UI (segments already parse; it's an entry-flow feature, not a renderer one).
12. `MapPreview.vue` decomposition behind the goldens; Streets mode; legacy-theme resurrection decision.

---

## 6. Bottom line

The days with Codex were not wasted — the 27 themes, the one-renderer architecture, the enrichment pipeline, the editor plumbing, and even the snap-guide overlay system are all real and good. What's missing is thin and specific: one data-binding wire, one text-fit engine that has a spec but no code, one 9-line allowlist, and physical print verification. That's roughly two to three focused weeks between here and a product you can confidently sell — provided the P0 list runs ahead of any new themes, modes, or editor ambitions.
