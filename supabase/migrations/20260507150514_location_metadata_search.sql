BEGIN;

CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA extensions;

ALTER TABLE public.maps
  ADD COLUMN IF NOT EXISTS location_label TEXT,
  ADD COLUMN IF NOT EXISTS location_city TEXT,
  ADD COLUMN IF NOT EXISTS location_region TEXT,
  ADD COLUMN IF NOT EXISTS location_country TEXT,
  ADD COLUMN IF NOT EXISTS location_lng DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS location_lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS location extensions.geography(POINT, 4326);

ALTER TABLE public.premade_maps
  ADD COLUMN IF NOT EXISTS location_label TEXT,
  ADD COLUMN IF NOT EXISTS location_city TEXT,
  ADD COLUMN IF NOT EXISTS location_region TEXT,
  ADD COLUMN IF NOT EXISTS location_country TEXT,
  ADD COLUMN IF NOT EXISTS location_lng DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS location_lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS location extensions.geography(POINT, 4326);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'maps_location_lng_lat_chk'
  ) THEN
    ALTER TABLE public.maps
      ADD CONSTRAINT maps_location_lng_lat_chk CHECK (
        (location_lng IS NULL AND location_lat IS NULL)
        OR (
          location_lng BETWEEN -180 AND 180
          AND location_lat BETWEEN -90 AND 90
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'premade_maps_location_lng_lat_chk'
  ) THEN
    ALTER TABLE public.premade_maps
      ADD CONSTRAINT premade_maps_location_lng_lat_chk CHECK (
        (location_lng IS NULL AND location_lat IS NULL)
        OR (
          location_lng BETWEEN -180 AND 180
          AND location_lat BETWEEN -90 AND 90
        )
      );
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_location_point_from_lnglat()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
BEGIN
  IF NEW.location_lng IS NULL OR NEW.location_lat IS NULL THEN
    NEW.location = NULL;
  ELSE
    NEW.location = extensions.st_setsrid(
      extensions.st_makepoint(NEW.location_lng, NEW.location_lat),
      4326
    )::extensions.geography;
  END IF;
  RETURN NEW;
END;
$$;

UPDATE public.maps
SET
  location_label = coalesce(nullif(location_label, ''), nullif(stats->>'location', '')),
  location_region = coalesce(nullif(location_region, ''), nullif(stats->>'location', '')),
  location_lng = coalesce(location_lng, (bbox[1] + bbox[3]) / 2),
  location_lat = coalesce(location_lat, (bbox[2] + bbox[4]) / 2)
WHERE bbox IS NOT NULL
  AND array_length(bbox, 1) = 4
  AND bbox[1] BETWEEN -180 AND 180
  AND bbox[3] BETWEEN -180 AND 180
  AND bbox[2] BETWEEN -90 AND 90
  AND bbox[4] BETWEEN -90 AND 90;

UPDATE public.premade_maps
SET
  location_label = coalesce(nullif(location_label, ''), nullif(stats->>'location', ''), region),
  location_region = coalesce(nullif(location_region, ''), region),
  location_country = coalesce(nullif(location_country, ''), country),
  location_lng = coalesce(location_lng, (bbox[1] + bbox[3]) / 2),
  location_lat = coalesce(location_lat, (bbox[2] + bbox[4]) / 2)
WHERE bbox IS NOT NULL
  AND array_length(bbox, 1) = 4
  AND bbox[1] BETWEEN -180 AND 180
  AND bbox[3] BETWEEN -180 AND 180
  AND bbox[2] BETWEEN -90 AND 90
  AND bbox[4] BETWEEN -90 AND 90;

UPDATE public.maps
SET location = CASE
  WHEN location_lng IS NULL OR location_lat IS NULL THEN NULL
  ELSE extensions.st_setsrid(extensions.st_makepoint(location_lng, location_lat), 4326)::extensions.geography
END;

UPDATE public.premade_maps
SET location = CASE
  WHEN location_lng IS NULL OR location_lat IS NULL THEN NULL
  ELSE extensions.st_setsrid(extensions.st_makepoint(location_lng, location_lat), 4326)::extensions.geography
END;

DROP TRIGGER IF EXISTS set_maps_location_point ON public.maps;
CREATE TRIGGER set_maps_location_point
  BEFORE INSERT OR UPDATE OF location_lng, location_lat ON public.maps
  FOR EACH ROW EXECUTE PROCEDURE public.set_location_point_from_lnglat();

DROP TRIGGER IF EXISTS set_premade_maps_location_point ON public.premade_maps;
CREATE TRIGGER set_premade_maps_location_point
  BEFORE INSERT OR UPDATE OF location_lng, location_lat ON public.premade_maps
  FOR EACH ROW EXECUTE PROCEDURE public.set_location_point_from_lnglat();

CREATE INDEX IF NOT EXISTS maps_location_gist_idx
  ON public.maps
  USING GIST (location);

CREATE INDEX IF NOT EXISTS premade_maps_location_published_gist_idx
  ON public.premade_maps
  USING GIST (location)
  WHERE status = 'published' AND location IS NOT NULL;

CREATE OR REPLACE FUNCTION public.nearby_published_premade_maps(
  p_lat DOUBLE PRECISION,
  p_lng DOUBLE PRECISION,
  p_radius_meters DOUBLE PRECISION DEFAULT 250000,
  p_limit INT DEFAULT 48
)
RETURNS TABLE (
  id UUID,
  source_map_id UUID,
  slug TEXT,
  title TEXT,
  subtitle TEXT,
  region TEXT,
  country TEXT,
  location_label TEXT,
  location_city TEXT,
  location_region TEXT,
  location_country TEXT,
  location_lng DOUBLE PRECISION,
  location_lat DOUBLE PRECISION,
  category TEXT,
  tagline TEXT,
  description TEXT,
  badges TEXT[],
  stats JSONB,
  bbox FLOAT8[],
  geojson JSONB,
  style_config JSONB,
  status TEXT,
  homepage_visible BOOLEAN,
  homepage_sort_order INT,
  needs_preview BOOLEAN,
  base_price_cents INT,
  cover_gradient TEXT[],
  preview_image_url TEXT,
  render_url TEXT,
  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  distance_meters DOUBLE PRECISION
)
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  WITH origin AS (
    SELECT extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography AS point
  )
  SELECT
    p.id,
    p.source_map_id,
    p.slug,
    p.title,
    p.subtitle,
    p.region,
    p.country,
    p.location_label,
    p.location_city,
    p.location_region,
    p.location_country,
    p.location_lng,
    p.location_lat,
    p.category,
    p.tagline,
    p.description,
    p.badges,
    p.stats,
    p.bbox,
    p.geojson,
    p.style_config,
    p.status,
    p.homepage_visible,
    p.homepage_sort_order,
    p.needs_preview,
    p.base_price_cents,
    p.cover_gradient,
    p.preview_image_url,
    p.render_url,
    p.created_by,
    p.updated_by,
    p.created_at,
    p.updated_at,
    extensions.st_distance(p.location, origin.point) AS distance_meters
  FROM public.premade_maps p, origin
  WHERE p.status = 'published'
    AND p.location IS NOT NULL
    AND p_lat BETWEEN -90 AND 90
    AND p_lng BETWEEN -180 AND 180
    AND extensions.st_dwithin(
      p.location,
      origin.point,
      least(greatest(coalesce(p_radius_meters, 250000), 1000), 20000000)
    )
  ORDER BY p.location OPERATOR(extensions.<->) origin.point
  LIMIT least(greatest(coalesce(p_limit, 48), 1), 100);
$$;

REVOKE ALL ON FUNCTION public.nearby_published_premade_maps(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, INT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.nearby_published_premade_maps(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, INT)
  TO service_role;

COMMIT;
