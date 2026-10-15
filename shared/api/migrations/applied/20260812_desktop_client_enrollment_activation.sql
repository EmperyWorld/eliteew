-- Wave 4: one-time activation token hash for Capsule v2
-- Related: documentation/product/desktop/DESKTOP-CLIENT-SECURITY-BOUNDARIES.md §4

ALTER TABLE desktop_client_enrollment_requests
    ADD COLUMN IF NOT EXISTS activation_token_hash TEXT NULL;

ALTER TABLE desktop_client_enrollment_requests
    ADD COLUMN IF NOT EXISTS activation_consumed_at TIMESTAMPTZ NULL;
