# Codex GTM Prompts — phased goals for trailmaps-app/docs/GO_TO_MARKET_COURSE_CORRECTION.md

Run in order. Each prompt is self-contained, has a DoD and a STOP condition. Do not start a phase until the previous one's DoD is verified.

**Phase 0 (human, DONE 2026-06-10):** working tree triaged into 7 commits on `codex/toner-pricing-redesign`.

**Phase 0.5 (human or supervised):** reconcile branches — `main` and `codex/toner-pricing-redesign` have diverged (main: acrylic mockup + deploy commits; branch: triage + theme-picker/pixel-contract work). Merge/rebase so there is ONE HEAD before goldens are cut. Remember main auto-deploys to Vercel.

---

## Prompt A — Test triage + golden snapshots + fixture fix (the guard)

> Implement parity regression guards per docs/GO_TO_MARKET_COURSE_CORRECTION.md §5 item 5. MapPreview.vue stays the only renderer. One commit per piece; vue-tsc + npm run test:style-graph green per commit.
>
> 0. TRIAGE THE 45 style-browser FAILURES FIRST (npm run test:style-browser: 86 pass / 17 skip / 45 fail as of 2026-06-10). Classify each failure as (a) stale expectation from intentional theme-parity/picker changes -> update the expectation, or (b) real regression -> fix the code. Commit the classification list in the commit message. Do NOT bulk-update expectations without classification — ecd2f0b changed theme picker + pixel contracts, so some failures may be real. The suite must be green before goldens are cut.
> 1. FIX THE BOSTON FIXTURE: in pages/style-browser-fixture.vue the `boston` fixture route is a 7-point north/south sawtooth. Replace it with a loop-shaped marathon-style route (~15-20 points, closed-ish loop like the design targets for splits-stats/blueprint-strava/electric-atlas show). Keep bbox/stats coherent.
> 2. GOLDEN SNAPSHOTS: re-render all 27 themes (editor + print) at HEAD using the existing capture tooling (scripts/capture-theme-audit.mjs), commit them as goldens, and add a CI job that re-renders and pixel-diffs against them (antialiasing-tolerant threshold, e.g. <0.5% changed pixels). The job must run on any PR touching components/map/, utils/themes/, utils/posterCompositions.ts, utils/posterLayout.ts, utils/mapStyle.ts, or pages/render/.
> 3. QUARANTINE: routeGeometryProfileValues in utils/trail.ts must never run in proof/checkout/final render modes — assert/throw if allowGeometryFallback is true outside test env.
>
> DoD: style-browser suite green with classified fixes; CI fails when a theme render changes without a golden update; all 27 goldens committed; boston-fixture themes visually comparable to docs/theme_screenshots targets. STOP after this — do not refine themes, do not touch text fit.

## Prompt B — Beautifully filled + safe text + full editability (the product)

> Implement docs/GO_TO_MARKET_COURSE_CORRECTION.md §5 items 2-4, in this order, one commit per piece. Goldens from Prompt A are the regression gate: update goldens ONLY where the change is the intended fix, and call out every golden diff in the commit message. vue-tsc + test:style-graph + golden diff green per commit.
>
> 1. SLOT BINDING: defaultSlotText() in MapPreview.vue (~line 3925) and any sibling slot resolvers must resolve through the theme data context (formatPosterLocationLine / themeDataContract), not stats.location. Create/finish utils/posterFormatters.ts as the single formatting source for editor + render. Verify enrichment (location_label/city/region, elevation) is triggered on EVERY create path: GPX upload, Strava import, place search, draw. Reconcile with the theme text slot autofill plan (commit 7cbd3f6) — one system, not two. Acceptance: a fresh real GPX upload (no fixtures) populates location, coords, distance, elevation gain, and date slots on splits-stats, editorial-minimal, and usgs-vintage with real data; missing data removes the slot ephemerally per the contract — never placeholder text on an orderable render.
> 2. TEXT FIT PHASE 1 per docs/POSTER_TEXT_FIT_PLAN.md: bounded containers (max-height + overflow:hidden) on every text slot; new utils/textFit.ts with fitTextToBox(el, box, {targetSizeCqh, minScale, maxLines}) — wait document.fonts.ready, measure, binary-search font size down from authored target, clip at floor, NEVER grow above authored size (parity rule); manual poster_text_overrides[slot].font_size_pt bypasses auto-fit; markPrintRenderReady() waits for fit settlement. Acceptance: a 50-char title and a 2-char title on all 27 themes never change the map rect geometry (Playwright assertion); editor == print text sizes.
> 3. EDITABILITY: expand TIER1_TEXT_SLOTS in utils/posterEditorAllowlist.ts to include composition_kicker, composition_meta, composition_footer, composition_side_rail; ensure the Layers panel lists them and delete/restore works (tombstones + restore list already exist). Acceptance: every text element on every theme is editable and removable in the editor, and restorable.
>
> STOP after these three. Do not start Tier 2 polish, Streets mode, new themes, or MapPreview refactoring.

