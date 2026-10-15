-- Магазин приложений: выверенные описания (польза, сценарии, тон; без вендоров и моделей).

BEGIN;

UPDATE desktop_app_catalog
SET
    description = 'Рисуйте и собирайте композицию в привычном окне студии. Адрес подключается в настройках один раз — дальше всё остаётся здесь, без скачков между вкладками и внешними страницами.',
    updated_at = NOW()
WHERE app_id = 'app-comfyui';

UPDATE desktop_app_catalog
SET
    description = 'Обходите библиотеку файлов, находите нужное по имени и открывайте документы и медиа без лишних шагов. Всё, что лежит в хранилище, остаётся на расстоянии пары кликов.',
    updated_at = NOW()
WHERE app_id = 'app-content';

UPDATE desktop_app_catalog
SET
    description = 'Когда вы представляете заказчика, важна одна цельная картина: какие компании и проекты за вами, что на согласовании и где договорённости. Здесь это собрано вместе — меньше писем в духе «напомни, где мы остановились».',
    updated_at = NOW()
WHERE app_id = 'app-customer-cabinet';

UPDATE desktop_app_catalog
SET
    description = 'Диалог с ассистентом, который помнит контекст переписки и вложения. При желании выделите проект отдельным хранилищем, подключите инструменты и голос — ведите разговор без распыления внимания по десяти вкладкам.',
    updated_at = NOW()
WHERE app_id = 'app-desktop-ai-chat';

UPDATE desktop_app_catalog
SET
    description = 'Оформляйте текст заголовками, списками и таблицами и пишите вместе с коллегами: правки видны в контексте, нить документа не теряется между версиями.',
    updated_at = NOW()
WHERE app_id = 'app-docs';

UPDATE desktop_app_catalog
SET
    description = 'Соберите презентацию на базе лендинга: допишите текст, подберите иллюстрации, получите слайды в PDF. Удобно показать экран на встрече или отправить файл тем, кто подключился позже.',
    updated_at = NOW()
WHERE app_id = 'app-ewrp';

UPDATE desktop_app_catalog
SET
    description = 'Личные переписки с друзьями один на один — спокойный чат без лент, групп и лишнего шума от остального.',
    updated_at = NOW()
WHERE app_id = 'app-gaf-chat';

UPDATE desktop_app_catalog
SET
    description = 'Сформулируйте образ словами или уточните уже готовый кадр по заметке — студия ведёт от запроса к результату, чтобы вы не собирали референсы по кускам в разных местах.',
    updated_at = NOW()
WHERE app_id = 'app-image-studio';

UPDATE desktop_app_catalog
SET
    description = 'Маркетинговый контур: компания, проекты, исследования и отчёты в одной цепочке. Сверьте гипотезы с ассистентом и оформите выводы так, чтобы команде было с чем идти в планирование — без разрозненных таблиц и потерянных заметок.',
    updated_at = NOW()
WHERE app_id = 'app-marketing-cabinet';

UPDATE desktop_app_catalog
SET
    description = 'Напишите строки песни и получите музыкальное сопровождение под настроение — от черновика текста до прослушивания трека в одном рабочем пространстве.',
    updated_at = NOW()
WHERE app_id = 'app-music-generator';

UPDATE desktop_app_catalog
SET
    description = 'Ваша музыка из библиотеки: в первую очередь папка «Музыка», плюс всё остальное аудио под рукой. Запуск, пауза и перемотка — без долгого поиска «где это лежало».',
    updated_at = NOW()
WHERE app_id = 'app-music-player';

UPDATE desktop_app_catalog
SET
    description = 'Опубликуйте свой сайт, настройте админку и откройте гостям отдельный режим просмотра: они видят витрину и контент, не заходя в ваш личный рабочий стол и приватные приложения.',
    updated_at = NOW()
WHERE app_id = 'app-site-studio';

UPDATE desktop_app_catalog
SET
    description = 'Друзья, входящие заявки, круги по интересам и профиль — единая точка входа в социальный слой, чтобы не прыгать между экранами ради одного ответа.',
    updated_at = NOW()
WHERE app_id = 'app-social-hub';

UPDATE desktop_app_catalog
SET
    description = 'Выбирайте приложения для рабочего стола по категориям и описаниям, ставьте и убирайте то, что вам нужно. Каталог понятный: видно, что ставится и зачем, без скрытых сюрпризов.',
    updated_at = NOW()
WHERE app_id = 'app-store';

UPDATE desktop_app_catalog
SET
    description = 'Голосовой диалог, координация в штабе команд и медиа рядом — когда важно говорить, показывать и договариваться в одном ритме, не собирая половину встречи из разных окон.',
    updated_at = NOW()
WHERE app_id = 'app-studio-gu';

UPDATE desktop_app_catalog
SET
    description = 'Запускайте сценарии генерации, следите за очередью и возвращайтесь к истории задач. Консоль студии держит всё последовательно, чтобы между сеансами ничего не выпало из виду.',
    updated_at = NOW()
WHERE app_id = 'app-ugs';

UPDATE desktop_app_catalog
SET
    description = 'Обзорный экран студии: что выполняется сейчас, что ждёт очереди и что уже готово к просмотру — без ручного сбора статусов из разных углов интерфейса.',
    updated_at = NOW()
WHERE app_id = 'app-ugs-hub';

UPDATE desktop_app_catalog
SET
    description = 'Возьмите один сильный кадр и разверните из него короткий ролик: покадровая смена картинки, чтобы задумка ожила в движении, оставаясь в одной студии.',
    updated_at = NOW()
WHERE app_id = 'app-video-studio';

UPDATE desktop_app_catalog
SET
    description = 'Буфер обмена с памятью: скопированный текст и картинки не пропадают сразу. Выберите нужный фрагмент из списка и вставьте снова — без переделки работы с нуля.',
    updated_at = NOW()
WHERE app_id = 'widget-clipboard';

UPDATE desktop_app_catalog
SET
    description = 'Компактный снимок нагрузки: процессор, память и диски на виджете рабочего стола. В тяжёлый момент сразу видно, упирается ли система в потолок или узкое место в конкретном приложении.',
    updated_at = NOW()
WHERE app_id = 'widget-sysmonitor';

COMMIT;
