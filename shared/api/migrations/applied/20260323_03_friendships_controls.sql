-- Friends v2 controls: mute, block, and directed activity sharing on friendship edges.
ALTER TABLE friendships
    ADD COLUMN IF NOT EXISTS is_muted BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE friendships
    ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE friendships
    ADD COLUMN IF NOT EXISTS share_activity_with_friend BOOLEAN NOT NULL DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS idx_friendships_user_blocked
    ON friendships (user_id, friend_id)
    WHERE is_blocked = TRUE;
