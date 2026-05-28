# RadMaps Theme Registry

Single source of truth for the AI style agent. All theme data comes from `utils/themes/refined.ts`.

## Refined Themes (13)

### editorial-minimal
- **Label:** Editorial | **Family:** Minimal | **Audience:** Gallery / collector
- **Composition:** `editorial-tall` | **Dark:** false
- **Palette:** bg `#F6F2EA`, route `#B5251D`, water `#D6DCE0`, land `#EFE9DD`
- **Typography:** Playfair Display / Libre Baskerville | **Border:** none
- **Tile:** carto-light | **Grain:** 0 | **Effect:** none
- **Map defaults:** preset=contour-art, roads=off, labels=off, hillshade=off, contours=on

### usgs-vintage
- **Label:** USGS | **Family:** Topographic | **Audience:** National Park / tourist
- **Composition:** `park-quad` | **Dark:** false
- **Palette:** bg `#EDE3CC`, route `#B43A1F`, water `#9CB7C0`, land `#E8DCBE`
- **Typography:** DM Serif Display / Libre Baskerville | **Border:** thin
- **Tile:** maptiler-topo | **Grain:** 0.32 | **Effect:** none
- **Map defaults:** preset=natural-topo, roads=off, labels=on, hillshade=off, contours=on

### midcentury-travel
- **Label:** Mid-Century | **Family:** Travel poster | **Audience:** National Park / tourist
- **Composition:** `travel-banner` | **Dark:** false
- **Palette:** bg `#E8DAB8`, route `#D4603A`, water `#7FA098`, land `#D8C594`
- **Typography:** Oswald / Work Sans | **Border:** none
- **Tile:** carto-light | **Grain:** 0.12 | **Effect:** none
- **Map defaults:** preset=contour-art, roads=off, labels=off, hillshade=off, contours=on

### risograph
- **Label:** Risograph | **Family:** Print | **Audience:** Trail marketing / merch
- **Composition:** `riso-stack` | **Dark:** false
- **Palette:** bg `#F2EAD2`, route `#E84A2A`, water `#3F6FB8`, land `#E8DDB8`
- **Typography:** Oswald / Space Grotesk | **Border:** none
- **Tile:** carto-light | **Grain:** 0.40 | **Effect:** duotone
- **Map defaults:** preset=minimalist, roads=off, labels=off, hillshade=off, contours=on

### blueprint
- **Label:** Blueprint | **Family:** Technical | **Audience:** Engineer / surveyor
- **Composition:** `blueprint-grid` | **Dark:** true
- **Palette:** bg `#0F2D52`, route `#FFD046`, water `#091F3A`, land `#143664`
- **Typography:** Space Grotesk / Space Grotesk | **Border:** thin
- **Tile:** carto-dark | **Grain:** 0.04 | **Effect:** none | **Grid:** on
- **Map defaults:** preset=route-only, roads=off, labels=off, hillshade=off, contours=on, grid=on

### blueprint-strava
- **Label:** Blueprint Strava | **Family:** Technical | **Audience:** Strava ride / data import
- **Composition:** `blueprint-strava` | **Dark:** true
- **Palette:** bg `#0F2D52`, route `#FC4C02`, water `#091F3A`, land `#143664`
- **Typography:** Space Grotesk / Space Grotesk | **Border:** thin
- **Tile:** carto-dark | **Grain:** 0.04 | **Effect:** none | **Grid:** on
- **Map defaults:** preset=route-only, roads=off, labels=off, hillshade=off, contours=on, grid=on

### field-journal
- **Label:** Journal | **Family:** Illustrated | **Audience:** Hiker / traveler
- **Composition:** `journal-spread` | **Dark:** false
- **Palette:** bg `#F1E9D8`, route `#A23B26`, water `#A8B8B0`, land `#EBE0C8`
- **Typography:** Cormorant Garamond / Libre Baskerville | **Border:** thin
- **Tile:** maptiler-outdoor | **Grain:** 0.22 | **Effect:** layer-color
- **Map defaults:** preset=natural-topo, roads=off, labels=on, hillshade=on, contours=on

### bold-modern
- **Label:** Modernist | **Family:** Graphic | **Audience:** Designer / collector
- **Composition:** `modernist-block` | **Dark:** false
- **Palette:** bg `#F1EAE0`, route `#FF3A2E`, water `#1C1917`, land `#F1EAE0`
- **Typography:** Big Shoulders Display / DM Sans | **Border:** thick
- **Tile:** carto-light | **Grain:** 0 | **Effect:** none
- **Map defaults:** preset=contour-art, roads=off, labels=off, hillshade=off, contours=on

