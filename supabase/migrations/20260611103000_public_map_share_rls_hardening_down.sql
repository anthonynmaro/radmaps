-- Roll back the explicit role-scoped public map share policy to the prior
-- policy shape. The is_public column is intentionally retained because it is
-- owned by 2026_04_security_fixes.sql and is part of the canonical schema.

DROP POLICY IF EXISTS "Public map share" ON public.maps;
CREATE POLICY "Public map share" ON public.maps
  FOR SELECT USING (is_public = true);
