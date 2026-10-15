-- Document collaboration invites: owner invites a friend to collaborate on a document.
-- Apply to the same database the API uses (stack1 postgres):
--   docker exec -i stack1-postgres psql -U ai_user -d ai_services < api/migrations/doc_collaboration_invites.sql

CREATE TABLE IF NOT EXISTS doc_collaboration_invites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES unified_content(id) ON DELETE CASCADE,
    from_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    to_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'accepted', 'declined', 'revoked')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT doc_invites_no_self CHECK (from_user_id != to_user_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_doc_invites_pending_unique
    ON doc_collaboration_invites (document_id, from_user_id, to_user_id)
    WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_doc_invites_to_user_status
    ON doc_collaboration_invites (to_user_id, status);

CREATE INDEX IF NOT EXISTS idx_doc_invites_document_status
    ON doc_collaboration_invites (document_id, status);

CREATE INDEX IF NOT EXISTS idx_doc_invites_from_user
    ON doc_collaboration_invites (from_user_id);

-- Optional: trigger to keep updated_at in sync (if not using application-side updates)
CREATE OR REPLACE FUNCTION doc_collaboration_invites_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_doc_collaboration_invites_updated_at ON doc_collaboration_invites;
CREATE TRIGGER tr_doc_collaboration_invites_updated_at
    BEFORE UPDATE ON doc_collaboration_invites
    FOR EACH ROW
    EXECUTE PROCEDURE doc_collaboration_invites_updated_at();