### splits-stats
- **Label:** Splits | **Family:** Data-forward | **Audience:** Runner / cyclist
- **Composition:** `splits-grid` | **Dark:** true
- **Palette:** bg `#0E0E10`, route `#FC4C02`, water `#101820`, land `#161618`
- **Typography:** Space Grotesk / Space Grotesk | **Border:** none
- **Tile:** carto-dark | **Grain:** 0.08 | **Effect:** none
- **Map defaults:** preset=road-network, roads=on, labels=off, hillshade=off, contours=off

### marathon-bib
- **Label:** Marathon | **Family:** Commemorative | **Audience:** Marathon / event
- **Composition:** `bib-numerals` | **Dark:** false
- **Palette:** bg `#FAFAF7`, route `#1A4D8F`, water `#D8E2EC`, land `#F0EDE7`
- **Typography:** Bebas Neue / DM Sans | **Border:** thick
- **Tile:** carto-light | **Grain:** 0 | **Effect:** none
- **Map defaults:** preset=road-network, roads=on, labels=off, hillshade=off, contours=off

### dark-sky
- **Label:** Dark Sky | **Family:** Atmospheric | **Audience:** Backcountry / dark sky park
- **Composition:** `darksky-stars` | **Dark:** true
- **Palette:** bg `#0A0F1C`, route `#F4B942`, water `#06091A`, land `#10162B`
- **Typography:** Fjalla One / Work Sans | **Border:** none
- **Tile:** carto-dark | **Grain:** 0.18 | **Effect:** layer-color
- **Map defaults:** preset=contour-art, roads=off, labels=off, hillshade=on, contours=on

### botanical
- **Label:** Botanical | **Family:** Naturalist | **Audience:** Garden / landscape
- **Composition:** `botanical-plate` | **Dark:** false
- **Palette:** bg `#EDE6D6`, route `#7B3A2A`, water `#A6BFA6`, land `#E2DCC4`
- **Typography:** Cormorant Garamond / Libre Baskerville | **Border:** thin
- **Tile:** maptiler-outdoor | **Grain:** 0.10 | **Effect:** none
- **Map defaults:** preset=natural-topo, roads=off, labels=off, hillshade=off, contours=on

### brutalist
- **Label:** Brutalist | **Family:** Concrete | **Audience:** Urban runner / cyclist
- **Composition:** `brutalist-slab` | **Dark:** false
- **Palette:** bg `#E5E1D8`, route `#FF1F1F`, water `#B8B8B0`, land `#D8D4CB`
- **Typography:** Bebas Neue / Space Grotesk | **Border:** thick
- **Tile:** carto-light | **Grain:** 0.06 | **Effect:** none
- **Map defaults:** preset=contour-art, roads=off, labels=off, hillshade=off, contours=on

## Audience-to-Theme Matrix

| Route category | Primary themes | Secondary themes |
|---------------|---------------|-----------------|
| National Park hike | usgs-vintage, midcentury-travel | field-journal, botanical, dark-sky |
| Day hike / trail | field-journal, editorial-minimal | usgs-vintage, botanical, dark-sky |
| Marathon / road race | marathon-bib, splits-stats | brutalist, bold-modern |
| Trail run | splits-stats, brutalist | dark-sky, field-journal |
| Cycling / road | blueprint-strava, splits-stats | bold-modern, brutalist |
| Mountain bike | blueprint-strava, bold-modern | brutalist, splits-stats |
| Backpacking | dark-sky, field-journal | usgs-vintage, botanical |
| Urban walk / tour | bold-modern, editorial-minimal | brutalist, risograph |
| Bike network / infrastructure | blueprint, blueprint-strava | bold-modern, brutalist |
| Art / gallery print | editorial-minimal, risograph | bold-modern, botanical |

## Valid Enums

### Presets (12)
minimalist, topographic, route-only, road-network, contour-art, natural-topo, stadia-watercolor, stadia-toner, native-toner, native-watercolor, alidade-smooth, alidade-smooth-dark

### Compositions (13)
editorial-tall, park-quad, travel-banner, riso-stack, blueprint-grid, blueprint-strava, journal-spread, modernist-block, splits-grid, bib-numerals, darksky-stars, botanical-plate, brutalist-slab

### Tile Styles (5)
carto-light, carto-dark, maptiler-outdoor, maptiler-topo, maptiler-winter

### Fonts — Display (12)
Big Shoulders Display, Fjalla One, Oswald, Bebas Neue, DM Sans, Space Grotesk, Outfit, Work Sans, Playfair Display, Cormorant Garamond, Libre Baskerville, DM Serif Display

### Border Styles
thin, thick, none

### Print Sizes
8x12, 12x18, 16x24, 20x30, 24x36, 32x48

### Tile Effects
none, duotone, posterize, layer-color, invert

## Legacy Themes (still valid, hidden from new selection)

chalk, topaz, dusk, obsidian, forest, midnight, editorial, bauhaus, vintage, kertok, mid-century, topo-art

These render correctly for existing maps but should not be used for new creations. Each has a `migration_target` pointing to a refined theme.
