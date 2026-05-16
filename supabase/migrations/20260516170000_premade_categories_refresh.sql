-- Refresh premade map categories to the shop's new taxonomy:
--   hikes, mountain-biking, paddles, rivers, cityscapes, cycling, beaches, wine-trails.
--
-- Auto-categorizes existing rows by mapping each retired category to the closest
-- surviving bucket. Marathons collapse into 'cityscapes' (they run through cities);
-- everything else trail-shaped folds into 'hikes'.

BEGIN;

ALTER TABLE public.premade_maps
  DROP CONSTRAINT IF EXISTS premade_maps_category_check;

ALTER TABLE public.premade_maps
  DROP CONSTRAINT IF EXISTS premade_maps_categories_check;

ALTER TABLE public.premade_maps
  ALTER COLUMN category DROP DEFAULT;

ALTER TABLE public.premade_maps
  ALTER COLUMN categories DROP DEFAULT;

-- Migrate the singular `category` column.
UPDATE public.premade_maps
SET category = CASE category
  WHEN 'marathon' THEN 'cityscapes'
  WHEN 'national-park' THEN 'hikes'
  WHEN 'long-distance' THEN 'hikes'
  WHEN 'peak' THEN 'hikes'
  WHEN 'pilgrimage' THEN 'hikes'
  WHEN 'adventure' THEN 'hikes'
  WHEN 'parks' THEN 'hikes'
  ELSE category
END
WHERE category IN ('marathon', 'national-park', 'long-distance', 'peak', 'pilgrimage', 'adventure', 'parks');

-- Migrate the plural `categories` array. Map each retired value to its replacement,
-- drop duplicates, and fall back to ['hikes'] if filtering empties the array.
UPDATE public.premade_maps
SET categories = COALESCE(
  NULLIF(
    (
      SELECT ARRAY_AGG(DISTINCT mapped)
      FROM (
        SELECT CASE c
          WHEN 'marathon' THEN 'cityscapes'
          WHEN 'national-park' THEN 'hikes'
          WHEN 'long-distance' THEN 'hikes'
          WHEN 'peak' THEN 'hikes'
          WHEN 'pilgrimage' THEN 'hikes'
          WHEN 'adventure' THEN 'hikes'
          WHEN 'parks' THEN 'hikes'
          ELSE c
        END AS mapped
        FROM unnest(categories) AS c
      ) m
      WHERE mapped IN ('hikes', 'mountain-biking', 'paddles', 'rivers', 'cityscapes', 'cycling', 'beaches', 'wine-trails')
    ),
    ARRAY[]::TEXT[]
  ),
  ARRAY['hikes']::TEXT[]
)
WHERE categories && ARRAY['marathon', 'national-park', 'long-distance', 'peak', 'pilgrimage', 'adventure', 'parks']::TEXT[]
   OR NOT (categories <@ ARRAY['hikes', 'mountain-biking', 'paddles', 'rivers', 'cityscapes', 'cycling', 'beaches', 'wine-trails']::TEXT[]);

ALTER TABLE public.premade_maps
  ALTER COLUMN category SET DEFAULT 'hikes';

ALTER TABLE public.premade_maps
  ALTER COLUMN categories SET DEFAULT ARRAY['hikes']::TEXT[];

ALTER TABLE public.premade_maps
  ADD CONSTRAINT premade_maps_category_check
  CHECK (
    category IN (
      'hikes',
      'mountain-biking',
      'paddles',
      'rivers',
      'cityscapes',
      'cycling',
      'beaches',
      'wine-trails'
    )
  );

ALTER TABLE public.premade_maps
  ADD CONSTRAINT premade_maps_categories_check
  CHECK (
    coalesce(array_length(categories, 1), 0) > 0
    AND categories <@ ARRAY[
      'hikes',
      'mountain-biking',
      'paddles',
      'rivers',
      'cityscapes',
      'cycling',
      'beaches',
      'wine-trails'
    ]::TEXT[]
  );

COMMIT;
