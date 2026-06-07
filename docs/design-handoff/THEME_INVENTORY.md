# Theme Inventory

This inventory describes the current poster themes and owned/Beta map presets
for external design review. The registry currently has 27 renderable poster
theme IDs: 15 primary anchors, 7 colorways, and 5 new candidate directions.

## Poster Themes

| Theme ID | Label | Composition | Primary Font | Secondary Font | Default Map Preset |
|---|---|---|---|---|---|
| `editorial-minimal` | Editorial | `editorial-tall` | Playfair Display | Source Serif 4 | `radmaps-simple-contour` |
| `usgs-vintage` | USGS Heritage | `park-quad` | Libre Baskerville | Source Sans 3 | `radmaps-simple-contour` |
| `midcentury-travel` | Mid-Century | `travel-banner` | Oswald | Source Sans 3 | `radmaps-simple-contour` |
| `risograph` | Risograph | `riso-stack` | Big Shoulders Display | Work Sans | `radmaps-simple-contour` |
| `blueprint` | Blueprint | `blueprint-grid` | Space Grotesk | IBM Plex Sans | `radmaps-alidade-dark` |
| `blueprint-strava` | Trail Blueprint | `blueprint-strava` | Space Grotesk | IBM Plex Sans | `radmaps-alidade-dark` |
| `field-journal` | Field Journal | `journal-spread` | Cormorant Garamond | Source Serif 4 | `radmaps-natural` |
| `bold-modern` | Modernist | `modernist-block` | Big Shoulders Display | DM Sans | `radmaps-toner-light` |
| `contour-wash` | Contour Wash | `art-wash` | Space Grotesk | Source Sans 3 | `radmaps-contour-wash` |
| `splits-stats` | Trail Profile | `splits-grid` | Space Grotesk | IBM Plex Sans | `radmaps-alidade-dark` |
| `marathon-bib` | Marathon | `bib-numerals` | Bebas Neue | Atkinson Hyperlegible Next | `radmaps-alidade` |
| `dark-sky` | Dark Sky | `darksky-stars` | Cormorant Garamond | Source Sans 3 | `radmaps-night-relief` |
| `botanical` | Botanical Plate | `botanical-plate` | Cormorant Garamond | Source Serif 4 | `radmaps-natural` |
| `brutalist` | Brutalist | `brutalist-slab` | Bebas Neue | IBM Plex Sans | `radmaps-toner-light` |
| `classic-trail` | Classic Trail | `park-quad` | Libre Baskerville | Source Sans 3 | `radmaps-topographic` |
| `ranch-ochre` | Ranch Ochre | `travel-banner` | Oswald | Source Sans 3 | `radmaps-simple-contour` |
| `blackline` | Blackline | `modernist-block` | Big Shoulders Display | IBM Plex Sans | `radmaps-toner-light` |
| `copper-night` | Copper Night | `darksky-stars` | Cormorant Garamond | Source Sans 3 | `radmaps-night-relief` |
| `moonstone` | Moonstone | `blueprint-grid` | Space Grotesk | IBM Plex Sans | `radmaps-alidade` |
| `night-ride` | Night Ride | `splits-grid` | Oswald | IBM Plex Sans | `radmaps-alidade-dark` |
| `daybreak-trace` | Daybreak | `travel-banner` | Oswald | Source Sans 3 | `radmaps-simple-contour` |
| `electric-atlas` | Electric Atlas | `blueprint-strava` | Big Shoulders Display | IBM Plex Sans | `radmaps-alidade-dark` |
| `cartouche-place` | Cartouche | `place-frame` | Playfair Display | Source Serif 4 | `radmaps-alidade` |
| `sea-chart` | Sea Chart | `sea-chart` | Libre Baskerville | IBM Plex Sans | `radmaps-simple-contour` |
| `relief-shaded` | Shaded Relief | `editorial-tall` | Newsreader | Source Sans 3 | `radmaps-natural` |
| `transit-diagram` | Transit | `transit-diagram` | Outfit | IBM Plex Sans | `radmaps-simple-contour` |
| `plein-air` | Plein Air | `art-wash` | Cormorant Garamond | Source Sans 3 | `radmaps-watercolor-paper` |

## Colorway Relationships

These IDs are implemented as distinct renderable themes, but should be reviewed
as colorways of stronger parent anchors.

| Colorway ID | Parent Anchor | Review Question |
|---|---|---|
| `classic-trail` | `usgs-vintage` | Is the cooler slate route/palette distinct enough, or should it nest under USGS Heritage? |
| `ranch-ochre` | `midcentury-travel` | Should ochre stay visible as a warmer travel colorway? |
| `daybreak-trace` | `midcentury-travel` | Does the daybreak palette earn a separate picker slot now that it shares Oswald? |
| `blackline` | `bold-modern` | Should this be the monochrome Modernist colorway rather than a top-level theme? |
| `moonstone` | `blueprint` | Is Moonstone a useful light technical colorway, or too close to Alidade defaults? |
| `night-ride` | `splits-stats` | Should Night Ride remain a performance/night colorway under Trail Profile? |
| `copper-night` | `dark-sky` | Should Copper Night remain visible under Dark Sky or be folded into copper route controls? |

## Implementation Contract

The extracted standalone review contract is codified in
[`utils/themes/specContract.ts`](/Users/anthonymaro/Documents/apps/trailmaps/trailmaps-app/utils/themes/specContract.ts).
Each theme entry includes the implementation checklist fields from the review:
decision, priority, composition, content fixture, typography, case behavior,
palette, map requirements, route requirements, layout requirements, problem,
refinement, merge target, and explicit not-implemented notes.

## Owned/Beta Map Presets

These are RadMaps-owned map styles exposed in the editor as map-only themes.
They can be paired with poster themes.

| Preset ID | Label | Review Focus |
|---|---|---|
| `radmaps-minimalist` | Atlas Minimal | Minimal map art, quiet background, route clarity |
| `radmaps-topographic` | Atlas Topo | Topographic texture, contour readability, outdoor credibility |
| `radmaps-natural` | Atlas Natural | Terrain/natural palette, botanical and field-guide compatibility |
| `radmaps-toner-light` | Toner Light | High-contrast monochrome, modern/editorial uses |
| `radmaps-toner-dark` | Toner Dark | Dark monochrome, label and route contrast |
| `radmaps-contour-wash` | Contour Wash | Soft contour expression, art print character |
| `radmaps-watercolor` | Watercolor | Painterly character, route legibility over texture |
| `radmaps-night-relief` | Night Relief | Dark terrain, premium night-map feel |
| `radmaps-simple-contour` | Simple Contour | Clean contour base, versatile poster support |
| `radmaps-alidade` | Atlas Alidade | Technical/celestial/cartographic identity |
| `radmaps-alidade-dark` | Atlas Dark | Technical dark mode, blueprint and performance themes |

## Composition IDs

- `editorial-tall`
- `park-quad`
- `travel-banner`
- `riso-stack`
- `blueprint-grid`
- `blueprint-strava`
- `journal-spread`
- `modernist-block`
- `splits-grid`
- `bib-numerals`
- `darksky-stars`
- `botanical-plate`
- `brutalist-slab`
- `art-wash`
- `place-frame`
- `sea-chart`
- `transit-diagram`
