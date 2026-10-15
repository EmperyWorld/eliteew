-- EliteEW desktop-client portal peers (Wave 3b)
-- DB SoT for wg-portal peers; coexists with portalctl manifest (.101-.149).
-- IP pool for DB allocator: 10.88.89.150–254.
-- Related: documentation/product/desktop/DESKTOP-TAURI-CONNECTED-CLIENT.md

CREATE TABLE IF NOT EXISTS desktop_client_portal_peers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT NOT NULL,
    wg_public_key TEXT NOT NULL,
    assigned_ip INET NOT NULL,
    status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'revoked')),
    license_id UUID NULL REFERENCES desktop_client_licenses (id) ON DELETE SET NULL,
    label TEXT NULL,
    edge_sync_status TEXT NOT NULL DEFAULT 'pending'
        CHECK (edge_sync_status IN ('pending', 'synced', 'error', 'skipped')),
    edge_synced_at TIMESTAMPTZ NULL,
    edge_sync_error TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at TIMESTAMPTZ NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_desktop_client_portal_peers_pubkey
    ON desktop_client_portal_peers (wg_public_key);

CREATE UNIQUE INDEX IF NOT EXISTS idx_desktop_client_portal_peers_active_slug
    ON desktop_client_portal_peers (slug)
    WHERE status = 'active';

CREATE UNIQUE INDEX IF NOT EXISTS idx_desktop_client_portal_peers_active_ip
    ON desktop_client_portal_peers (assigned_ip)
    WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_desktop_client_portal_peers_status
    ON desktop_client_portal_peers (status);

CREATE INDEX IF NOT EXISTS idx_desktop_client_portal_peers_edge_sync
    ON desktop_client_portal_peers (edge_sync_status)
    WHERE status = 'active';
