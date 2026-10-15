-- Студия ГУ: каталог магазина + нормализация данных рабочего стола
-- (фронт уже мержит legacy в app-studio-gu при отображении; здесь — источник правды в БД.)
--
-- 1) Запись в desktop_app_catalog, чтобы приложение было в store и в user_installed_apps (FK).
-- 2) Дедупликация ярлыков: app-voice + app-voicecmd → один app-studio-gu на config.
-- 3) Перенос установок: кто имел legacy id — получает app-studio-gu.
-- 4) Опционально: app-transcription в каталоге, если строки ещё нет (частый случай «вижу на столе из default», но нет в catalog).

BEGIN;

-- Каталог: StudioGU
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
    'app-studio-gu',
    'Студия ГУ',
    'Голосовой диалог, штаб команд и Live Voice',
    'StudioGU',
    'productivity',
    'from-emerald-500 to-teal-600',
    'text-emerald-400',
    118,
    false
) ON CONFLICT (app_id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    app_component = EXCLUDED.app_component,
    category = EXCLUDED.category,
    gradient = EXCLUDED.gradient,
    color = EXCLUDED.color,
    sort_order = EXCLUDED.sort_order,
    updated_at = NOW();

-- Каталог: транскрипция (если ещё не заведена — не перетираем существующую запись)
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
    'app-transcription',
    'Транскрипция',
    'Расшифровка длинных аудио и видео',
    'AudioTranscriptionPro',
    'productivity',
    'from-violet-500 to-fuchsia-600',
    'text-violet-400',
    117,
    false
) ON CONFLICT (app_id) DO NOTHING;

-- Связь с дефолтной группой доступа (как в 20260326_desktop_catalog_access_groups_m2m.sql для остальных строк)
INSERT INTO desktop_app_catalog_access_groups (catalog_id, access_group_id)
SELECT c.id, 'a0000000-0000-4000-8000-000000000001'::uuid
FROM desktop_app_catalog c
WHERE c.app_id = 'app-studio-gu'
  AND NOT EXISTS (
      SELECT 1 FROM desktop_app_catalog_access_groups x
      WHERE x.catalog_id = c.id
        AND x.access_group_id = 'a0000000-0000-4000-8000-000000000001'::uuid
  );

INSERT INTO desktop_app_catalog_access_groups (catalog_id, access_group_id)
SELECT c.id, 'a0000000-0000-4000-8000-000000000001'::uuid
FROM desktop_app_catalog c
WHERE c.app_id = 'app-transcription'
  AND NOT EXISTS (
      SELECT 1 FROM desktop_app_catalog_access_groups x
      WHERE x.catalog_id = c.id
        AND x.access_group_id = 'a0000000-0000-4000-8000-000000000001'::uuid
  );

-- Убрать лишние ярлыки, если на одном столе остались оба legacy
DELETE FROM desktop_items d
USING (
    SELECT id
    FROM (
        SELECT id,
               ROW_NUMBER() OVER (
                   PARTITION BY config_id
                   ORDER BY
                     CASE item_id
                       WHEN 'app-voice' THEN 1
                       WHEN 'app-voicecmd' THEN 2
                       ELSE 3
                     END,
                     id
               ) AS rn
        FROM desktop_items
        WHERE item_type = 'APP'
          AND (
            item_id IN ('app-voice', 'app-voicecmd')
            OR app_component IN ('VoiceStudio', 'VoiceCommand')
          )
    ) ranked
    WHERE rn > 1
) del
WHERE d.id = del.id;

UPDATE desktop_items
SET
    item_id = 'app-studio-gu',
    app_component = 'StudioGU',
    name = 'Студия ГУ',
    updated_at = NOW()
WHERE item_type = 'APP'
  AND (
    item_id IN ('app-voice', 'app-voicecmd')
    OR app_component IN ('VoiceStudio', 'VoiceCommand')
  );

-- Установки: перенос на новый app_id
INSERT INTO user_installed_apps (user_id, app_id, installed_at)
SELECT DISTINCT uia.user_id, 'app-studio-gu', NOW()
FROM user_installed_apps uia
WHERE uia.app_id IN ('app-voice', 'app-voicecmd')
ON CONFLICT (user_id, app_id) DO NOTHING;

DELETE FROM user_desktop_app_entitlements
WHERE app_id IN ('app-voice', 'app-voicecmd');

DELETE FROM user_installed_apps
WHERE app_id IN ('app-voice', 'app-voicecmd');

DELETE FROM desktop_app_catalog WHERE app_id IN ('app-voice', 'app-voicecmd');

COMMIT;
