-- Migration 007: Security hardening
-- 1. Lock down the _migrations table (used only by migrate.js via service_role)
-- 2. Tighten exec_migration access
-- 3. Remove any public/anon access to sensitive functions

-- ── _migrations table: restrict to service_role only ─────────────────────────
-- The table may not exist yet if this is a fresh DB; CREATE IF NOT EXISTS first.
CREATE TABLE IF NOT EXISTS public._migrations (
  name        TEXT PRIMARY KEY,
  applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public._migrations ENABLE ROW LEVEL SECURITY;

-- Deny ALL access for authenticated and anon roles.
-- service_role bypasses RLS, so migrate.js still works.
DROP POLICY IF EXISTS migrations_deny_all ON public._migrations;
CREATE POLICY migrations_deny_all ON public._migrations
  AS RESTRICTIVE
  FOR ALL
  TO authenticated, anon
  USING (false)
  WITH CHECK (false);

-- ── exec_migration: ensure only service_role can call it ─────────────────────
-- This was set in migration 002, but re-apply defensively.
REVOKE ALL ON FUNCTION public.exec_migration(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.exec_migration(text) FROM anon;
REVOKE ALL ON FUNCTION public.exec_migration(text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.exec_migration(text) TO service_role;

-- ── Tighten search_path on all SECURITY DEFINER functions ────────────────────
-- Prevents search_path hijacking attacks.
ALTER FUNCTION public.exec_migration(text) SET search_path = public;

-- ── Revoke default privileges on sequences from public ───────────────────────
-- Prevents unauthenticated users from using sequences directly.
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM public;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- ── Revoke direct table access from anon/public ──────────────────────────────
-- All data access goes through authenticated+RLS or service_role.
-- (These are no-ops if already restricted, but apply defensively.)
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM public;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
