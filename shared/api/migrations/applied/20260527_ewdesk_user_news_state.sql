-- EWDesk: per-user read/starred state and feed watermark for badge sync

CREATE TABLE IF NOT EXISTS ewdesk_user_feed_meta (
	user_id UUID PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
	last_seen_published_at TIMESTAMPTZ NULL,
	updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ewdesk_user_news_state (
	user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
	post_id UUID NOT NULL REFERENCES company_news_posts (id) ON DELETE CASCADE,
	read_at TIMESTAMPTZ NULL,
	starred BOOLEAN NOT NULL DEFAULT false,
	updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	PRIMARY KEY (user_id, post_id)
);

CREATE INDEX IF NOT EXISTS idx_ewdesk_user_news_state_user_starred
	ON ewdesk_user_news_state (user_id)
	WHERE starred = true;

CREATE INDEX IF NOT EXISTS idx_ewdesk_user_news_state_user_read
	ON ewdesk_user_news_state (user_id)
	WHERE read_at IS NOT NULL;

COMMENT ON TABLE ewdesk_user_feed_meta IS 'EWDesk feed watermark (badge / last visit) per user';
COMMENT ON TABLE ewdesk_user_news_state IS 'EWDesk read/starred flags per user and post';
