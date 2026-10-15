-- Магазин приложений: содержательные описания на русском (без имён внешних движков, моделей и стека).

BEGIN;

UPDATE desktop_app_catalog
SET
    description = 'Создавайте иллюстрации в привычном интерфейсе студии. Адрес подключается в настройках — работайте в одном окне, не переключаясь между сервисами.',
    updated_at = NOW()
WHERE app_id = 'app-comfyui';

UPDATE desktop_app_catalog
SET
    description = 'Обходите библиотеку файлов, ищите по имени и открывайте нужное за пару кликов — всё важное остаётся под рукой.',
    updated_at = NOW()
WHERE app_id = 'app-content';

UPDATE desktop_app_catalog
SET
    description = 'Компании и проекты, где вы назначены представителем заказчика: материалы, согласования и контекст договора — в одном кабинете.',
    updated_at = NOW()
WHERE app_id = 'app-customer-cabinet';

UPDATE desktop_app_catalog
SET
    description = 'Диалог с ассистентом в привычном чате: память по переписке и вложениям, при желании отдельное хранилище проекта, инструменты и голос — без лишних вкладок.',
    updated_at = NOW()
WHERE app_id = 'app-desktop-ai-chat';

UPDATE desktop_app_catalog
SET
    description = 'Документы с заголовками, списками и таблицами: пишите вместе с коллегами и держите правки под контролем.',
    updated_at = NOW()
WHERE app_id = 'app-docs';

UPDATE desktop_app_catalog
SET
    description = 'Презентации из шаблона лендинга: текст, иллюстрации и нарезка слайдов в PDF — готово к показу и отправке.',
    updated_at = NOW()
WHERE app_id = 'app-ewrp';

UPDATE desktop_app_catalog
SET
    description = 'Личные переписки с друзьями один на один — спокойный чат без лишнего шума.',
    updated_at = NOW()
WHERE app_id = 'app-gaf-chat';

UPDATE desktop_app_catalog
SET
    description = 'Опишите картинку словами или уточните уже созданное по инструкции — от идеи до готового кадра в одной студии.',
    updated_at = NOW()
WHERE app_id = 'app-image-studio';

UPDATE desktop_app_catalog
SET
    description = 'Компания, проекты, исследования рынка и отчёты в одном контуре. Обсудите гипотезы с ассистентом и зафиксируйте выводы для команды.',
    updated_at = NOW()
WHERE app_id = 'app-marketing-cabinet';

UPDATE desktop_app_catalog
SET
    description = 'Текст песни и музыкальное сопровождение в одном месте: от наброска строк до прослушивания результата.',
    updated_at = NOW()
WHERE app_id = 'app-music-generator';

UPDATE desktop_app_catalog
SET
    description = 'Плейлисты из вашей библиотеки: папка «Музыка» и всё остальное аудио — запуск и перемотка без лишних шагов.',
    updated_at = NOW()
WHERE app_id = 'app-music-player';

UPDATE desktop_app_catalog
SET
    description = 'Публикуйте локальный сайт, настраивайте админку и показывайте гостям отдельную версию — без доступа к вашему рабочему столу.',
    updated_at = NOW()
WHERE app_id = 'app-site-studio';

UPDATE desktop_app_catalog
SET
    description = 'Друзья, заявки, круги общения и профиль — всё для связи и самопрезентации в одном окне.',
    updated_at = NOW()
WHERE app_id = 'app-social-hub';

UPDATE desktop_app_catalog
SET
    description = 'Устанавливайте и убирайте приложения рабочего стола, смотрите категории и описания — прозрачный каталог без сюрпризов.',
    updated_at = NOW()
WHERE app_id = 'app-store';

UPDATE desktop_app_catalog
SET
    description = 'Голосовой диалог, штаб команд и работа с медиа рядом — удобно для живых сессий и совместной работы.',
    updated_at = NOW()
WHERE app_id = 'app-studio-gu';

UPDATE desktop_app_catalog
SET
    description = 'Сценарии генерации, очередь и история задач: полная консоль студии, чтобы ничего не потерять между запусками.',
    updated_at = NOW()
WHERE app_id = 'app-ugs';

UPDATE desktop_app_catalog
SET
    description = 'Хаб студии: что выполняется сейчас, что в очереди и что уже готово — обзор без прыжков по экранам.',
    updated_at = NOW()
WHERE app_id = 'app-ugs-hub';

UPDATE desktop_app_catalog
SET
    description = 'Соберите короткий ролик из исходного кадра: покадровая смена картинки, чтобы оживить задумку в одной студии.',
    updated_at = NOW()
WHERE app_id = 'app-video-studio';

UPDATE desktop_app_catalog
SET
    description = 'История буфера обмена с текстом и изображениями: верните любой недавний фрагмент одним кликом.',
    updated_at = NOW()
WHERE app_id = 'widget-clipboard';

UPDATE desktop_app_catalog
SET
    description = 'Процессор, память и диски на виджете — сразу видно, не упирается ли система в потолок.',
    updated_at = NOW()
WHERE app_id = 'widget-sysmonitor';

COMMIT;
