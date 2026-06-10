# Theme Refinement v3 — Claude Vision Review (rolling, overnight)

Written by Claude's review automation, **read by Codex**. Drives all 27 themes to
parity with `docs/theme_screenshots/` across layout, colors, font sizing,
font-family, contour density, and artifact cleanup. Plan:
`docs/THEME_REFINEMENT_V3_PLAN.md`.

Loop: Codex refines a theme → regenerates its editor+print render (DEM contours
rendering, NOT raw hillshade) → commits. Each run Claude compares current renders to
targets and appends per-theme verdicts. **Codex: read newest entries before each
theme; resolve BROKEN first; no fabricated artifacts; map = DEM contours not tiles.**

Per-theme axes checked (vs `docs/theme_screenshots/<name>.png`):
1. **Layout** — bands, title/footer position, map ratio, framing, motif placement.
2. **Colors** — paper/field, route, contour, accents (vs sampled target pixels).
3. **Font sizing** — authored display size (no shrink-when-it-fits).
4. **Font-family** — title/body faces match target.
5. **Contour density** — DEM contours read like the target's map character; adaptive
   (dense on flat, sparse on mountains); NOT a raw hillshade dump.
6. **Artifacts** — only elements present in the target; flag anything invented.
7. **Editor == print** + print-validity (no blank fills, no overflow, 24×36 clean).

Severity: `OK` · `MINOR` · `BROKEN`. Lead with BROKEN. Note the axis + likely cause.

Known starting failures to confirm fixed: title autosizing shrink (hero titles),
`transit-diagram` blank, `cartouche-place` dropped "MÉXICO" line, `contour-wash`
blank print map, and raw-hillshade maps everywhere (→ should become styled DEM
contours).

---

<!-- Claude appends review passes below this line, newest at the bottom. -->

## 2026-06-09 06:09 UTC — Review pass 1 (first pass; all 27 renders fresh, 05:41–05:51)

Coverage: all 27 print renders read + targets compared (3 themes have no target —
`transit-diagram`, `plein-air`, `field-journal` — judged on print-validity only).
Editor==print spot-checked (copper-night editor == print). Renders are newer than
the latest refinement commits (f83120d … e5d1e64/dd9095f/6b97bf2), so this reflects
current state.

### Phase-1 foundation failures — STATUS
- **Title autosizing shrink → FIXED.** Hero titles are full authored size: WONDERLAND
  fills the bold-modern band, BOSTON is monumental on brutalist, all 27 titles render
  at size. No shrink-when-it-fits seen. Good.
- **`transit-diagram` blank → FIXED.** Now renders full chrome: NAPA VALLEY title,
  transit-station route, T1 badge, legend. Clean, print-valid.
- **`contour-wash` blank print → FIXED (content present), but map character BROKEN** —
  see below.
- **`cartouche-place` dropped MÉXICO → FIXED (line present), but still shrunk** — see
  below.

### SYSTEMIC PATTERN (the one big remaining axis) — CONTOUR RENDERING
Title/layout/color/font-family are largely landing. The map is the recurring miss,
in three distinct failure modes. The renderer CAN do it right (see usgs-vintage,
sea-chart, classic-trail — clean styled contour lines), so this is per-theme tuning
of the DEM contour pipeline, not a global break.

1. **HILLSHADE WASH instead of contour lines** (warm/colored-field themes). Map is a
   marbled raw-relief blur where the target wants clean concentric tonal bands + thin
   crisp contour lines. Affects: **copper-night (worst), contour-wash, botanical,
   midcentury-travel, daybreak-trace, ranch-ochre**, and relief-shaded (palette).
   → DEM contour styling not applied on these; raw hillshade still showing through.
2. **TOO SPARSE / GRID-ONLY** — map nearly empty or grid dominates, contour rings the
   target shows are missing/faint. Affects: **bold-modern (near-empty), risograph,
   blueprint, electric-atlas** (graph grid, no purple contour rings).
   → adaptive density not maxing on these extents; contour layer under-rendering.
3. **NOISY / FRAGMENTED fine lines, no index emphasis** — contours present but thin,
   busy, low-contrast, lacking bold index contours. Affects: **brutalist, blackline,
   moonstone (too dense), night-ride, splits-stats, marathon-bib, blueprint-strava**
   (mottled landcover texture vs clean rings).
   → add index-contour weight/emphasis; thin/clean the intermediate lines.

Secondary pattern — **MISSING FOOTER/SUBTITLE CONTENT** (content gaps, not fabricated
artifacts; no invented overlays spotted this pass): editorial-minimal, dark-sky,
cartouche-place each drop subtitle/eyebrow/coord lines present in their targets.

---

### BROKEN (fix first)
- **copper-night** — MAP: dense copper hillshade wash fills the whole field; target is
  a clean dark-brown vertical gradient with only SPARSE thin gold contour lines + a
  visible star field. Stars are buried in the texture. Apply gold contour styling,
  kill the hillshade. (Editor==print, same issue.) Title/palette OK.
- **contour-wash** — MAP: grey muddy hillshade smudge; target is crisp thin concentric
  topo contour lines across the full field. Blank-print bug is fixed, but the map
  character is wrong (relief wash, not styled echo contours). Route is too faint.
  Title/layout OK.

### MINOR
- **bold-modern** — MAP near-empty white; target has rich concentric contour rings
  around the peak. Contour density way under target (mode 2). Title FIXED/full,
  palette + rust accent block OK.
- **botanical** — MAP soft green hillshade blur; target is crisp dense green concentric
  contour lines w/ index emphasis (mode 1). Frame/title/sage palette OK.
- **midcentury-travel** — MAP marbled orange hillshade; target is clean concentric warm
  tonal bands + thin contour lines (mode 1). Title/palette OK.
- **daybreak-trace** — MAP marbled rose hillshade; target is clean concentric rose
  tonal bands + thin contour lines (mode 1). Title/palette OK.
- **ranch-ochre** — MAP marbled ochre hillshade; target is layered ochre tonal bands +
  thin brown contour lines (mode 1). Title/palette OK.
- **relief-shaded** — KEEP shaded (intentional) but COLOR: render too green/saturated &
  high-contrast; target is soft uniform warm tan/sand. Desaturate toward warm sand.
  Layout/title OK.
- **brutalist** — MAP contours thin/grey/tangled; target has BOLD black index contours
  + lighter intermediates, clean rings (mode 3). Title BOSTON monumental (FIXED),
  layout/color OK.
- **blackline** — MAP contours thin/fragmented/noisy (reads like coastline bits); target
  is clean bold black concentric rings w/ index emphasis (mode 3). Title/black-bar
  layout OK.
- **moonstone** — MAP contours too DENSE/busy; target is clean sparse grey lines. Thin
  out. Title/grid/lavender palette OK.
- **risograph** — MAP blue contour rings too sparse/faint; target has fuller concentric
  rings (mode 2). Riso offset title + pink/blue colors OK.
- **blueprint** — MAP white contours too sparse/faint, grid dominates; target has clean
  white concentric rings over the grid (mode 2). Title/blue/yellow-route OK.
- **blueprint-strava** — MAP mottled green landcover texture + grid; target has faint
  green concentric contour rings (mode 3). Title/stat-row/green palette OK.
- **electric-atlas** — MAP renders a blue graph-paper GRID, not the target's glowing
  purple concentric contour rings; route lacks the neon glow. Title/magenta/stat-row OK.
- **night-ride** — MAP field noisier/darker than target's clean faint concentric rings
  (mode 3). Title/cyan/elevation-profile/stat-row OK.
- **splits-stats** — MAP field noisy vs target's faint sparse rings; ALSO elevation
  profile renders blocky/stepped (square plateaus) vs target's natural jagged trace.
  Title/layout/stats OK.
- **dark-sky** — MISSING: "Mount Whitney Trail" subtitle, the top constellation/eyebrow
  line, and the faint concentric contour rings target shows. Title/navy/gold-route OK.
- **editorial-minimal** — MISSING: "WASHINGTON" accent, "The Wonderland Trail" subtitle,
  coords/distance footer line. MAP faint mottled texture vs clean contour rings.
  Title/cream palette OK.
- **cartouche-place** — MÉXICO line restored, but TITLE shrunk to 2 lines (CIUDAD DE /
  MÉXICO) vs target's monumental 3-line stack; MISSING the small "MÉXICO" eyebrow above
  + the bottom mountain silhouette. Cartouche box smaller than target. Street-grid map
  denser than target.

### OK (minor/none)
- **usgs-vintage** — Strong topo parity, full title, border/ticks/scale all there.
  Minor: contours slightly busier & cooler-toned than target's warm tan.
- **sea-chart** — Strong nautical parity: pale sea-green, scattered soundings,
  magenta-tinted compass rose (refinement landed), sparse depth contours, full title.
- **classic-trail** — Clean topo parity, full serif title, border/scale. Minor:
  contours a touch fainter/sparser than target.
- **marathon-bib** — Excellent layout/title/color/2025-watermark parity. Minor: map
  band shows faint mottled landcover texture vs target's faint concentric rings.
- **transit-diagram** — (no target) print-valid, clean, full chrome. Was blank → fixed.
- **plein-air** — (no target) print-valid, soft watercolor wash + serif title, not blank.
- **field-journal** — (no target) print-valid, journal layout w/ ruled notes + stats box.

### Net
27/27 render and are print-valid (no blanks, no overflow seen; editor==print where
checked). Phase-1 title-shrink and the 3 render failures are resolved. The remaining
gap to parity is almost entirely the **DEM contour pipeline** (the 3 modes above) plus
3 themes with **missing subtitle/footer lines**. Prioritize: copper-night + contour-wash
(BROKEN map), then the hillshade-wash group (mode 1: botanical, midcentury-travel,
daybreak-trace, ranch-ochre), then the index-emphasis/sparse cleanups.

---

## 2026-06-09 07:02 UTC — Review pass 2 (3 new renders since pass 1: contour-wash 06:52, bold-modern 06:36, cartouche-place 06:12)

Only 3 themes re-rendered since pass 1 (06:09); the other 24 are unchanged from
pass 1 (05:41–05:51) — see that pass for their punch lists. This pass reviews only
the three new renders. **No theme is BROKEN this pass** — the two prior BROKEN/blank
failures here are resolved.

### Confirmed fixed
- **contour-wash** — the blank-print failure is FIXED. Print now renders a full
  contour field + route + TRE CIME title (editor==print). Big win.
- **cartouche-place** — the title-shrink is FIXED. Hero now stacks 3 monumental serif
  lines (CIUDAD / DE / MÉXICO) matching the target, with the "MÉXICO" eyebrow,
  "Ciudad de México" subtitle, and the coords/elev footer all present.

### Per-theme verdicts

- **contour-wash — MINOR.** No longer blank. CONTOUR DENSITY/character is the remaining
  gap: the field renders as clumpy, mottled dark patches (heavy blobs upper-right +
  lower-left) instead of the target's clean, smooth, evenly-spaced concentric lines.
  Reads like a thresholded hillshade-to-contour dump rather than styled even contours.
  Fix: thin + even out spacing, kill the dark clumped patches, aim for the target's
  uniform flowing line weight. LAYOUT/COLORS/FONT (eyebrow "ITALIA 46.4186°N", TRE CIME,
  "DOLOMITI, ITALIA", off-white paper) all OK. Editor==print OK.

- **bold-modern — MINOR.** Chrome is strong parity: red-orange L accent bar, WONDERLAND
  in bold condensed sans at full authored size, "WASHINGTON" eyebrow, subtitle +
  "93.0 MI / 46.8523°N" stats all match modernist.png. CONTOUR DENSITY off: contours are
  styled (not raw hillshade — progress) but fragmented/blobby and unevenly distributed —
  clumped on the right, large empty white field on the left — vs the target's clean,
  smooth, evenly nested concentric rings around the central peak. Fix: increase density
  on the flat/left areas and smooth the line work toward concentric. Route (red w/ square
  markers) OK. Editor==print OK.

- **cartouche-place — MINOR.** Title-shrink + MÉXICO eyebrow fixed (see above).
  Remaining: (1) ARTIFACT/missing — the target's bottom dark MOUNTAIN SILHOUETTE band is
  still absent from the print; (2) the background street-grid is fainter/lower-contrast
  in print than the target (editor shows it stronger — print is washing it out, verify
  print map opacity); (3) cartouche box reads slightly smaller/lower than the target's.
  COLORS/paper/FONT-FAMILY OK. Editor==print roughly OK (editor grid darker than print).

### Net (this pass)
3/3 new renders are print-valid, no blanks, no overflow, editor==print. Both targeted
failures (contour-wash blank, cartouche title shrink) are resolved → 0 BROKEN remaining
across the whole set as of last-known renders. The dominant remaining axis is still
**CONTOUR DENSITY/character** — even the freshly-refined maps (contour-wash, bold-modern)
render clumpy/fragmented contours rather than the targets' clean even concentric lines,
so the DEM contour styling still needs the spacing/smoothing tuning called out in pass 1.
Next: re-render the pass-1 hillshade-wash + sparse groups, and add cartouche-place's
mountain silhouette.

---

## 2026-06-09 08:06 UTC — Review pass 3 (FULL re-render: all 27 themes fresh 07:48–07:59)

Every theme re-rendered after pass 2 (07:02), driven by `f83120d Enable tier 2
poster overlays`, `2faadee Enable structural chrome deletes`, plus the 3 refined
commits (`e5d1e64` copper-night warm star field, `dd9095f` sea-chart magenta compass,
`6b97bf2` contour-wash sharpen echo). Full set reviewed against targets.
**0 BROKEN / 0 blank. All 27 are print-valid (editor==print where checked).** But two
new chrome-delete regressions and one profile-render bug appeared this pass — lead with
those.

### Systemic patterns (top priority)

1. **CHROME-DELETE OVER-PRUNE on 2 themes (NEW regression, likely `2faadee`).**
   - **editorial-minimal** dropped its subtitle **"The Wonderland Trail"**, the footer
     line **"46.8523°N 121.7603°W / 93.0 mi · AUG 2025"**, AND the red **"WASHINGTON"**
     accent eyebrow. Only "Wonderland" + "MOUNT RAINIER, WASHINGTON" remain.
   - **dark-sky** dropped its top eyebrow **"CALIFORNIA · 36.5785°N"** and its subtitle
     **"Mount Whitney Trail"** (footer/title still present).
   - **Cross-check proof it's a delete bug, not data:** relief-shaded renders the SAME
     Wonderland record and keeps subtitle + WASHINGTON tag + full footer. So the structural
     chrome-delete pass removed real target content on editorial-minimal/dark-sky. Restore
     those slots (they ARE in the targets).

2. **FABRICATED-OVERLAY audit on `f83120d` (tier 2 overlays).** Verify these render-only
   elements are actually in-target; flag/remove if invented:
   - **classic-trail** — small RADMAPS **logo emblem bottom-left** that is NOT in the
     target (target has "SCALE 1:24,000" bottom-right + a top coord eyebrow, both now
     MISSING). Looks like an overlay swapped in for the scale label.
   - **plein-air** — three swatch **dots bottom-right** (plausibly the palette motif, but
     confirm against target).
   - **transit-diagram** — T1 route badge by the title, the START/STOP/FINISH legend, and
     the "T1 · 45/90 GPX LINE" scale chip. NOTE: there is **no transit-diagram.png target**
     in docs/theme_screenshots/, so these can't be parity-checked — needs a human call on
     whether they're wanted.

3. **CONTOUR CHARACTER — still the dominant cross-theme gap (but now styled, not raw
   hillshade — progress holds).** Two failure modes persist:
   - *Line-art themes* (bold-modern, brutalist, blackline, risograph, modernist,
     classic-trail, moonstone): DEM contours render as scattered **coastline/island-like
     outline fragments** rather than the targets' soft, even, **concentric** rings.
   - *Wash themes* (contour-wash, mid-century, daybreak-trace, ranch-ochre): contours read
     **clumpy/mottled** vs the targets' clean even concentric lines.
   - Fix is the same as pass 1/2: even out spacing + smooth toward concentric. Adaptive
     density is closer but the line-art group especially needs the "concentric not
     coastline" treatment.

### Verify-the-known-failures (task checklist) — all CONFIRMED FIXED
- **title shrink → FIXED** everywhere: WONDERLAND, BOSTON, MOUNT WHITNEY, TRE CIME all
  render at full authored display size.
