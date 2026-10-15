-- User-facing storage quarantine (broken files tab) + audit actions.
-- Extends 20260325_unified_content_storage_integrity.sql
-- Values for storage_integrity_status:
--   NULL / 'ok'              — normal library
--   'broken_quarantined'     — user «Битые файлы» (deleted_at remains NULL)
--   'blob_missing'           — admin soft-quarantine (deleted_at SET)

ALTER TABLE unified_content
    ADD COLUMN IF NOT EXISTS storage_broken_at TIMESTAMPTZ NULL;

ALTER TABLE unified_content
    ADD COLUMN IF NOT EXISTS storage_broken_reason TEXT NULL;

ALTER TABLE unified_content
    ADD COLUMN IF NOT EXISTS storage_last_checked_at TIMESTAMPTZ NULL;

COMMENT ON COLUMN unified_content.storage_integrity_status IS
    'NULL/ok = normal; broken_quarantined = user broken-files quarantine (not soft-deleted); blob_missing = admin soft-quarantine';

COMMENT ON COLUMN unified_content.storage_broken_reason IS
    'Short code only: seaweed_needle_missing | incomplete_read | blob_unreadable | recheck_failed — no storage paths';

CREATE INDEX IF NOT EXISTS idx_unified_content_broken_quarantined_owner
    ON unified_content (user_id, storage_broken_at DESC NULLS LAST)
    WHERE deleted_at IS NULL AND storage_integrity_status = 'broken_quarantined';

ALTER TABLE public.content_audit_log
    DROP CONSTRAINT IF EXISTS check_action;

ALTER TABLE public.content_audit_log
    ADD CONSTRAINT check_action CHECK (
        action::text = ANY (
            ARRAY[
                'created'::character varying,
                'updated'::character varying,
                'deleted'::character varying,
                'restored'::character varying,
                'shared'::character varying,
                'unshared'::character varying,
                'accessed_view'::character varying,
                'accessed_download'::character varying,
                'version_created'::character varying,
                'version_reverted'::character varying,
                'attached_to_chat'::character varying,
                'file_replaced'::character varying,
                'quarantine_blob_missing'::character varying,
                'storage_quarantine_broken'::character varying,
                'storage_recheck'::character varying,
                'storage_permanent_delete'::character varying
            ]::text[]
        )
    );
