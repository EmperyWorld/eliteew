-- Desktop AI Chat (Ollama) в магазине приложений: запись в desktop_app_catalog + дефолтная группа доступа.
-- Идемпотентно (ON CONFLICT), как 20260329_01_desktop_ensure_gaf_chat_catalog.sql.

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
    'app-desktop-ai-chat',
    'AI Чат (Ollama)',
    'Локальный AI: Ollama, RAG по чату и вложениям, опционально vault проекта для лида, инструменты, голос',
    'DesktopAiChatApp',
    'productivity',
    'from-violet-600 to-sky-600',
    'text-violet-300',
    141,
    false
) ON CONFLICT (app_id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    app_component = EXCLUDED.app_component,
    category = EXCLUDED.category,
    gradient = EXCLUDED.gradient,
    color = EXCLUDED.color,
    sort_order = EXCLUDED.sort_order,
    is_system = EXCLUDED.is_system,
    updated_at = NOW();

INSERT INTO desktop_app_catalog_access_groups (catalog_id, access_group_id)
SELECT c.id, 'a0000000-0000-4000-8000-000000000001'::uuid
FROM desktop_app_catalog c
WHERE c.app_id = 'app-desktop-ai-chat'
  AND NOT EXISTS (
      SELECT 1 FROM desktop_app_catalog_access_groups x
      WHERE x.catalog_id = c.id
        AND x.access_group_id = 'a0000000-0000-4000-8000-000000000001'::uuid
  );

COMMIT;
