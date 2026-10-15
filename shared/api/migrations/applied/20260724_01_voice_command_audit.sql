-- Voice command audit: durable trail for Studio GU HQ (replaces in-memory store).
-- Apply via EliteEW/api migrations pending → applied pipeline.

BEGIN;

CREATE TABLE IF NOT EXISTS voice_command_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    command_id VARCHAR(128) NOT NULL,
    transcript TEXT NOT NULL DEFAULT '',
    status VARCHAR(16) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT voice_command_audit_status_valid
        CHECK (status IN ('success', 'error', 'cancelled'))
);

CREATE INDEX IF NOT EXISTS idx_voice_command_audit_user_created
    ON voice_command_audit (user_id, created_at DESC);

COMMENT ON TABLE voice_command_audit IS
    'Studio GU / voice HQ command executions; per-user list only (no admin-wide in MVP).';

COMMIT;
