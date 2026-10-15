-- Server-side profile privacy: discoverability (search) and per-field visibility (incl. friend circles).
-- Defaults match prior behavior: discoverable in search; avatar/full_name/bio visible to everyone who may see the row.

CREATE TABLE IF NOT EXISTS user_profile_privacy (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    discoverability TEXT NOT NULL DEFAULT 'public'
        CONSTRAINT chk_upp_discoverability CHECK (discoverability IN ('public', 'hidden')),
    avatar_visibility TEXT NOT NULL DEFAULT 'everyone'
        CONSTRAINT chk_upp_avatar_vis CHECK (avatar_visibility IN ('everyone', 'friends_only', 'none', 'circle')),
    avatar_circle_id UUID REFERENCES friend_circles(id) ON DELETE SET NULL,
    full_name_visibility TEXT NOT NULL DEFAULT 'everyone'
        CONSTRAINT chk_upp_full_name_vis CHECK (full_name_visibility IN ('everyone', 'friends_only', 'none', 'circle')),
    full_name_circle_id UUID REFERENCES friend_circles(id) ON DELETE SET NULL,
    bio_visibility TEXT NOT NULL DEFAULT 'everyone'
        CONSTRAINT chk_upp_bio_vis CHECK (bio_visibility IN ('everyone', 'friends_only', 'none', 'circle')),
    bio_circle_id UUID REFERENCES friend_circles(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE user_profile_privacy IS 'Authoritative privacy flags for profile fields and search discoverability; enforced in API.';
COMMENT ON COLUMN user_profile_privacy.discoverability IS 'public: may appear in user search for non-friends; hidden: excluded unless viewer is a friend.';
COMMENT ON COLUMN user_profile_privacy.avatar_visibility IS 'everyone|friends_only|none|circle — who may see avatar when API allows viewing that context.';

CREATE INDEX IF NOT EXISTS idx_user_profile_privacy_discoverability
    ON user_profile_privacy (discoverability)
    WHERE discoverability = 'hidden';

-- One row per existing user with defaults (idempotent).
INSERT INTO user_profile_privacy (user_id)
SELECT id FROM users
ON CONFLICT (user_id) DO NOTHING;
