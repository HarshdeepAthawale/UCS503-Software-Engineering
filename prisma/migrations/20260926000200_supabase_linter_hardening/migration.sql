-- Supabase database linter findings (security, WARN level).

-- 0011 function_search_path_mutable: pin the trigger function's search_path so
-- a caller-controlled path can never redirect the tables and types it reads.
ALTER FUNCTION public.attestation_requires_selected_application()
  SET search_path = public, pg_temp;

-- 0028 / 0029: rls_auto_enable() is a SECURITY DEFINER helper that Supabase
-- installs (not created by this project) and that anon/authenticated could
-- call through the REST API. This app never uses that API, so nobody needs it.
-- Conditional: the function and the anon/authenticated roles exist only on
-- Supabase, not in a local Postgres.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'rls_auto_enable'
  ) THEN
    REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
      REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM anon;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
      REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM authenticated;
    END IF;
  END IF;
END $$;

-- 0014 extension_in_public (citext) is deliberately left alone: moving the
-- extension changes how every existing citext column resolves its type, and a
-- local Postgres has no `extensions` schema, so migrations would diverge
-- between environments. It is a hygiene warning, not an exposure.
