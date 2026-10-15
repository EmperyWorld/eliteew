-- Desktop atomic conditional access — binding + auth tickets (Wave 1)
-- Related: documentation/product/desktop/DESKTOP-ATOMIC-CONDITIONAL-ACCESS.md

CREATE TABLE IF NOT EXISTS desktop_client_identity_bindings (
    id TEXT PRIMARY KEY,
    license_id UUID NOT NULL REFERENCES desktop_client_licenses (id) ON DELETE CASCADE,
    device_id UUID NULL REFERENCES desktop_client_devices (id) ON DELETE SET NULL,
    keycloak_sub TEXT NULL,
    dpop_jkt TEXT NOT NULL,
    channel TEXT NOT NULL CHECK (channel IN ('desktop', 'fofline')),
    client_id TEXT NOT NULL CHECK (client_id IN ('empery-desktop', 'empery-fofline')),
    state TEXT NOT NULL DEFAULT 'active' CHECK (
        state IN ('active', 'restricted', 'quarantined', 'revoked')
    ),
    authz_epoch BIGINT NOT NULL DEFAULT 1 CHECK (authz_epoch >= 1),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_desktop_client_identity_bindings_license
    ON desktop_client_identity_bindings (license_id, client_id);

CREATE INDEX IF NOT EXISTS idx_desktop_client_identity_bindings_sub
    ON desktop_client_identity_bindings (keycloak_sub)
    WHERE keycloak_sub IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_desktop_client_identity_bindings_active_license_client
    ON desktop_client_identity_bindings (license_id, client_id)
    WHERE state = 'active';

CREATE TABLE IF NOT EXISTS desktop_client_auth_tickets (
    id TEXT PRIMARY KEY,
    ticket_hash TEXT NOT NULL UNIQUE,
    license_id UUID NOT NULL REFERENCES desktop_client_licenses (id) ON DELETE CASCADE,
    device_id UUID NULL REFERENCES desktop_client_devices (id) ON DELETE SET NULL,
    client_id TEXT NOT NULL CHECK (client_id IN ('empery-desktop', 'empery-fofline')),
    channel TEXT NOT NULL CHECK (channel IN ('desktop', 'fofline')),
    dpop_jkt TEXT NOT NULL,
    pkce_challenge TEXT NOT NULL,
    redirect_uri_hash TEXT NULL,
    device_pubkey TEXT NOT NULL,
    keycloak_auth_session_id TEXT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ NULL,
    consumed_outcome TEXT NULL CHECK (
        consumed_outcome IS NULL
        OR consumed_outcome IN ('precheck_denied', 'commit_denied', 'commit_ok', 'expired')
    ),
    idempotency_key TEXT NULL,
    idempotency_outcome_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_desktop_client_auth_tickets_license_expires
    ON desktop_client_auth_tickets (license_id, expires_at DESC);

CREATE INDEX IF NOT EXISTS idx_desktop_client_auth_tickets_session
    ON desktop_client_auth_tickets (keycloak_auth_session_id)
    WHERE keycloak_auth_session_id IS NOT NULL AND consumed_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_desktop_client_auth_tickets_idempotency
    ON desktop_client_auth_tickets (idempotency_key)
    WHERE idempotency_key IS NOT NULL;
