-- Global web-search runtime config in Admin DB.
-- Stores non-secret settings + encrypted secrets and immutable audit log.

BEGIN;

CREATE TABLE IF NOT EXISTS search_runtime_config (
    id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    settings_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    secrets_encrypted_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO search_runtime_config (id, settings_json, secrets_encrypted_json)
VALUES (1, '{}'::jsonb, '{}'::jsonb)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS search_runtime_config_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(32) NOT NULL,
    before_settings JSONB NOT NULL DEFAULT '{}'::jsonb,
    after_settings JSONB NOT NULL DEFAULT '{}'::jsonb,
    before_secrets_status JSONB NOT NULL DEFAULT '{}'::jsonb,
    after_secrets_status JSONB NOT NULL DEFAULT '{}'::jsonb,
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_search_runtime_config_audit_created_at
    ON search_runtime_config_audit (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_search_runtime_config_audit_actor
    ON search_runtime_config_audit (actor_user_id, created_at DESC);

COMMIT;
