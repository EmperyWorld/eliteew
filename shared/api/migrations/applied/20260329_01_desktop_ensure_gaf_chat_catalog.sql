-- GAF Chat в каталоге магазина приложений: строка могла отсутствовать, т.к.
-- desktop_app_catalog_gaf_chat.sql не проходил через pending/apply_migrations.sh.
-- Идемпотентно: вставка или обновление полей + M2M с дефолтной группой доступа.

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
    'app-gaf-chat',
    'GAF Chat',
    'Чаты с друзьями (1:1)',
    'GAFChatApp',
    'communication',
    'from-teal-500 to-cyan-600',
    'text-teal-400',
    140,
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
WHERE c.app_id = 'app-gaf-chat'
  AND NOT EXISTS (
      SELECT 1 FROM desktop_app_catalog_access_groups x
      WHERE x.catalog_id = c.id
        AND x.access_group_id = 'a0000000-0000-4000-8000-000000000001'::uuid
  );

COMMIT;
