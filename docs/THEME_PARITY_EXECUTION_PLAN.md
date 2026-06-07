# Theme Parity Execution Plan (v2 — style-token model)

Date: June 6, 2026
Supersedes v1. v1 was built around pixel-diffing the live render against the
Claude Design screenshots. That was wrong and is the main reason the work
stalled — see Decision 0.1. This version reframes parity as **matching a style
contract, not an image.**

Goal: every theme renders our designs **exactly** as a fixed bundle of style
tokens, faithfully applied by the existing renderer. Scope is **27 themes: 24
that have a reference screenshot in `docs/theme_screenshots/`, plus 3
spec-referenced** (`field-journal`, `transit-diagram`, `plein-air`).

Read top to bottom before touching code.

---

## 0. Governing decisions (the rethink)

**0.1 — Parity is style, not geometry.** The route shape, contour lines, and
road network come from the user's GPX/location data and are different on every
poster. The screenshots show one specific place (e.g. Blueprint = Mount
Whitney); a real poster shows the user's route over different terrain. So the
map and route can **never** pixel-match the screenshot, and any image-diff score
is chasing an unreachable target. A theme controls only **how** geometry is
painted: colors, weights, widths, opacity, casing, dash, which layers are on,
contour interval/density, label treatment, hillshade/relief, plus the chrome
(typography, layout, frame, motif). Match those. Do not try to make the map look
like the screenshot's specific terrain.

