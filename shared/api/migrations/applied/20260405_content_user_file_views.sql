-- Per-user file view counts and last viewed time (Content Manager stats tab; survives reload).
CREATE TABLE IF NOT EXISTS content_user_file_views (
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    content_id UUID NOT NULL REFERENCES unified_content (id) ON DELETE CASCADE,
    view_count INTEGER NOT NULL DEFAULT 1,
    last_viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, content_id)
);

CREATE INDEX IF NOT EXISTS idx_content_user_file_views_user_last
    ON content_user_file_views (user_id, last_viewed_at DESC NULLS LAST);

COMMENT ON TABLE content_user_file_views IS
    'Content Manager: per-user recent/frequent views (not localStorage).';
