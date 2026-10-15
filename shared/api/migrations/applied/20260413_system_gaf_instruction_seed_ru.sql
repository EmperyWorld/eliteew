-- Default Russian onboarding text for system GAF (only if row still empty).
-- Requires system_gaf_instruction from 20260412_system_gaf_onboarding.sql.

UPDATE system_gaf_instruction
SET
    welcome_text = 'Добро пожаловать в EliteEW!',
    thanks_text = 'Спасибо, что вы с нами. Ниже — короткие шаги, с чего начать.',
    steps = $seed$[
        {
            "title": "Профиль и аватар",
            "body": "В Social hub откройте вкладку «Профиль»: отображаемое имя и аватар.",
            "open_app_component": "SocialHubApp",
            "button_label": "Открыть Social hub"
        },
        {
            "title": "Оформление рабочего стола",
            "body": "Правый клик по рабочему столу → «Параметры» — обои, тема, размер значков и панель задач.",
            "open_app_component": null
        },
        {
            "title": "Файлы и контент",
            "body": "Content Manager — загрузка файлов, папки и работа с материалами.",
            "open_app_component": "ContentManagerPro",
            "button_label": "Content Manager"
        },
        {
            "title": "Генерации и очередь",
            "body": "UGS Хаб — активные задачи, история и очередь генераций.",
            "open_app_component": "UGSHubApp",
            "button_label": "UGS Хаб"
        },
        {
            "title": "Чаты",
            "body": "GAF Chat — личные переписки 1:1 и уведомления.",
            "open_app_component": "GAFChatApp",
            "button_label": "GAF Chat"
        },
        {
            "title": "Приложения",
            "body": "Магазин приложений — установка и удаление приложений на рабочем столе.",
            "open_app_component": "AppStore",
            "button_label": "Магазин приложений"
        }
    ]$seed$::jsonb,
    updated_at = NOW()
WHERE locale = 'ru'
  AND welcome_text = ''
  AND thanks_text = ''
  AND steps = '[]'::jsonb;
