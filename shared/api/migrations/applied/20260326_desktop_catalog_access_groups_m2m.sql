-- Desktop app catalog: many access groups per app (was single access_group_id).
BEGIN;

CREATE TABLE IF NOT EXISTS desktop_app_catalog_access_groups (
    catalog_id UUID NOT NULL REFERENCES desktop_app_catalog(id) ON DELETE CASCADE,
    access_group_id UUID NOT NULL REFERENCES app_access_groups(id) ON DELETE CASCADE,
    PRIMARY KEY (catalog_id, access_group_id)
);

CREATE INDEX IF NOT EXISTS ix_dacag_access_group_id ON desktop_app_catalog_access_groups(access_group_id);

INSERT INTO desktop_app_catalog_access_groups (catalog_id, access_group_id)
SELECT id, access_group_id
FROM desktop_app_catalog
WHERE access_group_id IS NOT NULL
ON CONFLICT DO NOTHING;

ALTER TABLE desktop_app_catalog DROP CONSTRAINT IF EXISTS desktop_app_catalog_access_group_id_fkey;
ALTER TABLE desktop_app_catalog DROP COLUMN IF EXISTS access_group_id;

COMMIT;
