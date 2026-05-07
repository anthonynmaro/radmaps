-- ─── First-party feature flags ──────────────────────────────────────────────

BEGIN;

CREATE OR REPLACE FUNCTION public.feature_flag_rules_valid(rules JSONB)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT jsonb_typeof(rules) = 'array'
    AND jsonb_array_length(rules) <= 10
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(rules) AS item(rule)
      WHERE jsonb_typeof(rule) IS DISTINCT FROM 'object'
        OR (rule->>'type') NOT IN ('user_list', 'admin_role', 'all_staff', 'percentage', 'everyone')
        OR jsonb_typeof(rule->'enabled') IS DISTINCT FROM 'boolean'
        OR (
          rule ? 'emails'
          AND (
            jsonb_typeof(rule->'emails') IS DISTINCT FROM 'array'
            OR EXISTS (
              SELECT 1
              FROM jsonb_array_elements(rule->'emails') AS email(value)
              WHERE jsonb_typeof(email.value) IS DISTINCT FROM 'string'
                OR email.value #>> '{}' IS DISTINCT FROM lower(btrim(email.value #>> '{}'))
            )
          )
        )
        OR (rule ? 'roles' AND jsonb_typeof(rule->'roles') IS DISTINCT FROM 'array')
        OR (rule ? 'user_ids' AND jsonb_typeof(rule->'user_ids') IS DISTINCT FROM 'array')
        OR (
          rule ? 'percentage'
          AND CASE
            WHEN jsonb_typeof(rule->'percentage') = 'number'
              THEN (rule->>'percentage')::NUMERIC < 0 OR (rule->>'percentage')::NUMERIC > 100
            ELSE true
          END
        )
    );
$$;

CREATE TABLE IF NOT EXISTS public.feature_flags (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key          TEXT NOT NULL,
  name         TEXT NOT NULL,
  description  TEXT,
  environment  TEXT NOT NULL DEFAULT 'all'
    CHECK (environment IN ('development', 'preview', 'production', 'all')),
  enabled      BOOLEAN NOT NULL DEFAULT false,
  rules        JSONB NOT NULL DEFAULT '[]'::jsonb,
  archived_at  TIMESTAMPTZ,
  created_by   UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by   UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT feature_flags_key_chk CHECK (key ~ '^[a-z][a-z0-9_]*$'),
  CONSTRAINT feature_flags_rules_valid_chk CHECK (public.feature_flag_rules_valid(rules))
);

CREATE UNIQUE INDEX IF NOT EXISTS feature_flags_environment_key_idx
  ON public.feature_flags (environment, key);

CREATE INDEX IF NOT EXISTS feature_flags_active_environment_idx
  ON public.feature_flags (environment, key)
  WHERE archived_at IS NULL;

DROP TRIGGER IF EXISTS set_feature_flags_updated_at ON public.feature_flags;
CREATE TRIGGER set_feature_flags_updated_at
  BEFORE UPDATE ON public.feature_flags
  FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.feature_flag_events (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_flag_id  UUID REFERENCES public.feature_flags(id) ON DELETE SET NULL,
  flag_key         TEXT NOT NULL,
  environment      TEXT NOT NULL
    CHECK (environment IN ('development', 'preview', 'production', 'all')),
  action           TEXT NOT NULL CHECK (action IN ('create', 'update', 'archive', 'restore')),
  actor_id         UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  before           JSONB,
  after            JSONB,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS feature_flag_events_flag_idx
  ON public.feature_flag_events (feature_flag_id, created_at DESC);

CREATE INDEX IF NOT EXISTS feature_flag_events_key_environment_idx
  ON public.feature_flag_events (flag_key, environment, created_at DESC);

ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_flag_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.feature_flags FROM anon, authenticated;
REVOKE ALL ON TABLE public.feature_flag_events FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.feature_flags TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.feature_flag_events TO service_role;

CREATE POLICY "Service role manages feature flags" ON public.feature_flags
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role reads feature flag events" ON public.feature_flag_events
  FOR SELECT USING (auth.role() = 'service_role');

CREATE POLICY "Service role inserts feature flag events" ON public.feature_flag_events
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

INSERT INTO public.feature_flags (key, name, description, environment, enabled, rules)
VALUES (
  'scout_style_agent',
  'Scout AI Style Agent',
  'Adds the Scout AI chat tab to the admin premade style editor and gates /api/agent/style.',
  'all',
  false,
  '[{"type":"admin_role","enabled":true,"roles":["admin","designer"]}]'::jsonb
)
ON CONFLICT (environment, key) DO NOTHING;

COMMIT;
