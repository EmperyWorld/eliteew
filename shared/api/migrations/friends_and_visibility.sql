-- Friends system and visibility "friends": friend_requests, friendships, history, check_mutual_friendship.
-- Apply to the SAME database the API uses (see POSTGRES_DB in API container, usually ai_services):
--   psql "$DATABASE_URL" -f api/migrations/friends_and_visibility.sql
--   docker exec -i stack1-postgres psql -U ai_user -d ai_services < api/migrations/friends_and_visibility.sql

-- Friend requests: one row per request; status transitions (responded_at, responded_by) record response.
CREATE TABLE IF NOT EXISTS friend_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    to_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    responded_at TIMESTAMPTZ,
    responded_by UUID REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT friend_requests_no_self CHECK (from_user_id != to_user_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_friend_requests_pending_unique
    ON friend_requests (from_user_id, to_user_id) WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_friend_requests_to_status ON friend_requests (to_user_id, status);
CREATE INDEX IF NOT EXISTS idx_friend_requests_from_status ON friend_requests (from_user_id, status);

-- Accepted friendships: two rows per pair (A->B and B->A) for symmetric lookup.
CREATE TABLE IF NOT EXISTS friendships (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    friend_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, friend_id),
    CONSTRAINT friendships_no_self CHECK (user_id != friend_id)
);

CREATE INDEX IF NOT EXISTS idx_friendships_user_id ON friendships (user_id);
CREATE INDEX IF NOT EXISTS idx_friendships_friend_id ON friendships (friend_id);

-- History of request events (sent, accepted, rejected, cancelled).
CREATE TABLE IF NOT EXISTS friend_request_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL REFERENCES friend_requests(id) ON DELETE CASCADE,
    event VARCHAR(20) NOT NULL CHECK (event IN ('sent', 'accepted', 'rejected', 'cancelled')),
    at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_friend_request_history_request_id ON friend_request_history (request_id);

-- Returns TRUE if both users are friends (mutual row in friendships).
CREATE OR REPLACE FUNCTION check_mutual_friendship(user_id_1 UUID, user_id_2 UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM friendships f
        WHERE (f.user_id = user_id_1 AND f.friend_id = user_id_2)
           OR (f.user_id = user_id_2 AND f.friend_id = user_id_1)
    );
$$;

-- Allow visibility column to store 'friends' (if unified_content uses VARCHAR for visibility, no change needed;
-- if it uses an enum type, add value: ALTER TYPE visibility_enum ADD VALUE IF NOT EXISTS 'friends';
-- Comment for rollback:
-- DROP FUNCTION IF EXISTS check_mutual_friendship(UUID, UUID);
-- DROP TABLE IF EXISTS friend_request_history;
-- DROP TABLE IF EXISTS friendships;
-- DROP TABLE IF EXISTS friend_requests;
