-- Friend circles v2: visual metadata for Social Hub circle chips and ordering.
ALTER TABLE friend_circles
    ADD COLUMN IF NOT EXISTS color TEXT,
    ADD COLUMN IF NOT EXISTS icon TEXT;

CREATE INDEX IF NOT EXISTS idx_friend_circles_owner_updated
    ON friend_circles (owner_user_id, updated_at DESC);
