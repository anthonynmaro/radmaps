DROP POLICY IF EXISTS "Anyone reads published premade product mockups" ON public.product_mockups;
DROP POLICY IF EXISTS "Users read own map product mockups" ON public.product_mockups;
DROP POLICY IF EXISTS "Service role manages product mockups" ON public.product_mockups;

DROP TRIGGER IF EXISTS set_product_mockups_updated_at ON public.product_mockups;
DROP INDEX IF EXISTS public.product_mockups_hash_idx;
DROP INDEX IF EXISTS public.product_mockups_source_lookup_idx;
DROP TABLE IF EXISTS public.product_mockups;
