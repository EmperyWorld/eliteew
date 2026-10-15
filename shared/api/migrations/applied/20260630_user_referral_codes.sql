-- Per-user referral codes for Social Hub / MobileAndroid friend invite links (DEBT-X-06).
CREATE TABLE IF NOT EXISTS user_referral_codes (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    referral_code TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT user_referral_codes_code_format CHECK (referral_code ~ '^[A-Z2-9]{10}$')
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_referral_codes_code
    ON user_referral_codes (referral_code);