## Prompt C — Launch hygiene (trust + money path)

> Implement docs/GO_TO_MARKET_COURSE_CORRECTION.md §5 items 8-9. One commit per piece; full test suite green per commit.
>
> 1. SECURITY: fix the public-maps IDOR in server/api/maps/public/[id].get.ts per REMEDIATION.md (is_public column + migration + query only public maps; no service-key RLS bypass for private rows). Fix maps/[id]/logo.post.ts: validate mapId as UUID, verify real content type server-side (magic bytes, not client MIME). Add a GeoJSON size limit in maps/index.post.ts.
> 2. E2E MONEY PATH: one Playwright spec covering GPX upload -> theme pick (quick-pick) -> edit a text slot -> checkout quote -> Stripe test session -> proof render completes. Use GELATO_ORDER_TYPE=draft. This becomes a required CI job.
> 3. PROOF/FINAL PARITY CHECK: render the same map at proof and final framing and assert identical label layout/geometry after normalization (sharpness may differ, layout may not). Document the result in docs/RENDERING.md.
>
> STOP when CI is green with the new jobs. Bleed/safe-margin verification and physical Gelato sample orders are HUMAN tasks (Anthony) — do not guess provider geometry; leave providerProfile.ts TODOs in place until real numbers arrive.

## Prompt D — Editor feel: Canva grammar on the anchor model (post-B, behind a flag)

> Implement the interaction model in docs/EDITOR_UX_NORTH_STAR.md, in step order, one commit per step, all behind FLAGS.POSTER_TIER2_EDITOR (or a new editor_v2 flag — flag OFF must be byte-identical renders). MapPreview.vue stays the only renderer. Goldens + test:style-graph + vue-tsc green per commit; goldens may only change where the step intends it.
>
> PREREQ: Prompt B is merged (text-fit engine + full slot editability). Do not start without utils/textFit.ts in place.
>
> 1. UNIFY SELECTION: one element-selection grammar for theme slots AND overlays — same Moveable handles, same floating contextual toolbar (font, size, weight, italic, color, align, opacity, padding, delete; "…" overflow for letter-spacing/line-height/background). Double-click = text edit. Retire the separate InlineTextToolbar/overlay paths; under the hood slots remain data-bound + auto-fitting, overlays remain free anchors.
> 2. BAND-DIVIDER DRAG: draggable header/map and map/footer boundaries; bands trade height inside the locked aspect; min/max clamps; slot text refits live via fitTextToBox; serialize to poster_layout/AnchorFrame (relative units). Map geometry invariant: ONLY this gesture may move the map rect, and clamped.
> 3. + ADD MENU: one button — Text / Stat (data-bound picker from the theme data contract; no fabricated values insertable) / Icon / Image-logo. Drops centered over the map, selected, toolbar open.
> 4. EMPTY-SPACE PROPERTIES: click empty band space -> background color, padding, per-band reset-to-template; click map background -> opens the Advanced drawer. Add whole-poster reset-to-template.
> 5. STYLEPANEL DEMOTION: StylePanel becomes an "Advanced" drawer scoped to map style (preset/contours/hillshade/tiles/route) + order options; remove text/color/layout sections that the contextual toolbar now owns. Mobile keeps the bottom sheet with contextual contents.
> 6. GUARDRAILS: print guards (>=6pt effective, >=150dpi assets, safe-area) render as inline element warnings, hard-block only at checkout; snap guides (poster center, map-frame edges, element edges, safe area) appear only mid-drag.
>
> Acceptance = the demo in EDITOR_UX_NORTH_STAR.md §Acceptance, as a Playwright spec on editorial-minimal with a real GPX fixture, plus: flag-off renders byte-identical; proof render of an edited poster matches editor.
>
> STOP after step 6. Do not build Tier 3 free canvas, band reordering, or new themes.

