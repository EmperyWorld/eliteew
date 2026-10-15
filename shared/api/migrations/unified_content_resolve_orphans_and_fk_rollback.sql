-- Rollback: drop FK unified_content_user_id_fkey.
-- Orphan rows were reassigned to system user; this script does not revert that (data already changed).

BEGIN;

ALTER TABLE unified_content
  DROP CONSTRAINT IF EXISTS unified_content_user_id_fkey;

COMMIT;
