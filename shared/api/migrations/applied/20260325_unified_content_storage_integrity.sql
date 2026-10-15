-- Unified content: track storage orphan quarantine (missing SeaweedFS/volume blobs).
-- Apply: shared/api/migrations/apply_migrations.sh (or docker exec stack1-postgres psql ... < this file)

ALTER TABLE unified_content
    ADD COLUMN IF NOT EXISTS storage_integrity_status TEXT NULL;

COMMENT ON COLUMN unified_content.storage_integrity_status IS
    'NULL = normal; blob_missing = soft-deleted after admin scan (storage object unreadable); ok = optional future marker after verify';

CREATE INDEX IF NOT EXISTS idx_unified_content_storage_integrity_partial
    ON unified_content (storage_integrity_status)
    WHERE deleted_at IS NULL AND storage_integrity_status IS NOT NULL;
