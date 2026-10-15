-- MusicForge: default desktop catalog access group link.
-- Sync with frontend: app_id app-music-forge, app_component MusicForgeApp.

BEGIN;

-- UUID matches api/routers/desktop.py DEFAULT_ACCESS_GROUP_ID.
INSERT INTO app_access_groups (id, name, description, created_at, updated_at)
VALUES (
    'a0000000-0000-4000-8000-000000000001'::uuid,
    'Default',
    'Базовая группа доступа к каталогу приложений рабочего стола',
    NOW(),
    NOW()
)
ON CONFLICT (id) DO NOTHING;

UPDATE desktop_app_catalog
SET
    is_system = false,
    is_factory = true,
    ew_monthly_price = 0,
    trial_duration_days = 0,
    allow_multiple_windows = false,
    max_window_instances = 1,
    is_featured_new = true,
    updated_at = NOW()
WHERE app_id = 'app-music-forge';

INSERT INTO desktop_app_catalog_access_groups (catalog_id, access_group_id)
SELECT c.id, 'a0000000-0000-4000-8000-000000000001'::uuid
FROM desktop_app_catalog c
WHERE c.app_id = 'app-music-forge'
  AND NOT EXISTS (
      SELECT 1 FROM desktop_app_catalog_access_groups x
      WHERE x.catalog_id = c.id
        AND x.access_group_id = 'a0000000-0000-4000-8000-000000000001'::uuid
  );

COMMIT;
