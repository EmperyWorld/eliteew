-- Wave 6: at most one live (non-revoked) identity binding per license×client.
-- Complements idx_desktop_client_identity_bindings_active_license_client (active-only).
-- Precondition: revoke lower-priority duplicate live rows before creating the unique index.
-- Keep priority: active > quarantined > restricted > other, then newest updated_at/created_at/id.
-- Quarantined outranks restricted so migrate pending-PoP rows cannot undo admin quarantine.
-- Related: documentation/product/desktop/DESKTOP-ATOMIC-CONDITIONAL-ACCESS.md §9.6

WITH ranked AS (
    SELECT
        id,
        ROW_NUMBER() OVER (
            PARTITION BY license_id, client_id
            ORDER BY
                CASE state
                    WHEN 'active' THEN 0
                    WHEN 'quarantined' THEN 1
                    WHEN 'restricted' THEN 2
                    ELSE 3
                END ASC,
                updated_at DESC NULLS LAST,
                created_at DESC NULLS LAST,
                id DESC
        ) AS rn
    FROM desktop_client_identity_bindings
    WHERE state <> 'revoked'
)
UPDATE desktop_client_identity_bindings b
SET
    state = 'revoked',
    updated_at = NOW()
FROM ranked r
WHERE b.id = r.id
  AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_desktop_client_identity_bindings_live_license_client
    ON desktop_client_identity_bindings (license_id, client_id)
    WHERE state <> 'revoked';
