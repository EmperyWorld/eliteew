-- UGS Хаб: desktop_app_catalog + группа доступа + установка тем, у кого уже есть UGS Studio.
-- Идемпотент в духе 20260330_desktop_ai_chat_app_catalog.sql.
-- Без записи в каталоге API вернёт 404/403 при синхронизации ярлыка app-ugs-hub.

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
    is_system
) VALUES (
    'app-ugs-hub',
    'UGS Хаб',
    'Активные задачи, история и очередь генераций UGS (хаб)',
    'UGSHubApp',
    'productivity',
    'from-cyan-600 to-slate-700',
    'text-cyan-400',
    142,
    false
) ON CONFLICT (app_id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    app_component = EXCLUDED.app_component,
    category = EXCLUDED.category,
    gradient = EXCLUDED.gradient,
    color = EXCLUDED.color,
    sort_order = EXCLUDED.sort_order,
    is_system = EXCLUDED.is_system,
    updated_at = NOW();

INSERT INTO desktop_app_catalog_access_groups (catalog_id, access_group_id)
SELECT c.id, 'a0000000-0000-4000-8000-000000000001'::uuid
FROM desktop_app_catalog c
WHERE c.app_id = 'app-ugs-hub'
  AND NOT EXISTS (
      SELECT 1 FROM desktop_app_catalog_access_groups x
      WHERE x.catalog_id = c.id
        AND x.access_group_id = 'a0000000-0000-4000-8000-000000000001'::uuid
  );

-- Установка «хаба» тем, у кого установлен каталожный UGS Studio (если app_id есть в БД),
-- либо на рабочем столе уже есть ярлык с app_component = 'UGS' (старые/ручные конфиги).
INSERT INTO user_installed_apps (user_id, app_id, installed_at)
SELECT DISTINCT s.user_id, 'app-ugs-hub', NOW()
FROM (
    SELECT uia.user_id AS user_id
    FROM user_installed_apps uia
    WHERE uia.app_id = 'app-ugs'
    UNION
    SELECT dc.user_id
    FROM desktop_items di
    INNER JOIN desktop_configs dc ON dc.id = di.config_id
    WHERE di.item_type = 'APP'
      AND di.app_component = 'UGS'
) s
ON CONFLICT (user_id, app_id) DO NOTHING;

COMMIT;
