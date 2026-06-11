# Theme Regression — Claude Vision Diagnosis (rolling)

Written by Claude's review automation, **read by Codex**. Diagnoses the current
theme renders against the design targets to find the autosizing/layout/typography
regressions. Plan: `docs/THEME_REGRESSION_TRIAGE.md`.

How it works:
- Codex regenerates all 27 themes at editor + print geometry into
  `docs/theme_audit_output/poster-themes/{editor,print}/` (current HEAD).
- Claude compares each **current** render to `docs/theme_screenshots/<name>.png`
  and appends a per-theme verdict below, ranked by severity.
- **Codex: fix the listed items; do NOT trust 0px golden parity as "themes are
  fine" — verify against the design targets at editor AND print geometry.**

What the diagnosis checks per theme:
1. **Autosizing** — does the title render at its authored size, or has it shrunk
   when it actually fits? (W2 fit-target regression suspect.)
2. **Layout** — band proportions, title/footer position, map ratio vs the target.
3. **Typography** — face, weight, case, tracking, hierarchy vs the target.
4. **Editor vs print parity** — does the editor-geometry render match print, or
   does autosizing misbehave only at editor size (what the user sees live)?

Severity: `OK` · `MINOR` · `BROKEN` (clearly wrong vs target). Include the likely
cause (anchor / text-fit / editor / theme-token) where identifiable.

---

<!-- Claude appends diagnosis passes below this line, newest at the bottom. -->
<!-- BLOCKED until Codex regenerates the 24 stale renders through current HEAD. -->

## 2026-06-08 — Claude vision diagnosis (current renders vs targets)

Reviewed current print renders for bold-modern, brutalist, editorial-minimal,
blueprint, usgs-vintage against docs/theme_screenshots. **TWO distinct issues —
one real code regression, one likely a capture artifact. Do not conflate them.**

### ISSUE 1 — Title autosizing shrinks large display titles. REAL regression (text-fit). BROKEN.
The big display titles render ~40–60% too small vs the targets — they fit easily
but are scaled down anyway. This is the user's "autosizing not working / typography
slipped."
- `bold-modern`: target "WONDERLAND" fills the entire bottom band; current is ~1/3
  width, small. BROKEN.
- `brutalist`: target "BOSTON" is a monumental Bebas word cropped at the edge;
  current is a small top-left word. BROKEN.
- `editorial-minimal`: target "Wonderland" is a large Playfair title; current is
  small. BROKEN.
- **Cause:** `fitTextToBox` is scaling titles DOWN even when they fit. **Fix:** the
  fit target must be each theme's AUTHORED title size; scale down ONLY on overflow,
  never shrink a title that fits, never below the per-block floor. If W2 replaced the
  hand-tuned authored sizes with a generic default, restore/re-tune per theme. This
  is independent of map tiles (pure DOM/CSS) → it's a true regression, fix it.

### ISSUE 2 — Maps render as heavy hillshade/relief texture. LIKELY A CAPTURE ARTIFACT, not a code bug.
Every theme's map shows a dark, dense hillshade/relief texture dominating the
poster, instead of the theme's intended quiet contour style (light spaced contours
on bold-modern/editorial; clean white index contours on blueprint; tan+green
contours on usgs). BUT:
- **The map-style code did NOT change.** `git diff 8054196..HEAD -- utils/mapStyle.ts`
  = +12 lines (contour-wash echo route only); no hillshade/relief/terrain/contour
  deltas; `utils/styleLayerGraph.ts` untouched.
- The June-7 renders (captured during the parity runs, with Atlas tile access)
  showed the correct light contour styling. This regen was done via a local
  temporary Nuxt server.
- **Strong hypothesis:** the local capture did NOT load the RadMaps Atlas vector
  map tiles (auth/env/key), so the maps fell back to the raw DEM-derived
  hillshade/terrain layer (which `maplibre-contour` generates) — the heavy relief is
  the terrain layer rendering WITHOUT the styled vector contours/fills on top. The
  route + chrome render from the app; only the base map style is missing.
