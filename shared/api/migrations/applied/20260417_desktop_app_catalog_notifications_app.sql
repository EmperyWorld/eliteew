-- Центр уведомлений (окно десктопа NotificationsApp): строка каталога + дефолтная группа доступа.
-- Синхронизация с фронтом: app_id app-notifications, app_component NotificationsApp (constants/index.ts).

BEGIN;

INSERT INTO desktop_app_catalog (
    app_id,
    name,
    description,
    app_component,
    category,
    gradient,
    color,
    sort_order,
    is_system,
    is_factory,
    ew_monthly_price,
    trial_duration_days
) VALUES (
    'app-notifications',
    'Центр уведомлений',
    'Единый центр: история уведомлений, фильтры и настройки звука, GAF и UGS',
    'NotificationsApp',
    'communication',
    'from-sky-500 to-indigo-600',
    'text-sky-400',
    142,
    false,
    true,
    0,
    0
) ON CONFLICT (app_id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    app_component = EXCLUDED.app_component,
    category = EXCLUDED.category,
    gradient = EXCLUDED.gradient,
    color = EXCLUDED.color,
    sort_order = EXCLUDED.sort_order,
    is_system = EXCLUDED.is_system,
    is_factory = EXCLUDED.is_factory,
    ew_monthly_price = EXCLUDED.ew_monthly_price,
    trial_duration_days = EXCLUDED.trial_duration_days,
    updated_at = NOW();

-- UUID совпадает с api/routers/desktop.py DEFAULT_ACCESS_GROUP_ID.
-- На части БД строки не было — без неё FK desktop_app_catalog_access_groups падает.
INSERT INTO app_access_groups (id, name, description, created_at, updated_at)
VALUES (
    'a0000000-0000-4000-8000-000000000001'::uuid,
    'Default',
    'Базовая группа доступа к каталогу приложений рабочего стола',
    NOW(),
    NOW()
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO desktop_app_catalog_access_groups (catalog_id, access_group_id)
SELECT c.id, 'a0000000-0000-4000-8000-000000000001'::uuid
FROM desktop_app_catalog c
WHERE c.app_id = 'app-notifications'
  AND NOT EXISTS (
      SELECT 1 FROM desktop_app_catalog_access_groups x
      WHERE x.catalog_id = c.id
        AND x.access_group_id = 'a0000000-0000-4000-8000-000000000001'::uuid
  );

COMMIT;
