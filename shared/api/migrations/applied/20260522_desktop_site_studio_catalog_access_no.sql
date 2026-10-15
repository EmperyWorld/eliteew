-- Site Studio (app-site-studio): временная пауза — только группа допуска «NO».
-- Канон: documentation/product/SITE-STUDIO.md (§ «Временная пауза»).
-- Обратное включение: worker `--profile site-studio-worker` + вернуть группу допуска в каталоге.

BEGIN;

INSERT INTO app_access_groups (id, name, description, created_at, updated_at)
SELECT
    gen_random_uuid(),
    'NO',
    'Приложения, временно скрытые из магазина (операторская пауза)',
    NOW(),
    NOW()
WHERE NOT EXISTS (SELECT 1 FROM app_access_groups WHERE name = 'NO');

DELETE FROM desktop_app_catalog_access_groups AS dag
USING desktop_app_catalog AS c
WHERE dag.catalog_id = c.id
  AND c.app_id = 'app-site-studio';

INSERT INTO desktop_app_catalog_access_groups (catalog_id, access_group_id)
SELECT c.id, g.id
FROM desktop_app_catalog AS c
CROSS JOIN app_access_groups AS g
WHERE c.app_id = 'app-site-studio'
  AND g.name = 'NO'
  AND NOT EXISTS (
      SELECT 1
      FROM desktop_app_catalog_access_groups AS x
      WHERE x.catalog_id = c.id
        AND x.access_group_id = g.id
  );

-- Пользователи вне группы NO не должны видеть ярлык после следующей синхронизации каталога.
DELETE FROM user_installed_apps AS ui
USING users AS u
LEFT JOIN app_access_groups AS g ON g.id = u.app_access_group_id
WHERE ui.app_id = 'app-site-studio'
  AND ui.user_id = u.id
  AND COALESCE(g.name, 'Default') <> 'NO';

COMMIT;
