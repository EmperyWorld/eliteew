-- Recipient-initiated hide: content stays for owner/other shares; hidden only for this user.
-- Used when access is relationship-based (e.g. visibility=friends) without a dedicated share row.

CREATE TABLE IF NOT EXISTS content_user_library_removals (
    user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    content_id uuid NOT NULL REFERENCES unified_content (id) ON DELETE CASCADE,
    removed_at timestamptz NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, content_id)
);

CREATE INDEX IF NOT EXISTS content_user_library_removals_content_id_idx
    ON content_user_library_removals (content_id);

COMMENT ON TABLE content_user_library_removals IS
    'Per-user library hide for shared/friend-visible unified_content the user may read but does not own.';
