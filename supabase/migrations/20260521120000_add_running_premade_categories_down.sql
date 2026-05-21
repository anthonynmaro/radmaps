-- Rollback for add_running_premade_categories. Maps the added category values
-- to the closest previous taxonomy values before restoring the old constraints.

BEGIN;

ALTER TABLE public.premade_maps
  DROP CONSTRAINT IF EXISTS premade_maps_category_check;

ALTER TABLE public.premade_maps
  DROP CONSTRAINT IF EXISTS premade_maps_categories_check;

UPDATE public.premade_maps
SET category = CASE category
  WHEN 'trails' THEN 'hikes'
  WHEN 'runs' THEN 'hikes'
  WHEN 'marathons' THEN 'cityscapes'
  ELSE category
END
WHERE category IN ('trails', 'runs', 'marathons');

UPDATE public.premade_maps
SET categories = COALESCE(
  NULLIF(
    (
      SELECT ARRAY_AGG(DISTINCT mapped)
      FROM (
        SELECT CASE c
          WHEN 'trails' THEN 'hikes'
          WHEN 'runs' THEN 'hikes'
          WHEN 'marathons' THEN 'cityscapes'
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
WHERE categories && ARRAY['trails', 'runs', 'marathons']::TEXT[];

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
