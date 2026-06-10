# Post-Parity Review — June 10, 2026 (rev 2)

Scope: `THEME_REFINEMENT_FEEDBACK.md` (22 review passes), `POST_PARITY_NEXT_STEPS.md`, git state through `45ecb4a`, and a code-level architecture audit. Goal check: beautifully printed custom maps, simple.

Rev 2: original C1 ("fabricated data live on three sellable themes") was overstated and is corrected below — the synthetic-profile fallback is opt-in/default-off and unreachable in production, and the MA-theme "zigzag route" is a test-fixture artifact, not a renderer or data bug. Priorities re-ordered accordingly. Placeholder gate status updated (`45ecb4a` landed it).

---

## 1. Where things stand

**Theme parity: genuinely done.** 27/27 themes render coherently at editor + print, editor==print holds, title-shrink/blank-render/fabricated-artifact classes of bugs are closed, and the 4-item final backlog was cleared in single commits (5efb0fb, b6af4d8, 959d6f3, a79bc95). Pausing the open-ended reviewer was the right call — passes 12/22 show it had drifted into footer micro-tuning with no stop condition.

**Post-parity Phase 1: landed.** Quick-pick (`84b0991`) is in `ThemeLineupStep.vue` with Auto/Terrain/Streets/Minimal, Minimal mode is implemented, and the picker is purpose-grouped (`a16a621`).

**Phase 2 (data contract): well past half.** Foundation shipped (`e774db1`: ThemeDataContext, buildThemeDataContext, resolver; `dc6abf8`: server-side enrichment caching) with no render regressions, and `45ecb4a` landed the order-click placeholder approval gate. Remaining: shared `posterFormatters.ts`, contract version in render hashes, Streets mode, purpose-based recommendations, and the test plan.

**Architecture (the honest read).** The pipeline is sound in shape — one renderer (`MapPreview.vue`) shared by editor preview, proof, and the AWS Chromium render worker, which is exactly what makes editor==print achievable. But `MapPreview.vue` is ~15,900 lines, with `StylePanel.vue` (~3.5K), `FixedPosterEditor.vue` (~1.9K), and `pages/create/index` (~1.76K) behind it. Theme/layout/checkout unit coverage is decent; E2E on the order path is thin.

---

## 2. Critical issues (blockers to "beautiful + simple," in order)

### C1 — 116 uncommitted files in the working tree
`git status` shows ~116 modified files, including `nuxt.config.ts`, `checkout.vue`, `style.vue`, `MapPreview`-adjacent components, and render-worker CloudFormation. This violates the "one commit per piece" rule the whole parity effort relied on, makes "what's in pixels" unverifiable (the #1 recurring failure mode in the review log was stale renders vs HEAD), and puts the signed-off parity state at risk. Triage and commit (or stash/discard) before any new feature work.

### C2 — Parity has no regression guard
Parity was verified by a human-in-the-loop reviewer that is now paused. `e774db1` already rewrote ~142 lines of MapPreview render paths after sign-off; remaining Phase 2 work touches the same paths. Without locking the 27 signed-off renders as golden snapshots with an automated pixel-diff in CI, parity will silently rot. This is cheap now (the render batch tooling exists) and very expensive later.

### C3 — Accepted-but-unresolved low-relief gap, and the Minimal default isn't proven
The 03:25 sign-off backlog dropped the low-relief items still open at pass 21: sparse-fragment fields on splits-stats / electric-atlas / blueprint-strava, near-absent night-ride rings, relief-shaded reading as hillshade. The designed answer for flat terrain is Minimal mode — but the flat-route → Minimal auto-default (via `resolveAdaptiveContourReliefProfile(stats)`) needs verification that it actually fires for the canonical flat-Boston case. If it does, the MA-theme contour complaints become moot by design; if not, flat routes still ship with the weakest-looking maps in the catalog. Test this explicitly before calling the gap closed.

### C4 — Three themes have never been parity-checked
plein-air, field-journal, transit-diagram have no design targets; their overlays (plein-air corner dots, transit station names) were repeatedly flagged "needs a human call." Either author targets or record an explicit approval so they stop being unverifiable.

### Resolved in rev 2 — the "zigzag route" and the synthetic-profile fallback (downgraded from blocker)

Rev 1 claimed fabricated data was live on three sellable themes via `routeGeometryProfileValues()` (`utils/trail.ts:938`). On verification, that claim does not hold:

- **The fallback is opt-in and default-off.** `buildElevationProfile(..., allowGeometryFallback = false)` (`trail.ts:900`); the only `true` caller is a unit test. Production callers get `null` on missing elevation and the slot is hidden — the contract-correct behavior already exists. Output is also flagged `synthetic: true` and consumed (label suppression in `ElevationProfile.vue`).
- **The MA-theme zigzag is a fixture artifact, not a renderer or data bug.** The `boston` fixture (`pages/style-browser-fixture.vue:666`) is seven points alternating north/south as longitude decreases — a sawtooth by construction. splits-stats, blueprint-strava, and electric-atlas all render with `contentFixture: boston` and no `routeFixture` override (`utils/themes/screenshotManifest.json`), so every audit render of those themes draws this sawtooth, while their design targets were drawn with a marathon-style loop. Customer routes are unaffected.

Two small follow-ups, neither a blocker: (a) **quarantine the fallback** — delete `routeGeometryProfileValues` or add an assertion that it can never execute in proof/checkout/final render modes, so it stays dead; (b) **fix the boston fixture** — replace it with a loop-shaped marathon route (or add a `routeFixture`) so audit renders of the three MA themes are comparable to their targets before the golden snapshots in C2 are locked.

---

## 3. Next steps (sequenced)

1. **Stabilize:** triage/commit the working tree (C1). Half a day, unblocks everything.
2. **Guard:** fix the boston fixture (loop, not sawtooth), then lock the 27 parity renders as goldens + automated diff in CI (C2). Make it a merge gate for anything touching MapPreview, presets, or the contour pipeline. Fixture first, so the goldens you lock are comparable to the design targets.
3. **Prove the Minimal default** for flat routes (C3); if confirmed, formally close the low-relief punch items as superseded.
4. **Finish Phase 2** in plan order: `posterFormatters.ts` → contract version in render hashes → Streets mode → purpose recommendations → the POST_PARITY_NEXT_STEPS test plan. (The placeholder gate already landed in `45ecb4a` — verify it in the test plan rather than rebuilding it.)
5. **Hardening footnote:** quarantine `routeGeometryProfileValues` (delete or assert-unreachable in orderable render modes). Small, not urgent, but cheap insurance against a future caller flipping the flag.
6. **Settle the no-target themes** (C4).
7. **Then** resume editor Tier 2/3 work — with goldens in place, MapPreview decomposition (extract contour pipeline, chrome slots, elevation profile) can proceed incrementally behind the snapshot guard instead of as a risky big-bang refactor.
8. **E2E the money path:** one Playwright run from GPX upload → theme pick → edit → checkout → proof render. The order path is the least-tested part of the most important flow.

---

## 4. Verdict

The hard creative problem — 27 themes that look like the design targets at print quality — is solved, and the editor==print architecture decision is the reason it was solvable. On closer inspection the data-integrity story is also better than rev 1 claimed: the synthetic-elevation path is already gated off in production, and the placeholder approval gate has landed. The remaining distance to "beautiful printed maps, simple" is durability: no silent regression of the parity you just spent 24 hours earning (C1, C2), and a proven graceful default for the flat routes most real customers will upload (C3). Those are days, not weeks — but they belong ahead of Streets mode, new themes, or editor expansion.