**0.2 — A theme is a declarative style-token contract.** Each theme is a fixed
set of token values (Section 2). The screenshot's only job is to let you read
those values off once ("route ≈ 3px yellow; thin white index contours at low
opacity; titleblock bottom-left in Space Grotesk uppercase"). After that, the
theme is data, not an art project.

**0.3 — Disciplined motifs are allowed.** Distinctive motifs visible in the
targets (sun arc, star/ridge horizon, bib numeral, riso misregistration,
draughting ticks, compass/depth, hypsometric bands) must be built — as
parameterized, data-derived, print-safe, test-covered tokens (Section 8). "Not
implemented" is not an acceptable resting state for a motif in its target.

**0.4 — Theme fidelity is decoupled from the end-user editor.** The renderer
must reproduce the **full** token set so every theme matches the design exactly.
But we do **not** have to expose every token in the style editor for end users.
Each theme/composition declares a small **editable allowlist** (Section 6); the
editor (`StylePanel.vue`) shows only those controls. Everything else is
theme-owned and locked. Authoring fidelity and user editability are two
different surfaces — conflating them is what bloated the renderer.

**0.5 — Scope: all 27 in parallel**, managed by per-theme commits + style tests
(Section 9), not by avoiding the shared renderer file.

---

## 1. Why this stalled (root cause)

1. **Pixel-chasing geometry (the big one).** v1's image-diff gate set an
   impossible target; an agent trying to force map parity will spin forever.
   Fixed by 0.1 — verify the *style contract*, not the image.
2. **No commits.** ~4,000 lines of theme work currently sit uncommitted
   (`MapPreview.vue` +2,462, `mapStyle.ts` +1,107, `refined.ts` +778). With no
   checkpoints the agent can't tell which edit helped, can't roll back, and
   stacks changes on an unstable base. Fixed by Section 9.
3. **Blueprint was the worst first theme.** It needs heavy map-tile work AND
   chrome motifs AND typography at once, so nothing was isolatable. Validate the
   method on a simple theme first (Section 12).
4. **Per-theme branching bloat.** +2,462 renderer lines for ~one theme means
   hand-coded `if (theme === 'x')` chrome instead of reusable token-driven
   composition. Fixed by 0.2/0.4 and Section 8.
5. **Art-vs-chrome oscillation.** Settled by 0.3.

---

## 2. The theme token contract (new center of gravity)

Define a typed token schema and author one value set per theme. Tokens extend
the existing `StyleConfig` / `ThemeDefinition` and are authored in
`utils/themes/refined.ts`; the `specContract.ts` entry stays as the human-
readable intent. The four token groups:

**Map tokens (style only — geometry comes from data):**
- `mapBg` / paper, land + landcover fills, water fill
- contour: color, weight, opacity; index-contour color + weight; contour
  interval/density (a styling choice of *how many* lines to show, not their
  shape)
- hillshade/relief: on-off, intensity; hypsometric tint bands on-off + band
  colors
- roads: on-off, color, weight; labels: on-off, color, size, halo
- enabled layer set + draw order (within what the style-layer-graph allows)

**Route tokens (style only — shape comes from GPX):**
- color, width, opacity, casing/halo color + width, line cap/join, dash pattern,
  glow on-off + params, endpoint markers on-off + style

**Chrome tokens:**
- composition id; title face/size/case/tracking/position/alignment;
  subtitle + footer face/size/fields/position; frame/neatline/collar on-off +
  style; grid on-off/scope/color/opacity/weight/spacing; map-area ratio/margins

**Motif token:**
- `motif` key + params (sun-arc, star-ridge, bib, riso-offset, draughting-ticks,
  titleblock, compass, depth-soundings, hypsometric, deckle, etc.). See 0.3 / §8.

The screenshots map to theme ids via aliases (`editorial` → `editorial-minimal`,
`mid-century` → `midcentury-travel`, `modernist` → `bold-modern`, `marathon` →
`marathon-bib`, `usgs` → `usgs-vintage`). Keep that mapping in one place:
`utils/themes/screenshotManifest.ts` (already created).

---

## 3. Verification — assert tokens, eyeball the reading (replaces the image gate)

Two layers, neither of which diffs map geometry:

1. **Deterministic style assertions (the gate).** After rendering a theme, read
   the live MapLibre paint/layout properties (`getPaintProperty` etc.) and the
   computed CSS of the chrome elements (`poster-header`, `poster-footer`,
   `poster-inset-frame`, grid, motif element), and assert they equal the theme's
   token contract. This is a unit/browser test, extending the existing
   `tests/map-style-effects.test.ts`, `tests/poster-compositions.test.ts`, and
   `tests/style-browser/`. Deterministic, fast, no flaky pixels. Reports include
   a **semantic parity score** with a current threshold of **94%**, but **a theme
   is "applied correctly" iff every token assertion passes.**
2. **Human/vision gut-check (not scored).** Keep the triptych contact sheet
   (reference screenshot | live editor | live print) from
   `capture-theme-audit.mjs` purely for a person (or a vision pass) to confirm
   "this reads like the design." This catches things tokens don't encode
   (overall balance, taste). It is a review aid, **not** a numeric gate.

Drop the pixelmatch/SSIM gate. `pixelmatch` is already installed — if you want a
*cheap, non-gating* smoke signal, sample average color in solid chrome regions
(title band, paper, footer) and compare to palette tokens; never diff the map
band or route geometry.

---

## 4. The execution loop (per theme)

```
1. Open the target:        docs/theme_screenshots/<name>.png
2. Read off token values:  palette, route, contour/layer styling, typography,
                           composition, motif  → write them as the theme's
                           token set in refined.ts
3. Render the live theme   (style-browser fixture) over real fixture GPX
4. Style-assert:           do live paint props + computed CSS == the tokens?
5. Eyeball the contact     sheet next to the target — does it READ right?
                           (balance, weight, hierarchy) — not "same terrain"
6. Adjust token values (or build the motif primitive once), re-render
7. Done when: all token assertions pass AND it reads right AND tests green
8. Commit (one theme / one category), show the Refined badge, update
   specContract notImplemented[]
```

The loop converges because step 4 is a definite pass/fail on values you control,
not a fight with geometry you don't.

---

## 5. File map — what changes where

| Category | File(s) |
|---|---|
| Token values per theme (palette, route, map_defaults, typography refs, motif) | `utils/themes/refined.ts` |
| Token schema / types | `types/index.ts` (extend `StyleConfig` / `ThemeDefinition`) |
| Map-tile capabilities the tokens drive (cyanotype, white index contours, hypsometric bands, hillshade) | `utils/mapStyle.ts` + `utils/styleLayerGraph.ts` |
| Composition layout + motif rendering | `utils/posterCompositions.ts` (profile) + the matching `case` in `MapPreview.vue` |
| Typography profiles | `utils/posterData.ts`; fonts self-hosted via `utils/render/fontRegistry.ts` |
| Editable allowlist per theme/composition (what the editor exposes) | new field on the composition/theme + `components/map/StylePanel.vue` (Section 6) |
| Picker `Refined` badge + thumbnail | `utils/themeOptions.ts` |
| Human-review contact sheet | `scripts/capture-theme-audit.mjs` |

Hard constraints: 2:3 only; `MapPreview.vue` is the only renderer; self-hosted
fonts only; label bands ≥ 4.5:1 (WCAG AA); no DB migration; legacy ids stay
renderable; don't change `DEFAULT_STYLE_CONFIG`.

---

## 6. Decoupling theme fidelity from the editor (the simplification)

This is what "set more constraints on what can be customized" means: **the
renderer reproduces every token (so the design matches exactly), but the editor
only exposes a constrained subset to end users.** You no longer owe a UI control
for every token.

- Each theme (or its composition) declares an **`editable` allowlist**: a small
  set of override keys the user may change. Example for Blueprint: route color,
  title text, colorway, maybe label on-off. Everything else (grid, contour
  styling, titleblock, mono annotations, layout) is theme-owned and **not shown**
  in `StylePanel.vue`.
- `StylePanel.vue` renders controls **only** for the active theme's allowlist.
  Applying a theme resets to its token defaults; the user edits within the
  allowlist; print stays on the same render path.
- This shrinks three things at once: the editor surface, the number of
  renderer combinations to support, and the per-theme branching bloat. It also
  matches "calm by default, powerful on demand."
- Default allowlist if unsure: `title text`, `route color (within palette)`,
  `colorway`, and 1–2 layer toggles. Widen per theme only with a reason.

(If you want a power-user "advanced" mode later, it can reveal more tokens — but
that's an editor feature, separate from theme fidelity.)

---

## 7. Per-theme token + motif worklist (all 27)

For each theme: read tokens off the target, set them in `refined.ts`, build the
listed motif once (reused by colorways). Score = style-contract assertions pass.

| Reference | Theme id | Composition | Tokens/motif to set (beyond palette+type) |
|---|---|---|---|
| `editorial.png` | `editorial-minimal` | editorial-tall | ~64% map ratio, hairline rule, single rust route weight up so it reads on quiet contour |
| `usgs.png` | `usgs-vintage` | park-quad | inset neatline, corner coordinate ticks, green index-contour token, bottom collar |
| `classic-trail.png` | `classic-trail` | park-quad | usgs tokens + cool-slate colorway (inherits) |
| `mid-century.png` | `midcentury-travel` | travel-banner | sun-arc motif, 2-ink contour styling, condensed all-caps banner |
| `ranch-ochre.png` | `ranch-ochre` | travel-banner | mid-century tokens + ochre colorway (inherits) |
| `daybreak-trace.png` | `daybreak-trace` | travel-banner | mid-century tokens + dawn colorway (inherits) |
| `risograph.png` | `risograph` | riso-stack | riso-offset motif (pink + 3px blue), paper grain, blue contour token |
| `blueprint.png` | `blueprint` | blueprint-grid | cyanotype map tokens + white index contours, draughting-ticks + titleblock motif, mono annotations, yellow route |
| `moonstone.png` | `moonstone` | blueprint-grid | blueprint tokens + graphite-on-cool-paper colorway (inherits) |
| `blueprint-strava.png` | `blueprint-strava` | blueprint-strava | full-width map, drafting grid, route-stats bar, green route (no splits) |
| `electric-atlas.png` | `electric-atlas` | blueprint-strava | ink ground, magenta route + glow token, neon ticks, Big Shoulders |
| `splits-stats.png` | `splits-stats` | splits-grid | full-width map + elevation-profile + route stats, orange route (no per-mile table) |
| `night-ride.png` | `night-ride` | splits-grid | splits tokens + cyan/navy colorway (inherits) |
| `marathon.png` | `marathon-bib` | bib-numerals | ghosted bib-numeral motif, finish-time headline, race collar |
| `dark-sky.png` | `dark-sky` | darksky-stars | star-ridge horizon motif, dark relief map tokens, gold route glints |
| `copper-night.png` | `copper-night` | darksky-stars | dark-sky tokens + copper colorway (inherits) |
| `botanical.png` | `botanical` | botanical-plate | framed plate + ornamental corners motif, greener natural map tokens |
| `brutalist.png` | `brutalist` | brutalist-slab | exposed baseline grid + registration-marks motif, one cropped monumental word |
| `contour-wash.png` | `contour-wash` | art-wash | full-bleed soft contour-wash map tokens, small centered caption |
| `cartouche-place.png` | `cartouche-place` | place-frame | engraved street-network tokens, cartouche title, coord+elev footer, optional pin |
| `sea-chart.png` | `sea-chart` | sea-chart | warm chart paper tokens, compass + depth-sounding + rhumb motif, magenta course |
| `relief-shaded.png` | `relief-shaded` | editorial-tall | hypsometric tint-band + hillshade + fine-contour map tokens, quiet serif caption |
| `modernist.png` | `bold-modern` | modernist-block | asymmetric grid: oversized title bottom-left, color tab, map bleeds top-right |
| `blackline.png` | `blackline` | modernist-block | modernist tokens + mono colorway, pure black route (inherits) |
| (no shot) | `field-journal` | journal-spread | two-column spread, tipped-in plate, ruled margin notes, specimen tags |
| (no shot) | `transit-diagram` | transit-diagram | Beck 45/90 route motif, ringed station nodes, stop labels, mono legend |
| (no shot) | `plein-air` | art-wash | watercolor-wash map tokens, deckle-edge motif, hand-set italic title, brushed route |

**Track A (24, screenshot-referenced):** read tokens off the PNG.
**Track B (3, spec-referenced):** read tokens off `specContract.ts` + standalone
HTML; same verification (style assertions), human-reviewed on the contact sheet.
**The 7 colorways** are palette deltas on a parent's tokens — nearly free once
the parent passes.

---

## 8. Disciplined motif pattern

Build each motif once, as reusable token-driven config — never a per-theme
branch:

1. **Ownership:** if every theme on a composition shares the motif, put the
   key/params on the **composition profile** (`posterCompositions.ts`). If a
   composition is shared by themes that differ (e.g. `art-wash` = Contour Wash
   vs Plein Air; `editorial-tall` = Editorial vs Relief; `modernist-block` =
   Modernist vs Blackline), put the typed `motif` key/params on the **theme
   recipe** and have the composition renderer consume it. Prevents motif bleed.
2. **Render** in the matching `MapPreview.vue` composition case as an SVG/canvas
   layer whose geometry derives from real inputs (route bbox, elevation series,
   palette) — never random, never a static imported asset.
3. **Colors from palette tokens** so colorways recolor for free.
4. **Print-safe:** vector where possible; raster (grain/washes) at ≥ print DPI;
   confirm it survives the Browserless screenshot path.
5. **Test:** Playwright assertion that the motif element exists for that
   composition, like the existing blueprint-grid / darksky-stars assertions.

---

## 9. Regression control (scope is all 27 in parallel)

1. **Commit per theme and per category** (palette OR map OR chrome OR motif).
   The current 4,000-line uncommitted pile must be checkpointed/stashed first
   (Section 12). No more uncommitted multi-theme piles.
2. **Run the style-assertion suite on every change set** — it's the safety net
   for the shared renderer. `typecheck` + `test:style-graph` +
   `test:style-browser`.
3. **Prefer token/composition config over renderer branching.** Every
   `if (theme === 'x')` you avoid is a future collision you avoid.
4. **The token contract is the regression oracle:** if a change flips a token
   assertion for any theme, it's a regression — fix before moving on.

---

## 10. Executor recommendation

The model matters less than the reframe — but the loop in Section 4 has two
steps that need vision: reading token values off the target (step 2) and the
"does it read right" gut-check (step 5). An agent that can open the rendered PNG
and the target and reason over both does this far more reliably. Claude Code
does this natively and is disciplined about running the test gates against the
12.5k-line renderer, so I'd make it the primary driver for the visual loop. The
deterministic parts (token schema, style assertions, mapStyle work) are fine for
either agent. Whatever you choose, the read-off-and-gut-check steps are
non-negotiable — that's the part that was missing.

---

## 11. Verification gates & definition of done

Normal iteration uses non-browser checks: file reads, diffs, typecheck, and
Vitest. Do **not** run Browser/Playwright/parity after every edit. Batch browser
validation after meaningful token/layout changes.

Current approved browser/parity commands are intentionally narrow:

```bash
npm run themes:parity -- --theme=blueprint --wait=500 --map-timeout=12000
PLAYWRIGHT_PORT=3003 npm run test:style-browser -- --workers=1 --grep "blueprint"
```

If either command prompts for escalation, report the exact command string and do
not keep retrying variants. Broader all-theme capture/test commands are the
eventual gate, but require explicit approval before running in this session.

Eventual full-suite gates:

```bash
npm run typecheck
npm run test:style-graph
PLAYWRIGHT_PORT=3002 npm run test:style-browser -- --workers=1
npm run themes:capture-audit   # builds the human-review contact sheets
```

Per-theme done:
- every token in the theme's contract is asserted and passes in the live runtime
  capture (live paint props + computed CSS == tokens), with semantic parity at
  or above 94%; static manifest/spec approval alone is never enough,
- route geometry remains GPX-driven: validation checks route source readiness,
  layer order, color, width, opacity, casing/halo, markers, and motif-derived
  overlays; route path pixel parity against a screenshot is explicitly
  non-gating,
- the contact sheet reads like the design (human/vision sign-off),
- motif present + asserted (if the theme has one),
- editable allowlist wired in `StylePanel.vue`; locked tokens not exposed,
- `Refined` badge shown (driven off the screenshot/spec manifest; **no `tags`
  field**),
- `specContract.ts` `notImplemented[]` updated to reflect what's now real,
- committed, one theme / one category per commit.

Overall done:
- 27/27 themes pass their token contract + human review,
- editor exposes only allowlisted controls per theme,
- proof/final smoke renders at 24x36 (plus 32x48 for dense themes: Brutalist,
  Marathon, Modernist, Electric Atlas) for one heritage, one expressive, one
  data, one atmospheric theme,
- Browserless readiness still gated on `window.__RENDER_READY`; no editor
  controls in print mode,
- no second renderer, no remote fonts, no DB migration.

---

## 12. First moves (reset the Blueprint spin)

1. **Checkpoint the current work.** Commit or stash the ~4,000 uncommitted lines
   so nothing is lost, then stop building on top of it. Cherry-pick the genuinely
   reusable pieces (the harness, screenshotManifest, any real `mapStyle`
   capabilities) onto a clean base; drop hand-coded Blueprint-specific renderer
   branches.
2. **Define the token schema + the style-assertion test** (Sections 2–3) before
   any more theme work. This is the new "harness."
3. **Prove the loop on an easy theme** — a colorway or `editorial-minimal` /
   `contour-wash`, where one token group dominates — to confirm
   read-off → set tokens → assert → reads-right actually converges in minutes.
4. **Re-do Blueprint as tokens**, not as 2,400 lines of renderer code: cyanotype
   + white-index-contour map tokens, one `draughting-ticks`/`titleblock` motif,
   mono annotation tokens, yellow route. Then sweep the rest worst-first,
   colorways last.
