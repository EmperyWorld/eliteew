-- App Store catalog descriptions rewrite (path A, 2026-09-13).
-- RU-first SSOT for desktop_app_catalog.description; mirrors locales/ru/appStore.json.
-- Agent authored EN; Gemma ui-ru authored RU. Idempotent UPDATEs by app_id.

BEGIN;

UPDATE desktop_app_catalog
SET
    description = 'Интерактивный тур по EliteEW: экосистема, приложения и возможности платформы.',
    updated_at = NOW()
WHERE app_id = 'app-about-project';

UPDATE desktop_app_catalog
SET
    description = 'Навигация по продукту: ответы на FAQ и чат, который поможет сориентироваться в EliteEW.',
    updated_at = NOW()
WHERE app_id = 'app-assistant';

UPDATE desktop_app_catalog
SET
    description = 'Ваши личные события в режиме месяца или недели — ваш календарь, а не план Ассистента.',
    updated_at = NOW()
WHERE app_id = 'app-calendar';

UPDATE desktop_app_catalog
SET
    description = 'Просматривайте библиотеку, ищите файлы по названию и открывайте документы и медиа без поиска по папкам.',
    updated_at = NOW()
WHERE app_id = 'app-content';

UPDATE desktop_app_catalog
SET
    description = 'Быстрый переход к самым нужным виджетам без поиска по рабочему столу.',
    updated_at = NOW()
WHERE app_id = 'app-dashboard-favorites';

UPDATE desktop_app_catalog
SET
    description = 'Общайтесь с экспертом, который помнит контекст и вложения. Закрепляйте проекты и инструменты для фокуса на главном.',
    updated_at = NOW()
WHERE app_id = 'app-desktop-ai-chat';

UPDATE desktop_app_catalog
SET
    description = 'Совместная работа с Ассистентом: импортируйте и экспортируйте файлы, когда нужно перенести работу.',
    updated_at = NOW()
WHERE app_id = 'app-doc-editor-v2';

UPDATE desktop_app_catalog
SET
    description = 'Создавайте документы с заголовками, списками и таблицами и работайте вместе с коллегами без потери нити обсуждения.',
    updated_at = NOW()
WHERE app_id = 'app-docs';

UPDATE desktop_app_catalog
SET
    description = 'Просмотр разрешенных HTTPS-сайтов внутри EliteEW с полным контролем навигации, камеры и звука.',
    updated_at = NOW()
WHERE app_id = 'app-ebrowser';

UPDATE desktop_app_catalog
SET
    description = 'Живая хроника мира EliteEW: слои истории и реальности, которые можно изучать прямо на рабочем столе.',
    updated_at = NOW()
WHERE app_id = 'app-empery-nexus-chronicle';

UPDATE desktop_app_catalog
SET
    description = 'Ваш постоянный рабочий помощник — спокойное общение и поддержка, когда вам нужен партнер.',
    updated_at = NOW()
WHERE app_id = 'app-ewa';

UPDATE desktop_app_catalog
SET
    description = 'Новости и объявления компании в одном месте, чтобы важные обновления не терялись в чатах.',
    updated_at = NOW()
WHERE app_id = 'app-ewdesk';

UPDATE desktop_app_catalog
SET
    description = 'Создавайте презентации из историй: редактируйте текст, подбирайте визуал и экспортируйте PDF для встреч.',
    updated_at = NOW()
WHERE app_id = 'app-ewrp';

UPDATE desktop_app_catalog
SET
    description = 'Делитесь идеями, пожеланиями и сообщениями об ошибках, чтобы продукт становился лучше.',
    updated_at = NOW()
WHERE app_id = 'app-feedback-hub';

UPDATE desktop_app_catalog
SET
    description = 'Приватные чаты с друзьями: сообщения, история, уведомления и быстрый переход — без лишнего шума групп.',
    updated_at = NOW()
WHERE app_id = 'app-gaf-chat';

UPDATE desktop_app_catalog
SET
    description = 'Опишите желаемое изображение или измените готовое короткой инструкцией — создавайте контент в одной студии.',
    updated_at = NOW()
WHERE app_id = 'app-image-studio';

UPDATE desktop_app_catalog
SET
    description = 'Управление сайтом проекта: выбирайте шаблоны, публикуйте и предоставляйте клиентам чистый интерфейс без доступа к вашему столу.',
    updated_at = NOW()
WHERE app_id = 'app-kirs';

UPDATE desktop_app_catalog
SET
    description = 'Просмотр витрины проекта через KIRS — безопасный гостевой доступ к опубликованному сайту.',
    updated_at = NOW()
WHERE app_id = 'app-kirs-client-site';

