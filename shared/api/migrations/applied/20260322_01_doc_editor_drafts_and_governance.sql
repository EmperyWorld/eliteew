BEGIN;

-- ==========================================
-- Server-side drafts with optimistic concurrency
-- ==========================================
CREATE TABLE IF NOT EXISTS doc_editor_document_drafts (
    document_id UUID PRIMARY KEY REFERENCES unified_content(id) ON DELETE CASCADE,
    owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL DEFAULT '',
    base_document_version INTEGER NOT NULL DEFAULT 0,
    draft_version INTEGER NOT NULL DEFAULT 1,
    source_session_id TEXT NOT NULL DEFAULT '',
    updated_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_doc_editor_document_drafts_versions
        CHECK (base_document_version >= 0 AND draft_version >= 1)
);

CREATE INDEX IF NOT EXISTS idx_doc_editor_document_drafts_owner
    ON doc_editor_document_drafts (owner_user_id, updated_at DESC);

-- ==========================================
-- Governance 2.0: lifecycle/version ownership for templates/plugins
-- ==========================================
ALTER TABLE IF EXISTS doc_editor_templates
    ADD COLUMN IF NOT EXISTS lifecycle_state TEXT NOT NULL DEFAULT 'published',
    ADD COLUMN IF NOT EXISTS release_version INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS owner_user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS release_channel TEXT NOT NULL DEFAULT 'stable',
    ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ NULL;

ALTER TABLE IF EXISTS doc_editor_plugins
    ADD COLUMN IF NOT EXISTS lifecycle_state TEXT NOT NULL DEFAULT 'published',
    ADD COLUMN IF NOT EXISTS release_version INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS owner_user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS release_channel TEXT NOT NULL DEFAULT 'stable',
    ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ NULL;

CREATE TABLE IF NOT EXISTS doc_editor_catalog_audit_log (
    id UUID PRIMARY KEY,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    action TEXT NOT NULL,
    actor_user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    previous_payload JSONB NULL,
    next_payload JSONB NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_doc_editor_catalog_audit_entity
    ON doc_editor_catalog_audit_log (entity_type, entity_id, created_at DESC);

COMMIT;
