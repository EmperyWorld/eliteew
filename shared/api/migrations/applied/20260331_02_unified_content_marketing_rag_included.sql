-- Project marketing RAG: explicit inclusion flag (exclude from Qdrant without deleting content).
-- Apply: shared/api/migrations/apply_migrations.sh

ALTER TABLE unified_content
    ADD COLUMN IF NOT EXISTS marketing_rag_included BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN unified_content.marketing_rag_included IS
    'When false, unified_content is not indexed into marketing_project_rag (chunks removed on reindex).';

CREATE INDEX IF NOT EXISTS idx_unified_content_project_marketing_rag_partial
    ON unified_content (project_id, marketing_rag_included)
    WHERE deleted_at IS NULL AND project_id IS NOT NULL;
