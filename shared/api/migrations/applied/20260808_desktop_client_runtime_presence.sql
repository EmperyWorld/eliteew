-- EliteEW desktop-client runtime presence (Admin Users heartbeat)
-- Client reports app version / WG / build channel; join by keycloak_sub or license bind.
-- Related: documentation/platform/SSO-SESSION-REGISTRY-AND-ADMIN-PRESENCE.md
-- Related: documentation/product/desktop/DESKTOP-TAURI-CONNECTED-CLIENT.md

CREATE TABLE IF NOT EXISTS desktop_client_runtime_presence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    keycloak_sub TEXT NULL,
    license_id UUID NULL REFERENCES desktop_client_licenses (id) ON DELETE SET NULL,
    device_id UUID NULL REFERENCES desktop_client_devices (id) ON DELETE SET NULL,
    app_version TEXT NULL,
    wg_up BOOLEAN NULL,
    peer_slug TEXT NULL,
    build_channel TEXT NULL
        CHECK (build_channel IS NULL OR build_channel IN ('rpm', 'nsis', 'unknown')),
    updater_pubkey_baked BOOLEAN NOT NULL DEFAULT false,
    report_ip TEXT NULL,
    reported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_desktop_client_runtime_presence_sub
    ON desktop_client_runtime_presence (keycloak_sub)
    WHERE keycloak_sub IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_desktop_client_runtime_presence_device
    ON desktop_client_runtime_presence (device_id)
    WHERE device_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_desktop_client_runtime_presence_license
    ON desktop_client_runtime_presence (license_id)
    WHERE license_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_desktop_client_runtime_presence_reported
    ON desktop_client_runtime_presence (reported_at DESC);
