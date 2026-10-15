-- EliteEW desktop-client soft-revoke denylist SoT (Wave B / O4 Admin)
-- DB desired soft-revoke set + last publish metadata for OTA denylist.json.
-- Related: documentation/product/desktop/DESKTOP-TAURI-CONNECTED-CLIENT.md §8.1

CREATE TABLE IF NOT EXISTS desktop_client_soft_revokes (
    license_id UUID PRIMARY KEY
        REFERENCES desktop_client_licenses (id) ON DELETE CASCADE,
    reason TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by TEXT NULL
);

CREATE TABLE IF NOT EXISTS desktop_client_denylist_publish (
    id SMALLINT PRIMARY KEY DEFAULT 1
        CHECK (id = 1),
    published_at TIMESTAMPTZ NULL,
    note TEXT NULL,
    revoked_count INT NOT NULL DEFAULT 0,
    payload_hash TEXT NULL,
    out_path TEXT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO desktop_client_denylist_publish (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;
