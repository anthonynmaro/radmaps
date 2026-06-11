-- Public map share hardening.
--
-- 2026_04_security_fixes.sql introduced is_public. Keep this migration
-- idempotent so older databases that missed that migration still get the
-- guard column, then make the public read policy explicit for non-service
-- clients.

ALTER TABLE public.maps
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.maps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public map share" ON public.maps;
CREATE POLICY "Public map share" ON public.maps
  FOR SELECT TO anon, authenticated
  USING (is_public = true);
