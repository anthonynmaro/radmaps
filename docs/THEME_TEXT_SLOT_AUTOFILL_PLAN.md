# Theme Text Slot Autofill Plan

Date: June 10, 2026
Status: plan, reconciles with `THEME_DATA_CONTRACT_PLAN.md`

## Problem

The theme data contract now detects route/place context and guards missing data,
but poster text still falls back through old generic paths. In practice, a theme can
render the uploaded GPX title in several slots at once:

- primary title: `Kikcapoo Mountain Bike Trails`
- subtitle/location line: same title again
- kicker/meta/decorative chrome: same title again

That is why the picker can show repeated title text even though the imported GPX
and stored map payload contain enough information to derive richer labels such as
place, city/region/state, coordinates, date, distance, gain, and activity type.

This is not a renderer problem and not a new visual system. It is the missing
slot-population layer of the theme data contract.

## Principles

1. **Every slot has a semantic purpose.** A title slot, region slot, coordinate
   slot, date slot, route-stat slot, and decorative kicker are different contracts.
   They must not all independently fall back to `map.title`.
2. **Use only user-owned or genuinely derived data.** Slot values come from the GPX,
   stored map payload, cached location metadata, or user edits. Never hardcode a
   fixture region or invent a plausible-sounding place.
3. **No silent duplication.** The same string should not be used in adjacent visible
   text slots unless the theme explicitly declares that repetition as a design
   treatment.
4. **User edits win.** Existing `poster_text_overrides` remain the user-owned layer.
   Autofill changes defaults only; it must not overwrite a customized slot.
5. **Renderer stays pure.** `MapPreview.vue`, proof, final, checkout, and share
   render from stored map data plus resolved style config. No reverse geocode or
   elevation calls during render.
6. **`MapPreview.vue` remains the only renderer.** The fix feeds better data into
   the existing poster renderer rather than adding theme-specific render code.

## Desired Behavior

For a GPX route with metadata and derivable location:

- `trail_name`: the best route/title value, usually GPX track name or map title.
- `location_text`: the best location value, not the title. Prefer specific place
  label, then city/region, then region/country, then coordinates.
- `composition_kicker`: a theme-specific short label such as region, activity type,
  map mode, date, or "Relief Study"; not the route title unless no better real
  value exists and the slot is allowed to duplicate.
- `composition_meta`: structured supporting facts such as coordinates, distance,
  date, gain, point elevation, or source label.
- route stats/profile slots: populated only when route/elevation data exists.
- missing slots: removed ephemerally at layout resolution, not written as
  tombstones.

For the Kickapoo example, the selected Shaded Relief theme should use one title
slot for `Kikcapoo Mountain Bike Trails`, then fill the other visible slots from
real metadata such as derived location/region, coordinates, distance, gain, date,
or activity type. It should not repeat the title as title, subtitle, and kicker.

## Current Gaps

- `MapPreview.vue` still has local fallback functions (`defaultSlotText`,
  `compositionDecorDefaults`, and several composition-specific computed values)
  that choose text directly from `styleConfig`, `map.title`, `stats`, and partial
  `themeDataContext` values.
- `utils/render/posterFormatters.ts` formats known values, but it does not choose
  the best semantic value per slot.
- `utils/themeDataContract.ts` resolves missing/placeholder state, but it does not
  yet own the full text-value resolution policy for every visible poster slot.
- The theme picker previews use the real `MapPreview`, so any weak fallback appears
  immediately across hero and cards.

## Architecture

Add one canonical layer between `ThemeDataContext` and `MapPreview`:

```ts
resolveThemeTextSlots({
  theme,
  composition,
  context,
  styleConfig,
  renderMode,
}): ResolvedThemeTextSlots
```

It should live with the existing data contract, either in
`utils/themeDataContract.ts` or a small companion module such as
`utils/themeTextSlots.ts`. It returns:

- `values: Partial<Record<PosterTextSlot, string>>`
- `sources: Partial<Record<PosterTextSlot, SlotValueSource>>`
- `omittedSlotIds: PosterTextSlot[]`
- `duplicateSlotIds: PosterTextSlot[]`
- `warnings: string[]`

`MapPreview.vue` then becomes a consumer:

- `defaultSlotText(slot)` reads `resolvedThemeTextSlots.values[slot]`.
- composition-specific defaults read named resolved values instead of recomputing
  fallbacks.
- `poster_text_overrides[slot].text` still wins.
- `styleConfig.trail_name`, `location_text`, and `occasion_text` remain legacy/user
  editable fields, but they should be normalized into the slot resolver rather than
  being read ad hoc throughout the component.

## Slot Source Priority

### Title

Source priority:

