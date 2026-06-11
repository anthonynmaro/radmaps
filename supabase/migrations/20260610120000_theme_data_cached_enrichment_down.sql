BEGIN;

ALTER TABLE public.order_snapshots
  DROP COLUMN IF EXISTS location_metadata_enriched_at,
  DROP COLUMN IF EXISTS location_metadata_source,
  DROP COLUMN IF EXISTS location_elevation_m,
  DROP COLUMN IF EXISTS location_lat,
  DROP COLUMN IF EXISTS location_lng,
  DROP COLUMN IF EXISTS location_country,
  DROP COLUMN IF EXISTS location_region,
  DROP COLUMN IF EXISTS location_city,
  DROP COLUMN IF EXISTS location_label;

ALTER TABLE public.premade_maps
  DROP COLUMN IF EXISTS location_metadata_enriched_at,
  DROP COLUMN IF EXISTS location_metadata_source,
  DROP COLUMN IF EXISTS location_elevation_m;

ALTER TABLE public.maps
  DROP COLUMN IF EXISTS location_metadata_enriched_at,
  DROP COLUMN IF EXISTS location_metadata_source,
  DROP COLUMN IF EXISTS location_elevation_m;

COMMIT;
