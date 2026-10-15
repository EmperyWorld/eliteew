-- Включить модули ИМК в маркетинговом кабинете для уже существующих проектов
-- (колонка projects.enabled_modules; фронт показывает раздел imc при slug imc или imc_research).

UPDATE projects
SET enabled_modules = ARRAY(
    SELECT DISTINCT module_name
    FROM unnest(
        COALESCE(enabled_modules, ARRAY[]::VARCHAR[])
        || ARRAY['imc', 'imc_research']::VARCHAR[]
    ) AS module_name
)
WHERE deleted_at IS NULL;
