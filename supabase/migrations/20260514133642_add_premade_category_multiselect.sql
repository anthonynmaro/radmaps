ALTER TABLE public.premade_maps
  ADD COLUMN IF NOT EXISTS categories TEXT[] NOT NULL DEFAULT ARRAY['adventure']::TEXT[];

UPDATE public.premade_maps
SET categories = ARRAY[category]::TEXT[]
WHERE categories = ARRAY['adventure']::TEXT[]
  AND category <> 'adventure';

ALTER TABLE public.premade_maps
  DROP CONSTRAINT IF EXISTS premade_maps_categories_check;

ALTER TABLE public.premade_maps
  ADD CONSTRAINT premade_maps_categories_check
  CHECK (
    coalesce(array_length(categories, 1), 0) > 0
    AND categories <@ ARRAY[
      'national-park',
      'long-distance',
      'marathon',
      'peak',
      'pilgrimage',
      'adventure',
      'cycling',
      'cityscapes',
      'mountain-biking',
      'hikes',
      'beaches',
      'wine-trails',
      'parks'
    ]::TEXT[]
  );

CREATE INDEX IF NOT EXISTS premade_maps_categories_gin_idx
  ON public.premade_maps
  USING GIN (categories)
  WHERE status = 'published';

DROP FUNCTION IF EXISTS public.nearby_published_premade_maps(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, INT);

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
  categories TEXT[],
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
    p.categories,
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