- **ACTION before treating as a bug:** re-capture with proper Atlas tile/API access
  (the same env the June-7 captures used), OR Anthony confirms whether the LIVE app
  (with tiles) shows correct contours. If maps render correctly with tiles, Issue 2
  is a capture-env problem, NOT a theme regression — do not chase it in code. Only if
  it reproduces WITH tiles is it real.

### Net
- Fix Issue 1 (title autosizing) — it's the real regression and the user's pain.
- Verify Issue 2 (map relief) is a tile-load artifact before any code change; re-run
  the capture with tile access so the diagnosis isn't reading broken maps.

## 2026-06-09 04:05 UTC — Claude vision diagnosis (FULL 27-theme pass)

Renders are now **current: 27/27** in both `print/` and `editor/` (all dated
2026-06-09 03:38–03:45 UTC, newer than the text-fit commit `c89b2a3` @ 20:46 UTC).
Compared every current render to its `docs/theme_screenshots` target (aliases
applied). This supersedes the 5-theme spot check above and confirms its two issues.

### SYSTEMIC FINDINGS (read first)

1. **Issue 2 (heavy hillshade) is STILL present on essentially every theme → this
   regen was ALSO captured WITHOUT Atlas tiles.** Same dark DEM/relief texture
   dominates the map area on all line/flat themes; the ONLY theme where the relief
   looks on-target is `relief-shaded` (which is supposed to have it). This is the
   tell that the styled vector contours/fills never loaded — exactly the capture
   artifact diagnosed above. **Consequence: map-base fidelity remains unjudgeable
   this pass. Do NOT chase per-theme "map too heavy / contours wrong" as code bugs.
   Re-capture with Atlas tile access first.** All map-base notes below are bracketed
   `[BASE?]` and are low-confidence until tiles load. Everything else (title, bands,
   footer, anchors, framing) renders from the app and IS trustworthy.

2. **Issue 1 (title autosizing shrink) — CONFIRMED and broader than the 5-theme
   check.** Hero/display titles render markedly smaller than authored on:
   `editorial-minimal`, `bold-modern`, `blackline`, `brutalist`, `classic-trail`,
   `blueprint-strava`, `electric-atlas`, and (mild) `marathon-bib`. The shrink is
   NOT universal — medium-title themes (`night-ride`, `splits-stats`, `copper-night`,
   `dark-sky`, `risograph`, `usgs-vintage`) sit at/near authored size. So the fit bug
   bites the **largest authored display sizes / hero-title block kind**, not all
   titles. Cause = `fitTextToBox` shrinking titles that already fit; target must be
   authored size, scale down only on overflow. (Matches the W2 hypothesis.)

3. **NEW extreme text-fit case — `cartouche-place` drops a title line.** Target
   stacks "CIUDAD DE / MÉXICO" (3 lines) inside the cartouche; current renders only
   "CIUDAD DE" — the **"MÉXICO" line is gone** and the cartouche box is undersized and
   sits too high. This is overflow handling deleting content instead of fitting it →
   text-fit + anchor. Highest-value repro for the fit bug.

4. **Editor == Print for typography everywhere** (both shrink identically). The
   regression lives in **shared geometry, not editor-only** — do NOT hunt an
   "editor-only autosizing" path. The one parity exception is `contour-wash`
   (print map blank, editor textured) — see below.

5. **Two render FAILURES (independent of tiles — chrome is missing too):**
   - `transit-diagram` — effectively **blank** in both print+editor (35–55 KB files
     vs ~0.5–1 MB siblings): no theme chrome, no transit styling, just a faint route
     and a tiny "NAPA VALLEY". Theme likely **erroring during render**. BROKEN.
   - `contour-wash` — **print map area renders blank/white** (contour-wash fill
     missing) while editor shows texture. Print/editor divergence + missing fill.

### PER-THEME PUNCH LIST (lead with BROKEN; `[BASE?]` = blocked on tiles)

