-- ─── Admin roles + database-backed premade catalog ───────────────────────────

BEGIN;

CREATE TABLE IF NOT EXISTS public.admin_users (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  role        TEXT NOT NULL CHECK (role IN ('admin', 'curator', 'designer', 'support')),
  active      BOOLEAN NOT NULL DEFAULT true,
  created_by  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_users_role_idx
  ON public.admin_users (role)
  WHERE active = true;

DROP TRIGGER IF EXISTS set_admin_users_updated_at ON public.admin_users;
CREATE TRIGGER set_admin_users_updated_at
  BEFORE UPDATE ON public.admin_users
  FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

COMMENT ON TABLE public.admin_users IS
  'Server-managed staff roles for RadMaps admin tools. Role checks are performed by Nitro API handlers with the service role key.';

CREATE TABLE IF NOT EXISTS public.premade_maps (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_map_id          UUID REFERENCES public.maps(id) ON DELETE SET NULL,
  slug                  TEXT NOT NULL UNIQUE,
  title                 TEXT NOT NULL,
  subtitle              TEXT,
  region                TEXT NOT NULL DEFAULT 'Region TBD',
  country               TEXT NOT NULL DEFAULT 'United States',
  category              TEXT NOT NULL DEFAULT 'adventure'
    CHECK (category IN ('national-park', 'long-distance', 'marathon', 'peak', 'pilgrimage', 'adventure')),
  tagline               TEXT NOT NULL DEFAULT '',
  description           TEXT NOT NULL DEFAULT '',
  badges                TEXT[] NOT NULL DEFAULT '{}',
  stats                 JSONB NOT NULL DEFAULT '{}',
  bbox                  FLOAT8[4],
  geojson               JSONB,
  style_config          JSONB,
  status                TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published', 'archived')),
  homepage_visible      BOOLEAN NOT NULL DEFAULT false,
  homepage_sort_order   INT NOT NULL DEFAULT 1000,
  needs_preview         BOOLEAN NOT NULL DEFAULT true,
  base_price_cents      INT NOT NULL DEFAULT 2499,
  cover_gradient        TEXT[],
  preview_image_url     TEXT,
  render_url            TEXT,
  created_by            UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by            UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT premade_maps_bbox_len_chk CHECK (bbox IS NULL OR array_length(bbox, 1) = 4)
);

CREATE INDEX IF NOT EXISTS premade_maps_status_homepage_idx
  ON public.premade_maps (status, homepage_visible, homepage_sort_order, title);

CREATE INDEX IF NOT EXISTS premade_maps_category_idx
  ON public.premade_maps (category)
  WHERE status = 'published';

CREATE INDEX IF NOT EXISTS premade_maps_source_map_idx
  ON public.premade_maps (source_map_id);

DROP TRIGGER IF EXISTS set_premade_maps_updated_at ON public.premade_maps;
CREATE TRIGGER set_premade_maps_updated_at
  BEFORE UPDATE ON public.premade_maps
  FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

COMMENT ON TABLE public.premade_maps IS
  'Database-backed premade shop catalog. Drafts may be incomplete; published rows must pass server-side validation.';

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.premade_maps ENABLE ROW LEVEL SECURITY;

-- End users do not access these tables directly. Public catalog reads and all
-- admin mutations go through Nitro handlers using the service role key.

COMMIT;
