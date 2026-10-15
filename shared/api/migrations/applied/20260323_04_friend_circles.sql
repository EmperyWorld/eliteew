-- Friends v2 circles/groups foundation: owner-scoped social segments for directed friendships.
CREATE TABLE IF NOT EXISTS friend_circles (
    id UUID PRIMARY KEY,
    owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_friend_circles_owner_name
    ON friend_circles (owner_user_id, LOWER(BTRIM(name)));

CREATE INDEX IF NOT EXISTS idx_friend_circles_owner_sort
    ON friend_circles (owner_user_id, sort_order, created_at);

CREATE TABLE IF NOT EXISTS friend_circle_memberships (
    circle_id UUID NOT NULL REFERENCES friend_circles(id) ON DELETE CASCADE,
    owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    friend_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (circle_id, friend_user_id)
);

CREATE INDEX IF NOT EXISTS idx_friend_circle_memberships_owner_friend
    ON friend_circle_memberships (owner_user_id, friend_user_id);
