BEGIN;

ALTER TABLE public.maps
  ADD COLUMN IF NOT EXISTS location_elevation_m DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS location_metadata_source TEXT,
  ADD COLUMN IF NOT EXISTS location_metadata_enriched_at TIMESTAMPTZ;

ALTER TABLE public.premade_maps
  ADD COLUMN IF NOT EXISTS location_elevation_m DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS location_metadata_source TEXT,
  ADD COLUMN IF NOT EXISTS location_metadata_enriched_at TIMESTAMPTZ;

ALTER TABLE public.order_snapshots
  ADD COLUMN IF NOT EXISTS location_label TEXT,
  ADD COLUMN IF NOT EXISTS location_city TEXT,
  ADD COLUMN IF NOT EXISTS location_region TEXT,
  ADD COLUMN IF NOT EXISTS location_country TEXT,
  ADD COLUMN IF NOT EXISTS location_lng DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS location_lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS location_elevation_m DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS location_metadata_source TEXT,
  ADD COLUMN IF NOT EXISTS location_metadata_enriched_at TIMESTAMPTZ;

COMMIT;
