-- Extend content_audit_log.check_action for actions emitted by ContentStorageService
-- but missing from the original CHECK (replace-file, admin quarantine).

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
                'quarantine_blob_missing'::character varying
            ]::text[]
        )
    );
