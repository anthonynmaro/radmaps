-- Add running-focused premade map categories:
--   trails, runs, marathons.

BEGIN;

ALTER TABLE public.premade_maps
  DROP CONSTRAINT IF EXISTS premade_maps_category_check;

ALTER TABLE public.premade_maps
  DROP CONSTRAINT IF EXISTS premade_maps_categories_check;

UPDATE public.premade_maps
SET
  category = 'marathons',
  categories = (
    SELECT ARRAY_AGG(category_value ORDER BY first_position)
    FROM (
      SELECT category_value, MIN(position) AS first_position
      FROM unnest(ARRAY['marathons']::TEXT[] || categories) WITH ORDINALITY AS category_list(category_value, position)
      WHERE category_value IN (
        'hikes',
        'trails',
        'runs',
        'marathons',
        'mountain-biking',
        'paddles',
        'rivers',
        'cityscapes',
        'cycling',
        'beaches',
        'wine-trails'
      )
      GROUP BY category_value
    ) deduped_categories
  )
WHERE lower(slug) LIKE '%marathon%'
   OR lower(title) LIKE '%marathon%';

ALTER TABLE public.premade_maps
  ADD CONSTRAINT premade_maps_category_check
  CHECK (
    category IN (
      'hikes',
      'trails',
      'runs',
      'marathons',
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
      'trails',
      'runs',
      'marathons',
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
