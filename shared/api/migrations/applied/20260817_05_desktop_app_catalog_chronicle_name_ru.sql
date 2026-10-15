-- Empery Nexus Chronicle: RU user-facing catalog name «Хроника» (offline subset label).

BEGIN;

UPDATE desktop_app_catalog
SET
    name = 'Хроника',
    description = 'Живая хроника экосистемы: Abyss, Nexus и слои реальности EliteEW',
    updated_at = NOW()
WHERE app_id = 'app-empery-nexus-chronicle'
  AND name IN ('Empery Nexus', 'Empery Nexus Chronicle');

COMMIT;