UPDATE desktop_app_catalog
SET
    description = 'Исследователь, который ищет по вашим материалам и в сети, собирает улики и отвечает на вопросы дела.',
    updated_at = NOW()
WHERE app_id = 'app-kursorina';

UPDATE desktop_app_catalog
SET
    description = 'Запуск локальных сервисов в отдельном окне внутри рабочего стола.',
    updated_at = NOW()
WHERE app_id = 'app-local-service';

UPDATE desktop_app_catalog
SET
    description = 'От идеи до проекта: позиционирование, доказательства и оракулы в одном кабинете — без разрозненных таблиц.',
    updated_at = NOW()
WHERE app_id = 'app-marketing-cabinet';

UPDATE desktop_app_catalog
SET
    description = 'Опишите песню, которую вы представляете: студия создаст текст, стиль и готовый трек без лишних черновиков.',
    updated_at = NOW()
WHERE app_id = 'app-music-forge';

UPDATE desktop_app_catalog
SET
    description = 'Воспроизводите аудио из вашей библиотеки и папок: управление треками без поиска файлов.',
    updated_at = NOW()
WHERE app_id = 'app-music-player';

UPDATE desktop_app_catalog
SET
    description = 'Единый центр истории уведомлений, фильтров и звуковых настроек для мессенджеров и студий.',
    updated_at = NOW()
WHERE app_id = 'app-notifications';

UPDATE desktop_app_catalog
SET
    description = 'Бизнес-карта Зои: смыслы, план на 90 дней, прибыль, опыт и следующие шаги — всё на одном экране.',
    updated_at = NOW()
WHERE app_id = 'app-poemma';

UPDATE desktop_app_catalog
SET
    description = 'Профессиональное рабочее пространство: профиль, обучение, объекты, клиенты и умные подсказки.',
    updated_at = NOW()
WHERE app_id = 'app-professional-worlds';

UPDATE desktop_app_catalog
SET
    description = 'Панель управления сайтами: готовность сервиса, задачи, домены, проверка публикации и журнал событий.',
    updated_at = NOW()
WHERE app_id = 'app-site-manager-ops';

UPDATE desktop_app_catalog
SET
    description = 'Создавайте и публикуйте персональные сайты: контент, магазин, админка и безопасный гостевой режим.',
    updated_at = NOW()
WHERE app_id = 'app-site-studio';

UPDATE desktop_app_catalog
SET
    description = 'Запросы в друзья, контакты, круги общения, приватность и мобильное приложение — единая точка входа в соцсети.',
    updated_at = NOW()
WHERE app_id = 'app-social-hub';

UPDATE desktop_app_catalog
SET
    description = 'Просматривайте каталог, устанавливайте нужное и удаляйте лишнее — не покидая рабочий стол.',
    updated_at = NOW()
WHERE app_id = 'app-store';

UPDATE desktop_app_catalog
SET
    description = 'Голосовое общение, командный центр, живой голос и перевод аудио в текст — всё в одном окне студии.',
    updated_at = NOW()
WHERE app_id = 'app-studio-gu';

UPDATE desktop_app_catalog
SET
    description = 'Проходите интерактивные опросы и получайте награды за участие.',
    updated_at = NOW()
WHERE app_id = 'app-survey-hub';

UPDATE desktop_app_catalog
SET
    description = 'Создавайте и управляйте генерацией изображений в студии. Отслеживайте задачи и историю в UGS Hub.',
    updated_at = NOW()
WHERE app_id = 'app-ugs';

UPDATE desktop_app_catalog
SET
    description = 'Активные задачи, прошлые запуски и очередь генерации — всё в одном удобном месте.',
    updated_at = NOW()
WHERE app_id = 'app-ugs-hub';

UPDATE desktop_app_catalog
SET
    description = 'Начинайте видеозвонки внутри сервиса: камера и микрофон всегда под рукой.',
    updated_at = NOW()
WHERE app_id = 'app-video-call';

UPDATE desktop_app_catalog
SET
    description = 'Превращайте статичные кадры в короткие видеоролики без переключения между инструментами.',
    updated_at = NOW()
WHERE app_id = 'app-video-studio';

UPDATE desktop_app_catalog
SET
    description = 'Заметки и списки задач на рабочем столе для быстрого доступа.',
    updated_at = NOW()
WHERE app_id = 'app-widget-shelf';

UPDATE desktop_app_catalog
SET
    description = 'Настраивайте темы, обои, иконки, окна и производительность, чтобы рабочий стол стал вашим.',
    updated_at = NOW()
WHERE app_id = 'desktop-shell-settings';

UPDATE desktop_app_catalog
SET
    description = 'История буфера обмена, чтобы быстро вставить скопированное, не возвращаясь к источнику.',
    updated_at = NOW()
WHERE app_id = 'widget-clipboard';

COMMIT;
