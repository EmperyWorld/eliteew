-- UltimateDocEditor Q2 / Sprint 1
-- Review workflow depth: assignment, pin/follow, unread tracking

CREATE TABLE IF NOT EXISTS doc_editor_comment_thread_meta (
    thread_id UUID PRIMARY KEY REFERENCES unified_content_comment_threads(id) ON DELETE CASCADE,
    assigned_reviewer_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
    pinned_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    pinned_at TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS doc_editor_comment_thread_user_state (
    thread_id UUID NOT NULL REFERENCES unified_content_comment_threads(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    is_following BOOLEAN NOT NULL DEFAULT TRUE,
    last_read_at TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    PRIMARY KEY(thread_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_doc_editor_comment_thread_user_state_user
    ON doc_editor_comment_thread_user_state(user_id, thread_id);
