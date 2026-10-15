-- Включить раздел «С заказчиком» в маркетинговом кабинете для уже существующих проектов.

UPDATE projects
SET enabled_modules = ARRAY(
    SELECT DISTINCT module_name
    FROM unnest(
        COALESCE(enabled_modules, ARRAY[]::VARCHAR[])
        || ARRAY['client_interaction']::VARCHAR[]
    ) AS module_name
)
WHERE deleted_at IS NULL;
