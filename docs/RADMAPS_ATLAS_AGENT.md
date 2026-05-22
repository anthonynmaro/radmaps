# RadMaps Atlas Agent

The atlas style agent uses Anthropic to generate structured owned-atlas tileset
recipes. It is for the Planetiler + PMTiles atlas workstream, not the
customer-facing Scout style assistant.

Read `docs/RADMAPS_ATLAS_PRODUCTION_PLAN.md` before adding new atlas styles,
layers, build scripts, manifests, or editor controls. That document defines the
production layer contract and rollout strategy.

## What It Produces

Each run writes:

- JSON recipes for candidate RadMaps atlas tilesets.
- A Markdown summary for quick review.
- Source-layer requirements, derived terrain-art layers, MapLibre styling
  recipes, Planetiler profile notes, attribution reminders, and acceptance
  fixtures.

The output is intentionally a design/build spec, not raw map tiles. Tile
generation still belongs to the Planetiler build pipeline.

## Environment

The script reads `ANTHROPIC_API_KEY` from:

1. The current worktree `.env`.
2. The sibling main worktree at `../trailmaps-app/.env`.
3. `process.env`.

Do not commit `.env` files or generated logs containing secrets.

## Usage

```bash
npm run atlas:style-agent

npm run atlas:style-agent -- \
  --count 8 \
  --brief "More Midwest gravel, Great Lakes shoreline, and blueprint terrain ideas"
```

Default outputs:

- `atlas/style-ideas/latest.json`
- `atlas/style-ideas/latest.md`

Use dated filenames when you want to preserve a run:

```bash
npm run atlas:style-agent -- \
  --out atlas/style-ideas/seed-2026-05-14.json \
  --markdown atlas/style-ideas/seed-2026-05-14.md
```

## Review Checklist

Before turning an idea into app code:

- Confirm it uses the RadMaps-native minimal schema.
- Confirm it follows `docs/RADMAPS_ATLAS_PRODUCTION_PLAN.md`.
- Confirm the style can render from PMTiles/MapLibre without a commercial
  provider dependency.
- Confirm source attribution is represented in `docs/MAP_TOOLS_CATALOG.md`.
- Confirm new layer capabilities are represented in `utils/styleLayerGraph.ts`.
- Add fixtures for Rockies, Utah desert, PNW forest/water, Chicago/urban
  Midwest, Wisconsin/Driftless, and Michigan/Great Lakes when the idea becomes
  an internal atlas-lab preset.

Before publishing or promoting Atlas data:

- Update `docs/RADMAPS_ATLAS_BUILD_PIPELINE.md`,
  `docs/RADMAPS_ATLAS_STORAGE.md`, `docs/RADMAPS_ATLAS_PRODUCTION_PLAN.md`,
  and `docs/MAP_TOOLS_CATALOG.md`.
- Record artifact id, object path, source data, bounds, zooms, bytes, checksum
  when available, manifest version, verification commands, and remaining
  production blockers.
- Merge large base artifacts into the current manifest with
  `npm run atlas:merge-manifest-artifact` instead of replacing the manifest and
  losing previously verified terrain or overlay artifacts.
- Keep production promotion separate from staging publication until Worker,
  Atlas Lab, editor, Browserless, attribution, analytics, and rollback checks
  pass.
