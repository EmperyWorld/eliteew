-- System GAF onboarding instruction template + user flag + message metadata.
-- Apply via api/migrations/apply_migrations.sh

CREATE TABLE IF NOT EXISTS system_gaf_instruction (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    locale TEXT NOT NULL DEFAULT 'ru',
    welcome_text TEXT NOT NULL DEFAULT '',
    thanks_text TEXT NOT NULL DEFAULT '',
    steps JSONB NOT NULL DEFAULT '[]'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT system_gaf_instruction_locale_unique UNIQUE (locale)
);

INSERT INTO system_gaf_instruction (locale, welcome_text, thanks_text, steps)
VALUES ('ru', '', '', '[]'::jsonb)
ON CONFLICT (locale) DO NOTHING;

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS onboarding_gaf_sent_at TIMESTAMPTZ NULL;

ALTER TABLE gaf_messages
    ADD COLUMN IF NOT EXISTS metadata JSONB NULL;
