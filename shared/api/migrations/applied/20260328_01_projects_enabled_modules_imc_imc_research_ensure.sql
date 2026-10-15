-- Гарантировать в projects.enabled_modules оба slug: imc и imc_research (идемпотентно).
-- Если 20260327_01 не применялась или вручную удалили один из ключей — после apply снова появятся оба.

BEGIN;

UPDATE projects
SET enabled_modules = ARRAY(
    SELECT DISTINCT module_name
    FROM unnest(
        COALESCE(enabled_modules, ARRAY[]::VARCHAR[])
        || ARRAY['imc', 'imc_research']::VARCHAR[]
    ) AS module_name
)
WHERE deleted_at IS NULL;

COMMIT;
