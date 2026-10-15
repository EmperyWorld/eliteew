-- EBrowser: column default fail-closed (empty allowlist), not open.
-- SoT: documentation/product/desktop/DESKTOP-EBROWSER.md §2
-- Cause: INSERT omitting mode must not invent unrestricted HTTPS.

BEGIN;

ALTER TABLE ebrowser_user_policies
    ALTER COLUMN mode SET DEFAULT 'allowlist';

-- Scrub persisted empty-denylist rows (would evaluate as allow-all before fail-closed).
UPDATE ebrowser_user_policies
SET
    mode = 'allowlist',
    allow_json = '[]'::jsonb,
    deny_json = '[]'::jsonb,
    updated_at = (NOW() AT TIME ZONE 'utc')
WHERE mode = 'denylist'
  AND (
    deny_json IS NULL
    OR deny_json = '[]'::jsonb
    OR jsonb_typeof(deny_json) <> 'array'
    OR jsonb_array_length(deny_json) = 0
  );

COMMENT ON TABLE ebrowser_user_policies IS
    'Per-user EBrowser navigation policy (open|allowlist|denylist). Missing-row / column default = allowlist (deny-all until admin saves). Client fail-closed on TTL.';

COMMIT;
