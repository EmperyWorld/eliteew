-- EliteEW · FoFline W2: additive allow_fofline on desktop_client_licenses
-- Default deny; does not alter mode_chk (offline OR online).
-- Related: documentation/product/desktop/DESKTOP-FOFLINE-EDITION.md §4.2

ALTER TABLE desktop_client_licenses
    ADD COLUMN IF NOT EXISTS allow_fofline BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN desktop_client_licenses.allow_fofline IS
  'FoFline pack entitlement (empery-fofline OIDC). Additive; default false.';
