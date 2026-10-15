-- Social Hub moderation reports.
CREATE TABLE IF NOT EXISTS social_user_reports (
    id UUID PRIMARY KEY,
    reporter_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reported_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reason TEXT NOT NULL,
    details TEXT,
    status TEXT NOT NULL DEFAULT 'open',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ,
    reviewer_user_id UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_social_user_reports_reported_created
    ON social_user_reports (reported_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_social_user_reports_status_created
    ON social_user_reports (status, created_at DESC);
