-- EliteEW desktop-client Air enrollment one-code FSM.
-- Dedicated edge SG leases, hash-only credentials, sanitized append-only events.
-- Related: documentation/product/desktop/DESKTOP-CLIENT-AIR-ENROLL.md

CREATE TABLE IF NOT EXISTS desktop_client_air_enroll_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mode TEXT NOT NULL
        CHECK (mode IN ('offline', 'cloud', 'both')),
    label TEXT NULL,
    slug TEXT NULL,
    allowed_email TEXT NULL,
    allow_fofline BOOLEAN NOT NULL DEFAULT false,
    seat_expires_at TIMESTAMPTZ NULL,
    created_by TEXT NOT NULL,
    idempotency_key TEXT NOT NULL,
    intent_hash TEXT NOT NULL
        CHECK (intent_hash ~ '^[0-9a-f]{64}$'),
    port INTEGER NOT NULL
        CHECK (port BETWEEN 62200 AND 63200),
    lifecycle TEXT NOT NULL DEFAULT 'provisioning'
        CHECK (
            lifecycle IN (
                'provisioning',
                'ready',
                'revealed',
                'claimed',
                'capsule_sealed',
                'activation_acked',
                'completed',
                'auth_failed',
                'issue_failed',
                'delivery_uncertain',
                'expired',
                'cancelled'
            )
        ),
    cleanup_state TEXT NOT NULL DEFAULT 'not_started'
        CHECK (
            cleanup_state IN (
                'not_started',
                'local_closed',
                'sg_removing',
                'closed',
                'cleanup_degraded'
            )
        ),
    selector_hash TEXT NULL
        CHECK (selector_hash IS NULL OR selector_hash ~ '^[0-9a-f]{64}$'),
    secret_hash TEXT NULL
        CHECK (secret_hash IS NULL OR secret_hash ~ '^[0-9a-f]{64}$'),
    sg_rule_id TEXT NULL,
    attempt_count SMALLINT NOT NULL DEFAULT 0
        CHECK (attempt_count BETWEEN 0 AND 1),
    request_id TEXT NULL,
    device_signing_pubkey TEXT NULL,
    capsule_recipient_pubkey TEXT NULL,
    recipient_key_id TEXT NULL,
    machine_fingerprint_hash TEXT NULL,
    license_id UUID NULL
        REFERENCES desktop_client_licenses (id) ON DELETE SET NULL,
    ecap_sha256 TEXT NULL
        CHECK (ecap_sha256 IS NULL OR ecap_sha256 ~ '^[0-9a-f]{64}$'),
    ecap_size INTEGER NULL
        CHECK (ecap_size IS NULL OR ecap_size BETWEEN 1 AND 262144),
    reissue_of UUID NULL
        REFERENCES desktop_client_air_enroll_sessions (id) ON DELETE RESTRICT,
    delivery_generation INTEGER NOT NULL DEFAULT 1
        CHECK (delivery_generation BETWEEN 1 AND 1000),
    provision_expires_at TIMESTAMPTZ NOT NULL,
    code_expires_at TIMESTAMPTZ NULL,
    ready_at TIMESTAMPTZ NULL,
    revealed_at TIMESTAMPTZ NULL,
    claimed_at TIMESTAMPTZ NULL,
    sealed_at TIMESTAMPTZ NULL,
    activation_acked_at TIMESTAMPTZ NULL,
    terminal_at TIMESTAMPTZ NULL,
    local_closed_at TIMESTAMPTZ NULL,
    sg_closed_at TIMESTAMPTZ NULL,
    last_error_code TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_desktop_client_air_live_port
    ON desktop_client_air_enroll_sessions (port)
    WHERE cleanup_state <> 'closed';

CREATE UNIQUE INDEX IF NOT EXISTS idx_desktop_client_air_selector_hash
    ON desktop_client_air_enroll_sessions (selector_hash)
    WHERE selector_hash IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_desktop_client_air_idempotency
    ON desktop_client_air_enroll_sessions (created_by, idempotency_key);

CREATE INDEX IF NOT EXISTS idx_desktop_client_air_lifecycle
    ON desktop_client_air_enroll_sessions (lifecycle, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_desktop_client_air_cleanup
    ON desktop_client_air_enroll_sessions (cleanup_state, updated_at)
    WHERE cleanup_state <> 'closed';

CREATE TABLE IF NOT EXISTS desktop_client_air_enroll_events (
    id BIGSERIAL PRIMARY KEY,
    session_id UUID NOT NULL
        REFERENCES desktop_client_air_enroll_sessions (id) ON DELETE RESTRICT,
    sequence INTEGER NOT NULL CHECK (sequence > 0),
    event TEXT NOT NULL,
    lifecycle TEXT NOT NULL,
    cleanup_state TEXT NOT NULL,
    reason TEXT NULL,
    detail JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (session_id, sequence)
);

CREATE INDEX IF NOT EXISTS idx_desktop_client_air_events_created
    ON desktop_client_air_enroll_events (session_id, created_at, id);

ALTER TABLE desktop_client_enrollment_requests
    ADD COLUMN IF NOT EXISTS air_session_id UUID NULL
        REFERENCES desktop_client_air_enroll_sessions (id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS ecap_sha256 TEXT NULL,
    ADD COLUMN IF NOT EXISTS ecap_size INTEGER NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_desktop_client_enrollment_air_session
    ON desktop_client_enrollment_requests (air_session_id)
    WHERE air_session_id IS NOT NULL;

COMMENT ON TABLE desktop_client_air_enroll_sessions IS
    'One-code pre-license Air enrollment FSM and exact dedicated-SG lease';
COMMENT ON TABLE desktop_client_air_enroll_events IS
    'Sanitized append-only Air enrollment issuance and cleanup checkpoints';
COMMENT ON COLUMN desktop_client_enrollment_requests.air_session_id IS
    'Air session that atomically sealed this exact persisted Capsule';
