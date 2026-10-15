-- Desktop atomic conditional access — Wave 5 auth-risk events + admin recovery
-- Related: documentation/product/desktop/DESKTOP-ATOMIC-CONDITIONAL-ACCESS.md

ALTER TABLE desktop_client_identity_bindings
    ADD COLUMN IF NOT EXISTS rebind_allowed_until TIMESTAMPTZ NULL,
    ADD COLUMN IF NOT EXISTS last_risk_at TIMESTAMPTZ NULL;

ALTER TABLE desktop_client_auth_tickets
    ADD COLUMN IF NOT EXISTS transcript_jti TEXT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_desktop_client_auth_tickets_transcript_jti
    ON desktop_client_auth_tickets (transcript_jti)
    WHERE transcript_jti IS NOT NULL;

ALTER TABLE desktop_client_auth_tickets
    DROP CONSTRAINT IF EXISTS desktop_client_auth_tickets_consumed_outcome_check;

ALTER TABLE desktop_client_auth_tickets
    ADD CONSTRAINT desktop_client_auth_tickets_consumed_outcome_check
    CHECK (
        consumed_outcome IS NULL
        OR consumed_outcome IN (
            'precheck_denied',
            'commit_denied',
            'commit_ok',
            'expired',
            'risk_revoked',
            'admin_revoked'
        )
    );

CREATE TABLE IF NOT EXISTS desktop_client_auth_risk_events (
    id TEXT PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    kind TEXT NOT NULL CHECK (
        kind IN (
            'unsigned_bad_proof',
            'stale_nonce',
            'valid_replay',
            'impossible_transition',
            'admin_quarantine',
            'admin_restore',
            'admin_allow_rebind',
            'admin_end_sessions',
            'admin_clear_kc_failures'
        )
    ),
    binding_id TEXT NULL REFERENCES desktop_client_identity_bindings (id) ON DELETE SET NULL,
    license_id UUID NULL REFERENCES desktop_client_licenses (id) ON DELETE SET NULL,
    device_id UUID NULL REFERENCES desktop_client_devices (id) ON DELETE SET NULL,
    keycloak_sub TEXT NULL,
    client_ip TEXT NULL,
    corroborated BOOLEAN NOT NULL DEFAULT FALSE,
    resulting_state TEXT NULL CHECK (
        resulting_state IS NULL
        OR resulting_state IN ('active', 'restricted', 'quarantined', 'revoked')
    ),
    tickets_revoked INTEGER NOT NULL DEFAULT 0 CHECK (tickets_revoked >= 0),
    epoch_after BIGINT NULL,
    license_status_unchanged BOOLEAN NOT NULL DEFAULT TRUE,
    detail JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_desktop_client_auth_risk_events_binding
    ON desktop_client_auth_risk_events (binding_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_desktop_client_auth_risk_events_license
    ON desktop_client_auth_risk_events (license_id, created_at DESC);

CREATE TABLE IF NOT EXISTS desktop_client_admin_recovery_actions (
    idempotency_key TEXT PRIMARY KEY,
    action TEXT NOT NULL,
    binding_id TEXT NOT NULL REFERENCES desktop_client_identity_bindings (id) ON DELETE CASCADE,
    actor_sub TEXT NOT NULL,
    reason TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    outcome_json JSONB NOT NULL DEFAULT '{}'::jsonb
);
