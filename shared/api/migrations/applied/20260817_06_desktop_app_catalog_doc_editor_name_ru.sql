-- DocEditor v1 catalog: «Редактор документов» (consistent sentence case).

BEGIN;

UPDATE desktop_app_catalog
SET
    name = 'Редактор документов',
    updated_at = NOW()
WHERE app_id = 'app-docs'
  AND name IN ('Редактор Документов', 'Doc Editor', 'Ultimate Doc Editor');

COMMIT;
