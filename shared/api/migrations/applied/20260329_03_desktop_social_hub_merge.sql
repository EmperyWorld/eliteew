-- Merge desktop apps «Друзья» + «Профиль» into one «Social hub» (SocialHubApp / app-social-hub).

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
    'app-social-hub',
    'Social hub',
    'Друзья и профиль: заявки, круги, настройки и карточка в одном окне',
    'SocialHubApp',
    'communication',
    'from-emerald-500 to-cyan-600',
    'text-emerald-400',
    136,
    false
) ON CONFLICT (app_id) DO NOTHING;

INSERT INTO desktop_app_catalog_access_groups (catalog_id, access_group_id)
SELECT c.id, 'a0000000-0000-4000-8000-000000000001'::uuid
FROM desktop_app_catalog c
WHERE c.app_id = 'app-social-hub'
  AND NOT EXISTS (
      SELECT 1 FROM desktop_app_catalog_access_groups x
      WHERE x.catalog_id = c.id
  );

-- Dedupe: if both legacy icons exist for same desktop, keep one.
DELETE FROM desktop_items d
USING (
    SELECT id FROM (
        SELECT id,
               ROW_NUMBER() OVER (
                   PARTITION BY config_id
                   ORDER BY CASE item_id WHEN 'app-friends' THEN 1 WHEN 'app-user-profile' THEN 2 ELSE 3 END,
                            id
               ) AS rn
        FROM desktop_items
        WHERE item_type = 'APP'
          AND item_id IN ('app-friends', 'app-user-profile')
    ) ranked
    WHERE rn > 1
) del
WHERE d.id = del.id;

UPDATE desktop_items
SET
    item_id = 'app-social-hub',
    app_component = 'SocialHubApp',
    name = 'Social hub',
    updated_at = NOW()
WHERE item_type = 'APP'
  AND (
    item_id IN ('app-friends', 'app-user-profile')
    OR app_component IN ('FriendsApp', 'UserProfile')
  );

INSERT INTO user_installed_apps (user_id, app_id, installed_at)
SELECT DISTINCT uia.user_id, 'app-social-hub', NOW()
FROM user_installed_apps uia
WHERE uia.app_id IN ('app-friends', 'app-user-profile')
ON CONFLICT (user_id, app_id) DO NOTHING;

DELETE FROM user_installed_apps WHERE app_id IN ('app-friends', 'app-user-profile');

DELETE FROM desktop_app_catalog WHERE app_id IN ('app-friends', 'app-user-profile');

COMMIT;
