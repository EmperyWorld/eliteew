-- Магазин приложений: нейтральные описания без имён внешних движков (Ollama, ComfyUI и т.п.).

BEGIN;

UPDATE desktop_app_catalog
SET
    name = 'AI Чат',
    description = 'Диалог с локальной моделью: память по переписке и вложениям, опциональное хранилище проекта, инструменты и голос.',
    updated_at = NOW()
WHERE app_id = 'app-desktop-ai-chat';

UPDATE desktop_app_catalog
SET
    description = 'Генерация изображений по тексту и правки по инструкции в студии.',
    updated_at = NOW()
WHERE app_id = 'app-image-studio';

UPDATE desktop_app_catalog
SET
    description = 'Сборка видео из исходного кадра — покадровая анимация в студии.',
    updated_at = NOW()
WHERE app_id = 'app-video-studio';

UPDATE desktop_app_catalog
SET
    description = 'Презентации: шаблон лендинга, текст и иллюстрации, скриншоты слайдов в PDF.',
    updated_at = NOW()
WHERE app_id = 'app-ewrp';

UPDATE desktop_app_catalog
SET
    description = 'Друзья, заявки и сценарии общения между пользователями.',
    updated_at = NOW()
WHERE app_id = 'app-friends';

UPDATE desktop_app_catalog
SET
    description = 'Активные задачи, история и очередь генераций в хабе студии.',
    updated_at = NOW()
WHERE app_id = 'app-ugs-hub';

COMMIT;
