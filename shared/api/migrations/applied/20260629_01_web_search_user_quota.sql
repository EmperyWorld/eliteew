-- Web search per-user quota: monthly free allowance + admin-granted coins (1 coin = 1 search).

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS web_search_coins INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS web_search_monthly_limit INTEGER NULL;

COMMENT ON COLUMN users.web_search_coins IS 'Bonus web search quota (coins); 1 coin = 1 search after monthly free allowance.';
COMMENT ON COLUMN users.web_search_monthly_limit IS 'Per-user monthly free search cap; NULL = platform default (WEB_SEARCH_MONTHLY_FREE_DEFAULT).';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'users_web_search_coins_nonneg'
    ) THEN
        ALTER TABLE users
            ADD CONSTRAINT users_web_search_coins_nonneg CHECK (web_search_coins >= 0);
    END IF;
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'users_web_search_monthly_limit_nonneg'
    ) THEN
        ALTER TABLE users
            ADD CONSTRAINT users_web_search_monthly_limit_nonneg
            CHECK (web_search_monthly_limit IS NULL OR web_search_monthly_limit >= 0);
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS web_search_monthly_usage (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    period_month DATE NOT NULL,
    used_count INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, period_month),
    CONSTRAINT web_search_monthly_usage_used_nonneg CHECK (used_count >= 0)
);

CREATE INDEX IF NOT EXISTS idx_web_search_monthly_usage_period
    ON web_search_monthly_usage (period_month);
