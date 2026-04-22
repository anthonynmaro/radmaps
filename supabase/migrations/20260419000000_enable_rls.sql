-- Fix: enable Row Level Security on all public tables
-- Run this in Supabase SQL Editor to resolve the rls_disabled_in_public advisor warning.
-- All ALTER TABLE ... ENABLE ROW LEVEL SECURITY statements are idempotent.

ALTER TABLE public.profiles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maps          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.strava_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.map_versions  ENABLE ROW LEVEL SECURITY;

-- Ensure policies exist (IF NOT EXISTS requires Postgres 15+, which Supabase uses)

-- profiles
CREATE POLICY IF NOT EXISTS "Users read own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY IF NOT EXISTS "Users update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- maps
CREATE POLICY IF NOT EXISTS "Users CRUD own maps" ON public.maps
  FOR ALL USING (auth.uid() = user_id);

-- orders
CREATE POLICY IF NOT EXISTS "Users read own orders" ON public.orders
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users insert own orders" ON public.orders
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- strava_tokens
CREATE POLICY IF NOT EXISTS "Users CRUD own strava tokens" ON public.strava_tokens
  FOR ALL USING (auth.uid() = user_id);

-- map_versions
CREATE POLICY IF NOT EXISTS "Users CRUD own map versions" ON public.map_versions
  FOR ALL USING (auth.uid() = user_id);
