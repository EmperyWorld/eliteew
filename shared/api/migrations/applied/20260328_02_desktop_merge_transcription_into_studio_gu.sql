-- Транскрипция: отдельное приложение убрано — ярлыки и установки → Студия ГУ (app-studio-gu / StudioGU).

BEGIN;

-- Дедупликация: если на столе были и транскрипция, и Студия ГУ
DELETE FROM desktop_items d
USING (
    SELECT id
    FROM (
        SELECT id,
               ROW_NUMBER() OVER (
                   PARTITION BY config_id
                   ORDER BY
                     CASE item_id
                       WHEN 'app-transcription' THEN 1
                       WHEN 'app-studio-gu' THEN 2
                       ELSE 3
                     END,
                     id
               ) AS rn
        FROM desktop_items
        WHERE item_type = 'APP'
          AND (
            item_id = 'app-transcription'
            OR app_component = 'AudioTranscriptionPro'
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
    item_id = 'app-transcription'
    OR app_component = 'AudioTranscriptionPro'
  );

INSERT INTO user_installed_apps (user_id, app_id, installed_at)
SELECT DISTINCT uia.user_id, 'app-studio-gu', NOW()
FROM user_installed_apps uia
WHERE uia.app_id = 'app-transcription'
ON CONFLICT (user_id, app_id) DO NOTHING;

DELETE FROM user_desktop_app_entitlements
WHERE app_id = 'app-transcription';

DELETE FROM user_installed_apps
WHERE app_id = 'app-transcription';

DELETE FROM desktop_app_catalog WHERE app_id = 'app-transcription';

COMMIT;
