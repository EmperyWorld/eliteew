-- Wave 9: fleet Capsule v2 migration tracking + enrollment issued peer slug
-- Related: documentation/product/desktop/DESKTOP-CLIENT-SECURITY-BOUNDARIES.md §12g
-- Related: documentation/database/DATABASE_TABLES_REGISTRY.md

CREATE TABLE IF NOT EXISTS desktop_client_fleet_migration (
    license_id UUID PRIMARY KEY,
    migration_deadline TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'grace', 'completed', 'quarantined', 'exception')),
    exception_owner TEXT NULL,
    exception_until TIMESTAMPTZ NULL,
    old_peer_count INT NOT NULL DEFAULT 0,
    notes TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_desktop_client_fleet_migration_status
    ON desktop_client_fleet_migration (status, migration_deadline);

COMMENT ON TABLE desktop_client_fleet_migration IS
    'Wave 9 fleet cutover: Capsule v2 re-issue / peer revoke tracking per license';

ALTER TABLE desktop_client_enrollment_requests
    ADD COLUMN IF NOT EXISTS issued_peer_slug TEXT NULL;

COMMENT ON COLUMN desktop_client_enrollment_requests.issued_peer_slug IS
    'Portal peer slug created at sealed seat issue (Wave 9 keep-peer hint)';