**BROKEN**
- `transit-diagram` — blank render, no chrome/theme. Cause: render/theme error. (no target)
- `cartouche-place` — title line "MÉXICO" dropped; cartouche box undersized & high.
  Cause: text-fit overflow + anchor.
- `contour-wash` — print map blank (fill missing); editor textured → print/editor
  parity break. Title OK. Cause: map-layer/anchor settle. `[BASE?]` for the texture.
- `editorial-minimal` — large Playfair "Wonderland" shrunk to ~small. Cause: text-fit.
  `[BASE?]` map should be minimal contour, shows hillshade.
- `bold-modern` — "WONDERLAND" should fill salmon band; renders ~1/3 width. text-fit.
  `[BASE?]` base too heavy.
- `blackline` — bottom-band "BOSTON" shrunk. text-fit. `[BASE?]` contour over-dense.
- `brutalist` — top "BOSTON" should be monumental/edge-cropped; renders small. text-fit.
  `[BASE?]` contour over-dense.
- `classic-trail` — serif title shrunk. text-fit. `[BASE?]` heavy hillshade vs thin contour.
- `blueprint-strava` — "BOSTON" shrunk; low contrast on dark base. text-fit. `[BASE?]`.

**MINOR**
- `electric-atlas` — magenta "BOSTON" smaller than target; dark theme otherwise close. text-fit.
- `marathon-bib` — "BOSTON" mildly shrunk vs heavy navy target; 2025 watermark + layout OK. text-fit (mild).
- `sea-chart` — title OK but low-contrast; `[BASE?]` pale nautical chart replaced by dark relief.
- `midcentury-travel` — title OK; `[BASE?]` flat tonal shapes replaced by relief.
- `usgs-vintage` — title/layout OK; `[BASE?]` cream contour replaced by green hillshade.
- `blueprint` — title OK; `[BASE?]` thin index contour replaced by relief.
- `botanical` — title OK (centered vs target left); `[BASE?]` delicate contour vs heavy relief.
- `daybreak-trace` — title OK; `[BASE?]` concentric contour vs hillshade.
- `moonstone` — title OK; `[BASE?]` thin contour+grid vs hillshade.
- `ranch-ochre` — title OK; `[BASE?]` flat tonal rings vs glossy relief.
- `risograph` — title + riso offset treatment good; `[BASE?]` clean blue contour vs blue relief.
- `copper-night` — close; title OK, dark theme tolerates relief. starfield slightly weak.
- `dark-sky` — close; title OK, dark theme tolerates relief.
- `relief-shaded` — on-theme relief (correct), but glossier/busier than target's soft banded relief. title OK.
- `plein-air` — full-bleed terrain; "Tre Cime" title small/low-contrast (possible shrink). (no target — can't confirm authored size)

**OK**
- `night-ride` — title + elevation strip match target; layout intact.
- `splits-stats` — title band + elevation strip + data row match; good.
- `field-journal` — coherent journal layout, title at top reasonable. (no target — fidelity unverifiable)

### Recommended fix order for Codex
1. **Re-capture all 27 WITH Atlas tiles** — until then half the punch list (`[BASE?]`)
   is unverifiable and you risk fixing a non-bug.
2. **transit-diagram** + **contour-wash print** — they render blank; fix the render
   failure (theme error / missing fill) so they're even reviewable.
3. **text-fit fit-target** — make hero/display titles render at AUTHORED size, scale
   down only on overflow. Repro on `cartouche-place` (line-drop), then verify
   `bold-modern`/`brutalist`/`editorial-minimal`/`blackline`/`classic-trail`.
4. Re-run this vision pass once 1–3 land; only then judge map-base per theme.

- 05:01 UTC — renders still incomplete (2/27 print, 3/27 editor present; regen in progress, prior full set cleared). The 2 completed themes (editorial-minimal, usgs-vintage) are flagged `"skipped":true` in capture-summary.json. Waiting on Codex regen to finish.
