ALTER TABLE public.premade_maps
  DROP CONSTRAINT IF EXISTS premade_maps_category_check;

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