- **transit-diagram blank → FIXED**: now a full transit layout (purple route + named
  stations, NAPA VALLEY title, legend). (Artifacts unverifiable — no target; see #2.)
- **cartouche-place MÉXICO line → FIXED**: CIUDAD / DE / MÉXICO all present.
- **contour-wash blank print → FIXED** (stays fixed); clumpiness remains (see #3).
- **raw-hillshade dump → largely resolved**: wash themes now match their warm radial-shaded
  targets; relief-shaded intentionally keeps shaded terrain.

### Refined-commit verdicts
- **sea-chart — OK.** Magenta compass-rose tint applied; strong nautical parity (depth
  contours, soundings, dotted route, double border, monumental serif title). Best of the 3.
- **copper-night — MINOR.** Warm star field present (refinement landed). But the hero
  "Tre Cime" reads grey/white, not the target's **copper/gold**; copper contour lines very
  faint. Fix: warm the title fill to copper + lift contour opacity.
- **contour-wash — MINOR.** No longer blank; "sharpen echo" made contours more present but
  they're still heavy/clumped in patches vs the target's uniform thin concentric lines.

### Per-theme severity (all 27)
- **OK / strong parity (12):** blueprint, blueprint-strava, usgs-vintage, marathon-bib,
  night-ride, electric-atlas, botanical, sea-chart, field-journal, moonstone,
  bold-modern*, risograph* (*chrome+title strong; contour character is the only gap).
- **MINOR — missing chrome (2, lead):** editorial-minimal (subtitle+footer+WASHINGTON),
  dark-sky (eyebrow+subtitle). See #1.
- **MINOR — render bug:** **splits-stats** — the ELEVATION PROFILE renders as blocky
  flat-topped **battlement/trapezoid steps** instead of a natural jagged line. Proof it's
  theme-specific: night-ride uses the same profile component and renders a correct natural
  jagged profile. Also verify a faint **blue grid** isn't being added over the map (target
  map is plain dark; electric-atlas legitimately has a grid, splits-stats does not).
- **MINOR — overlay/label:** classic-trail (logo emblem swapped for missing scale label +
  missing eyebrow; see #2).
- **MINOR — artifact still missing:** cartouche-place — the target's bottom **mountain
  silhouette band** is still absent; print street-grid still washed out (editor shows it
  stronger).
- **MINOR — colors/contour:** copper-night (title not copper), relief-shaded (relief tone
  reads yellow-green; neutralize toward target's soft warm tan, lift contour overlay).
- **MINOR — contour character only (chrome/colors/font all OK):** brutalist, blackline,
  modernist/bold-modern, risograph, mid-century, daybreak-trace, ranch-ochre, contour-wash,
  plein-air. See #3.

### Net (this pass)
Title-fit and the 3 original render failures stay fixed; refinements (sea-chart, copper
star field, contour-wash sharpen) landed. The NEW work needed: (1) restore the over-deleted
chrome on **editorial-minimal** + **dark-sky**; (2) fix **splits-stats** elevation profile
(battlement → natural line); (3) artifact-audit the tier-2 overlays (classic-trail logo,
transit-diagram chips, plein-air dots); (4) keep grinding **contour character** toward
even concentric on the line-art group + de-clump the wash group; (5) add cartouche-place's
mountain silhouette. Prioritize 1+2 (regressions) before the contour polish.

## 2026-06-09 09:01 UTC — Review pass 4 (3 themes re-iterated post-pass-3; no new commits)

SCOPE: No new commits since pass 3 (HEAD still `f83120d`). The full 27-render batch was
re-run 08:09–08:13 (no code change → reproduces pass 3 punch lists for those 24; not
re-reviewed). Three themes were re-rendered LATER, indicating active working-tree
iteration on the pass-3 regressions: **brutalist** (08:51), **blackline** (08:59),
**editorial-minimal** (09:01). This pass reviews only those three.

### Lead — BROKEN
- **brutalist — BROKEN (contour character + EDITOR≠PRINT).** Chrome is now strong parity
  (crop marks, RADMAPS/MASSACHUSETTS/04.21.2025 header, full-size BOSTON, bordered map box,
  rule + footer + orange "26.2 mi"). But the map is wrong on two counts and the two
  surfaces disagree:
  - *PRINT*: contours are washed near-invisible (faint grey squiggles) — the target's BOLD
    black CONCENTRIC rings are absent. Plus a stray dark **coastline/island fragment in the
    lower-right corner** (fabricated artifact, not concentric — flag for removal) and a
    faint **grid** overlaying the map (target map is plain paper, NO grid — remove).
  - *EDITOR*: contours render DARK but as scattered **coastline fragments**, not concentric
    rings — i.e. the old line-art failure mode, at full weight. Same stray grid.
  - Net: EDITOR≠PRINT (dark-coastline vs washed-faint) AND neither matches the target's
    even bold concentric black contours. Fix: apply the concentric DEM contour treatment at
    a heavy uniform weight, make print match editor weight, and strip the grid + the
    bottom-right coastline fragment.

### MINOR
- **editorial-minimal — MINOR (partial chrome restore; contour still wash).** Progress: the
  **subtitle "MOUNT RAINIER, WASHINGTON" is back** and title renders full size; editor==print.
  Still MISSING vs target: (a) the red **"WASHINGTON"** accent label (top-right of the
  caption block), (b) the **"The Wonderland Trail"** trail-name line, (c) the bottom-right
  **metadata block** (46.8523°N 121.7603°W / 93.0 mi · AUG 2025). So the eyebrow+accent row
  and the metadata column are still dropped — finish restoring them. Map contour still reads
  as a mottled hillshade-wash, not the target's clean even concentric topo lines.

### OK
- **blackline — OK (regression fixed).** The marathon titleblock binding landed: eyebrow
  "MASSACHUSETTS", full-size condensed "BOSTON", black bottom-left corner block, rule, and
  the "Boston Marathon / Hopkinton → Boylston St" + "26.2 MI / 42.3601°N" footer all match
  the target. editor==print. Contours now read as proper **concentric rings** (no longer
  coastline fragments) — the only nit: line weight is a touch faint/light-grey vs the
  target's even thin black contours, and the route could be slightly heavier with clearer
  start/end dots. Minor polish, not blocking.

### Net (this pass)
blackline's pass-3 regression is RESOLVED (chrome + concentric contours). editorial-minimal
is half-fixed (subtitle back; accent/trail-name/metadata still missing). brutalist is the
priority: chrome is done but the map is BROKEN — print washed + editor dark-coastline +
stray grid + corner fragment, all on contour treatment. Order: (1) brutalist contour
(concentric + print==editor + strip grid/fragment); (2) finish editorial-minimal caption
restore. Splits-stats battlement profile and the other pass-3 items were not re-rendered
this cycle — still open per pass 3.

## 2026-06-09 10:05 UTC — Review pass 5 (full 27-render re-batch; no new commit)

SCOPE: HEAD still `f83120d` (no new commits since pass 4), but all 27 print+editor
renders are freshly dated 09:54–09:57 — a full working-tree re-render with active
contour/chrome iteration. Re-reviewed the pass-4 priority items + a systemic contour
sweep across the topo/line-art and relief groups.

### Systemic patterns (read first)
- **CONTOUR CHARACTER is now THE blocker — it's the last axis holding most themes back.**
  The raw-hillshade dump is gone (good), but the replacement has NOT reached the targets'
  **dense even concentric rings**. Two failure modes:
  1. *Line-art group* (classic-trail, usgs-vintage, bold-modern, contour-wash, brutalist):
     contours render as **sparse, irregular "coastline-fragment" islands** (or a faint
     wash) instead of dense even concentric topo lines. usgs-vintage and classic-trail
     in particular look near-empty vs their target's full-poster concentric weave.
  2. *Relief/tonal group* (relief-shaded, editorial-minimal, midcentury-travel,
     splits-stats top): still a **noisy hillshade-wash / mottled blobs** instead of the
     targets' **smooth concentric tonal bands + clean fine contour lines**. The
     adaptive-density math seems to be thinning/clumping contours rather than spacing
     them evenly; tune toward even concentric spacing, not sparse islands.
- **STRAY GRID overlay** appears on **brutalist** (both surfaces) and **splits-stats**
  top map — neither target has a grid. Remove.
- **Tier-2 overlay artifact audit (no targets exist for these themes — verify intent):**
  **plein-air** renders 3 grey dots bottom-right (both surfaces); **transit-diagram**
  renders invented station names (RIDGE/OVERLOOK/CELLAR/VINE). No screenshot supports
  either — confirm they're authored design, not fabricated, or strip. classic-trail's
  fabricated logo is GONE (good).

### Known starting failures — ALL FIXED, confirmed this pass
- `transit-diagram` blank → **renders** (full NAPA VALLEY transit layout, T1 badges, legend).
- `cartouche-place` dropped MÉXICO → **MÉXICO eyebrow line restored**; 3-line title intact.
- `contour-wash` blank print → **renders** (TRE CIME, route + faint echo contours).
- Title autosizing → **stable everywhere**: full-size BOSTON (brutalist/blackline/splits/
  marathon), WONDERLAND (bold-modern/editorial), CIUDAD DE MÉXICO (3 lines, no drop).

### Lead — BROKEN
- **brutalist — BROKEN (contour + EDITOR≠PRINT + grid).** Chrome is full parity (crop marks,
  RADMAPS/MASSACHUSETTS/04.21.2025, monumental BOSTON, bordered map, rule + footer + orange
  "26.2 mi"). The bottom-right coastline fragment is GONE (fixed). But the map is still wrong:
  *PRINT* = contours washed to near-invisible faint grey squiggles + a faint **grid** over the
  map; *EDITOR* = contours render **dark but as blobby coastline fragments**, not rings + same
  grid. So EDITOR≠PRINT on weight, neither matches the target's **bold even concentric black
  rings**, and a grid that isn't in the target sits on both. Fix: apply concentric DEM
  contours at heavy uniform weight, make print match editor weight, strip the grid.

### MINOR
- **splits-stats — MINOR (improved).** Pass-3 "battlement" elevation profile is now a
  **smooth filled mound** — better, but target is a **natural jagged/spiky** profile; add
  back micro-variation. Top map carries the **stray grid + blobby fragment contours** vs
  target's faint clean concentric rings — de-grid + even out.
- **usgs-vintage — MINOR (contour too sparse).** Chrome perfect (MOUNT WHITNEY, SIERRA
  NEVADA, scale 1:24,000, coords, border). Map is the standout density miss: **sparse blobby
  contour islands** where the target is a **dense even concentric brown weave** filling the
  poster. This theme lives or dies on contour density — push interval down hard.
- **classic-trail — MINOR (contour too sparse).** Same as usgs: clean chrome (THE COBBLER,
  ARGYLL SCOTLAND, scale, coords, frame), but contours are **wispy sparse islands** vs the
  target's dense even concentric grey. No fabricated logo (good).
- **bold-modern — MINOR (contour weight/character).** Chrome strong (red side-accent
  WASHINGTON, WONDERLAND band, route, metadata). Contours are **heavy black angular
  coastline-fragments**, not the target's **fine even concentric grey rings** — too heavy,
  too jagged. Lighten + concentric-ize.
- **contour-wash — MINOR (contour crispness).** Print no longer blank (fixed). Contours read
  as a **faint mottled echo-wash**; target is **crisp even concentric lines**. Sharpen toward
  defined lines. Title/subtitle/route all match.
- **editorial-minimal — MINOR (caption fully restored; contour wash).** Big progress: the
  caption block is now COMPLETE — "MOUNT RAINIER, WASHINGTON" eyebrow, red **WASHINGTON**
  accent, **"The Wonderland Trail"** line, and the **bottom-right metadata** (46.8523°N
  121.7603°W / 93.0 MI · AUG 2025) are all back. Only remaining miss: map is a **soft
  hillshade-wash**, target is **clean even concentric topo lines**.
- **relief-shaded — MINOR (relief too noisy).** Chrome matches (Wonderland, WASHINGTON
  accent, metadata). Relief is a **rough noisy hillshade**; target is **smooth layered
  tonal bands with visible fine contour lines**. Smooth the relief + overlay contour lines.
- **cartouche-place — MINOR (motif).** MÉXICO line + full cartouche restored. Still missing
  the target's **soft mountain silhouette** at the bottom and the bolder **angular street-grid**
  lines — background is too faint/orthogonal vs the target's diagonal street weave.
- **midcentury-travel — MINOR (contour on the relief).** Warm radial sun-graded relief reads
  close, but contours over it are **blobby coastline-fragments** vs target's **smooth
  concentric tonal bands**. Chrome (VISIT / TRE CIME / DOLOMITI) matches.
- **dark-sky — MINOR (verify print parity).** Editor shows full chrome incl. bottom metadata
  (Sierra Nevada, California / 22.0 mi · 14 SEP 2025) — much improved from pass-4 over-delete.
  Verify the **bottom metadata + header constellation** also render at full strength in PRINT
  (faint/possibly cropped there) — possible EDITOR≠PRINT. Star-field + gold route + title OK.

### OK
- **blackline — OK.** Holds from pass 4: concentric contours, marathon titleblock, footer all
  parity. (Contours could be a hair heavier but not blocking.)
- **marathon-bib — OK.** Strong parity: BIB header, faint contour top map, grey 2025
  watermark behind navy BOSTON, FINISHER · 3:24:51, footer all match. Contour even fainter
  than target but both subtle — fine.
- **transit-diagram — OK (renders).** Resolved from blank. Pending only the station-name
  artifact audit noted above.

### Net (this pass)
All four original render failures + title-fit stay fixed; pass-4 regressions largely
recovered (editorial-minimal caption fully restored; dark-sky chrome back in editor;
brutalist corner fragment gone). The work has converged onto ONE axis: **contour
character.** Order of attack: (1) **brutalist** — concentric + print==editor + kill grid
(only BROKEN left); (2) the **contour-density tune** for the line-art group
(usgs-vintage, classic-trail, bold-modern, contour-wash) — sparse blobby islands →
dense even concentric; (3) **relief-group smoothing** (relief-shaded, editorial-minimal,
midcentury, splits-stats) — noisy wash → smooth concentric bands + clean lines; (4)
de-grid splits-stats; (5) tier-2 artifact audit (plein-air dots, transit station names);
(6) splits-stats profile micro-variation + cartouche mountain silhouette. Chrome/typography
are essentially done across the set — this is now a map-rendering problem.

## 2026-06-09 11:02 UTC — Review pass 6 (full 27-render re-batch 10:47–10:50; new commits since pass 5: 2faadee "structural chrome deletes", f83120d "tier 2 poster overlays", + Mapbox typeahead/editor slot work)

### Systemic (read first)
- **NO BROKEN themes left.** brutalist — the lone BROKEN from passes 1–5 — is resolved
  (renders, EDITOR==PRINT, fabricated grid gone, BOSTON title fills the band, footer present).
- **Contour-density fix LANDED but UNEVENLY.** The dense-even-concentric treatment now reads
  on **usgs-vintage** (was sparse blobby islands → now dense concentric weave) and
  **bold-modern** (was heavy black coastline-fragments → now fine grey concentric rings) — big
  wins. But it did NOT propagate to the rest of the line-art/wash group: **classic-trail** still
  wispy/sparse, **contour-wash** still faint blobby echo, **editorial-minimal** still soft wash,
  **brutalist** lacks index-contour emphasis. The styling exists — push it to the remaining themes.
- **EDITOR==PRINT holds; chrome-delete commit did NOT over-delete** (no pass-4-style regression).
  Verified on brutalist, dark-sky, splits-stats, transit-diagram — print now carries the same
  chrome as editor. The pass-5 **dark-sky EDITOR≠PRINT** worry is RESOLVED: print shows the
  bottom metadata + header constellation at full strength.
- **Tier-2 overlay commit: no fabricated artifacts** on the targeted themes checked. (plein-air
  still shows its 3 corner dots, but plein-air has NO design target — can't call it fabricated.)
- **3 themes have no target** (plein-air, field-journal, transit-diagram) — judged on render
  validity + editor==print only, not parity.
- **Scope note:** this pass focused on (a) the BROKEN/MINOR contour group and (b) confirming the
  structural-delete + tier-2-overlay commits didn't regress chrome or add artifacts (the only new
  code since pass 5 is editor-feature work, not the contour/chrome renderer). Themes not re-read
  here (blackline, marathon-bib, botanical, blueprint(-strava), copper-night, sea-chart, moonstone,
  night-ride, risograph, ranch-ochre, daybreak-trace, electric-atlas, midcentury-travel,
  field-journal) carry forward their pass-5 status.

### Resolved this pass (BROKEN/regression → OK)
- **brutalist — OK now.** EDITOR==PRINT (both render BOSTON + bordered map + footer); fabricated
  grid gone; title fills the band. ONE residual nit (see MINOR): no bold black **index-contour**
  emphasis — target has thick black concentric rings over fine grey; current is a uniform thin-grey
  tangle.
- **dark-sky — OK.** print==editor, bottom metadata (Sierra Nevada, California / 22.0 mi · 14 SEP
  2025) + header now render in PRINT. Star field, gold route, title all parity.
- **usgs-vintage — OK (density fixed).** Map now reads as a dense even concentric weave filling the
  poster — the pass-5 "sparse blobby islands" miss is gone. Chrome perfect (MOUNT WHITNEY, SIERRA
  NEVADA, 1:24,000, coords, border). Maybe a hair lighter than target; not blocking.
- **splits-stats — OK (both fixes landed).** De-gridded (stray top-map grid gone) AND the elevation
  profile is jagged/natural again (was a smooth mound in pass 5). BOSTON chrome + 813 FT GAIN + stat
  row all parity. Tiny nit: top-map contours read faint **blue** blobs vs target's faint grey
  concentric — minor.
- **transit-diagram — OK.** Renders clean, editor==print (NAPA VALLEY, T1 line badge, stations,
  legend, 45/90 GPX LINE scale). Station labels are the genre, not fabricated artifacts. No target.

### MINOR (lead: contour character — this is now the whole game)
- **relief-shaded — MINOR (COLOR is the miss now).** Field reads **green/olive**; target is **warm
  tan/beige**. Relief also still **noisy** vs target's **smooth layered tonal bands w/ fine contour
  lines**. Chrome matches (Wonderland, WASHINGTON accent, metadata). Fix hue → warm tan, smooth the
  relief, overlay fine contours.
- **classic-trail — MINOR (contour too sparse).** Density fix from usgs did NOT reach here: contours
  are **wispy sparse grey islands**; target (West Highland Way) is a **dense even concentric grey**
  filling the poster. Clean chrome (THE COBBLER, ARGYLL SCOTLAND, scale, frame, blue route). Apply
  the usgs-vintage density treatment.
- **contour-wash — MINOR (contour crispness).** Print no longer blank (holds). Map is a **faint
  blobby echo-wash**; target is **crisp even concentric fine lines**. Sharpen toward defined
  concentric lines. TRE CIME title/route parity.
- **editorial-minimal — MINOR (map wash + hue).** Caption fully present (Wonderland, MOUNT RAINIER
  WASHINGTON, red WASHINGTON accent, 46.8523°N / 93.0 MI · AUG 2025). Map is a **soft warm
  hillshade-wash**; target is **clean grey even concentric topo lines**. De-wash + cool the hue.
- **brutalist — MINOR (index-contour emphasis).** See Resolved. Add **bold black concentric index
  contours** over the fine grey; current uniform thin-grey tangle lacks the target's heavy ring
  structure.
- **bold-modern — MINOR (outer contour weight).** Much improved to fine grey concentric, but the
  **outer rings are still a touch heavy/black-jagged** vs target's uniform fine grey. Near-OK;
  lighten the outermost contours. Chrome (WASHINGTON eyebrow, WONDERLAND, red accent, 93.0 MI /
  46.8523°N) parity.
- **cartouche-place — MINOR (motif).** MÉXICO line + full cartouche hold. Still missing the target's
  **soft mountain silhouette** along the bottom and the **bolder angular diagonal street weave** —
  current background grid is too faint and too orthogonal.

### Order of attack for next render
1. **Propagate the usgs/bold-modern contour-density treatment** to the themes it skipped:
   classic-trail, contour-wash, editorial-minimal (dense even concentric; de-wash).
2. **brutalist index contours** — add bold black concentric index rings over fine grey.
3. **relief-shaded color** — green/olive → warm tan/beige + smooth relief.
4. **bold-modern** — lighten outermost contour rings.
5. **cartouche-place** — add mountain silhouette + bolder diagonal street weave.
6. **splits-stats** top-map contour color (blue → grey) — cosmetic, last.
Chrome, typography, title-fit, render-validity, and editor==print are DONE across the checked set.
This remains purely a map-contour-styling problem, now down to ~6 themes.

## 2026-06-09 12:04 UTC — Review pass 7 (full re-batch 11:45–11:48; NO new refinement commit since pass 5/6 — top commit still f83120d "tier 2 poster overlays" @ 06-08 19:58)

### Systemic (READ FIRST — the pass-6 contour wins REGRESSED with no commit behind them)
- **The contour-density treatment has broadly REVERTED since pass 6, even though git shows
  no new commit.** Renders were regenerated at 11:45–11:48 but the top commit is unchanged
  (f83120d, 06-08 19:58). So the 11:45 re-batch ran against a renderer state that LOST the
  pass-6 contour styling — likely an **uncommitted/broken working tree, or the DEM contour
  layer failed to generate and fell back to raw hillshade.** Codex: figure out why this batch
  doesn't match the committed state before refining further — you may be reviewing renders that
  don't reflect your code.
- **Two failure modes are back across the map group:**
  - **(A) Raw hillshade tangle** (the core v3 bug — "raw DEM hillshade with no contour styling"):
    **brutalist, splits-stats (top map), night-ride (top map), midcentury-travel, relief-shaded.**
    These show a noisy squiggle/blob hillshade dump, NOT styled concentric contour lines.
  - **(B) Sparse blobby islands / heavy fragments** (density treatment not applied): **usgs-vintage**
    (was the pass-6 density WIN — now back to sparse light islands), **bold-modern** (was fine grey
    concentric — now heavy black coastline fragments), **classic-trail, contour-wash, editorial-minimal.**
- **What still reads correctly tells you the fix scope:** **blackline** and **marathon-bib** render
  clean — but only because their target map is *meant* to be sparse/faint, so they survive the
  regression by luck. The themes whose targets want dense even concentric or smooth tonal bands all broke.
- **Chrome / typography / title-fit / editor==print are still solid** where checked (brutalist
  editor==print both show the same hillshade; BOSTON/WONDERLAND/etc. fill their bands; footers,
  metadata, accents all present). This remains purely a **map-rendering** regression, now wider
  than pass 6.
- **3 themes have no target** (plein-air, field-journal, transit-diagram) — judged on validity only.

### BROKEN (lead here — raw hillshade dump = the explicit v3 contract violation; all REGRESSIONS from pass-6 OK)
- **brutalist — BROKEN (regressed).** Map is now a **noisy raw-hillshade tangle**; target is
  **bold black concentric index rings over fine grey concentric**. EDITOR==PRINT (both broken).
  Chrome/title/footer fine. Fix: restore styled concentric DEM contours + bold black index rings;
  kill the hillshade.
- **splits-stats — BROKEN (regressed).** Top map is a **blue-grey hillshade tangle**; target is
  **faint grey concentric rings** on navy. Was OK in pass 6. Profile (jagged + orange gradient),
  BOSTON chrome, 813 FT GAIN, stat row all fine. Fix: concentric faint-grey contours, no hillshade.
- **night-ride — BROKEN (regressed).** Top map is a **blue hillshade blob tangle**; target (MOAB)
  is **faint grey concentric rings** on navy. Cyan route, ELEVATION PROFILE, stat row fine. Fix:
  concentric contours, kill hillshade.
- **midcentury-travel — BROKEN (regressed).** Map is a **rough orange hillshade tangle**; target
  is a **smooth warm radial sun-graded relief in concentric tonal bands** with thin contour lines.
  VISIT / TRE CIME / DOLOMITI chrome fine. Fix: restore the smooth radial concentric grade.

### MINOR (contour character — apply once the renderer regression above is resolved)
- **usgs-vintage — MINOR (regressed from the pass-6 WIN).** Back to **sparse light blobby islands**;
  target is a **dense even concentric grey weave** filling the poster. Chrome perfect (MOUNT WHITNEY,
  SIERRA NEVADA, 1:24,000, coords, border). Re-apply the density treatment that landed in pass 6.
- **bold-modern — MINOR (regressed).** Back to **heavy black coastline-fragment outlines** (sparse,
  jagged); target is **fine uniform grey concentric rings**. Chrome (WASHINGTON eyebrow, WONDERLAND,
  red accent, 93.0 MI / 46.8523°N) parity. Restore fine grey concentric, drop the heavy black.
- **classic-trail — MINOR.** Still **wispy sparse grey blob-islands**; target (West Highland Way) is a
  **dense even concentric grey** filling the poster. Chrome (THE COBBLER, ARGYLL SCOTLAND, scale, frame,
  blue route) clean. Apply the dense-concentric treatment.
- **contour-wash — MINOR.** Map is a **blobby noisy echo-wash**; target (TRE CIME) is **crisp even
  concentric fine lines**. Print not blank (holds). Sharpen to defined concentric lines. Title/route parity.
- **editorial-minimal — MINOR (map + layout).** Map is a **soft tan hillshade-wash**, hue **too warm**;
  target is **clean cool-grey even concentric topo lines**. ALSO **layout**: map ratio is too small and
  the caption block is spread with a dead-space gap (Wonderland sits high, metadata stranded at the very
  bottom); target's caption is a **compact block at the bottom** with the map filling more of the sheet.
  All caption content present (Wonderland, MOUNT RAINIER WASHINGTON, red WASHINGTON, 46.8523°N / 93.0 MI
  · AUG 2025). De-wash + cool the hue + tighten the caption / grow the map.
- **relief-shaded — MINOR.** Color is **warmer/better** now (tan, less olive — improvement); but relief
  is still a **rough noisy hillshade** vs target's **smooth layered tonal bands with fine contour lines**.
  Chrome matches (Wonderland, WASHINGTON accent, metadata). Smooth the relief + overlay fine contours.
- **cartouche-place — MINOR (near-OK).** MÉXICO line + full cartouche hold (MÉXICO / CIUDAD DE MÉXICO /
  Ciudad de México / 19.4326°N 99.1332°W · 2,240 m). Mountain silhouette now **faintly present** (better).
  Residual: street weave is **too faint and not angular/diagonal enough** vs target, an **offset
  rectangular frame artifact** sits top-left, and the cartouche box sits a touch **low** vs target's center.

### OK
- **blackline — OK.** Clean concentric grey contours, heavy black route, MASSACHUSETTS/BOSTON chrome,
  footer, black corner block — parity. (Survives the regression because its map is concentric-clean here.)
- **marathon-bib — OK.** Faint sparse top contours, red jagged route, grey 2025 watermark behind navy
  BOSTON, FINISHER · 3:24:51, 26.2 mi / 813 ft GAIN / coords — parity. (Target wants faint/sparse, so OK.)
- **transit-diagram — OK (renders, no target).** NAPA VALLEY, T1 badge, RIDGE/OVERLOOK/CELLAR/VINE/
  START/FINISH stations, legend, 45/90 GPX LINE scale all render clean. Station labels are the genre.

### Order of attack for next render
1. **Diagnose the regression first.** The 11:45 batch lost the pass-6 contour styling with no commit
   behind it — confirm the renderer is building from the intended (committed) state and the DEM contour
   layer is actually generating, not falling back to raw hillshade. Refinement on this batch is wasted
   until the maps reflect the committed code.
2. **Kill the hillshade dump** on brutalist, splits-stats, night-ride, midcentury-travel, relief-shaded →
   styled concentric DEM contours (brutalist: + bold black index rings; midcentury/relief: smooth tonal bands).
3. **Re-land the density treatment** that worked in pass 6 on usgs-vintage + bold-modern, then propagate to
   classic-trail, contour-wash, editorial-minimal (dense even concentric; de-wash; cool editorial's hue).
4. **editorial-minimal layout** — grow the map ratio, tighten the caption block (kill the dead-space gap).
5. **cartouche-place** — bolder diagonal street weave; remove the offset rectangle artifact; nudge cartouche up.
Chrome, typography, title-fit, render-validity, and editor==print remain DONE across the checked set.

## 2026-06-09 13:05 UTC — Review pass 8 (full re-batch 12:48–12:52; HEAD still f83120d but a large UNCOMMITTED working tree now touches the renderer)

### Headline / systemic
- **The hillshade-dump regression is RESOLVED.** The 12:48 batch reflects active uncommitted work
  (working tree modifies `utils/mapStyle.ts`, `server/api/maps/[id]/render.post.ts`, `utils/themes/refined.ts`,
  `components/map/MapPreview.vue`, `scripts/capture-theme-audit.mjs`). Maps that were raw-hillshade tangles in
  pass 7 (brutalist, splits-stats, midcentury, relief, contour-wash) now render as **actual styled contour
  LINES**, not a relief dump. This is the single biggest improvement since pass 5/6. NOTE: HEAD is still
  f83120d — none of this is committed yet, so the gain is live only in the working tree; commit it before
  the next batch can be trusted as a baseline.
- **Remaining systemic gap is now CONTOUR DENSITY/CHARACTER, not hillshade.** Two distinct misses persist
  across the field: (a) **too-sparse blobby "island" contours** (bold-modern, usgs-vintage, classic-trail) —
  target wants a dense, even concentric weave filling the sheet; the pass-6 density win is still not re-landed.
  (b) **no index-contour emphasis** — brutalist renders a uniform fine-line tangle with NO bold black index
  rings over fine grey (the defining move of its target). The adaptive-density spec is half-applied: lines
  exist, but interval/weight/index-tiering is not yet tuned to target character.
- **Title-fit, render-validity, editor==print, chrome/typography remain DONE.** WONDERLAND fills the
  bold-modern band at full authored size; no blanks anywhere; brutalist editor==print confirmed identical.

### Known-failure verification (all four FIXED — holds)
- **title shrink — FIXED.** bold-modern WONDERLAND hero is full-size, fills the band.
- **transit-diagram blank — FIXED.** Renders clean: NAPA VALLEY, T1 badge, RIDGE/OVERLOOK/CELLAR/VINE/
  START/FINISH stations, legend, 45/90 GPX LINE scale, purple transit line. (Genre piece, no target.)
- **cartouche MÉXICO line drop — FIXED.** Full cartouche present: MÉXICO / CIUDAD DE MÉXICO / Ciudad de
  México / 19.4326°N 99.1332°W · 2,240 m.
- **contour-wash blank print — FIXED.** Print renders fine contour lines (not blank); editor==print.

### BROKEN
- (none this pass — the hillshade regression that drove the pass-7 BROKEN list is resolved.)

### MINOR — contour density/character (the focus for the next iteration)
- **brutalist — MINOR (big improvement from BROKEN).** Hillshade gone; now real contour lines. BUT missing
  the target's defining move: **bold black concentric INDEX rings over fine GREY concentric**. Current is a
  uniform dense black fine-line tangle — no index-contour tiering, fine lines too dark/dense. Fix: add bold
  black index contours every Nth line; lighten + thin the intermediate lines to grey. EDITOR==PRINT (good).
- **splits-stats — MINOR (improved from BROKEN).** Top map no longer a hillshade tangle, but still reads as
  **dark relief blobs** rather than the target's **faint grey concentric rings** on navy. Push toward clean
  faint concentric. Profile, BOSTON chrome, 813 FT GAIN, stat row all parity.
- **night-ride — MINOR (improved from BROKEN).** Top map de-blobbed; now faint dark texture + cyan route,
  closer to target's faint grey concentric rings (MOAB) but still slightly hillshade-textured rather than
  clean concentric lines. Chrome (MOAB, ELEVATION PROFILE, 1,100 ft GAIN, stat row) parity.
- **midcentury-travel — MINOR (improved from BROKEN).** Now orange contour LINES instead of a hillshade
  tangle, color warm/correct. BUT target wants a **smooth warm radial sun-graded relief in concentric tonal
  bands** with thin contours — current is a busy even-weight contour weave, missing the smooth radial tonal
  grade. VISIT / TRE CIME / DOLOMITI chrome parity.
- **relief-shaded — MINOR.** The one theme that intentionally shows shaded terrain; color warm/tan (good).
  Relief is still a **rough noisy hillshade** vs target's **smooth layered tonal bands + fine contour overlay**.
  Smooth the relief and overlay fine contours. Chrome (Wonderland, WASHINGTON accent, metadata) parity.
- **bold-modern — MINOR.** Map outlines now **fine and GREY** (improved from heavy black), but still
  **sparse blobby islands** vs target's dense fine uniform concentric rings. Re-land density. Chrome
  (WASHINGTON eyebrow, WONDERLAND full-size, red accent bar, 93.0 MI / 46.8523°N, metadata) full parity.
- **usgs-vintage — MINOR.** Chrome perfect (MOUNT WHITNEY, SIERRA NEVADA CALIFORNIA, SCALE 1:24,000, coords,
  frame border, red route). Map still **sparse light blobby islands**; target is a **dense even concentric
  grey weave** filling the sheet. Pass-6 density treatment still not re-applied — top priority for density.
- **classic-trail — MINOR.** Chrome (THE COBBLER, ARGYLL SCOTLAND, scale, frame, blue route) clean. Contours
  still **wispy sparse grey blob-islands** vs target's dense even concentric. Apply the dense treatment.
- **contour-wash — MINOR.** Print valid (not blank). Map is a busy fine **echo-wash** of real-terrain
  contours; target (TRE CIME) is **crisp even concentric** lines. Sharpen toward defined concentric rings.
  Title/route/footer parity.
- **editorial-minimal — MINOR (layout improved).** Caption block is now a **compact bottom block** (the
  pass-7 dead-space gap is largely gone — good) and the map fills more of the sheet. Residual is the MAP:
  still a **soft warm-tan wash with blobby islands**, hue **too warm**; target is **clean cool-grey even
  concentric topo lines**. De-wash, cool the hue, densify. Caption content all present (Wonderland, MOUNT
  RAINIER WASHINGTON, red WASHINGTON, 46.8523°N 121.7603°W, 93.0 MI · AUG 2025).
- **cartouche-place — MINOR (near-OK).** MÉXICO line + full cartouche hold. Street weave is **still too
  faint** and not boldly diagonal vs target; the cartouche **box border reads very light/near-absent** vs
  target's clear bordered white box — strengthen the box outline. The pass-7 offset-rectangle artifact is no
  longer obvious. Mountain silhouette faint.

### OK / genre (render valid, no fabricated artifacts spotted)
- **blackline — OK.** Clean concentric grey contours, heavy black route, MASSACHUSETTS/BOSTON chrome, footer.
- **marathon-bib — OK.** (Carried from prior passes; target wants faint/sparse, so its sparse map is correct.)
- **transit-diagram — OK (renders, no target).** See known-failure note above.
- **sea-chart — OK/MINOR.** Nautical bathymetric contours + depth soundings, **magenta-tinted compass rose**
  (matches commit dd9095f) top-right, magenta route, "The Cobbler" title. Coherent genre render.
- **copper-night — OK/MINOR.** Dark ground, copper contours, **warm gold star field** (matches commit
  e5d1e64), gold route, Tre Cime title/footer. Coherent.
- **electric-atlas — OK/MINOR.** Navy + cyan/magenta grid, magenta route, BOSTON title, stat row. Coherent.
- **plein-air — OK/MINOR.** Painterly soft tan/green wash (genre), orange route, Tre Cime, color-dot footer.
- **risograph — OK/MINOR.** Riso duotone offset (cyan/magenta registration) WONDERLAND title, grey contours.
- **daybreak-trace — OK/MINOR.** Warm peach sunrise gradient, dense copper contour weave (good density),
  NAPA VALLEY title. Note: density here is closer to target than the sparse themes — reference for those.
- **dark-sky — OK/MINOR.** Night-sky navy, white star field + faint constellation lines (genre, not
  fabricated), gold route, MOUNT WHITNEY title.

### Order of attack for next iteration
1. **COMMIT the working-tree renderer fix.** HEAD is still f83120d; the hillshade-kill lives only in the
   working tree. Commit it so the gain is locked and the next batch is a trustworthy baseline.
2. **Re-land the pass-6 dense-concentric density** on usgs-vintage, bold-modern, classic-trail (and cool +
   de-wash editorial-minimal's map). Use daybreak-trace's density as the reference for "filled, even weave."
3. **Add index-contour tiering** to brutalist (bold black index rings over fine grey) — its target's signature.
4. **Smooth-tonal-band treatment** for midcentury-travel (radial sun grade) and relief-shaded (layered bands
   + fine contour overlay); push splits-stats/night-ride from dark relief texture to clean faint concentric.
5. **cartouche-place** — strengthen the cartouche box border + bolder diagonal street weave.
Title-fit, render-validity, editor==print, chrome and typography remain DONE across the checked set.

## 2026-06-09 14:05 UTC — Review pass 9 (fresh re-batch 13:43–13:47; HEAD still f83120d "tier 2 poster overlays" @ 06-08 19:58 — renderer changes STILL uncommitted in working tree)

### Systemic (READ FIRST)
1. **COMMIT THE WORKING-TREE RENDERER. AGAIN.** HEAD is still f83120d for the 3rd review in a row; every
   gain below lives only in an uncommitted tree. Land it so the next batch is a trustworthy baseline and the
   wins stop being at risk.
2. **The contour renderer now fails in TWO opposite directions — it is not yet a single clean concentric
   pass.** Mode A = **busy/noisy relief leakage**: a mottled fragmented contour-network (real micro-terrain
   detail, reads hillshade-ish) instead of clean styled lines → brutalist, botanical, blueprint-strava,
   splits-stats, night-ride, contour-wash. Mode B = **too sparse/faint**: scattered blob fragments on mostly
   empty paper → classic-trail, blueprint, moonstone (mild). The adaptive-density interval is mis-tuned per
   theme: lower the interval / smooth/simplify the line generation on the Mode-A themes (kill the micro-noise,
   keep smooth concentric), raise density on the Mode-B themes. daybreak-trace + botanical-TARGET remain the
   "filled, even, smooth concentric" reference.
3. **Tonal-band treatment still missing on the two themes whose signature it is.** midcentury-travel and
   ranch-ochre render a dense fine contour WEAVE; both targets are **smooth radial tonal bands** (graduated
   concentric fills, sun-grade) with only faint contour overlay. Apply the band fill; it is not a contour job.
4. **Known starting failures — verification:** title-shrink **FIXED** (BOSTON/WONDERLAND/MOAB all full hero
   size); transit-diagram blank **FIXED** (renders full diagram); cartouche MÉXICO line **FIXED** (holds);
   contour-wash blank print **FIXED** (valid render). Raw-hillshade **PARTIALLY fixed** — usgs-vintage,
   bold-modern, blueprint, editorial-minimal now read as styled contours, but the Mode-A cluster above still
   leaks relief noise. Editor==print holds on every pair checked.

### BROKEN (lead — map character is wrong, reads as relief noise not styled contours)
- **brutalist — BROKEN.** Map is a **dark noisy marbled relief tangle**; target is **a few BOLD BLACK index
  rings over faint grey fine contours** (index-contour tiering is the signature). De-noise to smooth
  concentric AND add the bold-black index tier. Title/header/footer/crosshairs all correct.
- **botanical — BROKEN.** Bordered box + sage palette + italic "Tre Cime" title all correct, but the map is a
  **mottled dark-green hillshade texture**; target is **clean fine sage concentric + darker green index
  contours**. Replace the relief mottle with clean concentric lines.

### MINOR — Mode-A relief-noise (calm/simplify the background contours)
- **blueprint-strava — MINOR.** Dark-teal ground, grid, green glow route, BOSTON title, stat cells all good;
  background contours are a **busy bright-white fragmented network** vs target's faint subtle lines. Drop
  opacity + simplify.
- **splits-stats — MINOR.** Orange route, BOSTON, orange elevation profile, footer cells all good; background
  map is **busy white/grey contour noise** vs target's barely-there faint grey concentric. Calm it.
- **night-ride — MINOR.** Cyan route, MOAB, teal profile, footer good; same **busy relief noise** in the map
  field vs target's faint subtle concentric. Calm it.
- **contour-wash — MINOR.** Print valid; map is still a **grainy echo-wash** (commit 6b97bf2 didn't reach it)
  vs target's crisp even concentric. Sharpen to defined rings, kill grain.

### MINOR — Mode-B too-sparse (densify toward even concentric)
- **classic-trail — MINOR.** "The Cobbler" serif title good; map is **sparse faint blob fragments on empty
  white** vs target's dense smooth concentric blue-grey rings. Densify hard.
- **blueprint — MINOR.** Navy/grid/yellow-route/title/footer all good; white contours **blobby + slightly
  sparse** vs target's clean even concentric. Densify + smooth.
- **moonstone — MINOR (mild).** Light lavender grid layout good; contours a touch **faint/sparse**. Small
  density bump.

### MINOR — tonal-band themes (apply radial band fill, not contour weave)
- **midcentury-travel — MINOR.** VISIT/TRE CIME title good; map is a **dense saturated orange contour weave**;
  target = **smooth radial tan tonal bands** + faint contour. Add the band fill; soften hue toward soft tan.
- **ranch-ochre — MINOR.** VISIT/MOAB title good; same **dense ochre contour weave** vs target's **smooth
  radial ochre tonal bands**. Same fix.

### MINOR — other parity residuals
- **usgs-vintage — MINOR.** Big improvement (was sparse blobs); now even concentric, but contours read
  **slightly too fine/noisy + a touch streaky** vs target's clean smooth lines. Light simplify.
- **bold-modern — MINOR.** WONDERLAND fills the band (hero size good), coral block + layout good; map contours
  **slightly sparse/fine** vs target's medium even concentric. Small density bump.
- **editorial-minimal — MINOR (much improved).** Caption block compact, density now reads as even concentric
  weave (good); residual is **hue still a touch warm** vs target's cool grey. Cool it slightly.
- **cartouche-place — MINOR.** MÉXICO + full title hold (fixed); but **cartouche box border reads near-absent**
  vs target's clear bordered white box, and **CIUDAD DE MÉXICO is smaller/less bold** than the target's
  band-filling serif. Strengthen the box outline; bump the title to authored size. Street weave + mountain
  silhouette still faint.
- **relief-shaded — MINOR.** Intentional shaded terrain present (correct for this theme); shading is
  **busier/cooler-grey** than target's soft smooth tan, and the "Wonderland" title reads **undersized** vs
  target's large bottom-left serif. Smooth + warm the shade; check title fit.

### OK / genre (render valid, no fabricated artifacts spotted)
- **transit-diagram — OK (renders, no target).** Full NAPA VALLEY transit diagram: purple line, stations,
  T1 badge, legend, GPX-line indicator. Was the blank failure — now fixed. Minor: one station label reads
  truncated ("VINEY…"); confirm full label fits.
- **field-journal — OK (renders, no target).** "The Cobbler" two-panel field-journal layout (map + ruled
  Field Notes panel + route box). Coherent.
- **marathon-bib, sea-chart, copper-night, electric-atlas, plein-air, risograph, daybreak-trace, dark-sky,
  blackline — OK/MINOR (carried).** Coherent genre renders, no fabricated artifacts; daybreak-trace remains
  the density reference for the Mode-B themes.

### Order of attack (next iteration)
1. **COMMIT the renderer working tree** (3rd ask — gains are unprotected).
2. **De-noise the Mode-A cluster** (brutalist, botanical, blueprint-strava, splits-stats, night-ride,
   contour-wash): simplify/smooth contour generation, kill micro-terrain noise → clean concentric.
3. **Add index-contour tiering** to brutalist + botanical (bold rings over faint grey/sage).
4. **Tonal-band fill** for midcentury-travel + ranch-ochre (radial graduated bands, faint contour overlay).
5. **Densify Mode-B** (classic-trail, blueprint, moonstone) to even concentric.
6. **cartouche-place**: box border + title size. **editorial-minimal**: cool the hue.

## 2026-06-09 15:03 UTC — Review pass 10 (full re-batch 14:43–14:48; renderer tree now COMMITTED — new commits a174faa "Stabilize refined theme contour renderer" + 6eac9e2 "Preserve botanical authored contour density")

### Systemic patterns (read first)
1. **The renderer is finally committed (3rd ask — resolved).** HEAD is now 6eac9e2; the previously-uncommitted
   contour work landed as a174faa + 6eac9e2. Gains are protected.
2. **Contour stabilization swung BIMODAL — it did not converge.** a174faa over-thinned one set of themes to the
   point of STRIPPING contours, while never touching another set that still dumps raw mottled relief. The split
   tracks FIELD BRIGHTNESS:
   - **Over-thinned → contours essentially GONE (light-field themes):** brutalist (empty), blueprint
     (navy field stripped), botanical (sparse fragments), classic-trail (faint sparse). The de-noise pass
     removed the lines instead of simplifying them.
   - **Untouched → still raw dark mottled relief (dark-field themes):** splits-stats, blueprint-strava,
     night-ride. The contour-styling path clearly does NOT run on dark themes — they still render the hillshade
     dump flagged since pass 1. **Fix target: route dark themes through the same styled-contour generator, then
     tune opacity for dark ground.**
   - **Converged well (light-field):** usgs-vintage, bold-modern, editorial-minimal, moonstone, relief-shaded.
3. **Tonal-band themes still unaddressed.** midcentury-travel + ranch-ochre still render a dense contour WEAVE;
   targets are smooth radial tonal bands + faint contour. This is a FILL job, not a contour job — stabilization
   was never going to fix it. Still open.
4. **Known starting failures — verification:** title-shrink **FIXED** (BOSTON / WONDERLAND / CIUDAD DE MÉXICO all
   full hero size); transit-diagram blank **FIXED** (full diagram renders); cartouche MÉXICO line **FIXED**;
   contour-wash blank print **FIXED**. Raw-hillshade **STILL OPEN on the 3 dark themes** (see #2). Botanical
   hillshade mottle **FIXED** but over-corrected to sparse fragments. EDITOR==PRINT holds on every pair checked
   (verified brutalist + botanical: both editor and print match, including the empty/stripped state).

### BROKEN (lead — contours stripped or wrong character)
- **brutalist — BROKEN (regression direction flipped).** Map field is now **completely empty except the route**
  — no fine contours, no bold-black index rings. Went from "dark noisy tangle" (too much) to "nothing" (a174faa
  over-thinned it to zero). Target = a few BOLD BLACK index rings over faint grey fine contours. Restore
  concentric contours AND add the index tier. Header / BOSTON title / footer / crosshairs all correct.
  EDITOR==PRINT (both empty).
- **blueprint — BROKEN.** Navy ground, grid, yellow route, MOUNT WHITNEY title, footer cells all good, but the
  **white contours are essentially gone** — field reads as grid + route on empty navy. Over-thinned like
  brutalist. Restore even white concentric at low-but-visible opacity.

### MINOR — over-thinned, under-dense (densify back toward even concentric)
- **botanical — MINOR (much improved; hillshade gone).** Bordered box + sage palette + italic "Tre Cime" all
  correct; the dark hillshade mottle is **fixed**. Residual: contours are now **sparse scattered fragments** on
  near-empty paper, not the target's dense smooth sage concentric + darker index rings. 6eac9e2 preserved too
  little — densify and smooth into continuous concentric; add the darker-green index tier.
- **classic-trail — MINOR.** "The Cobbler" serif title good; map still **faint sparse fragments** vs target's
  dense smooth blue-grey concentric. Densify.
- **moonstone — MINOR (mild).** Lavender layout good; contours present and fairly even now, just slightly faint.
  Small density/contrast bump.

### MINOR/BROKEN — dark themes still dumping raw relief (styled-contour path not applied)
- **splits-stats — MINOR (unchanged).** Red elevation profile, BOSTON, stat cells all good; map field is still
  a **dark marbled relief dump** vs target's barely-there faint concentric. Route through styled contours.
- **blueprint-strava — MINOR (unchanged).** Dark-teal ground, grid, green route, BOSTON, stat cells good;
  background still **bright fragmented relief noise**. Same fix.
- **night-ride — MINOR (unchanged).** Cyan route, MOAB, profile, footer good; field still **dark mottled relief
  noise** vs target's faint subtle concentric. Same fix.

### MINOR — tonal-band themes (apply radial band FILL, not contour weave)
- **midcentury-travel — MINOR (unchanged).** VISIT / TRE CIME title good; map is a **dense tan contour weave**;
  target = smooth radial tan tonal bands + faint contour. Add band fill; soften hue.
- **ranch-ochre — MINOR (unchanged).** VISIT / MOAB title good; same **dense ochre contour weave** vs target's
  smooth radial ochre tonal bands. Same fix.

### MINOR — parity residuals
- **contour-wash — MINOR.** Print valid; map now reads as a fairly even fine grey weave (improved from grainy
  wash) but still **denser/busier** than target's crisp defined rings. Light simplify.
- **cartouche-place — MINOR.** MÉXICO + full-size CIUDAD DE MÉXICO serif hold (title fixed); but the **cartouche
  box border still reads near-absent** — centered text floats with no clear bordered white box. Strengthen the
  box outline. Street weave still faint.
- **usgs-vintage — MINOR (near parity).** Clean even brown concentric now, red route, MOUNT WHITNEY — big
  improvement, reads as proper USGS contours. Residual is very light streakiness only.
- **bold-modern — OK/MINOR.** WONDERLAND hero fills the band, coral block + layout good; even medium concentric
  now reads correctly. Near parity.
- **editorial-minimal — OK/MINOR.** Even cool-grey concentric weave, dark-red route, bottom-left "Wonderland"
  serif, WASHINGTON tag — hue now cool (prior warm-tint residual resolved). Near parity.
- **relief-shaded — MINOR.** Intentional shaded terrain (correct for theme); shade now softer/warmer tan
  (improved). Confirm "Wonderland" title size vs target's large bottom-left serif.

### OK / genre (render valid, no fabricated artifacts)
- **transit-diagram — OK (no target).** Full NAPA VALLEY diagram: purple line, START/RIDGE/OVERLOOK/CELLAR/
  VINEY…/FINISH stations, T1 badge, legend, GPX-line indicator. Residual: one station label still truncates
  ("VINEY…" → VINEYARD); confirm full label fits.
- **field-journal — OK (no target).** "The Cobbler" two-panel layout (map + ruled Field Notes panel + route
  box). Coherent.
- **marathon-bib, sea-chart, copper-night, electric-atlas, plein-air, risograph, daybreak-trace, dark-sky,
  blackline — OK/MINOR (carried).** Coherent genre renders, no fabricated artifacts; daybreak-trace remains the
  Mode-B density reference.

### Order of attack (next iteration)
1. **Un-strip the over-thinned light themes:** brutalist (BROKEN, fully empty) + blueprint (BROKEN, navy
   stripped) — restore even concentric, add index tier to brutalist.
2. **Re-densify botanical + classic-trail** from fragments to continuous smooth concentric (+ botanical index
   tier).
3. **Route the 3 dark themes through the styled-contour generator** (splits-stats, blueprint-strava, night-ride)
   — they have been bypassing it since pass 1; tune opacity for dark ground.
4. **Tonal-band FILL** for midcentury-travel + ranch-ochre (radial graduated bands, faint contour overlay).
5. **cartouche-place box border**; **transit-diagram VINEYARD label fit**.

## 2026-06-09 14:55 UTC — Pass 9 CORRECTION (brutalist regenerated 14:46, after the 14:05 entry) + title-rule bug

- **CORRECTION — brutalist.** My 14:05 "dark noisy relief tangle" judged the 13:47 render. brutalist was
  re-rendered at **14:46** and has flipped to the OPPOSITE failure: **map is near-empty — orange route on
  bare paper, no contours at all.** Codex's read is right: the route-derived Boston crop is tight and very
  low-relief, so the DEM has almost no contour signal to draw. Disregard the "tangle" note for brutalist;
  current state = **Mode-B empty**, not Mode-A noise.
  - **Do NOT fabricate contour geometry to fill it** (violates the no-invented-artifacts principle, and the
    brutalist TARGET's tidy concentric rings are themselves idealized, not real Boston terrain). Zooming the
    camera out (Codex's plan) is the correct *mechanism*, BUT note the ceiling: Boston has ~no relief at any
    zoom, so a wider crop yields faint/sparse contours at best. This is the concrete case for a **non-contour
    base layer for flat routes** (street network or minimal) — see product note below.
- **NEW — brutalist title↔rule alignment (LAYOUT).** "BOSTON" does not align to the header rule: the title's
  left edge / the rule's left terminus don't share the margin, and the title sits too close to the rule
  vertically. Target: title left-aligned to the RADMAPS/header left margin, with a clean gap below the rule.
  Fix the title block's left inset + top margin against the header rule. (Verify the same anchor on other
  top-title themes — bold-modern, blueprint — since they share the header-rule + hero-title structure.)
- **PRODUCT direction (not a parity item) — base-layer quick-pick.** Flat-city routes (Boston, Chicago) make
  contours meaningless. Plan a Terrain / Streets / Minimal base-layer toggle beside the theme selector;
  default chosen from the relief metric already computed for adaptive contour density (low relief → Streets/
  Minimal, high → Terrain). Streets styled from theme tokens, no labels by default. See memory note.

## 2026-06-09 16:02 UTC — Review pass 11 (full re-batch 15:49–15:54; new code = brutalist only: 4c4514f "Restore brutalist authored title scale" + 714d880 "Tune brutalist index contour character", on top of pass-10's a174faa/6eac9e2)

### Systemic (good news)
- **brutalist map no longer empty.** The Mode-B "orange route on bare paper" failure from pass 9/10 is RESOLVED
  — the map now renders a full field of contour lines + the orange route. This was the last fully-broken theme.
- **Dark-theme styled contours now applying.** night-ride print now shows faint blue-grey concentric contours
  behind the cyan route on the navy ground (not a raw hillshade dump, not bare). The pass-10 "3 dark themes
  bypass the styled-contour generator" item reads as fixed for night-ride; spot-confirm splits-stats +
  blueprint-strava show the same faint styled concentric next pass.

### MINOR — this run's focus
- **brutalist — MINOR (was BROKEN).** Big step up. (1) TITLE fixed: monumental "BOSTON" is restored to full
  authored scale, left-aligned to the RADMAPS margin with a clean gap below the header rule — both the title-
  shrink and the 14:55 title↔rule alignment bugs are resolved. (2) Map renders route + contours. RESIDUAL —
  **index-contour character (CONTOUR axis):** target = heavy BLACK index rings + a faint GREY intermediate set
  (clear two-tier weight). Current render is near-uniform thin black single-weight lines — the 714d880 index
  tuning isn't reading as a weight/value split. Push index contours heavier/darker and drop intermediates to
  faint grey so the two tiers separate like the target. (Geometry differs from the target's idealized rings —
  data-driven, not judged; only the line weight/tier treatment.)
- **botanical — MINOR (unchanged, not regressed).** Green double-frame + "Tre Cime" serif footer + green route
  all good. Contours still read **fragmented/sparse** vs the target's dense smooth continuous concentric weave;
  the authored-density commit holds the density it has but it's still below target. Continue densifying toward a
  continuous fine weave and add the faint index tier.

### Carried (no new code; re-confirm, not re-litigated this run)
- Pass-10 punch lists stand for the other 24 themes (midcentury-travel/ranch-ochre tonal-band FILL;
  cartouche-place box border; contour-wash light simplify; usgs-vintage/bold-modern/editorial-minimal near
  parity; transit-diagram VINEYARD label fit). No code touched them since 15:03; nothing in the re-batch looked
  regressed on spot-check.

### Order of attack (next iteration)
1. **brutalist index-contour two-tier** — heavier black index + faint grey intermediate (only remaining axis).
2. **botanical densify** to continuous concentric + faint index tier.
3. **Confirm splits-stats + blueprint-strava** now carry the same faint styled concentric as night-ride.
4. Resume the carried list: tonal-band fill (midcentury-travel, ranch-ochre), cartouche box border,
   transit-diagram label fit.

## 2026-06-09 16:45 UTC — Review pass 10 (batch 16:33–16:35; HEAD be698a3, and the renderer is finally COMMITTED — a174faa "Stabilize refined theme contour renderer" + per-theme commits since f83120d)

### Systemic (READ FIRST)
- **The renderer is committed at last** (a174faa). Three passes of "commit the working tree" is resolved.
  Per-theme commits landed on exactly the themes I flagged worst (6eac9e2 botanical density, 714d880 +
  4c4514f brutalist, be698a3 daybreak) — and **each one worked on the theme it targeted.** Progress is now
  real and theme-by-theme, worst-first.
- **But "Stabilize contour renderer" did NOT globally fix the relief-noise cluster.** blueprint-strava,
  splits-stats, night-ride still render a **busy dark mottled relief field**, contour-wash is still a grainy
  echo-wash, classic-trail is still sparse, and the two tonal-band themes are still a contour weave. The
  stabilize commit kept the renderer from oscillating (good — no more flip-flopping), but these themes each
  still need their own per-theme pass. They are unchanged from pass 9, not regressed.
- Note: working tree still carries uncommitted changes on top of be698a3 — keep committing per theme.

### FIXED / recovered this pass (verify and move on)
- **brutalist — RECOVERED (BROKEN→MINOR).** No longer empty: map now renders **clean bold-black contour
  lines** + orange route, and the **hero BOSTON title is back to full authored scale** and reads correctly
  left-aligned under the header rule (the title↔rule alignment I flagged looks resolved — confirm). Residual:
  it's a **single bold-black tier only** — target pairs bold-black index rings over a **faint-grey minor
  contour** underlayer; add that minor tier, and smooth the black lines toward concentric.
- **botanical — RECOVERED (BROKEN→MINOR).** The dark-green hillshade mottle is **gone**; map now renders
  **green contour LINES** over sage, double-frame + italic "Tre Cime" intact. Residual: lines are a touch
  **sparse/irregular** vs target's dense fine concentric, and the **darker-green index tier** isn't
  differentiated yet. Densify + add index emphasis.

### WATCH (commit landed — confirm it didn't overshoot)
- **daybreak-trace — WATCH.** be698a3 "soften tonal contour field" softened it to a **rosy peach wash**; it
  may have **over-softened** — the crisp copper contour weave that made it the density *reference* now reads
  as a soft mottle. Re-check against target: keep the warm gradient but don't lose the defined copper lines.

### MINOR — still open, unchanged from pass 9 (each needs its own pass)
- **blueprint-strava / splits-stats / night-ride — MINOR.** Background map still a **busy dark relief mottle**
  vs targets' faint subtle contours. Drop opacity + simplify (same fix all three). Route/title/stat-cells fine.
- **contour-wash — MINOR.** Still a **grainy echo-wash**, not crisp even concentric. Sharpen to defined rings.
- **classic-trail — MINOR.** Still **sparse faint blobs on empty white**; densify to even concentric.
- **midcentury-travel / ranch-ochre — MINOR.** Still a **dense contour weave**; targets want **smooth radial
  tonal bands** + faint contour overlay. Apply the band fill (not a contour job).
- **blueprint — MINOR.** White contours still slightly **blobby/sparse**; densify + smooth. Else good.
- **bold-modern — MINOR.** Hero title good; map contours **slightly sparse/fine**; small density bump.
- **editorial-minimal — MINOR.** Even concentric weave good; **hue still a touch warm** vs target cool grey.
- **usgs-vintage — MINOR (near-OK).** Even concentric brown contours read well; lines slightly fine/streaky.

### OK (carried)
- transit-diagram, field-journal, sea-chart, copper-night, electric-atlas, plein-air, risograph, dark-sky,
  marathon-bib, blackline — coherent, no fabricated artifacts.

### Order of attack
1. **Relief-noise trio** (blueprint-strava, splits-stats, night-ride) — one shared fix: faint/simplify the
   background contour field. Highest count, all the same bug.
2. **Tonal-band fill** (midcentury-travel, ranch-ochre).
3. **Finish brutalist + botanical** — add the faint-grey/index minor tier each is missing.
4. **classic-trail + contour-wash + blueprint** density/sharpen.
5. **Confirm daybreak didn't over-soften.**

## 2026-06-09 17:08 UTC — Review pass 12 (full re-batch 16:27–16:35; new code since pass 11 = be698a3 "Soften daybreak tonal contour field" only, on top of pass-11's 4c4514f/714d880)

### Systemic (read these first)
- **Dark-theme styled contours applied to night-ride ONLY — splits-stats + blueprint-strava STILL dump raw relief.** night-ride print is now correct: faint grey concentric rings on the navy ground behind the cyan route (matches target). But splits-stats (dark marbled relief mottle) and blueprint-strava (dark-teal ground with bright fragmented relief marble) are UNCHANGED — they are still bypassing the styled-contour generator. The pass-10/11 fix did not propagate to these two. Route both through the SAME path night-ride now uses; tune opacity for their darker grounds.
- **Tonal-band FILL still not implemented (midcentury-travel + ranch-ochre).** Both still render a dense contour WEAVE where the target is smooth radial graduated tonal bands + a faint contour overlay. No movement since pass 10. This is a distinct render mode (radial band fill), not a density tweak — it needs the band-fill treatment added, not more/fewer contour lines.
- **Known starting failures — status:** title-shrink FIXED (brutalist BOSTON + cartouche CIUDAD DE MÉXICO both full authored scale); transit-diagram blank FIXED (renders full diagram); cartouche MÉXICO line FIXED (present); contour-wash blank print FIXED (valid). Raw-hillshade PARTIAL — night-ride fixed; splits-stats, blueprint-strava, and now daybreak-trace still show raw relief.

### BROKEN / regression — this run's new code
- **daybreak-trace — BROKEN (new code regressed it).** be698a3's "soften" went the wrong direction. Target = pale cream/peach paper, soft RADIAL graduated tonal rings, and faint fine concentric CONTOUR LINES, dark route, VISIT / NAPA VALLEY. Current = an over-saturated CORAL/SALMON MARBLE relief wash filling the whole field; the faint concentric contour lines are gone and the paper is far too pink/dense. It now reads as a raw relief mottle, not styled tonal bands — the same Mode-A failure the dark themes have. EDITOR==PRINT (both show the coral marble). Pull saturation/value way back toward the pale target, restore the faint concentric contour lines over a soft radial band fill. daybreak was the Mode-B density reference last pass; it no longer is — re-anchor against the target screenshot.

### MINOR — carried focus items (re-confirmed this batch)
- **brutalist — MINOR (title resolved; CONTOUR axis unchanged).** Monumental BOSTON full-size, left-aligned to the RADMAPS margin, clean gap below the rule — title fully fixed. Map renders route + contours. RESIDUAL unchanged from pass 11: contours are near-uniform thin BLACK single-weight lines; target wants a clear TWO-TIER split — heavy black index rings + faint grey intermediates. 714d880 still not reading as a weight/value split. Push index heavier/darker, drop intermediates to faint grey.
- **botanical — MINOR (slightly improved).** Green double-frame + "Tre Cime" serif + green route all good; a concentric ring cluster is now visible (denser than pass 11). Still below target's dense continuous smooth weave and still missing the darker-green INDEX tier. Continue densifying to continuous fine weave; add the faint index tier.
- **cartouche-place — MINOR (unchanged).** MÉXICO + full-size CIUDAD DE MÉXICO serif hold. Cartouche BOX BORDER still near-absent — centered title floats with no bordered white box. Strengthen the box outline. Street weave still faint.
- **transit-diagram — OK except label fit (unchanged).** Full NAPA VALLEY diagram renders (purple line, START/RIDGE/OVERLOOK/CELLAR/FINISH, T1 badge, legend, GPX-line indicator). VINEYARD station STILL truncates to "VINEY" (now hard-clipped, no ellipsis). Also RIDGE label sits tight against the line. Fix label box width so VINEYARD fits.
- **contour-wash — MINOR (unchanged).** Print valid, even fine grey weave; still a touch busier than target's crisp defined rings. Light simplify only.

### Carried OK / near-parity (no new code; not re-litigated)
- **night-ride — OK (confirmed fixed).** Faint styled concentric on navy + cyan route + MOAB + profile + stat cells = parity.
- **usgs-vintage, bold-modern, editorial-minimal, relief-shaded — OK/MINOR (carried).** Near parity per pass 10/11; nothing in this batch looked regressed on spot-check.
- **marathon-bib, sea-chart, copper-night, electric-atlas, plein-air, risograph, dark-sky, blackline, classic-trail, moonstone, field-journal, blueprint, blueprint-strava(layout), classic genres — carried.** Coherent renders, no fabricated artifacts spotted; substantive notes for splits-stats/blueprint-strava are under Systemic above.

### Order of attack (next iteration)
1. **daybreak-trace** — desaturate/lighten back to the pale target; restore faint concentric contour lines over a soft radial band fill (worst regression).
2. **Propagate the night-ride styled-contour path to splits-stats + blueprint-strava** — they are the last two raw-relief dumps.
3. **Tonal-band FILL** for midcentury-travel + ranch-ochre (radial graduated bands + faint contour overlay; not a density tweak).
4. **brutalist two-tier index** (heavy black index + faint grey intermediate) — last brutalist axis.
5. **botanical** densify to continuous weave + add index tier.
6. **cartouche box border**; **transit-diagram VINEYARD label width**.

## 2026-06-09 18:02 UTC — Review pass 13 (full re-batch 17:22–17:30; new code since pass 11/12 = fe0ae13 "Rebalance daybreak contour tone" only, on top of be698a3)

### Systemic (read these first)
- **daybreak coral-marble regression is RESOLVED — the over-saturation/Mode-A failure from pass 12 is gone.** fe0ae13 pulled value/saturation back to the pale target and restored the soft radial graduated tonal band fill. This is the correct direction; do NOT revert. One residual axis remains (below) but daybreak is no longer broken.
- **Unchanged carry (no new code touched them this batch):** splits-stats + blueprint-strava still dump raw dark relief (only night-ride is on the styled-contour path); midcentury-travel + ranch-ochre still render a contour WEAVE where the target wants radial tonal BANDS + faint overlay (the daybreak band-fill that now works is the reference treatment — apply the SAME radial-band mode to these two); brutalist two-tier index, botanical index tier + densify, cartouche box border, transit-diagram VINEYARD label width all still open from pass 12. None regressed on spot-check.

### BROKEN
- None this batch. (daybreak downgraded from BROKEN → MINOR.)

### MINOR — this run's new code
- **daybreak-trace — MINOR (was BROKEN; major improvement).** Paper is now pale pink/peach and the soft RADIAL graduated tonal bands read correctly — matches the target's value gradient. Title NAPA VALLEY full authored scale, VISIT + CALISTOGA · NAPA · CALIFORNIA all present. EDITOR==PRINT confirmed (both show pale-pink radial bands + same title). **Residual (CONTOUR axis):** the contour LINES are wrong character — sparse, irregular, organic squiggly outlines (read like a coastline/landmass tracing) rather than the target's DENSE FINE CONCENTRIC topo rings radiating from the center. Densify and make them concentric/closed rings over the radial band fill; right now they look like a few stray feature outlines, not the fine copper contour weave. This is the last daybreak axis.

### Carried OK / near-parity (no new code; not re-litigated)
- night-ride, usgs-vintage, bold-modern, editorial-minimal, relief-shaded, marathon-bib, sea-chart, copper-night, electric-atlas, plein-air, risograph, dark-sky, blackline, classic-trail, moonstone, field-journal, blueprint, contour-wash, transit-diagram (label-fit aside), cartouche-place (box-border aside) — coherent, no fabricated artifacts spotted; substantive open items tracked under Systemic / pass 12.

### Order of attack (next iteration)
1. **daybreak contour lines** — densify to fine concentric closed rings (the band fill is done; just the line layer is wrong).
2. **Propagate the now-working radial band-fill mode to midcentury-travel + ranch-ochre** (these are the same treatment daybreak just nailed).
3. **Route splits-stats + blueprint-strava through night-ride's styled-contour path** (last two raw-relief dumps).
4. **brutalist two-tier index** (heavy black index + faint grey intermediate).
5. **botanical** densify to continuous weave + index tier.
6. **cartouche box border; transit-diagram VINEYARD label width.**

## 2026-06-09 19:03 UTC — Review pass 14 (render batch 18:28–18:36; HEAD = aebe700 "Quiet dark data contour maps", committed 18:51 UTC)

### Systemic — READ FIRST: this render batch is STALE relative to HEAD
- **The renders predate the only new commit.** New code since pass 13 = aebe700 "Quiet dark data contour maps" (committer time 18:51 UTC). The print/editor renders are all timestamped 18:28–18:36 UTC — i.e. they were generated ~15–25 min BEFORE aebe700 landed. So this batch reflects fe0ae13 (the exact code pass 13 already reviewed), NOT the new dark-data fix. **Action for Codex: re-render the dark-data themes against HEAD before the next review — the fix is in code but currently UNVERIFIED in pixels.** Everything below for splits-stats / blueprint-strava describes the PRE-fix pixels.
- **aebe700's diff looks like the right fix for the raw-relief dumps.** It adds `atlas_layers` to the dark data recipes set to contour-ONLY (landcover/water/waterway/park/transportation/building/place/poi all = false) and drops `contour_detail` 5→1. That directly targets exactly what these renders still show: splits-stats = a street/road network fragment cluster; blueprint-strava = building/landcover blocky outline marble. Turning those layers off + sparse contour-only is the correct direction. Just needs a fresh render to confirm.
- **No regressions vs pass 13.** Since the batch is the same fe0ae13 code, every theme matches pass 13's findings on spot-check. Known-fixed items still hold: brutalist BOSTON full authored scale; transit-diagram renders full; cartouche MÉXICO line present; daybreak no longer the coral-marble blowup. Nothing newly broken.

### BROKEN
- None new this batch.

### Confirmed open items (pre-aebe700 pixels — verify after re-render)
- **splits-stats — contour axis still wrong (pre-fix render).** Field is clean near-black but the only background detail is a faint grey FRAGMENTED street/road network clustered in the upper-RIGHT quadrant; the left/center field is empty. Target = faint SMOOTH concentric topo contour rings filling the whole field, centered. This is precisely the transportation-layer leak aebe700 disables — re-render should replace the street fragments with sparse concentric contours. Title/profile/stat row all fine. (Minor: hero BOSTON reads a touch lighter-weight than target's heavy bold, but within tolerance.)
- **blueprint-strava — contour axis + COLOR (color NOT addressed by aebe700).** (1) Background is still a fragmented blocky building/landmass outline marble on the right half — same building/landcover leak aebe700 disables; re-render to confirm it becomes smooth concentric contours. (2) NEW callout: ground reads near-BLACK, but the target ground is clearly dark TEAL/GREEN. aebe700 only toggles atlas layers + contour_detail — it does NOT touch paper/field color, so this color gap will persist after re-render. Warm the field toward the target's dark teal-green. Grid, FIG.01 header, green route, BOSTON title, stat row all correct.

### MINOR — carried, genuinely unchanged (no code touched them this batch)
- **daybreak-trace — MINOR (contour-line axis, unchanged from pass 13).** Radial graduated tonal bands are correct (pale pink center → deeper edges) and match the target's value gradient; NAPA VALLEY full scale, VISIT + CALISTOGA·NAPA·CALIFORNIA present. Residual is unchanged: the contour LINES are sparse organic squiggles in the upper-left only, not the target's DENSE FINE CONCENTRIC closed copper rings radiating from center. Last daybreak axis; still open.
- **midcentury-travel — MINOR (band-fill, unchanged).** Still a dense full-field ochre contour WEAVE; target wants smooth radial graduated tonal BANDS + a faint contour overlay (the treatment daybreak's band fill already nails). Apply the radial-band mode; this is not a line-density tweak. ranch-ochre carried identical (not re-pulled this pass).
- **transit-diagram — OK except label fit (unchanged).** Full NAPA VALLEY diagram (purple line, START/RIDGE/OVERLOOK/CELLAR/FINISH, T1 badge, 45/90 GPX LINE legend, START/STOP/FINISH legend). VINEYARD station STILL hard-clips to "VINEY" and collides with the FINISH node/label. Widen the VINEYARD label box (or nudge FINISH right). RIDGE still sits tight to the line.
- **brutalist (two-tier index), botanical (densify + index tier), cartouche-place (box border) — carried open from pass 12/13.** Not re-litigated; same code, expect same pixels.

### Order of attack (next iteration)
1. **RE-RENDER the dark-data themes against HEAD (aebe700)** — current batch is stale; splits-stats + blueprint-strava verdicts can't close until the fix is in pixels.
2. **blueprint-strava ground color** — warm near-black → dark teal-green (aebe700 won't do this; separate color edit needed).
3. **daybreak contour lines** — densify to fine concentric closed rings over the (working) radial band fill.
4. **midcentury-travel + ranch-ochre** — apply the daybreak radial band-fill mode (replace the contour weave).
5. **brutalist two-tier index; botanical densify + index tier; cartouche box border; transit-diagram VINEYARD label width.**

## 2026-06-09 20:03 UTC — Review pass 15 (render batch 19:24–20:01 UTC; FRESH vs HEAD. HEAD = e2d674b "Tune Night Ride navy palette" 14:50; new code since pass 14 = aebe700 "Quiet dark data contour maps", 8a750a8 "Adapt contour density to elevation change", e2d674b)

### Systemic — READ FIRST
- **Batch is FRESH this time.** All print/editor renders timestamped 19:24–20:01 UTC, well after the three new commits (13:51 / 14:46 / 14:50). So aebe700 (dark-data quiet) is finally IN PIXELS, and 8a750a8 (adaptive density) + e2d674b (night-ride navy) are reviewable. Pass 14's "stale, can't verify" caveat is cleared.
- **aebe700 did NOT fix the two raw-relief dark-data dumps — pixels UNCHANGED.** splits-stats and blueprint-strava STILL show the exact fragment leaks from the pre-fix pass-14 pixels: splits-stats = faint grey FRAGMENTED street/road network clustered upper-RIGHT, empty left/center; blueprint-strava = fragmented coastline/building outline marble on the right half. aebe700's atlas_layers contour-only + contour_detail 5→1 toggle is committed but is NOT reaching these two recipes' output. Meanwhile the SAME flat-Boston location renders as clean concentric rings in **brutalist** and as faint concentric rings in **night-ride** (Moab) — so the styled/concentric-contour path works for those recipes but splits-stats + blueprint-strava are NOT routed through it. This is the headline BROKEN; the fix is wired to the wrong recipe key or those two bypass the generator.
- **8a750a8 adaptive density — mixed.** It clearly drove the radial tonal-band fill that midcentury-travel + ranch-ochre now show correctly (big win, below). But it did NOT densify daybreak's contour LINES (still sparse), and did not help the two dark-data dumps. Net positive but incomplete.
- **Known starting failures status:** title-shrink FIXED (brutalist BOSTON + cartouche CIUDAD DE MÉXICO full authored scale); transit-diagram blank FIXED (full diagram renders); cartouche MÉXICO line FIXED (present); contour-wash blank FIXED (valid, carried). Raw-hillshade PARTIAL — night-ride fixed; splits-stats + blueprint-strava STILL leaking (see above).

### BROKEN
- **splits-stats — BROKEN (contour axis, unchanged despite aebe700).** Field is clean near-black but the only background detail is a faint grey fragmented street/road network in the upper-RIGHT quadrant; left/center empty. Target = faint SMOOTH concentric topo rings filling the whole centered field (brutalist's Boston map now nails exactly this look — copy that path). EDITOR==PRINT confirmed (editor shows the same upper-right fragments). Title/profile/stat row all fine. Route splits-stats through the concentric-contour generator brutalist/night-ride use.
- **blueprint-strava — BROKEN (contour axis + COLOR).** (1) Background still a fragmented coastline/building outline marble on the right half — same transportation/landcover leak; route through the concentric path. (2) Ground reads near-BLACK; target ground is clearly dark TEAL-GREEN — aebe700 doesn't touch paper/field color, so this color gap persists exactly as predicted. Warm field toward dark teal-green. Grid, FIG.01 header, green route, BOSTON title, stat row all correct.

### FIXED / recovered this pass (verify and move on)
- **midcentury-travel — RECOVERED (MINOR→OK).** The dense contour WEAVE is gone; now renders the target's smooth radial graduated tonal-band MOUND (darker ochre center → lighter edges) + faint fine contour overlay + black route. TRE CIME / VISIT / DOLOMITI all present. Matches target. The band-fill mode landed.
- **ranch-ochre — RECOVERED (MINOR→OK).** Same as midcentury: warm ochre radial tonal-band mound + faint contour overlay + black route, MOAB / VISIT / SAND FLATS UTAH. Matches target. Band-fill landed.
- **brutalist — RECOVERED (MINOR→OK).** Two-tier index is now PRESENT: heavy BLACK index rings over faint GREY intermediate contours, orange route, monumental BOSTON full scale, crosshair corners, footer + 26.2 mi. Matches target two-tier character. Last brutalist axis closed.
- **botanical — RECOVERED (MINOR→OK).** Contours now read as a dense continuous fine concentric green weave with a darker-green index tier differentiated from faint minors; double-frame + italic "Tre Cime" + PLATE IX — ITALIA + green route intact. Matches target. Densify + index-tier items closed.
- **cartouche-place — RECOVERED (MINOR→OK).** The bordered white cartouche BOX is now visible around the centered MÉXICO / CIUDAD DE MÉXICO / Ciudad de México / coords·2,240 m block; faint diagonal street weave behind. Box-border item closed. (Street weave still slightly faint vs target but acceptable.)
- **night-ride — OK (e2d674b confirmed good).** Navy palette tune reads as a deep navy ground matching the target; faint grey concentric rings + cyan MOAB route + profile + stat cells = parity. Do not revert.

### MINOR — still open
- **daybreak-trace — MINOR (contour-line axis, unchanged; 8a750a8 did not help).** Pale-pink radial tonal bands correct (matches target value gradient); NAPA VALLEY full scale, VISIT + CALISTOGA·NAPA·CALIFORNIA present. Residual unchanged from pass 13/14: the contour LINES are nearly absent — a faint feature outline at top only, NOT the target's DENSE FINE CONCENTRIC closed copper rings radiating from center. Add the concentric ring layer over the (correct) band fill. Last daybreak axis.
- **transit-diagram — MINOR (label fit, unchanged).** Full NAPA VALLEY diagram renders (purple line, START/RIDGE/OVERLOOK/CELLAR/FINISH, T1 badge, 45/90 GPX LINE legend, START/STOP/FINISH legend). VINEYARD station STILL hard-clips to "VINEY" and collides with the FINISH node/label. Widen the VINEYARD label box or nudge FINISH right. RIDGE still tight to the line.
- **blueprint — MINOR (near-OK, improved).** MOUNT WHITNEY navy blueprint: white/cyan concentric contours now read smoother/more concentric than pass 11's blobby version; yellow route, FIG.01, DIST/GAIN footer all good. Slightly sparse vs target's denser rings; minor density bump only.

### Carried OK / near-parity (no new code; not re-litigated)
- usgs-vintage, bold-modern, editorial-minimal, relief-shaded, marathon-bib, sea-chart, copper-night, electric-atlas, plein-air, risograph, dark-sky, blackline, classic-trail, moonstone, field-journal, contour-wash — coherent renders, no fabricated artifacts spotted.

### Order of attack (next iteration)
1. **Route splits-stats + blueprint-strava through the concentric-contour generator** that brutalist/night-ride now use — aebe700's atlas toggle is not reaching them; they are the last two fragment-leak dumps. (Highest priority — committed fix is a no-op for these.)
2. **blueprint-strava ground color** — warm near-black → dark teal-green (separate color edit; contour fix above won't do it).
3. **daybreak contour lines** — add fine concentric closed rings over the working radial band fill.
4. **transit-diagram VINEYARD label width** (or nudge FINISH); **blueprint** small density bump.

## 2026-06-09 21:03 UTC — Review pass 16 (render batch 20:32–21:01 UTC; FRESH vs HEAD. HEAD = 184e213 "Cap Daybreak adaptive contour density" 15:40; new code since pass 15 = ca92bcc "Tune Blueprint Strava teal field" 15:18, 184e213)

### Systemic — READ FIRST
- **Batch is FRESH.** All print/editor renders timestamped 20:32–21:01 UTC, hours after the two new commits (15:18 / 15:40). Both new commits are now IN PIXELS and reviewable.
- **ca92bcc landed cleanly — blueprint-strava ground color is FIXED.** The near-black field is now a clear dark TEAL-GREEN matching the target. The color gap flagged BROKEN in passes 14/15 is CLOSED. Do not revert.
- **184e213 fixed daybreak density but at a cost.** Daybreak contour LINES went from "nearly absent" (pass 15) to a full-field fine copper contour fill — the density axis is now close to target. BUT the radial graduated tonal MOUND (deep-rose center → pale edges) that pass 15 praised now reads much flatter/weaker; the field is near-uniform pale pink behind the lines, and the lines read as organic topographic squiggles rather than the target's smooth CONCENTRIC closed rings. Net improvement, but a mild band-fill regression came with it. See MINOR below.
- **The two fragment-leak dumps are STILL BROKEN and neither new commit touches them.** splits-stats + blueprint-strava STILL show the contour leak. Clearer at editor resolution this pass: the leak is the **Boston-harbor COASTLINE/water OUTLINE** (smooth closed geographic shapes confined to the RIGHT half, left/center empty) — NOT a street network as earlier passes described. Brutalist's Boston map renders continuous closed contour lines filling the WHOLE frame; these two do not. Same recipe-routing bug, unchanged for 3 passes. This is the headline.
- **No regressions from the shared density commits.** midcentury-travel + ranch-ochre radial tonal-band MOUNDS still render correctly (8a750a8 band-fill held); brutalist coastal/two-tier contours fill the frame as in pass 15. EDITOR==PRINT confirmed on both BROKEN themes (editor shows the identical coastline leak + teal ground).

### BROKEN
- **splits-stats — BROKEN (contour axis, unchanged; neither new commit touches it).** Near-black field, orange route + profile + 813 FT GAIN + stat row all fine. Background = faint Boston-harbor COASTLINE-outline fragments confined to the RIGHT half; left/center empty. Target = faint SMOOTH concentric topo rings filling the whole centered field. Route this recipe through the concentric-contour generator brutalist/night-ride use (their Boston/Moab maps fill the frame correctly). EDITOR==PRINT confirmed.
- **blueprint-strava — BROKEN (contour axis ONLY; color now FIXED).** (1) Ground is now dark teal-green — color CLOSED via ca92bcc. ✓ (2) Background still the Boston-harbor coastline-outline leak on the right half, not concentric topo rings — same routing bug as splits-stats. Grid, FIG.01 header, green→cyan route, BOSTON, stat row all correct. Only the contour axis remains; route through the concentric generator.

### FIXED this pass (verify and move on)
- **blueprint-strava GROUND COLOR — FIXED (ca92bcc).** Near-black → dark teal-green, matches target. Color axis closed; only contour routing remains (above).
- **daybreak-trace contour DENSITY — much improved (184e213).** Full-field fine copper contour fill now present (was nearly absent). Density axis essentially at target. (Residual band-fill tradeoff → MINOR below.)

### MINOR — open
- **daybreak-trace — MINOR (band-fill weakened + line character; 184e213 tradeoff).** Density now good, but: (a) the radial tonal MOUND (deep-rose center graduating to pale edges) is now too flat — restore the band-fill depth that midcentury/ranch-ochre still show, UNDER the new dense lines; (b) the lines read as organic topographic squiggles, not the target's smooth concentric closed rings centered on the mound. Both can coexist: band-fill mound + concentric ring overlay. NAPA VALLEY full scale, VISIT, CALISTOGA·NAPA·CALIFORNIA, black route all present.
- **transit-diagram — MINOR (label fit, unchanged).** VINEYARD station still hard-clips to "VINEY" and collides with the FINISH node/label. Widen the VINEYARD label box or nudge FINISH right. (Not touched this batch.)
- **blueprint — MINOR (near-OK, unchanged).** Whitney navy blueprint reads smooth/concentric; slightly sparse vs target's denser rings. Minor density bump only.

### Carried OK / no regression (re-confirmed where spot-checked)
- midcentury-travel, ranch-ochre (radial band mounds hold), brutalist (two-tier/coastal contours fill frame), night-ride, botanical, cartouche-place, usgs-vintage, bold-modern, editorial-minimal, relief-shaded, marathon-bib, sea-chart, copper-night, electric-atlas, plein-air, risograph, dark-sky, blackline, classic-trail, moonstone, field-journal, contour-wash — coherent, no fabricated artifacts spotted, no blanks/overflow.

### Order of attack (next iteration)
1. **Route splits-stats + blueprint-strava through the concentric-contour generator** brutalist/night-ride use — the Boston-harbor coastline-outline leak is the last open BROKEN axis and is identical across both recipes (same routing bug). Highest priority; unchanged 3 passes.
2. **daybreak band-fill** — restore the radial tonal mound depth UNDER the now-dense lines (184e213 flattened it); ideally make the lines concentric.
3. **transit-diagram VINEYARD label width; blueprint density bump.**

## 2026-06-09 21:35 UTC — Review pass 11 (batch ~21:30; HEAD db2f02f; 7 new commits since pass 10)

### Convergence — the contour-character problem is essentially solved this cycle
The pass-10 commits (aebe700 "Quiet dark data contour maps", 8a750a8 "Adapt contour
density to elevation change", + per-theme tone tunes) landed the open items:

- **blueprint-strava / splits-stats / night-ride — FIXED.** The busy dark relief mottle
  is GONE; all three now read as the targets' faint subtle contour field behind the
  glow/route. Night-ride navy + blueprint-strava teal palettes retuned. No longer flagged.
- **contour-wash — FIXED.** Now crisp even concentric grey lines, not a grainy echo-wash.
- **midcentury-travel / ranch-ochre — FIXED (tonal bands present).** Both now render the
  **smooth radial tonal band** (sun-grade mound) + faint contour overlay, matching the
  targets' signature. Big improvement from the prior contour weave.
- **daybreak-trace — RESOLVED (watch closed).** 184e213/fe0ae13 capped + rebalanced it to
  a soft peach field with faint contour definition — no longer the over-soft mush.

### Remaining — all MINOR polish, no BROKEN left
- **brutalist — MINOR.** Clean bold-black contour outlines + full-size BOSTON title (good),
  but still a **single tier** — target pairs bold-black index over a faint-grey minor
  underlayer. Add the minor tier. (Flat Boston is also the canonical base-layer Minimal
  case once that ships.)
- **botanical — MINOR.** Green contour lines over sage (good), still slightly **sparse +
  no differentiated index tier**. Densify + emphasize index.
- **classic-trail — MINOR.** Improved but still on the **light/sparse** side vs target's
  dense concentric. Small density bump.
- **blueprint — MINOR.** White contours still slightly **blobby/sparse**. Minor.

### Verdict
No BROKEN themes; ~4 MINOR polish items left (contour-tier niceties + density on flat
crops). One short polish pass + a final full-batch verification closes parity — not
another full cycle.

## 2026-06-09 22:01 UTC — Review pass 12

22:01 — no new refinement work. Render batch unchanged since pass 11 (same ~21:30 batch, HEAD db2f02f in pixels). One commit landed since (9187d91 "Filter sea-level dark data contours", 21:49 UTC) — it targets the splits-stats / blueprint-strava sea-level coastline-leak BROKEN axis, but it postdates this render batch and is NOT yet rendered. Re-run after a fresh render pass captures 9187d91 to verify the leak fix.

## 2026-06-09 23:01 UTC — Review pass 13 (VERIFICATION; full re-batch 22:37–23:01 UTC, FRESH. New code since pass 12 = 9187d91 "Filter sea-level dark data contours" 21:49, 2917205 "Fix transit station label spacing", eb593b1 "Tune Night Ride footer spacing" — HEAD eb593b1)

This is the verification pass pass 12 asked for: the 22:37–23:01 batch is hours after all three commits, so 9187d91 (the coastline-leak fix) + the two label/spacing tunes are finally IN PIXELS. Reviewed the three themes those commits touch (splits-stats, blueprint-strava, transit-diagram, night-ride) against targets, plus the two open MINORs (daybreak, blueprint). EDITOR==PRINT spot-checked on both leak themes.

### Headline — the 3-pass BROKEN is RESOLVED → 0 BROKEN across the set
- **9187d91 WORKED on BOTH recipes.** The Boston-harbor COASTLINE/water-outline dump — the right-half fragment leak that was BROKEN on splits-stats + blueprint-strava for passes 14/15/16 — is **GONE on both**. The dense right-half outline clusters are filtered out; the field is now balanced (faint scattered contour fragments distributed across the whole frame, no longer clustered right with empty left/center). The sea-level dark-data filter reached both recipes this time. **No theme is BROKEN this pass.**
- **Residual (both):** the filter REMOVED the leak but did not ADD the targets' positive: smooth full-field **concentric** topo rings. Both fields now read **faint/sparse scattered fragments** rather than the target's gentle concentric weave (brutalist's Boston map still the reference for the right look). So both drop **BROKEN → MINOR (density/character only)** — the failure mode flipped from "wrong content dumped" to "too little of the right content."

### Verified FIXED this pass
- **splits-stats — BROKEN→MINOR.** Coastline leak filtered (no more right-half outline cluster). Field is faint balanced fragments; target wants faint SMOOTH concentric rings filling the centered field. Profile (natural jagged orange + gradient fill), BOSTON title, HOPKINTON→BOYLSTON ST, 813 FT GAIN, START/HIGH POINT/FINISH, stat row all parity. EDITOR==PRINT confirmed (editor shows identical faint fragments). Remaining: route through the concentric generator brutalist/night-ride use to fill the field with even rings.
- **blueprint-strava — BROKEN→MINOR (now contour-density only; leak + color both closed).** Coastline leak filtered (matches splits-stats). Ground is dark TEAL-GREEN (ca92bcc holds ✓). Grid, RADMAPS·MASSACHUSETTS / 42°21'N, FIG.01·ROUTE PLAN, green route, BOSTON, BOSTON MARATHON subtitle, stat row all correct. EDITOR==PRINT confirmed (same faint fragments + teal + grid). Remaining: same as splits-stats — faint fragments → even concentric rings behind the grid.
- **transit-diagram — FIXED (2917205); OK (no target, validity only).** The VINEYARD station label that hard-clipped to "VINEY" and collided with the FINISH node is **resolved** — full "VINEYARD" renders, left of its node, cleanly separated from FINISH. Full diagram intact: purple T1 line, START/RIDGE/OVERLOOK/CELLAR/VINEYARD/FINISH, T1 badges, 45/90 GPX LINE + START/STOP/FINISH legends, NAPA VALLEY title. Clean, print-valid.
- **night-ride — OK (eb593b1 confirmed).** Footer-spacing tune reads clean: deep-navy ground, faint grey concentric rings (parity with target's faint rings), cyan MOAB route, MOAB / SAND FLATS UTAH·MAY 2025, ELEVATION PROFILE / 1,100 FT GAIN, teal gradient profile, and the Distance/Elev Gain/Location/Date stat row now evenly distributed with clean spacing — no overflow, no crowding. Do not revert.

### MINOR — carried unchanged (no new code touched these)
- **daybreak-trace — MINOR (band-fill depth, unchanged from pass 16).** Density is good — fine copper contour lines fill the pale-pink field. Still missing the target's strong radial tonal MOUND (deep-rose graduated center → pale edges); current field is near-uniform pale pink behind the lines. Restore the band-fill mound depth UNDER the lines (midcentury/ranch-ochre still show it correctly). NAPA VALLEY / VISIT / CALISTOGA·NAPA·CALIFORNIA / black route all present.
- **blueprint — MINOR (near-OK, unchanged).** MOUNT WHITNEY navy blueprint: white/cyan contours read smooth and reasonably concentric; slightly sparse vs target's denser rings. Minor density bump only. Yellow route, FIG.01, header, DIST/GAIN footer all good.

### Known starting failures — all still FIXED
Title-shrink (BOSTON full scale), transit-diagram blank (full diagram), cartouche MÉXICO line, contour-wash blank, raw-hillshade dump — all hold. The last raw-data leak (splits-stats/blueprint-strava coastline) is now filtered too.

### Net (this pass)
**0 BROKEN.** All three new commits landed cleanly: 9187d91 closed the last leak axis on both recipes (BROKEN→MINOR), 2917205 fixed the VINEYARD label clip/collision, eb593b1 tidied the night-ride footer. Remaining work is ~3 MINOR polish items, all contour density/character: (1) push splits-stats + blueprint-strava from filtered-faint-fragments to even concentric rings (route them through the brutalist/night-ride concentric generator — the leak is gone, now they just need the positive fill); (2) restore daybreak's radial band-fill mound under its (now-dense) lines; (3) small blueprint density bump. Chrome, typography, title-fit, color, render-validity, and editor==print are DONE across the set. One short contour-density polish pass + final verification closes parity.

## 2026-06-10 00:05 UTC — Review pass 17 (render batch 23:49–23:57 UTC; HEAD 081ef8a "Deepen Daybreak tonal mound" 23:59:31. New code since pass 13 = 921a8a4 "Tune Brutalist footer spacing" 23:10, 47fb7f2 "Tune Blueprint Strava footer chrome" 23:40, 081ef8a 23:59)

### Systemic — READ FIRST (render freshness is SPLIT this pass)
- **2 of the 3 new commits are IN PIXELS; the most substantive one (daybreak) is NOT.** Verified mtimes vs commit times in UTC: brutalist.png 23:54:34 > 921a8a4 23:10 ✓ reviewable; blueprint-strava.png 23:52:17 > 47fb7f2 23:40 ✓ reviewable; **daybreak-trace.png 23:51:08 < 081ef8a 23:59:31 — render PREDATES the commit by 8 min, so "Deepen Daybreak tonal mound" is NOT yet rendered and CANNOT be verified this pass.** Re-run after a fresh render captures 081ef8a.
- **Both reviewable commits are footer-chrome/spacing tunes — both landed clean, no regressions.** Neither touched a map/contour axis, so the carried contour-density MINORs (splits-stats, blueprint-strava, daybreak band-fill, blueprint) are unchanged by definition.
- **0 BROKEN.** No blanks, no overflow, no fabricated artifacts spotted in the reviewed themes. EDITOR==PRINT confirmed on brutalist + blueprint-strava.

### Verified this pass (the 2 in-pixel commits)
- **brutalist — footer tune OK (921a8a4).** Footer reads clean: "Boston Marathon / Hopkinton → Boylston St" left, orange "26.2 mi" right, even spacing, thin rule above — matches target footer block. BOSTON title full authored scale ✓, header row ✓, crosshair corners ✓. EDITOR==PRINT confirmed (editor shows identical coastline-style map + footer). **Map caveat (carried, NOT new — no map code changed this batch):** the map still reads as SINGLE-TIER black irregular coastline/landmass outlines, NOT the target's TWO-TIER concentric rings (bold-black index over a faint-GREY concentric minor underlayer). The faint grey minor tier is absent. This is the same two-tier item first flagged MINOR in pass 11; re-observed here at full res. Footer is done; if pursuing parity, add the faint grey minor concentric tier under the black index.
- **blueprint-strava — footer chrome tune OK (47fb7f2).** Bottom stat row (Distance 26.2 mi / Elev Gain 813 ft / Location MASSACHUSETTS / Date 04.21.2025) renders evenly spaced with clean dividers, matching target. Dark teal-green ground holds (ca92bcc ✓), grid ✓, "RADMAPS · MASSACHUSETTS 42°21'N" ✓, "FIG.01 · ROUTE PLAN" ✓, BOSTON title ✓, subtitle ✓. EDITOR==PRINT confirmed. **Two carried items, unchanged (no map code this batch):** (1) background contours still faint/sparse at top rather than the target's even full-field concentric weave — same density MINOR as pass 13; (2) the route renders as a jagged elevation-PROFILE zigzag across the upper field rather than the target's geographic route loop — likely data-driven projection so NOT flagged BROKEN per the geometry rule, but worth a glance next time the route generator is touched (target clearly shows a closed-ish loop, not a profile zigzag).

### STALE — cannot verify this pass
- **daybreak-trace — 081ef8a UNVERIFIED (render predates commit).** Current 23:51 render still shows the pass-13 state: pale-pink radial bands present but FLAT/weak mound, faint copper contour lines, NAPA VALLEY full scale + VISIT + CALISTOGA·NAPA·CALIFORNIA + black route all fine. Target wants a STRONG deep radial tonal mound (dark-rose center graduating to pale edges) with concentric rings. 081ef8a is aimed exactly at this (deepen the mound) but is not in these pixels. **Re-verify next render pass** — the open question is whether the deepened mound now matches the target depth without re-flattening the contour lines.

### Carried OK / MINOR — unchanged, no new code touched these (not re-litigated)
- splits-stats (MINOR: filtered-faint fragments → want even concentric rings, pass 13), blueprint (MINOR: slight density bump), transit-diagram (FIXED pass 13, OK), night-ride (OK), midcentury-travel, ranch-ochre (radial band mounds hold), botanical, cartouche-place, usgs-vintage, bold-modern, editorial-minimal, relief-shaded, marathon-bib, sea-chart, copper-night, electric-atlas, plein-air, risograph, dark-sky, blackline, classic-trail, moonstone, field-journal, contour-wash — coherent, no blanks/overflow/fabricated artifacts.

### Net (this pass)
**0 BROKEN.** Both footer-chrome commits (brutalist 921a8a4, blueprint-strava 47fb7f2) landed cleanly and are verified in pixels. The substantive daybreak mound-deepen (081ef8a) committed 8 min after its render and is UNVERIFIED — re-run after a fresh render. Open polish, all contour density/character: (1) daybreak mound depth — VERIFY 081ef8a next batch; (2) splits-stats + blueprint-strava faint fragments → even concentric rings (route through brutalist/night-ride concentric generator); (3) brutalist add faint grey minor concentric tier under the black index (two-tier); (4) blueprint small density bump. Chrome/typography/title-fit/color/validity/editor==print remain DONE across the set.

## 2026-06-10 01:01 UTC — Review pass 18 (render batch 00:38–01:01 UTC; HEAD 3925ed7 "Tune Night Ride footer chrome" cd 00:50:17 UTC. New code since pass 17 = 081ef8a "Deepen Daybreak tonal mound" 23:59 UTC, 3925ed7 00:50 UTC)

### Systemic — READ FIRST (freshness is again SPLIT; the substantive commit IS now in pixels)
- **081ef8a (daybreak mound-deepen) is FINALLY RENDERED and VERIFIED FIXED.** This is the commit pass 13 + pass 17 both flagged STALE/unverified. daybreak-trace.png mtime 00:39:59 UTC > commit 23:59:31 UTC ✓. Reviewed print + editor against target — see below. **The mound depth is restored.**
- **3925ed7 (night-ride footer chrome) is NOT in pixels — STALE.** night-ride.png mtime 00:41:59 UTC < commit 00:50:17 UTC by ~8 min. The current night-ride render is still the pass-13 eb593b1 footer-spacing state. Re-verify next render batch.
- **0 BROKEN.** No blanks, no overflow, no fabricated artifacts. EDITOR==PRINT confirmed on daybreak.
- Note: editorial-minimal.png is the freshest file (01:01:04) but no code touched it since pass 17 — incidental re-render, unchanged, OK.

### Verified FIXED this pass
- **daybreak-trace — MINOR→OK (mound depth RESOLVED; 081ef8a worked).** The flat/weak radial field flagged passes 13–17 is **gone**. The print + editor now show a genuine deep radial tonal MOUND: dark-rose graduated center → pale-pink edges, concentric tonal bands reading as real depth (editor render shows it most clearly). Copper/white contour lines sit on top and did NOT re-flatten — the open question from pass 17 ("does deepening the mound re-flatten the lines?") answers **no**; lines stay legible over the deeper fill. NAPA VALLEY full authored scale ✓, VISIT ✓, CALISTOGA·NAPA·CALIFORNIA ✓, black route ✓. EDITOR==PRINT confirmed (editor shows identical deepened mound + same line density). **Residual (drop to OK-tier nicety, not blocking):** the mound bands read very slightly STEPPED vs the target's perfectly smooth continuous gradient, and the copper rings are a touch fainter/sparser than target's fine dense rings — but the depth, hue, and character now match. This closes the daybreak MINOR; only sub-pixel smoothing/density polish remains if pursuing pixel-perfect.

### STALE — cannot verify this pass
- **night-ride — 3925ed7 UNVERIFIED (render predates commit by ~8 min).** Current 00:41 render shows the pass-13 eb593b1 state and reads clean: deep-navy ground, cyan MOAB route loop, faint grey concentric rings, MOAB / SAND FLATS UTAH·MAY 2025, ELEVATION PROFILE / 1,100 FT GAIN, teal gradient profile, and the Distance 6.5 mi / Elev Gain 1,100 ft / Location UTAH / Date MAY 2025 stat row evenly spaced, no overflow. 3925ed7 is another footer-chrome tune on top of this already-clean footer — low risk, but NOT in these pixels. **Re-verify next batch** that the chrome tune didn't disturb the even stat-row spacing.

### Carried MINOR — unchanged, no new code touched these (not re-litigated)
- **splits-stats — MINOR.** Coastline leak stays filtered; field still filtered-faint fragments, wants even concentric rings (route through brutalist/night-ride concentric generator). Unchanged from pass 13/17.
- **blueprint-strava — MINOR.** Teal ground + footer chrome hold; background contours still faint/sparse at top vs target's even full-field concentric weave. Unchanged.
- **brutalist — MINOR (two-tier).** Footer done; map still single-tier black coastline outlines, missing the faint-grey minor concentric underlayer. Unchanged.
- **blueprint — MINOR.** Small density bump only. Unchanged.

### Carried OK — unchanged (not re-litigated)
transit-diagram (FIXED pass 13), midcentury-travel, ranch-ochre, botanical, cartouche-place, usgs-vintage, bold-modern, editorial-minimal, relief-shaded, marathon-bib, sea-chart, copper-night, electric-atlas, plein-air, risograph, dark-sky, blackline, classic-trail, moonstone, field-journal, contour-wash — coherent, no blanks/overflow/fabricated artifacts.

### Known starting failures — all still FIXED
Title-shrink (NAPA/BOSTON full scale), transit-diagram blank, cartouche MÉXICO line, contour-wash blank, raw-hillshade dump, splits-stats/blueprint-strava coastline leak — all hold.

### Net (this pass)
**0 BROKEN.** The long-running daybreak mound-deepen (081ef8a) is finally in pixels and **VERIFIED FIXED** — that MINOR closes to OK; lines did not re-flatten. night-ride footer chrome (3925ed7) committed ~8 min after its render and is UNVERIFIED — re-run after a fresh render. Remaining open polish is all contour density/character on a shrinking list: (1) splits-stats + blueprint-strava faint fragments → even concentric rings; (2) brutalist add faint-grey minor concentric tier under the black index; (3) blueprint small density bump; (4) optional daybreak sub-pixel smoothing. Chrome/typography/title-fit/color/validity/editor==print remain DONE across the set. Parity is within ~3 contour-density polish items of complete.

## 2026-06-10 02:02 UTC — Review pass 19 (render batch 01:48–01:51 UTC, FRESH; HEAD 6d7a0f4 "Cap Electric Atlas low-relief contours" 01:51:45. New code since pass 18 = cc234d0 night-ride divider 01:05, 99228fc splits-stats footer chrome 01:12, 5ccfce3 blueprint-strava footer hierarchy 01:22, 1f2e95b blueprint-strava subtitle case 01:33, a2f6356 night-ride inset footer profile 01:42, 6d7a0f4 electric-atlas cap low-relief contours 01:51)

### Systemic — READ FIRST (freshness split: 5 of 6 commits in pixels; only HEAD is stale)
- **night-ride, splits-stats, blueprint-strava commits are ALL in pixels.** Render mtimes (UTC): night-ride 01:49:44 > a2f6356 01:42:15 ✓ (so all three night-ride commits 3925ed7/cc234d0/a2f6356 are captured); splits-stats 01:49:38 > 99228fc 01:12 ✓; blueprint-strava 01:49:26 > 1f2e95b 01:33 ✓. All reviewable and verified clean below.
- **electric-atlas 6d7a0f4 is NOT in pixels — STALE.** electric-atlas.png 01:49:32 < commit 01:51:45 by ~2 min. The cap on low-relief contours is NOT rendered; current pixels still show the uncapped dense cluster. Re-verify next batch.
- **0 BROKEN.** No blanks, no overflow, no fabricated artifacts. EDITOR==PRINT confirmed on night-ride + splits-stats.
- **Pass-18 night-ride STALE is now RESOLVED** — the 3925ed7 footer chrome + cc234d0 divider + a2f6356 inset profile are all finally in pixels and read clean (below).

### Verified this pass (the 5 in-pixel commits)
- **night-ride — OK (3925ed7 + cc234d0 + a2f6356, all clean; resolves pass-18 STALE).** The footer is now fully tuned: the elevation profile sits in a contained INSET band (a2f6356) with the teal gradient fill and a clean rule/divider above the stat row (cc234d0), and the Distance 6.5 mi / Elev Gain 1,100 ft / Location UTAH / Date MAY 2025 stat row is evenly distributed with no overflow or crowding (3925ed7). Deep-navy ground, cyan MOAB route, faint grey concentric rings, MOAB full authored scale, SAND FLATS UTAH · MAY 2025, ELEVATION PROFILE / 1,100 FT GAIN, START/HIGH POINT/FINISH all parity. EDITOR==PRINT confirmed (editor shows identical inset profile + footer). Do not revert — footer chrome is DONE on night-ride.
- **splits-stats — footer chrome OK (99228fc).** Bottom stat row (Distance 26.2 mi / Elev Gain 813 ft / Location MASSACHUSETTS / Date 04.21.2025) renders evenly spaced with clean dividers, matching the target footer block. BOSTON full authored scale ✓, HOPKINTON → BOYLSTON ST ✓, ELEVATION PROFILE / 813 FT GAIN ✓, footer elevation profile band (orange jagged line + dark-orange gradient fill) ✓, START/HIGH POINT/FINISH ✓. EDITOR==PRINT confirmed. Carried MINORs unchanged (see below).
- **blueprint-strava — footer hierarchy + subtitle case OK (5ccfce3 + 1f2e95b).** 1f2e95b WORKED: the subtitle now renders MIXED-CASE "Boston Marathon · Hopkinton → Boylston St" matching the target (was being uppercased before) ✓. 5ccfce3: the bottom stat row hierarchy (small grey labels over larger values, Distance 26.2 mi / Elev Gain 813 ft / Location MASSACHUSETTS / Date 04.21.2025) reads clean and even, matching target. Dark teal-green ground ✓, grid ✓, RADMAPS · MASSACHUSETTS / 42°21'N ✓, FIG.01 · ROUTE PLAN ✓, BOSTON full scale ✓. Carried MINORs unchanged.

### STALE — cannot verify this pass
- **electric-atlas — 6d7a0f4 UNVERIFIED (render predates commit by ~2 min).** Current 01:49 pixels still show the UNCAPPED state the commit targets: a heavy DENSE purple low-relief contour cluster bunched on the right half of the map (exactly the "low-relief contours" 6d7a0f4 caps). Target shows sparser, cleaner purple concentric contours. The commit is aimed precisely at this dump. **Re-verify next render pass** that the cap thins the right-side cluster to target density without stripping the contours entirely. (Title BOSTON, header, subtitle, footer all fine and not at issue.)

### Systemic watch item (NOT BROKEN — flagging the pattern) — route renders as ZIGZAG, not geographic loop, on the 3 Boston/MA themes
- splits-stats, blueprint-strava, AND electric-atlas all render the ROUTE as a jagged elevation-profile-style ZIGZAG across the upper field, whereas all three targets show a closed-ish GEOGRAPHIC LOOP (the bird/leaf/eye shape). This is now consistent across all three MA themes, which suggests a shared route-generator/projection path rather than per-theme data noise. Per the geometry rule this is data-driven and NOT flagged BROKEN, but the treatment (zigzag vs loop) diverges from target on three themes at once — worth a look next time the route generator is touched. (night-ride and the rest render proper route loops, so it is isolated to this route/data path.)

### Carried MINOR — unchanged, no new map code touched these (not re-litigated)
- **splits-stats — MINOR (contour density).** Field still filtered-faint scattered fragments; target wants even faint concentric rings filling the field. Route through the brutalist/night-ride concentric generator. Unchanged from pass 13/17/18.
- **blueprint-strava — MINOR (contour density).** Background contours still faint/sparse vs target's even full-field concentric weave behind the grid. Unchanged.
- **brutalist — MINOR (two-tier).** Map still single-tier black coastline outlines, missing the faint-grey minor concentric underlayer under the black index. Unchanged.
- **blueprint — MINOR.** Small density bump only. Unchanged.

### Carried OK — unchanged (not re-litigated)
daybreak-trace (mound-deepen VERIFIED FIXED pass 18, OK), transit-diagram (FIXED pass 13), midcentury-travel, ranch-ochre, botanical, cartouche-place, usgs-vintage, bold-modern, editorial-minimal, relief-shaded, marathon-bib, sea-chart, copper-night, plein-air, risograph, dark-sky, blackline, classic-trail, moonstone, field-journal, contour-wash — coherent, no blanks/overflow/fabricated artifacts.

### Known starting failures — all still FIXED
Title-shrink (BOSTON/MOAB/NAPA full scale), transit-diagram blank, cartouche MÉXICO line, contour-wash blank, raw-hillshade dump, splits-stats/blueprint-strava coastline leak — all hold.

### Net (this pass)
**0 BROKEN.** Five of six new commits are in pixels and verified clean: night-ride's three footer/profile tunes (3925ed7/cc234d0/a2f6356) close the pass-18 STALE and finish night-ride footer chrome; splits-stats footer chrome (99228fc) and blueprint-strava footer hierarchy + subtitle case (5ccfce3/1f2e95b) all landed cleanly — subtitle is now correctly mixed-case. electric-atlas low-relief cap (6d7a0f4) committed ~2 min after its render and is UNVERIFIED — re-run after a fresh render to confirm the right-side dense cluster thins to target. Remaining open polish is all contour density/character: (1) splits-stats + blueprint-strava faint fragments → even concentric rings; (2) brutalist faint-grey minor concentric tier; (3) blueprint small density bump; (4) VERIFY electric-atlas 6d7a0f4 next batch. New systemic watch (not blocking): route renders as zigzag not geographic loop on all three MA themes (splits-stats/blueprint-strava/electric-atlas) — likely shared route generator. Chrome/typography/title-fit/color/validity/editor==print remain DONE across the set.

## 2026-06-10 03:04 UTC — Review pass 20 (render batch 02:49–02:52 UTC, FULLY FRESH; HEAD 2d23a71 "Filter Electric Atlas contour field" cd 02:48:28 UTC. New code since pass 19 (6d7a0f4): ec6af28 "Adapt contour density to visible relief" 02:09, b74f636 "Sparse Night Ride non-low relief contours" 02:14, 9a137f7 "Smooth dark data low-relief contours" 02:28, fac3b29 "Tune Night Ride poster background and footer" 02:36, 2d23a71 "Filter Electric Atlas contour field" 02:48)

### Systemic — READ FIRST (NO STALE this pass; whole batch postdates HEAD)
- **Every render mtime (02:49–02:52) is newer than HEAD 2d23a71 (02:48:28).** All 5 new commits — including the broad ec6af28 contour-relief change and the electric-atlas filter (2d23a71) — are IN PIXELS and reviewable. First clean no-STALE batch in several passes. Also resolves pass-19's electric-atlas STALE (6d7a0f4 now captured too).
- **0 BROKEN.** No blanks, no overflow, no fabricated artifacts. transit-diagram still renders full (T1 line + stations + NAPA VALLEY, not blank). EDITOR==PRINT confirmed on electric-atlas.
- **NEW SYSTEMIC PATTERN — the density/dark-data batch OVER-THINNED contour fields on dark + low-relief themes.** contour-wash now renders a PERFECT even fine concentric-ring field matching target (parity — this PROVES the contour engine can produce the even-ring character we want). But on the dark themes and the flat-MA themes the same batch went the OTHER way and stripped rings to sparse blob fragments / near-absent vs targets that clearly want an EVEN ring field. Net read: ec6af28's relief→density mapping is likely MIScalibrated for LOW-RELIEF data — the spec wants DENSE contours on flat terrain, but flat MA (splits-stats/electric-atlas/blueprint-strava) is rendering SPARSE fragments, the opposite of target. Recommend checking the relief-bin→contour-interval lookup for the low-relief case; contour-wash (high-relief Dolomites) is the reference for the look to hit.

### Verified this pass (in-pixel commits)
- **electric-atlas — dense cluster FIXED, but over-corrected → MINOR (6d7a0f4 + 2d23a71).** The pass-19 heavy dense purple low-relief cluster bunched on the right half is GONE — the cap (6d7a0f4) + field filter (2d23a71) worked. BUT it over-thinned: the field now reads as sparse scattered blob OUTLINES (irregular patches), not the target's even nested purple concentric rings. Title BOSTON full scale ✓, RADMAPS·MASSACHUSETTS/42°21'N ✓, FIG.01·ROUTE PLAN ✓, LIVE GPS 26.2 MI badge ✓, footer stat row ✓. EDITOR==PRINT confirmed (editor shows the same blob-outline field + pink zigzag). Net: improved from over-dense to over-sparse; still off target's even-ring density. Same fix path as splits-stats.
- **night-ride — footer/background tune OK, but rings OVER-THINNED → MINOR (fac3b29 + b74f636).** fac3b29 is clean: deep-navy ground is cleaner, the elevation profile sits in a contained inset band with teal gradient + clean divider, stat row (Distance 6.5 mi / Elev Gain 1,100 ft / UTAH / MAY 2025) even, MOAB full scale, cyan route, SAND FLATS UTAH·MAY 2025, ELEVATION PROFILE/1,100 FT GAIN, START/HIGH POINT/FINISH — all parity. HOWEVER b74f636 sparsened the faint grey concentric rings to NEAR-ABSENT (only a couple faint fragments at the left/bottom edge), whereas the TARGET shows an even faint concentric-ring field filling most of the map (clear nested ovals center-left). Footer chrome is DONE; the contour field is now too sparse vs target. Recommend dialing the non-low-relief sparse factor back up for night-ride toward the target's even ring density.
- **relief-shaded — hillshade reads softer/blobbier than target's crisp contour lines → MINOR (watch pattern).** Current render shows soft mottled tan/brown HILLSHADE mounds; target shows fine even concentric CONTOUR LINES forming the mound (crisp nested rings, not a shaded blob). Title Wonderland ✓, MOUNT RAINIER WASHINGTON ✓, WASHINGTON tag ✓, black route ✓, footer ✓ — layout/color/type all fine; only the map character diverges (hillshade-dominant vs styled contour lines). Flagging per the task's "hillshade still dominating instead of styled contours" watch.

### Carried / re-confirmed
- **contour-wash — OK (now exemplary).** Even fine grey concentric contour-line field fills the whole field, thin black route, TRE CIME + DOLOMITI ITALIA. Matches target; use as the reference for the even-ring look the sparse themes are missing.
- **splits-stats — MINOR (unchanged).** Field still faint scattered blob fragments, not target's even concentric rings; ec6af28 did NOT densify the flat-MA field. Footer chrome + profile band + title all parity. Same fix path as electric-atlas.
- **blueprint — MINOR (small density bump, marginal).** White concentric rings present around the route but the outer/upper field is barer than target's full even ring field. Cyan grid, MOUNT WHITNEY, yellow route, footer all fine.
- **blueprint-strava — MINOR (carried).** Teal ground + footer hierarchy + mixed-case subtitle (1f2e95b) all hold from pass 19; background contour weave still faint/sparse vs target's even full-field weave. Not re-litigated.
- **brutalist — MINOR (two-tier, carried).** No map code targeted it this batch; still single-tier black coastline outlines, missing the faint-grey minor concentric underlayer. Footer done.
- **dark-sky — OK (borderline).** Starfield + gold route + MOUNT WHITNEY + constellation lines + footer all parity; faint blue concentric rings a touch fainter than target but subtle in both — not flagged.

### Route-geometry watch (NOT BROKEN — data-driven) — persists on the 3 MA themes
splits-stats, blueprint-strava, electric-atlas all still render the route as a jagged elevation-profile ZIGZAG across the upper field; targets show a closed geographic LOOP (bird/leaf/eye). Consistent across all three → shared route generator/projection, not per-theme noise. Per the geometry rule, not flagged BROKEN; worth a look next time the route generator is touched.

### Known starting failures — all still FIXED
Title-shrink (BOSTON/MOAB/NAPA full scale), transit-diagram blank, cartouche MÉXICO line, contour-wash blank, raw-hillshade dump, splits-stats/blueprint-strava coastline leak — all hold.

### Net (this pass)
**0 BROKEN.** First fully-fresh, no-STALE batch in several passes. The big takeaway is a NEW SYSTEMIC pattern from the contour-density/dark-data work: it nailed contour-wash (even-ring parity, the reference look) but OVER-THINNED the dark + low-relief themes — electric-atlas's over-dense cluster is fixed but over-corrected to sparse blobs; night-ride's footer is done but its rings are now near-absent vs the target's even ring field; splits-stats/blueprint-strava/blueprint stay sparse; relief-shaded reads as soft hillshade vs target's crisp contour lines. Likely root cause: the relief→density mapping is miscalibrated for LOW-RELIEF data (producing sparse where the spec/targets want dense). Recommended next moves: (1) recalibrate low-relief contour density toward contour-wash's even-ring density for splits-stats/electric-atlas/blueprint-strava/blueprint; (2) dial night-ride's sparse factor back up; (3) relief-shaded — bias toward styled contour lines over hillshade mottle; (4) brutalist faint-grey minor tier (carried). Chrome/typography/title-fit/color/validity/editor==print remain DONE across the set.

## 2026-06-10 03:15 UTC — Review pass 12 (batch ~03:12; HEAD 254e349; ~19 commits since pass 11, mostly footer chrome + edge-case density)

### Holding — no regressions, no BROKEN
- **night-ride — OK.** Footer/profile chrome cleaned up (multiple footer commits), contours
  faint/subtle, cyan route, tidy footer. Converged.
- **electric-atlas — OK.** Contour field filtered/quieted (2d23a71, 6d7a0f4); magenta grid +
  route, LIVE GPX badge, BOSTON, stat row all coherent. Converged.
- The pass-11 FIXED set (blueprint-strava, splits-stats, contour-wash, midcentury, ranch-ochre,
  daybreak) holds — no regressions spotted.
- transit-diagram station-label spacing fix (2917205) landed.

### Still open — SAME 4 MINORs as pass 11 (not addressed this batch)
This batch went to footer chrome + edge density (night-ride/electric-atlas/sea-level), NOT to
the four flagged contour items, which are unchanged:
- **brutalist — MINOR.** Still single bold-black tier; add the faint-grey minor underlayer.
- **botanical — MINOR.** Still slightly sparse; densify + differentiate index tier.
- **classic-trail — MINOR.** Still light/sparse; small density bump.
- **blueprint — MINOR.** White contours still slightly blobby/sparse.

### Verdict
~27 hrs in; converged with no BROKEN. Codex is now in fine chrome-polish/diminishing-returns
territory and is NOT converging the 4 named MINORs. Recommend redirecting it to close exactly
those four, then call 27/27 and stop — further footer micro-tuning is past the critical path.

## 2026-06-10 04:06 UTC — Review pass 21 (render batch 03:40–03:43 UTC, FULLY FRESH; HEAD a16a621 cd 23:04 UTC 06-09. New since pass 12 HEAD 254e349: 5b46f9e "Add Brutalist minor contour tier" 22:23, 7bde078 "Fix Blueprint title and drafting label fit" 22:40, e774db1 "Add theme data contract foundation" 23:00, a16a621 "Group theme picker by purpose" 23:04)

### Systemic — READ FIRST
- **All render mtimes (03:40–03:43) postdate HEAD a16a621 (23:04). Whole batch IS in pixels — no STALE.**
- **0 BROKEN.** No blanks, no overflow, no fabricated artifacts. The risky broad commit e774db1 "theme data contract foundation" (rewrote ~142 lines of MapPreview.vue + render/snapshot/payload server paths) landed WITHOUT visible regression: transit-diagram still renders full (T1 + stations + NAPA VALLEY, not blank), contour-wash still even-ring, cartouche MÉXICO line intact, blueprint/brutalist valid, EDITOR==PRINT holds. The contract refactor is clean from a render-output standpoint.
- a16a621 "Group theme picker by purpose" touches only ThemeLineupStep.vue / themeOptions.ts / tests — picker UI, NOT poster pixels. Nothing to review.

### Verified this pass (in-pixel commits)
- **blueprint — title/label fit FIXED → OK on type; density still MINOR (7bde078).** MOUNT WHITNEY now full scale, fits the field width cleanly. Drafting labels legible and fit: RADMAPS · SHEET A / FIG. 01 · ROUTE PLAN top-left, 36.5785°N top-right. Navy ground, cyan grid, white contour rings, yellow route, footer (DIST 22.0 mi / GAIN 6,650 ft / 14 SEP 2025) all parity. Title-fit + label-fit are DONE. REMAINING: white concentric field still sparser than target — rings cluster mid-map, the upper/outer field is barer than the target's full even ring field. Same small density bump carried from passes 11/12/19/20.
- **brutalist — minor tier added but DID NOT reach parity → MINOR, priority fix (5b46f9e).** EDITOR==PRINT confirmed (both show the same field). The commit added a faint tier, but the current map reads as faint-GREY COASTLINE-BLOB contours — and is MISSING the target's defining BOLD-BLACK MAJOR concentric-ring tier (target = heavy black nested ovals + a faint-grey minor ring tier interleaved between them; clear concentric character). Current render shows neither the bold-black major rings nor a true concentric structure — just thin grey coastline-style outlines. Net: this looks like the major-tier weight was lost / the field is keyed to coastline geometry rather than concentric contour rings. Recommend restoring the BOLD-BLACK major concentric tier as the dominant element and rendering the minor tier as faint-grey rings BETWEEN the majors, matching contour-wash's even-ring character for the minor layer. This is the brutalist parity blocker, not the previously-noted "single tier" framing.

### Carried / re-confirmed (no map-density code touched beyond brutalist this batch)
- **contour-wash — OK (reference).** Even fine grey concentric ring field fills the whole map; thin black peak route; TRE CIME / DOLOMITI ITALIA. Use as the even-ring reference for blueprint/brutalist/the MA themes.
- **transit-diagram — OK.** Full T1 line, START/OVERLOOK/CELLAR/VINEYARD/FINISH stations, NAPA VALLEY + CALISTOGA·NAPA·CALIFORNIA, T1 badge, 45/90 GPX LINE legend. Not blank.
- **cartouche-place — OK.** MÉXICO eyebrow line present above CIUDAD DE MÉXICO; Ciudad de México subtitle; footer coords. MÉXICO-line failure holds fixed.
- **Low-relief density MINORs unchanged (no code this batch):** splits-stats, electric-atlas, blueprint-strava still sparse-fragment vs target even rings; night-ride rings still near-absent; relief-shaded hillshade-vs-contour; botanical / classic-trail sparse. All carried from pass 20.

### Route-geometry watch (NOT BROKEN — data-driven) — persists
splits-stats / blueprint-strava / electric-atlas still render the route as a jagged zigzag vs targets' closed loop; shared route generator. Not flagged BROKEN per the geometry rule.

### Known starting failures — all still FIXED
Title-shrink (BOSTON / MOUNT WHITNEY / NAPA full scale), transit-diagram blank, cartouche MÉXICO line, contour-wash blank, raw-hillshade dump, coastline leak — all hold.

### Net (this pass)
**0 BROKEN.** Headline: the broad theme-data-contract refactor (e774db1) shipped with no render regression — good. blueprint title + drafting-label fit (7bde078) is DONE; only its contour density remains (carried MINOR). brutalist's new minor-tier commit (5b46f9e) did NOT hit parity — it's missing the bold-black MAJOR concentric tier and reads as faint coastline blobs; that's now the brutalist blocker. Next moves, in order: (1) brutalist — restore bold-black major concentric rings + faint-grey minor rings between them (model the minor layer on contour-wash); (2) recalibrate low-relief density toward contour-wash even-ring for blueprint / splits-stats / electric-atlas / blueprint-strava; (3) dial night-ride rings back up; (4) relief-shaded — styled contour lines over hillshade mottle; (5) botanical / classic-trail density bump. Chrome/typography/title-fit/color/validity/editor==print remain DONE across the set.

## 2026-06-10 05:01 UTC — Review pass 22
05:01 — no new refinement work (renders unchanged since pass 21 batch 03:40–03:43; only new commit dc6abf8 "Cache theme location enrichment" is enrichment/caching plumbing — server payload/snapshot + migration, no theme-style change and no re-render).

06:01 — no new refinement work (HEAD still dc6abf8; renders unchanged since pass 21 batch 03:40–03:43; no new refinement commits, no re-render since pass 22).

07:01 — no new refinement work (HEAD still dc6abf8; renders unchanged since pass 21 batch 03:40–03:43; no new refinement commits, no re-render since pass 22).

08:01 — no new refinement work (HEAD still dc6abf8; renders unchanged since pass 21 batch 03:40–03:43; no new refinement commits, no re-render since pass 22).

09:01 — no new refinement work (HEAD still dc6abf8; renders unchanged since pass 21 batch 03:40–03:43; no new refinement commits, no re-render since pass 22).

10:01 — no new refinement work (HEAD still dc6abf8; renders unchanged since pass 21 batch 03:40–03:43; no new refinement commits, no re-render since pass 22).

11:01 — no new refinement work (HEAD still dc6abf8; renders unchanged since pass 21 batch 03:40–03:43; no new refinement commits, no re-render since pass 22).

12:01 — no new refinement work (HEAD still dc6abf8; renders unchanged since pass 21 batch 03:40–03:43; no new refinement commits, no re-render since pass 22).

13:01 — no new refinement work (HEAD still dc6abf8; renders unchanged since pass 21 batch 03:40–03:43; no new refinement commits, no re-render since pass 22).

## 2026-06-10 03:25 UTC — PARITY CALLED DONE (Anthony) — reviewer PAUSED

Theme parity refinement is signed off as shippable after ~24 hrs. State: no BROKEN
themes, all 27 render coherently at editor + print, foundation/title/chrome/contour
character all resolved. The hourly overnight reviewer (radmaps-theme-parity-review) is
**paused** — the open-ended refine+review loop had no stop condition and had drifted to
off-critical-path chrome micro-tuning.

### Backlog — 4 MINOR density/tier items (not blockers; do as a small finite task, then stop)
1. **brutalist** — add the faint-grey minor-contour underlayer beneath the bold-black index (single-tier today).
2. **botanical** — densify the sage contour field + differentiate the darker-green index tier.
3. **classic-trail** — small density bump (currently light/sparse on the low-relief crop).
4. **blueprint** — de-blob / densify the white contours slightly toward even concentric.

No other changes. Do NOT resume open-ended footer/chrome tuning. Next work = the
post-parity plan (docs/POST_PARITY_NEXT_STEPS.md).

## 2026-06-10 03:45 UTC — BACKLOG CLEARED — parity 27/27 COMPLETE
The four finite MINORs are closed (one commit each: 5efb0fb brutalist underlayer,
b6af4d8 botanical density, 959d6f3 classic-trail density, a79bc95 blueprint contours;
vue-tsc + test:style-graph green per commit; only the four re-rendered).
Verified vs targets: brutalist now has the faint-grey minor tier under bold-black index;
botanical denser sage + distinct index tier; classic-trail evenly concentric; blueprint
denser/smoother. No regressions to title/frame/footer/palette. Codex stopped after the
four as instructed (no full re-batch).
Theme parity refinement is DONE. Reviewer remains paused. Next work = post-parity plan
(docs/POST_PARITY_NEXT_STEPS.md). FYI: one prep commit dc6abf8 "Cache theme location
enrichment" landed just before the four — that's Phase-2 (data-contract) groundwork.
