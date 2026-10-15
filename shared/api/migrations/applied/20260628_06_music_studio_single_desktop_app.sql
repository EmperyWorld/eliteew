-- Single user-facing song studio on desktop: MusicForge as «Студия песен».
-- Legacy MusicGenerator / Music Evolution icons stay in DB but leave factory defaults.

BEGIN;

UPDATE desktop_app_catalog
SET
    name = 'Студия песен',
    description = 'Опишите идею — студия сама соберёт текст, стиль и готовый трек',
    is_factory = true,
    is_featured_new = true,
    updated_at = NOW()
WHERE app_id = 'app-music-forge';

UPDATE desktop_app_catalog
SET
    is_factory = false,
    is_featured_new = false,
    updated_at = NOW()
WHERE app_id IN ('app-music-generator', 'app-music-evolution');

COMMIT;
