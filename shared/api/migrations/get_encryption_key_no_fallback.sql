-- Remove development fallback from get_encryption_key().
-- After this migration, every session that INSERT/UPDATEs users must set:
--   SET LOCAL encryption.pii_key = '<ENCRYPTION_MASTER_KEY from env>';
-- API does this in database_manager and chat_database_manager. Apply after 1.1 (ENCRYPTION_MASTER_KEY in env).

CREATE OR REPLACE FUNCTION public.get_encryption_key()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_key text;
BEGIN
    v_key := current_setting('encryption.pii_key', true);
    IF v_key IS NULL OR v_key = '' THEN
        RAISE EXCEPTION 'encryption.pii_key must be set in session for PII encryption (set ENCRYPTION_MASTER_KEY in API env and ensure session runs SET LOCAL encryption.pii_key)';
    END IF;
    RETURN v_key;
END;
$function$;
