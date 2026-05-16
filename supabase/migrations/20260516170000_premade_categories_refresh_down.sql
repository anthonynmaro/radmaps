-- Rollback for premade_categories_refresh. Restores the legacy CHECK constraint
-- vocabulary and default values. Categories that were collapsed in the forward
-- migration cannot be perfectly reconstructed; existing rows are left in their
-- new (still-valid) buckets and the legacy constraint is re-applied.

BEGIN;

ALTER TABLE public.premade_maps
  DROP CONSTRAINT IF EXISTS premade_maps_category_check;

ALTER TABLE public.premade_maps
  DROP CONSTRAINT IF EXISTS premade_maps_categories_check;

ALTER TABLE public.premade_maps
  ALTER COLUMN category SET DEFAULT 'adventure';

ALTER TABLE public.premade_maps
  ALTER COLUMN categories SET DEFAULT ARRAY['adventure']::TEXT[];

ALTER TABLE public.premade_maps
  ADD CONSTRAINT premade_maps_category_check
  CHECK (
    category IN (
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
    )
  );

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

COMMIT;