1. user override for `trail_name`
2. `styleConfig.trail_name`
3. GPX track/name metadata stored as map title
4. imported activity name
5. location label
6. preview-only placeholder in `picker-preview`/`editor`

### Location

Source priority:

1. user override for `location_text`
2. `styleConfig.location_text`
3. `location_label` when it is not the same as title
4. `location_city + location_region`
5. `location_region + location_country`
6. `stats.location` when it is not the same as title
7. formatted coordinates
8. remove/block according to render mode

### Kicker / Eyebrow

Source priority depends on composition, but must prefer non-title facts:

1. activity type, map mode, region, month/year, or theme-authored static label
2. point elevation or route distance/gain where appropriate
3. remove if it would duplicate the title and no explicit theme rule allows that

### Meta / Footer

Source priority:

1. coordinates
2. distance/gain/date
3. region/country
4. point elevation
5. remove if empty

## De-Duplication Rules

Normalize strings before comparing:

- trim whitespace
- collapse internal whitespace
- compare case-insensitively
- ignore punctuation-only differences where practical

Default rule:

- Adjacent `trail_name`, `location_text`, `occasion_text`, `composition_kicker`,
  `composition_meta`, and `composition_footer` may not resolve to the same
  normalized value.
- If a lower-priority slot duplicates a higher-priority slot, try the next source
  for that slot.
- If no non-duplicate real source exists, omit the lower-priority slot in proof,
  checkout, final, and share.
- In picker/editor, a preview placeholder may be used only if the render mode
  permits placeholders and it is visibly non-canonical sample content.

## Data Enrichment

The resolver can only use stored data. Server-side map creation/enrichment should
populate:

- `location_label`
- `location_city`
- `location_region`
- `location_country`
- `location_lng`
- `location_lat`
- `location_elevation_m`
- `location_metadata_source`
- `location_metadata_enriched_at`

For GPX uploads, derive the lookup point from:

1. explicit GPX/activity location metadata if available
2. route centroid or bbox center
3. start point when centroid is unavailable

This should use the already planned server-side reverse geocode/elevation path and
cache results on the `maps` row. The renderer must never call external services.

## Build Order

1. **Inventory slots.** Add a table/test fixture of every `PosterTextSlot` used by
   each composition and whether it is title, location, stat, coord, date, decorative,
   or brand.
2. **Add text-slot resolver.** Implement `resolveThemeTextSlots(...)` using
   `ThemeDataContext`, `posterFormatters`, and render mode.
3. **Wire `MapPreview.vue`.** Replace ad hoc title/location/meta fallbacks with the
   resolved slot values while preserving `poster_text_overrides`.
4. **Add de-duplication.** Lower-priority slots choose alternate real values or omit
   themselves instead of repeating the title.
5. **Complete enrichment path.** Ensure GPX creation/enrichment fills cached
   location fields and schema/migrations are in sync.
6. **Order/checkout gate.** Block unresolved unapproved placeholders from proof,
   checkout, final, and share. Approved placeholders become user-owned overrides,
   not canonical metadata.
7. **Picker review.** Theme picker should preview the same resolved slot values as
   the editor output for the same theme + base mode.

## Tests

Unit:

- route with GPX title + cached city/region resolves distinct title/location/meta
  slots.
- route with title but no location omits or coordinates-fills location slots
  according to render mode.
- place-only map removes route stats/profile and uses place metadata.
- duplicate title/location values force lower-priority slot fallback or omission.
- user `poster_text_overrides` preserve custom text and bypass auto de-duplication
  only for that explicit slot.
- approved placeholders are allowed only as user-owned override data.
- unapproved placeholders block checkout/final/share.

Playwright:

- Kickapoo-style GPX in theme picker does not repeat the title in title, subtitle,
  and kicker.
- Shaded Relief hero/card preview text matches editor output after "Use this look."
- POI on `splits-stats` and `marathon-bib` reflows without route stats/profile.
- Editing a slot keeps the user edit when changing themes.

Regression assertions:

- no hardcoded fixture regions such as Massachusetts/Boston appear for maps whose
  stored location context is elsewhere.
- render hashes include `THEME_DATA_CONTRACT_VERSION`, resolved context, base mode,
  and resolved text-slot values or their source signatures.

## Acceptance Criteria

- A GPX import with derivable location data produces a poster where title,
  location, kicker, and meta carry distinct real facts where possible.
- No ordered/proof/final/share render silently shows fabricated text.
- Missing data removes slots ephemerally and preserves user tombstones as user
  intent only.
- Editor, picker, proof, checkout, final, and share use the same slot values.
- User edits remain editable and survive theme changes unless the user resets them.
