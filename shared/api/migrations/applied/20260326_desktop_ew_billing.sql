-- Desktop app store: EW balance per user, catalog pricing/trial, entitlements, ledger.
BEGIN;

ALTER TABLE users ADD COLUMN IF NOT EXISTS ew_balance INTEGER NOT NULL DEFAULT 100;

UPDATE users SET ew_balance = 100 WHERE ew_balance IS NULL;

ALTER TABLE desktop_app_catalog ADD COLUMN IF NOT EXISTS ew_monthly_price INTEGER NOT NULL DEFAULT 0;
ALTER TABLE desktop_app_catalog ADD COLUMN IF NOT EXISTS trial_duration_days INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS user_desktop_app_entitlements (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    app_id VARCHAR(100) NOT NULL REFERENCES desktop_app_catalog(app_id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL,
    trial_ends_at TIMESTAMPTZ NULL,
    subscription_ends_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, app_id)
);

CREATE INDEX IF NOT EXISTS ix_udae_app_id ON user_desktop_app_entitlements(app_id);

CREATE TABLE IF NOT EXISTS user_ew_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    delta INTEGER NOT NULL,
    balance_after INTEGER NULL,
    reason TEXT NOT NULL,
    app_id VARCHAR(100) NULL,
    is_family_waiver BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_user_ew_ledger_user_created ON user_ew_ledger(user_id, created_at DESC);

COMMIT;
