-- Synced snapshot of desktop notification center (cross-device). Client merges with localStorage.
CREATE TABLE IF NOT EXISTS user_notification_center (
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_notification_center_updated_at ON user_notification_center (updated_at);

COMMENT ON TABLE user_notification_center IS 'Desktop notification center inbox snapshot (max 200 items); API GET/PUT under /api/v1/profile/notification-center';
