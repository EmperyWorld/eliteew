-- EWA companion: per-user declarative action workflows (phrase triggers).
-- Applied: 2026-05-25

CREATE TABLE IF NOT EXISTS ewa_companion_user_workflows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    principal_id UUID NOT NULL,
    name TEXT NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    definition_json JSONB NOT NULL,
    trigger_json JSONB NOT NULL,
    version INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ewa_companion_user_workflows_name_len CHECK (char_length(name) BETWEEN 1 AND 120)
);

CREATE UNIQUE INDEX IF NOT EXISTS ewa_companion_user_workflows_principal_name_uidx
    ON ewa_companion_user_workflows (principal_id, lower(name));

CREATE INDEX IF NOT EXISTS ewa_companion_user_workflows_principal_enabled_idx
    ON ewa_companion_user_workflows (principal_id, enabled, updated_at DESC);
