-- Per-user mobile push tokens (FCM); upsert via PUT /api/v1/profile/mobile-push-token
CREATE TABLE IF NOT EXISTS user_mobile_push_tokens (
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    platform VARCHAR(32) NOT NULL DEFAULT 'android',
    device_id VARCHAR(256) NOT NULL DEFAULT '',
    token TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT user_mobile_push_tokens_pkey PRIMARY KEY (user_id, platform, device_id)
);

CREATE INDEX IF NOT EXISTS idx_user_mobile_push_tokens_updated_at ON user_mobile_push_tokens (updated_at);

COMMENT ON TABLE user_mobile_push_tokens IS 'FCM/APNs-style device tokens; keyed by user, platform, optional device_id (empty string = default device)';
