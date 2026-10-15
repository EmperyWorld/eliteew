-- EliteEW desktop-client enrollment requests (Wave 3 / F-03)
-- Hand-to-hand device_request_v1 persistence for sealed seat issue.
-- Related: documentation/product/desktop/DESKTOP-CLIENT-SECURITY-BOUNDARIES.md §4

CREATE TABLE IF NOT EXISTS desktop_client_enrollment_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id TEXT NOT NULL UNIQUE,
    product_id TEXT NOT NULL,
    app_identifier TEXT NOT NULL,
    device_signing_pubkey TEXT NOT NULL,
    capsule_recipient_pubkey TEXT NOT NULL,
    recipient_key_id TEXT NOT NULL,
    machine_fingerprint_hash TEXT NOT NULL,
    nonce TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'issued', 'expired', 'revoked')),
    expires_at TIMESTAMPTZ NOT NULL,
    license_id UUID NULL REFERENCES desktop_client_licenses (id) ON DELETE SET NULL,
    issued_package_json JSONB NULL,
    issue_body_hash TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    issued_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_desktop_client_enrollment_status
    ON desktop_client_enrollment_requests (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_desktop_client_enrollment_recipient
    ON desktop_client_enrollment_requests (recipient_key_id);
