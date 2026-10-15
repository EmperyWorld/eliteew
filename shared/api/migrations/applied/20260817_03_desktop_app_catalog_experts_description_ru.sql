-- Experts (app-desktop-ai-chat): user-facing catalog description — «эксперт», not «ассистент».

BEGIN;

UPDATE desktop_app_catalog
SET
    description = 'Диалог с экспертом, который помнит контекст переписки и вложения. При желании выделите проект отдельным хранилищем, подключите инструменты и голос — ведите разговор без распыления внимания по десяти вкладкам.',
    updated_at = NOW()
WHERE app_id = 'app-desktop-ai-chat'
  AND (
    description ILIKE '%ассистент%'
    OR description ILIKE '%assistant%'
    OR description = 'Команда экспертов: ensemble, вложения, память, проектный контекст, умные действия и голос'
  );

COMMIT;