## Prompt E — Style system evolution: map-element selection + segments v2 (post-D)

> Implement docs/STYLE_SYSTEM_EVOLUTION.md in its §Sequencing order, one commit per step, behind the editor_v2 flag (flag OFF = byte-identical renders). MapPreview.vue stays the only renderer; goldens + test:style-graph + vue-tsc green per commit.
>
> 1. THEME-OWNERSHIP REGISTRY: split StyleConfig fields into theme-owned vs user-owned (extend the data contract's existing concept). applyThemeToStyleConfig/THEME_RESET_FIELDS may reset ONLY theme-owned fields; user-owned (poster_text_overrides, poster_layout, map_element_overrides, segments, route geometry, print_size) survive theme switches. Add the "Kept your customizations / Reset all to theme" toast as the undo. Acceptance: switch themes after manual route-color + segment edits → edits survive; reset button restores pure theme.
> 2. STABLE FEATURE IDS: atlas tile pipeline emits stable per-feature ids (place/POI: source id; contour labels: elevation+geohash). Document in MAP_TOOLS_CATALOG.md per the catalog policy.
> 3. MAP SELECTION MODE: FreezeControl reframed — frozen = selection (queryRenderedFeatures hit-testing + highlight + floating toolbar shell), unfrozen = camera. Vector layers only; baked-raster presets highlight nothing (graph-gated via styleLayerGraph capabilities, no hardcoded preset checks).
> 4. SEGMENTS V2: click segment → toolbar (inline name, color, width, line style, delete, split-at-point, zoom-to); endpoint drag kept; label double-click rename; segment list/reorder in the Advanced drawer. No parallel persistence — existing segment structures.
> 5. MAP ELEMENT OVERRIDES: new StyleConfig.map_element_overrides ({hidden, text, color, size_scale} keyed by stable id) applied ONLY through buildMapStyle (filters + data-driven props) so editor/proof/final agree by construction; include in render hashes; preserve-and-ignore unknown keys. Toolbars per element type: place/POI (rename/hide/size/color + hide-kind), elevation label (hide/size/density), pins (label/style/hide), route (color/width/opacity/smoothing).
> 6. STYLEPANEL DISPOSITION: poster-chrome controls retire to Prompt D toolbars; map-style sections consolidate into the Advanced drawer (keep graph gating); fix dual-writes (duplicate grid controls, dual logo storage, atlas contour dual-sync → one write path). Order/meta untouched.
>
> HARD RULES: no DOM overlays over the map for label edits (print would lose them); every new control graph-registered; raster presets advertise honestly (picker badge driven by graph capability).
>
> Acceptance: on a vector preset — rename a place label, hide a POI, restyle + split a segment, switch themes, order a proof: all edits survive theme switch AND appear identically in the proof. On a raster preset: selection mode highlights nothing, no dead controls shown.
>
> STOP after step 6. Do not migrate raster presets to vector, build Streets mode, or touch checkout.

---

## Why phased prompts, not one

Phases have different verification loops (pixel-diff vs unit/Playwright vs checkout E2E), a hard ordering dependency (goldens before MapPreview surgery), and the parity history shows open-ended goals drift while finite goals with stop conditions converge. Each prompt ends with an explicit STOP to prevent the micro-tuning spiral.
