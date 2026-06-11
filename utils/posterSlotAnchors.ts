import type { CompositionId, PosterTextSlot } from '~/types'

export type PosterSlotAnchorType = 'band' | 'free' | 'map'
export type PosterSlotAnchorLocation =
  | 'band-header'
  | 'band-footer'
  | 'band-rail'
  | 'free-over-map-titleblock'
  | 'map-label'
  | 'map-pin-label'

export interface PosterSlotAnchorOccurrence {
  id: string
  slot: PosterTextSlot
  anchorType: PosterSlotAnchorType
  location: PosterSlotAnchorLocation
  compositions?: CompositionId[]
  themes?: string[]
  source: string
}

export const POSTER_TEXT_SLOT_ANCHOR_OCCURRENCES = [
  {
    id: 'header-title',
    slot: 'trail_name',
    anchorType: 'band',
    location: 'band-header',
    source: 'utils/posterLayout.ts default header-title row',
  },
  {
    id: 'header-subtitle-location',
    slot: 'location_text',
    anchorType: 'band',
    location: 'band-header',
    source: 'utils/posterLayout.ts header-subtitle row',
  },
  {
    id: 'header-subtitle-occasion',
    slot: 'occasion_text',
    anchorType: 'band',
    location: 'band-header',
    compositions: ['editorial-tall', 'park-quad', 'travel-banner', 'riso-stack', 'journal-spread', 'darksky-stars', 'botanical-plate'],
    source: 'utils/posterLayout.ts OCCASION_COMPOSITIONS',
  },
  {
    id: 'header-decor-kicker',
    slot: 'composition_kicker',
    anchorType: 'band',
    location: 'band-header',
    compositions: ['blueprint-grid', 'blueprint-strava', 'brutalist-slab', 'darksky-stars', 'modernist-block', 'place-frame', 'sea-chart', 'splits-grid'],
    source: 'utils/posterLayout.ts HEADER_DECOR_COMPOSITIONS',
  },
  {
    id: 'header-decor-meta',
    slot: 'composition_meta',
    anchorType: 'band',
    location: 'band-header',
    compositions: ['blueprint-grid', 'blueprint-strava', 'brutalist-slab', 'darksky-stars', 'modernist-block', 'place-frame', 'sea-chart', 'splits-grid'],
    source: 'utils/posterLayout.ts HEADER_DECOR_COMPOSITIONS',
  },
  {
    id: 'footer-distance',
    slot: 'distance',
    anchorType: 'band',
    location: 'band-footer',
    source: 'utils/posterLayout.ts footer-primary row',
  },
  {
    id: 'footer-elevation-gain',
    slot: 'elevation_gain',
    anchorType: 'band',
    location: 'band-footer',
    source: 'utils/posterLayout.ts footer-primary row',
  },
  {
    id: 'footer-date',
    slot: 'date',
    anchorType: 'band',
    location: 'band-footer',
    source: 'utils/posterLayout.ts footer-primary row',
  },
  {
    id: 'footer-coordinates',
    slot: 'coordinates',
    anchorType: 'band',
    location: 'band-footer',
    source: 'utils/posterLayout.ts footer-primary row',
  },
  {
    id: 'footer-note',
    slot: 'composition_footer',
    anchorType: 'band',
    location: 'band-footer',
    compositions: ['brutalist-slab', 'darksky-stars'],
    source: 'utils/posterLayout.ts FOOTER_NOTE_COMPOSITIONS and MapPreview.vue composition-footer-note',
  },
  {
    id: 'free-place-frame-titleblock',
    slot: 'trail_name',
    anchorType: 'free',
    location: 'free-over-map-titleblock',
    compositions: ['place-frame'],
    themes: ['cartouche-place'],
    source: 'MapPreview.vue .poster-composition--place-frame .poster-header',
  },
  {
    id: 'free-place-frame-titleblock-meta',
    slot: 'composition_meta',
    anchorType: 'free',
    location: 'free-over-map-titleblock',
    compositions: ['place-frame'],
    themes: ['cartouche-place'],
    source: 'MapPreview.vue .poster-composition--place-frame .composition-meta-line',
  },
  {
    id: 'free-place-frame-titleblock-kicker',
    slot: 'composition_kicker',
    anchorType: 'free',
    location: 'free-over-map-titleblock',
    compositions: ['place-frame'],
    themes: ['cartouche-place'],
    source: 'MapPreview.vue .poster-composition--place-frame .composition-kicker',
  },
  {
    id: 'free-sea-chart-titleblock',
    slot: 'trail_name',
    anchorType: 'free',
    location: 'free-over-map-titleblock',
    compositions: ['sea-chart'],
    themes: ['sea-chart'],
    source: 'MapPreview.vue .poster-composition--sea-chart .poster-header',
  },
  {
    id: 'free-sea-chart-titleblock-location',
    slot: 'location_text',
    anchorType: 'free',
    location: 'free-over-map-titleblock',
    compositions: ['sea-chart'],
    themes: ['sea-chart'],
    source: 'MapPreview.vue .poster-composition--sea-chart .poster-location-line',
  },
  {
    id: 'free-sea-chart-titleblock-meta',
    slot: 'composition_meta',
    anchorType: 'free',
    location: 'free-over-map-titleblock',
    compositions: ['sea-chart'],
    themes: ['sea-chart'],
    source: 'MapPreview.vue .poster-composition--sea-chart .composition-meta-line',
  },
  {
    id: 'free-art-wash-titleblock',
    slot: 'trail_name',
    anchorType: 'free',
    location: 'free-over-map-titleblock',
    compositions: ['art-wash'],
    themes: ['contour-wash', 'plein-air'],
    source: 'MapPreview.vue .poster-composition--art-wash .poster-header',
  },
  {
    id: 'free-art-wash-titleblock-location',
    slot: 'location_text',
    anchorType: 'free',
    location: 'free-over-map-titleblock',
    compositions: ['art-wash'],
    themes: ['plein-air'],
    source: 'MapPreview.vue .poster-composition--art-wash[data-theme="plein-air"] .poster-location-line',
  },
  {
    id: 'free-art-wash-titleblock-kicker',
    slot: 'composition_kicker',
    anchorType: 'free',
    location: 'free-over-map-titleblock',
    compositions: ['art-wash'],
    themes: ['contour-wash', 'plein-air'],
    source: 'MapPreview.vue .poster-composition--art-wash .composition-kicker',
  },
  {
    id: 'usgs-map-coordinate',
    slot: 'composition_kicker',
    anchorType: 'map',
    location: 'map-label',
    compositions: ['park-quad'],
    themes: ['usgs-vintage'],
    source: 'MapPreview.vue usgs-heritage-map-label--coord',
  },
  {
    id: 'usgs-map-scale',
    slot: 'composition_meta',
    anchorType: 'map',
    location: 'map-label',
    compositions: ['park-quad'],
    themes: ['usgs-vintage'],
    source: 'MapPreview.vue usgs-heritage-map-label--scale',
  },
  {
    id: 'composition-side-rail',
    slot: 'composition_side_rail',
    anchorType: 'map',
    location: 'map-label',
    compositions: ['modernist-block'],
    source: 'MapPreview.vue composition-side-rail-label',
  },
  {
    id: 'composition-side-rail-band',
    slot: 'composition_side_rail',
    anchorType: 'band',
    location: 'band-rail',
    source: 'MapPreview.vue non-map side rail branch',
  },
  {
    id: 'start-pin-label',
    slot: 'start_pin_label',
    anchorType: 'map',
    location: 'map-pin-label',
    source: 'MapPreview.vue SVG pin label overlay',
  },
  {
    id: 'finish-pin-label',
    slot: 'finish_pin_label',
    anchorType: 'map',
    location: 'map-pin-label',
    source: 'MapPreview.vue SVG pin label overlay',
  },
] as const satisfies readonly PosterSlotAnchorOccurrence[]
