-- Friends v2 foundation: private relationship metadata on directed friendship edges.
ALTER TABLE friendships
    ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE friendships
    ADD COLUMN IF NOT EXISTS private_note TEXT;

ALTER TABLE friendships
    ADD COLUMN IF NOT EXISTS note_updated_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_friendships_user_favorite
    ON friendships (user_id, created_at DESC)
    WHERE is_favorite = TRUE;
