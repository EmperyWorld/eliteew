-- Магазин приложений: заполнение и выравнивание описаний (нейтральный продуктовый текст, без имён внешних движков).

BEGIN;

-- ComfyUI убран из отображаемого названия; описание без вендоров.
UPDATE desktop_app_catalog
SET
    name = 'Веб-студия изображений',
    description = 'Внешняя студия генерации изображений: открывается по ссылке из настроек.',
    updated_at = NOW()
WHERE app_id = 'app-comfyui';

UPDATE desktop_app_catalog
SET
    description = 'Просмотр, поиск и операции с файлами библиотеки.',
    updated_at = NOW()
WHERE app_id = 'app-content';

UPDATE desktop_app_catalog
SET
    description = 'Кабинет заказчика: компании и проекты, где вы назначены представителем.',
    updated_at = NOW()
WHERE app_id = 'app-customer-cabinet';

UPDATE desktop_app_catalog
SET
    description = 'Редактор документов: оформление текста, таблицы и совместная работа.',
    updated_at = NOW()
WHERE app_id = 'app-docs';

UPDATE desktop_app_catalog
SET
    description = 'Личные чаты с друзьями один на один.',
    updated_at = NOW()
WHERE app_id = 'app-gaf-chat';

UPDATE desktop_app_catalog
SET
    description = 'Маркетинговый кабинет: компания, проекты, исследования, отчёты и чат с ассистентом.',
    updated_at = NOW()
WHERE app_id = 'app-marketing-cabinet';

UPDATE desktop_app_catalog
SET
    description = 'Музыка из папки «Музыка» и всего аудио библиотеки.',
    updated_at = NOW()
WHERE app_id = 'app-music-player';

UPDATE desktop_app_catalog
SET
    description = 'Локальный сайт: публикация, админка и отдельный показ для гостей.',
    updated_at = NOW()
WHERE app_id = 'app-site-studio';

UPDATE desktop_app_catalog
SET
    description = 'Друзья, заявки, круги общения и профиль в одном окне.',
    updated_at = NOW()
WHERE app_id = 'app-social-hub';

UPDATE desktop_app_catalog
SET
    description = 'Каталог приложений рабочего стола: установка и удаление.',
    updated_at = NOW()
WHERE app_id = 'app-store';

UPDATE desktop_app_catalog
SET
    description = 'Голосовой диалог, штаб команд, живой голос и работа с медиа.',
    updated_at = NOW()
WHERE app_id = 'app-studio-gu';

UPDATE desktop_app_catalog
SET
    description = 'Консоль студии генерации: сценарии, очередь и история задач.',
    updated_at = NOW()
WHERE app_id = 'app-ugs';

UPDATE desktop_app_catalog
SET
    description = 'История буфера обмена: текст, изображения и быстрый возврат.',
    updated_at = NOW()
WHERE app_id = 'widget-clipboard';

UPDATE desktop_app_catalog
SET
    description = 'Нагрузка на процессор, память и диски в виджете на рабочем столе.',
    updated_at = NOW()
WHERE app_id = 'widget-sysmonitor';

COMMIT;
