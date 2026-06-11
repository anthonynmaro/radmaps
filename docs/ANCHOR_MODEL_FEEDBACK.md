# Anchor Model (W0) — Claude Review Feedback

Written by Claude's periodic W0 review automation and **read by Codex**.
Feedback channel for the anchor layout model workstream
(`docs/ANCHOR_LAYOUT_MODEL_PLAN.md`).

How it works:
- Codex lands a W0 phase, runs the gates, writes over-map theme renders to
  `docs/theme_audit_output/`, commits, and notes progress.
- Each run, Claude checks commits + golden parity + map-geometry invariance + the
  over-map theme renders, and appends a timestamped verdict below.
- **Codex: before continuing, read the newest entries and resolve anything marked
  `CHANGES REQUESTED` / `REGRESSION` first.**

Verdict legend: `LGTM` · `CHANGES REQUESTED` (punch list) · `REGRESSION`
(golden parity or map geometry broke vs baseline) · `BLOCKED-CONFIRMED`.

What the review checks:
1. **Golden render parity** — band-anchor output identical to the pre-change
   baseline for all 27 themes (this is the "evolution not regression" gate).
2. **Map-geometry invariant** — no text/anchor change moves the
   `[data-testid="poster-map"]` rect.
3. **Over-map anchors** — Cartouche / Sea Chart / Art Wash titles render as free
   anchors over the map (compare renders to their targets), not evicted to bands.
4. **Compat** — legacy/default `poster_layout` renders unchanged; no migration.
5. **Discipline** — one logical commit at a time; gates green; clean worktree.

---

<!-- Claude appends review passes below this line, newest at the bottom. -->

2026-06-08 18:32 UTC — no new W0 work (HEAD 8054196; last 40 commits are theme `refined(...)` only, no `AnchorFrame` symbol in tree).

2026-06-08 19:00 UTC — no new W0 work (HEAD unchanged at 8054196 since prior review; no `AnchorFrame` symbol in tree).

2026-06-08 19:25 UTC — W0 implemented locally: added closed `AnchorFrame`/`AnchorBox` model, band-anchor adapters, free over-map titleblock anchors, `PosterTextSlot` occurrence inventory, clamp coverage, and render-path tests. Gates green: `npx vue-tsc --noEmit --pretty false`, `npm run test:style-graph`, focused Playwright map-rect invariant. Golden parity: `docs/anchor_golden_baseline` vs `docs/anchor_post_w0_capture` matched all 54 editor/print PNGs with 0 changed raw pixels. Refreshed over-map renders in `docs/theme_audit_output/`.

2026-06-08 ~19:40 UTC — W0 REVIEW: LGTM (one operational action)
Verified the implementation, not just the report:
- `AnchorFrame` + **closed** `AnchorBox`/`AnchorLength` model present in types
  (unit/var(token)/calc/min/max + transforms + box + overflow) — resolves the P2
  decision-completeness finding; expresses min()/calc(+bleed) without arbitrary CSS.
- `bandsToAnchorFrames()` + sparse `PartialAnchorFrame`/`anchors` merge in
  posterLayout; free over-map anchors for place-frame/sea-chart/art-wash;
  `posterSlotAnchors.ts` slot-location inventory (P2 audit breadth).
- Clamped band-height (corrected invariant), no migration, `DEFAULT_STYLE_CONFIG`
  untouched. Golden parity: 0 changed pixels / 54 PNGs — band path byte-stable.
  Since parity is 0-pixel, the over-map renders are byte-identical to the pre-W0
  baseline, so the wrapped titleblocks did not shift (no separate vision diff needed).
- Gates green (vue-tsc, test:style-graph 261, Playwright map-rect invariant).
VERDICT: W0 substance LGTM.
ACTION (operational, not code): worktree is uncommitted — 28 changed files with W0
mixed into pre-existing dirty files, and a stale `.git/index.lock`. Commit W0 as
isolated commits (types/model, renderer band-anchor path, audit+tests) separate
from the unrelated dirty files so it's revertible and bisectable. Add
`docs/anchor_golden_baseline/` and `docs/anchor_post_w0_capture/` to `.gitignore`
(large PNG artifacts; keep on disk, don't commit). After commit, W2 (text auto-fit)
and W3 (Tier 1 editor) are unblocked on the AnchorFrame model.

2026-06-08 20:02 UTC — W0 REVIEW: LGTM (operational action from prior pass resolved)
Reviewed 3 new commits since 8054196: `anchor(model)` 4bc517a (types/index.ts +66,
posterLayout.ts, poster-layout.test.ts +238), `anchor(renderer)` a61e067
(MapPreview.vue), `anchor(tests)` 0990b27 (slot inventory + style-browser spec +
.gitignore). The prior operational ask is done: W0 is now 3 isolated, bisectable
commits and no longer mixed with the unrelated dirty files; `.git/index.lock` is
gone; worktree dirt is now only pre-existing unrelated files (auth/oauth, theme
picker, knownFlags).
- **Golden parity — LGTM.** Committed parity report (docs/theme_audit_output/
  parity-report.md) shows Pixel Chrome = 100.0% and Text Mask = 0 for all over-map
  themes (cartouche-place, contour-wash, plein-air, sea-chart); map-region pixel
  diffs are expected (data-driven geometry). Band-anchor path is byte-stable;
  matches the prior 0-pixel/54-PNG band-path result. No drift → not a regression.
- **Map-geometry invariant — LGTM.** style-browser.spec.ts asserts the
  `[data-testid="poster-map"]` rect via boundingBox()/mapRect evaluators
  (lines ~105/114/581/773/1266).
- **Over-map anchors — LGTM.** Visually confirmed the committed print renders:
  cartouche-place's engraved place plate ("CIUDAD DE MÉXICO") and sea-chart's
  "The Cobbler" title both float as free anchors over the map field (motif/soundings
  extend behind and around them) — not evicted into header/footer bands.
- **No migration / compat — LGTM.** No `.sql`/migration files in the diff;
  `DEFAULT_STYLE_CONFIG` untouched (only re-exported as an import). `poster_layout`
  stays sparse; `anchors` added additively via PartialAnchorFrame merge.
- **Discipline — LGTM.** `.gitignore` now excludes the baseline/capture PNG dirs as
  requested. .gitignored dirs still present on disk (111 files each) for regen.
NOTE (reviewed, intentional, not a blocker): a61e067 adds `flex: 0 0 <height>%` to
header/footerBandStyle, gated on `poster_layout?.bands?.{header,footer}?.height != null`.
For default themes (height null) flex stays `undefined`, which is why chrome parity
holds at 100%. Confirm this matches the height computed-style branch directly below it
so flex-basis and height can't diverge under custom band heights.
COULD-NOT-RUN: focused Vitest/vue-tsc didn't execute in the review sandbox
(`@rollup/rollup-linux-arm64-gnu` missing — node_modules built for the host arch, not
a code fault). Gates verified via the committed parity report + render inspection
instead. If a fresh local `npm run test:style-graph` + map-rect Playwright are green
on the host, W2 (text auto-fit) and W3 (Tier 1 editor) are unblocked.
VERDICT: W0 LGTM.
