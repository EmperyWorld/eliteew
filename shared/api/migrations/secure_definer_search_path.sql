-- Security: set search_path = public on all SECURITY DEFINER functions
-- to prevent schema hijacking. See docs/DB_PITFALLS_AND_QUIRKS.md §2.

BEGIN;

ALTER FUNCTION public.audit_trigger_func() SET search_path = public;
ALTER FUNCTION public.decrypt_text(bytea) SET search_path = public;
ALTER FUNCTION public.encrypt_text(text) SET search_path = public;
ALTER FUNCTION public.encrypt_users_pii_trigger() SET search_path = public;
ALTER FUNCTION public.get_encryption_key() SET search_path = public;

COMMIT;
