-- AIP Phase 2: block-based incremental document payload on unified_content.
-- Apply: docker exec -i stack1-postgres psql -U ai_user -d ai_services < shared/api/migrations/applied/20260707_unified_content_content_payload.sql

BEGIN;

ALTER TABLE unified_content
    ADD COLUMN IF NOT EXISTS content_payload JSONB;

COMMENT ON COLUMN unified_content.content_payload IS
    'AIP block payload: {"schema_version":1,"blocks":[{id,type,content,author_role,order_index},...]}';

COMMIT;
