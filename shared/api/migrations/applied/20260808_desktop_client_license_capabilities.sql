-- EliteEW desktop-client license capabilities + account bind (#015)
-- Modes offline/online/both without key rotation; optional allowed_email + claim.
-- Related: documentation/product/desktop/DESKTOP-TAURI-CONNECTED-CLIENT.md

ALTER TABLE desktop_client_licenses
    ADD COLUMN IF NOT EXISTS allow_offline BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS allow_online BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS allowed_email TEXT NULL,
    ADD COLUMN IF NOT EXISTS bound_keycloak_sub TEXT NULL,
    ADD COLUMN IF NOT EXISTS email_bound_at TIMESTAMPTZ NULL;

-- Backfill from legacy edition / profile_id
UPDATE desktop_client_licenses
SET
    allow_offline = CASE
        WHEN edition = 'client' OR profile_id = 'client-offline-ai' THEN true
        ELSE false
    END,
    allow_online = CASE
        WHEN edition = 'connected' THEN true
        WHEN edition = 'client' OR profile_id = 'client-offline-ai' THEN false
        ELSE true
    END
WHERE true;

-- At least one mode
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'desktop_client_licenses_mode_chk'
    ) THEN
        ALTER TABLE desktop_client_licenses
            ADD CONSTRAINT desktop_client_licenses_mode_chk
            CHECK (allow_offline OR allow_online);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_desktop_client_licenses_allowed_email
    ON desktop_client_licenses (lower(allowed_email))
    WHERE allowed_email IS NOT NULL;
