-- EliteEW desktop-client license + device registry (Wave 2)
-- Private connected Tauri path; fields align with parked offline blob appendix.
-- Related: documentation/product/desktop/DESKTOP-TAURI-CONNECTED-CLIENT.md

CREATE TABLE IF NOT EXISTS desktop_client_licenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    license_key_hash TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'revoked')),
    edition TEXT NOT NULL DEFAULT 'connected',
    profile_id TEXT NULL,
    apps_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    label TEXT NULL,
    issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NULL,
    revoked_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS desktop_client_devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    license_id UUID NOT NULL REFERENCES desktop_client_licenses (id) ON DELETE CASCADE,
    device_pubkey TEXT NOT NULL,
    machine_fingerprint TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'revoked')),
    last_seen_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at TIMESTAMPTZ NULL,
    UNIQUE (license_id, device_pubkey),
    UNIQUE (license_id, machine_fingerprint)
);

CREATE INDEX IF NOT EXISTS idx_desktop_client_devices_pubkey
    ON desktop_client_devices (device_pubkey)
    WHERE status = 'active';

CREATE TABLE IF NOT EXISTS desktop_client_audit (
    id BIGSERIAL PRIMARY KEY,
    event TEXT NOT NULL,
    license_id UUID NULL REFERENCES desktop_client_licenses (id) ON DELETE SET NULL,
    device_id UUID NULL REFERENCES desktop_client_devices (id) ON DELETE SET NULL,
    client_ip TEXT NULL,
    detail JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_desktop_client_audit_created
    ON desktop_client_audit (created_at DESC);
