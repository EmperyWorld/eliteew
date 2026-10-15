-- Site Studio (app-site-studio): partial unpause for access group «NoRes» (product shape 1A).
-- Canon: documentation/product/SITE-STUDIO.md (§pause / NoRes).
-- Requires: site-studio-worker consuming site_studio; Edge Carrier for visitor publish.
-- Rollback: re-apply 20260522_desktop_site_studio_catalog_access_no.sql (group NO only).

BEGIN;

INSERT INTO app_access_groups (id, name, description, created_at, updated_at)
SELECT
    gen_random_uuid(),
    'NoRes',
    'NoRes desktop catalog access group',
    NOW(),
    NOW()
WHERE NOT EXISTS (SELECT 1 FROM app_access_groups WHERE name = 'NoRes');

DELETE FROM desktop_app_catalog_access_groups AS dag
USING desktop_app_catalog AS c
WHERE dag.catalog_id = c.id
  AND c.app_id = 'app-site-studio';

INSERT INTO desktop_app_catalog_access_groups (catalog_id, access_group_id)
SELECT c.id, g.id
FROM desktop_app_catalog AS c
CROSS JOIN app_access_groups AS g
WHERE c.app_id = 'app-site-studio'
  AND g.name = 'NoRes'
  AND NOT EXISTS (
      SELECT 1
      FROM desktop_app_catalog_access_groups AS x
      WHERE x.catalog_id = c.id
        AND x.access_group_id = g.id
  );

COMMIT;
