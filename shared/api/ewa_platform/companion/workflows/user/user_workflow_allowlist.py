# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Allowlisted atomic tools end-users may place in personal action workflows.
# Invariants:
# - Destructive file ops require confirm gates in validated definitions.
# Related:
# - api/ewa_platform/companion/workflows/user/user_workflow_validation.py
# ---

from __future__ import annotations

from typing import Any, Final

USER_WORKFLOW_MAX_STEPS: Final[int] = 6

USER_WORKFLOW_INLINE_DAG_NODE_TYPES: Final[frozenset[str]] = frozenset(
    {
        "prompt_gen",
        "logic_filter",
        "confirm_gate",
        "delay",
        "decision",
        "switch",
        "print_log",
        "for_each",
        "data_transformer",
    }
)

USER_WORKFLOW_ALLOWED_TOOLS: Final[frozenset[str]] = frozenset(
    {
        "music_generation",
        "music_generation_xl_base",
        "music_studio_open",
        "image_generation",
        "presentation_generation",
        "file_create",
        "file_save_text",
        "file_open",
        "file_rename",
        "file_delete",
        "doc_insert",
        "app_open",
        "theme_set",
        "catalog_list",
        "catalog_discuss",
        "social_post_compose",
        "operations_status",
        "recall_memory",
        "file_rewrite",
        "paperless_import",
        "telegram_sender",
        "email_dispatcher",
        "vision_analyze",
        "llm_summarize",
        "llm_classify",
        "pdf_parser",
        "document_extractor",
        "plan_v1",
        "plan_task_complete_v1",
        "check_task_status",
        "operation_cancel",
    }
)

USER_WORKFLOW_TOOLS_REQUIRING_CONFIRM: Final[frozenset[str]] = frozenset(
    {
        "file_create",
        "file_save_text",
        "file_delete",
        "file_rename",
        "file_rewrite",
        "operation_cancel",
        "telegram_sender",
        "email_dispatcher",
    }
)

USER_WORKFLOW_ASYNC_TOOLS: Final[frozenset[str]] = frozenset(
    {
        "music_generation",
        "music_generation_xl_base",
        "image_generation",
        "presentation_generation",
    }
)

# Optional ``args_template`` keys per tool (builder + server-side sanitization).
USER_WORKFLOW_TOOL_ARG_KEYS: Final[dict[str, frozenset[str]]] = {
    "music_generation": frozenset(
        {"theme", "genre", "style", "lyrics", "language", "vocal", "autoplay", "play_when_ready"}
    ),
    "music_generation_xl_base": frozenset({"mood", "style", "genre", "language", "vocal", "autoplay"}),
    "music_studio_open": frozenset(),
    "image_generation": frozenset({"prompt", "aspect_ratio", "image_tool_mode", "source_unified_content_id"}),
    "presentation_generation": frozenset({"topic", "title", "num_slides", "presentation_theme", "extra_context"}),
    "paperless_import": frozenset({"paperless_id"}),
    "telegram_sender": frozenset({"message_text", "text", "reply", "chat_id"}),
    "email_dispatcher": frozenset({"to", "subject", "body", "text", "reply", "html"}),
    "vision_analyze": frozenset(
        {"image_url", "attachment_id", "prompt", "question", "data_base64", "mime_type", "user_line"}
    ),
    "llm_summarize": frozenset({"text", "body", "reply", "prompt", "instruction", "user_line"}),
    "llm_classify": frozenset({"text", "body", "reply", "categories", "labels", "rules", "contains", "user_line"}),
    "pdf_parser": frozenset(
        {"unified_content_id", "document_id", "paperless_id", "filename", "mime_type", "file_base64", "user_line"}
    ),
    "document_extractor": frozenset(
        {"unified_content_id", "document_id", "paperless_id", "filename", "mime_type", "file_base64", "user_line"}
    ),
    "file_create": frozenset({"name", "body"}),
    "file_save_text": frozenset({"name", "body", "text"}),
    "file_open": frozenset({"file_query", "unified_content_id"}),
    "file_rename": frozenset({"rename_old_query", "rename_new_name"}),
    "file_delete": frozenset({"delete_file_query"}),
    "doc_insert": frozenset({"source_file_query"}),
    "app_open": frozenset({"app_component"}),
    "theme_set": frozenset({"theme", "accent"}),
    "catalog_list": frozenset({"mode"}),
    "catalog_discuss": frozenset({"file_query"}),
    "social_post_compose": frozenset({"brief", "channel", "file_query"}),
    "operations_status": frozenset(),
    "recall_memory": frozenset(),
    "file_rewrite": frozenset({"file_query", "rewrite_brief", "open_editor"}),
    "plan_v1": frozenset({"plan_focus", "horizon"}),
    "plan_task_complete_v1": frozenset({"task_hint"}),
    "check_task_status": frozenset({"run_id", "task_id"}),
    "operation_cancel": frozenset({"run_id", "task_id"}),
}

_SOCIAL_CHANNEL_OPTIONS: tuple[dict[str, str], ...] = (
    {"value": "", "label_ru": "По умолчанию", "label_en": "Default"},
    {"value": "telegram", "label_ru": "Telegram", "label_en": "Telegram"},
    {"value": "vk", "label_ru": "VK", "label_en": "VK"},
    {"value": "linkedin", "label_ru": "LinkedIn", "label_en": "LinkedIn"},
    {"value": "blog", "label_ru": "Блог / лонгрид", "label_en": "Blog / longread"},
)

_PLAN_HORIZON_OPTIONS: tuple[dict[str, str], ...] = (
    {"value": "", "label_ru": "Без срока", "label_en": "No horizon"},
    {"value": "неделю", "label_ru": "На неделю", "label_en": "One week"},
    {"value": "2 недели", "label_ru": "На 2 недели", "label_en": "Two weeks"},
    {"value": "месяц", "label_ru": "На месяц", "label_en": "One month"},
)

_OPEN_EDITOR_OPTIONS: tuple[dict[str, str], ...] = (
    {"value": "", "label_ru": "Не открывать", "label_en": "Do not open"},
    {"value": "1", "label_ru": "Открыть в редакторе", "label_en": "Open in editor"},
)

_APP_OPTIONS: tuple[dict[str, str], ...] = (
    {"value": "MusicGenerator", "label_ru": "Студия записи", "label_en": "Music Studio"},
    {"value": "DocEditor", "label_ru": "Редактор документов", "label_en": "Doc Editor"},
    {"value": "ContentManagerPro", "label_ru": "Менеджер файлов", "label_en": "File Manager"},
    {"value": "ImageStudio", "label_ru": "Студия изображений", "label_en": "Image Studio"},
    {"value": "MusicPlayer", "label_ru": "Музыкальный плеер", "label_en": "Music Player"},
    {"value": "DesktopShellSettings", "label_ru": "Настройки стола", "label_en": "Desktop Settings"},
    {"value": "EWDeskApp", "label_ru": "EWDesk", "label_en": "EWDesk"},
    {"value": "VideoStudio", "label_ru": "Видеостудия", "label_en": "Video Studio"},
)

_THEME_OPTIONS: tuple[dict[str, str], ...] = (
    {"value": "dark", "label_ru": "Тёмная", "label_en": "Dark"},
    {"value": "light", "label_ru": "Светлая", "label_en": "Light"},
    {"value": "auto", "label_ru": "Как в системе", "label_en": "System"},
)

_ASPECT_OPTIONS: tuple[dict[str, str], ...] = (
    {"value": "1:1", "label_ru": "Квадрат 1:1", "label_en": "Square 1:1"},
    {"value": "16:9", "label_ru": "Широкий 16:9", "label_en": "Wide 16:9"},
    {"value": "9:16", "label_ru": "Вертикальный 9:16", "label_en": "Portrait 9:16"},
)

_IMAGE_TOOL_MODE_OPTIONS: tuple[dict[str, str], ...] = (
    {"value": "", "label_ru": "Новая картинка", "label_en": "Generate new"},
    {"value": "edit", "label_ru": "Редактировать файл", "label_en": "Edit existing file"},
)

_PRESENTATION_THEME_OPTIONS: tuple[dict[str, str], ...] = (
    {"value": "", "label_ru": "По умолчанию (aurora)", "label_en": "Default (aurora)"},
    {"value": "aurora", "label_ru": "Aurora", "label_en": "Aurora"},
    {"value": "classic", "label_ru": "Classic", "label_en": "Classic"},
    {"value": "midnight", "label_ru": "Midnight", "label_en": "Midnight"},
    {"value": "ember", "label_ru": "Ember", "label_en": "Ember"},
    {"value": "paper", "label_ru": "Paper", "label_en": "Paper"},
)

_CATALOG_MODE_OPTIONS: tuple[dict[str, str], ...] = (
    {"value": "list", "label_ru": "Список файлов", "label_en": "File list"},
    {"value": "search", "label_ru": "Поиск по имени", "label_en": "Search by name"},
)

USER_WORKFLOW_TOOL_RECOMMENDED_ARGS: Final[dict[str, frozenset[str]]] = {
    "app_open": frozenset({"app_component"}),
    "file_create": frozenset({"name"}),
    "file_save_text": frozenset({"name", "body"}),
    "image_generation": frozenset({"prompt"}),
    "presentation_generation": frozenset({"topic"}),
    "file_open": frozenset({"file_query"}),
    "file_rename": frozenset({"rename_old_query", "rename_new_name"}),
    "file_delete": frozenset({"delete_file_query"}),
    "catalog_discuss": frozenset({"file_query"}),
    "doc_insert": frozenset({"source_file_query"}),
    "social_post_compose": frozenset({"brief"}),
    "file_rewrite": frozenset({"file_query", "rewrite_brief"}),
    "plan_v1": frozenset({"plan_focus"}),
    "plan_task_complete_v1": frozenset({"task_hint"}),
    "check_task_status": frozenset({"run_id"}),
    "operation_cancel": frozenset({"run_id"}),
    "paperless_import": frozenset({"paperless_id"}),
    "telegram_sender": frozenset({"message_text"}),
    "email_dispatcher": frozenset({"to", "subject", "body"}),
    "vision_analyze": frozenset({"prompt"}),
    "llm_summarize": frozenset({"text"}),
    "llm_classify": frozenset({"text", "categories"}),
    "pdf_parser": frozenset({"unified_content_id"}),
    "document_extractor": frozenset({"unified_content_id"}),
}

# Required args block Save / run when empty (placeholders {{…}} count as filled).
USER_WORKFLOW_TOOL_REQUIRED_ARGS: Final[dict[str, frozenset[str]]] = {
    "catalog_discuss": frozenset({"file_query"}),
    "file_open": frozenset({"file_query"}),
    "file_delete": frozenset({"delete_file_query"}),
    "file_rename": frozenset({"rename_old_query", "rename_new_name"}),
    "file_rewrite": frozenset({"file_query", "rewrite_brief"}),
    "file_save_text": frozenset({"name", "body"}),
    "plan_v1": frozenset({"plan_focus"}),
    "presentation_generation": frozenset({"topic"}),
    "image_generation": frozenset({"prompt"}),
    "social_post_compose": frozenset({"brief"}),
    "plan_task_complete_v1": frozenset({"task_hint"}),
    "check_task_status": frozenset({"run_id"}),
}

USER_WORKFLOW_TOOL_CATALOG: Final[tuple[dict[str, Any], ...]] = (
    {
        "name": "music_studio_open",
        "title_ru": "Открыть студию записи",
        "title_en": "Open Music Studio",
        "description_ru": "Открывает приложение «Студия записи» на рабочем столе.",
        "description_en": "Opens the Music Studio desktop app.",
        "async_step": False,
        "requires_confirm": False,
        "fields": [],
    },
    {
        "name": "music_generation",
        "title_ru": "Запись песни",
        "title_en": "Song recording",
        "description_ru": "Полный цикл генерации трека (текст, стиль, рендер). Долго — идёт в фоне.",
        "description_en": "Full track generation pipeline (lyrics, style, render). Runs in the background.",
        "async_step": True,
        "requires_confirm": False,
        "fields": [
            {
                "key": "theme",
                "type": "text",
                "label_ru": "Тема / настроение",
                "label_en": "Theme / mood",
                "placeholder_ru": "например: утренний lo-fi",
                "placeholder_en": "e.g. morning lo-fi",
            },
            {
                "key": "genre",
                "type": "text",
                "label_ru": "Жанр",
                "label_en": "Genre",
                "placeholder_ru": "pop, rock, electronic…",
                "placeholder_en": "pop, rock, electronic…",
            },
            {
                "key": "style",
                "type": "text",
                "label_ru": "Стиль звучания",
                "label_en": "Production style",
            },
            {
                "key": "autoplay",
                "type": "select",
                "label_ru": "Автовоспроизведение",
                "label_en": "Autoplay when ready",
                "options": (
                    {"value": "", "label_ru": "По умолчанию", "label_en": "Default"},
                    {"value": "1", "label_ru": "Да", "label_en": "Yes"},
                    {"value": "0", "label_ru": "Нет", "label_en": "No"},
                ),
            },
        ],
    },
    {
        "name": "music_generation_xl_base",
        "title_ru": "Песня по настроению (XL)",
        "title_en": "Mood song (XL)",
        "description_ru": "Ассистент сам подберёт текст и стиль из диалога и памяти.",
        "description_en": "Companion derives lyrics and style from chat mood and memory.",
        "async_step": True,
        "requires_confirm": False,
        "fields": [
            {
                "key": "mood",
                "type": "text",
                "label_ru": "Настроение",
                "label_en": "Mood",
                "placeholder_ru": "спокойная, энергичная…",
                "placeholder_en": "calm, energetic…",
            },
            {
                "key": "style",
                "type": "text",
                "label_ru": "Стиль",
                "label_en": "Style",
            },
        ],
    },
    {
        "name": "image_generation",
        "title_ru": "Картинка",
        "title_en": "Image",
        "description_ru": "Генерация изображения по описанию. Долго — идёт в фоне.",
        "description_en": "Generate an image from a prompt. Runs in the background.",
        "async_step": True,
        "requires_confirm": False,
        "fields": [
            {
                "key": "prompt",
                "type": "textarea",
                "label_ru": "Описание картинки",
                "label_en": "Image prompt",
                "placeholder_ru": "закат над городом в акварели",
                "placeholder_en": "sunset over a city in watercolor",
            },
            {
                "key": "aspect_ratio",
                "type": "select",
                "label_ru": "Формат",
                "label_en": "Aspect ratio",
                "options": _ASPECT_OPTIONS,
            },
            {
                "key": "image_tool_mode",
                "type": "select",
                "label_ru": "Режим",
                "label_en": "Mode",
                "options": _IMAGE_TOOL_MODE_OPTIONS,
            },
            {
                "key": "source_unified_content_id",
                "type": "text",
                "label_ru": "Исходная картинка (ID)",
                "label_en": "Source image (ID)",
                "placeholder_ru": "для режима «Редактировать»",
                "placeholder_en": "for Edit mode",
            },
        ],
    },
    {
        "name": "presentation_generation",
        "title_ru": "Презентация",
        "title_en": "Presentation",
        "description_ru": "Фоновая генерация презентации в EWRP.",
        "description_en": "Background presentation generation via EWRP.",
        "async_step": True,
        "requires_confirm": False,
        "fields": [
            {
                "key": "topic",
                "type": "text",
                "label_ru": "Тема",
                "label_en": "Topic",
                "placeholder_ru": "например: запуск продукта",
                "placeholder_en": "e.g. product launch",
            },
            {
                "key": "title",
                "type": "text",
                "label_ru": "Заголовок",
                "label_en": "Title",
            },
            {
                "key": "num_slides",
                "type": "text",
                "label_ru": "Количество слайдов",
                "label_en": "Slides",
            },
            {
                "key": "presentation_theme",
                "type": "select",
                "label_ru": "Тема оформления",
                "label_en": "Visual theme",
                "options": _PRESENTATION_THEME_OPTIONS,
            },
            {
                "key": "extra_context",
                "type": "textarea",
                "label_ru": "Доп. контекст",
                "label_en": "Extra context",
                "placeholder_ru": "аудитория, тон, ограничения…",
                "placeholder_en": "audience, tone, constraints…",
            },
        ],
    },
    {
        "name": "file_create",
        "title_ru": "Создать файл",
        "title_en": "Create file",
        "description_ru": "Новый документ в каталоге EwaFile. Перед записью спросит подтверждение.",
        "description_en": "New document in the EwaFile catalog. Asks for confirmation first.",
        "async_step": False,
        "requires_confirm": True,
        "fields": [
            {
                "key": "name",
                "type": "text",
                "label_ru": "Имя файла",
                "label_en": "File name",
                "placeholder_ru": "notes.md",
                "placeholder_en": "notes.md",
            },
            {
                "key": "body",
                "type": "textarea",
                "label_ru": "Содержимое",
                "label_en": "Body",
            },
        ],
    },
    {
        "name": "file_save_text",
        "title_ru": "Сохранить текст в файл",
        "title_en": "Save text to file",
        "description_ru": "Записать готовый текст (например, ответ прошлого шага) в новый .md в каталоге. С подтверждением.",
        "description_en": "Write ready text (e.g. a prior step reply) into a new .md in the catalog. Requires confirmation.",
        "async_step": False,
        "requires_confirm": True,
        "fields": [
            {
                "key": "name",
                "type": "text",
                "label_ru": "Имя файла",
                "label_en": "File name",
                "placeholder_ru": "summary.md",
                "placeholder_en": "summary.md",
            },
            {
                "key": "body",
                "type": "textarea",
                "label_ru": "Текст",
                "label_en": "Text body",
                "placeholder_ru": "{{steps.0.output.reply}}",
                "placeholder_en": "{{steps.0.output.reply}}",
            },
        ],
    },
    {
        "name": "file_open",
        "title_ru": "Открыть файл",
        "title_en": "Open file",
        "description_ru": "Открыть документ из каталога в редакторе.",
        "description_en": "Open a catalog document in the editor.",
        "async_step": False,
        "requires_confirm": False,
        "fields": [
            {
                "key": "file_query",
                "type": "text",
                "label_ru": "Имя или часть имени",
                "label_en": "File name or fragment",
                "placeholder_ru": "report.md",
                "placeholder_en": "report.md",
            },
        ],
    },
    {
        "name": "file_rename",
        "title_ru": "Переименовать файл",
        "title_en": "Rename file",
        "description_ru": "Переименование файла в каталоге EwaFile (с подтверждением).",
        "description_en": "Rename a file in EwaFile catalog (requires confirmation).",
        "async_step": False,
        "requires_confirm": True,
        "fields": [
            {
                "key": "rename_old_query",
                "type": "text",
                "label_ru": "Какой файл",
                "label_en": "Source file",
            },
            {
                "key": "rename_new_name",
                "type": "text",
                "label_ru": "Новое имя",
                "label_en": "New name",
            },
        ],
    },
    {
        "name": "file_delete",
        "title_ru": "Удалить файл",
        "title_en": "Delete file",
        "description_ru": "Удаление файла из каталога EwaFile (с подтверждением).",
        "description_en": "Delete a file from EwaFile catalog (requires confirmation).",
        "async_step": False,
        "requires_confirm": True,
        "fields": [
            {
                "key": "delete_file_query",
                "type": "text",
                "label_ru": "Файл для удаления",
                "label_en": "File to delete",
            },
        ],
    },
    {
        "name": "doc_insert",
        "title_ru": "Вставить в редактор",
        "title_en": "Insert into editor",
        "description_ru": "Вставить фрагмент из другого файла в открытый документ.",
        "description_en": "Insert a fragment from another file into the open document.",
        "async_step": False,
        "requires_confirm": False,
        "fields": [
            {
                "key": "source_file_query",
                "type": "text",
                "label_ru": "Исходный файл",
                "label_en": "Source file",
            },
        ],
    },
    {
        "name": "app_open",
        "title_ru": "Открыть приложение",
        "title_en": "Open app",
        "description_ru": "Запуск приложения на рабочем столе.",
        "description_en": "Launch a desktop app.",
        "async_step": False,
        "requires_confirm": False,
        "fields": [
            {
                "key": "app_component",
                "type": "select",
                "label_ru": "Приложение",
                "label_en": "Application",
                "options": _APP_OPTIONS,
            },
        ],
    },
    {
        "name": "theme_set",
        "title_ru": "Сменить тему",
        "title_en": "Change theme",
        "description_ru": "Переключить светлую/тёмную тему рабочего стола.",
        "description_en": "Switch desktop light/dark theme.",
        "async_step": False,
        "requires_confirm": False,
        "fields": [
            {
                "key": "theme",
                "type": "select",
                "label_ru": "Тема",
                "label_en": "Theme",
                "options": _THEME_OPTIONS,
            },
            {
                "key": "accent",
                "type": "text",
                "label_ru": "Акцент (опционально)",
                "label_en": "Accent (optional)",
            },
        ],
    },
    {
        "name": "catalog_list",
        "title_ru": "Список файлов",
        "title_en": "File catalog",
        "description_ru": "Показать или найти файлы в каталоге EwaFile.",
        "description_en": "Browse or search files in the EwaFile catalog.",
        "async_step": False,
        "requires_confirm": False,
        "fields": [
            {
                "key": "mode",
                "type": "select",
                "label_ru": "Режим",
                "label_en": "Mode",
                "options": _CATALOG_MODE_OPTIONS,
            },
        ],
    },
    {
        "name": "catalog_discuss",
        "title_ru": "Обсудить файл",
        "title_en": "Discuss file",
        "description_ru": "Прочитать файл и добавить его в контекст диалога.",
        "description_en": "Read a file and inject it into chat context for discussion.",
        "async_step": False,
        "requires_confirm": False,
        "fields": [
            {
                "key": "file_query",
                "type": "text",
                "label_ru": "Имя файла",
                "label_en": "File name",
            },
        ],
    },
    {
        "name": "social_post_compose",
        "title_ru": "Текст поста / лонгрид",
        "title_en": "Post / longread text",
        "description_ru": "Сгенерировать готовый пост или лонгрид по теме (можно указать площадку).",
        "description_en": "Generate a ready-to-publish post or longread from a topic (optional channel).",
        "async_step": False,
        "requires_confirm": False,
        "fields": [
            {
                "key": "brief",
                "type": "textarea",
                "label_ru": "Тема / тезисы",
                "label_en": "Topic / brief",
                "placeholder_ru": "например: итоги недели для команды",
                "placeholder_en": "e.g. weekly team recap",
            },
            {
                "key": "channel",
                "type": "select",
                "label_ru": "Площадка",
                "label_en": "Channel",
                "options": _SOCIAL_CHANNEL_OPTIONS,
            },
            {
                "key": "file_query",
                "type": "text",
                "label_ru": "Файл-источник (опционально)",
                "label_en": "Source file (optional)",
            },
        ],
    },
    {
        "name": "operations_status",
        "title_ru": "Статус операций",
        "title_en": "Operations status",
        "description_ru": "Показать активные фоновые задачи Ассистента (генерации, цепочки).",
        "description_en": "Show active Assistant background tasks (generations, chains).",
        "async_step": False,
        "requires_confirm": False,
        "fields": [],
    },
    {
        "name": "recall_memory",
        "title_ru": "Контекст памяти",
        "title_en": "Memory context",
        "description_ru": "Кратко напомнить, что Ассистент помнит о пользователе и умеет делать.",
        "description_en": "Summarize what the Assistant remembers and can do.",
        "async_step": False,
        "requires_confirm": False,
        "fields": [],
    },
    {
        "name": "file_rewrite",
        "title_ru": "Переписать файл",
        "title_en": "Rewrite file",
        "description_ru": "Полная перезапись содержимого файла в каталоге по инструкции (с подтверждением).",
        "description_en": "Full rewrite of a catalog file from an instruction (requires confirmation).",
        "async_step": False,
        "requires_confirm": True,
        "fields": [
            {
                "key": "file_query",
                "type": "text",
                "label_ru": "Файл",
                "label_en": "File",
                "placeholder_ru": "notes.md",
                "placeholder_en": "notes.md",
            },
            {
                "key": "rewrite_brief",
                "type": "textarea",
                "label_ru": "Инструкция",
                "label_en": "Instruction",
                "placeholder_ru": "сделай краткое резюме в 5 пунктах",
                "placeholder_en": "turn into a 5-bullet summary",
            },
            {
                "key": "open_editor",
                "type": "select",
                "label_ru": "После сохранения",
                "label_en": "After save",
                "options": _OPEN_EDITOR_OPTIONS,
            },
        ],
    },
    {
        "name": "plan_task_complete_v1",
        "title_ru": "Отметить шаг плана",
        "title_en": "Complete plan task",
        "description_ru": "Отмечает задачу активного плана выполненной по названию шага.",
        "description_en": "Marks an active plan task complete by step title hint.",
        "async_step": False,
        "requires_confirm": False,
        "fields": [
            {
                "key": "task_hint",
                "type": "text",
                "label_ru": "Название шага",
                "label_en": "Task title hint",
                "placeholder_ru": "часть названия задачи из плана",
                "placeholder_en": "fragment of the plan task title",
            },
        ],
    },
    {
        "name": "check_task_status",
        "title_ru": "Статус операции",
        "title_en": "Operation status",
        "description_ru": "Проверяет статус фоновой операции по run_id (например, после async-шага).",
        "description_en": "Checks background operation status by run_id (e.g. after an async step).",
        "async_step": False,
        "requires_confirm": False,
        "fields": [
            {
                "key": "run_id",
                "type": "text",
                "label_ru": "ID операции (run_id)",
                "label_en": "Operation ID (run_id)",
                "placeholder_ru": "{{steps.0.output.task_run_id}}",
                "placeholder_en": "{{steps.0.output.task_run_id}}",
            },
        ],
    },
    {
        "name": "operation_cancel",
        "title_ru": "Отменить операцию",
        "title_en": "Cancel operation",
        "description_ru": "Экстренная отмена фоновой операции по run_id. Требует подтверждения.",
        "description_en": "Emergency cancel of a background operation by run_id. Requires confirmation.",
        "async_step": False,
        "requires_confirm": True,
        "fields": [
            {
                "key": "run_id",
                "type": "text",
                "label_ru": "ID операции (run_id)",
                "label_en": "Operation ID (run_id)",
            },
        ],
    },
    {
        "name": "plan_v1",
        "title_ru": "План на сервере",
        "title_en": "Server plan",
        "description_ru": "Составить и сохранить план с целями и задачами в EWA.",
        "description_en": "Build and persist a goals/tasks plan in EWA.",
        "async_step": False,
        "requires_confirm": False,
        "fields": [
            {
                "key": "plan_focus",
                "type": "textarea",
                "label_ru": "Фокус плана",
                "label_en": "Plan focus",
                "placeholder_ru": "запуск фичи companion plans за 2 недели",
                "placeholder_en": "ship companion plans feature in two weeks",
            },
            {
                "key": "horizon",
                "type": "select",
                "label_ru": "Горизонт",
                "label_en": "Horizon",
                "options": _PLAN_HORIZON_OPTIONS,
            },
        ],
    },
    {
        "name": "paperless_import",
        "title_ru": "Импорт из Paperless",
        "title_en": "Import from Paperless",
        "description_ru": "Подтянуть документ из архива Paperless-ngx в каталог / редактор.",
        "description_en": "Pull a document from Paperless-ngx into the catalog / editor.",
        "async_step": False,
        "requires_confirm": False,
        "fields": [
            {
                "key": "paperless_id",
                "type": "text",
                "label_ru": "ID в Paperless",
                "label_en": "Paperless ID",
                "placeholder_ru": "например: 42",
                "placeholder_en": "e.g. 42",
            },
        ],
    },
    {
        "name": "pdf_parser",
        "title_ru": "Текст из PDF",
        "title_en": "Extract PDF text",
        "description_ru": "Извлечь текст из PDF (Tika / OCR). Укажите файл каталога или вложение.",
        "description_en": "Extract text from a PDF (Tika / OCR). Point at a catalog file or attachment.",
        "async_step": False,
        "requires_confirm": False,
        "fields": [
            {
                "key": "unified_content_id",
                "type": "text",
                "label_ru": "ID файла в каталоге",
                "label_en": "Catalog file ID",
            },
            {
                "key": "filename",
                "type": "text",
                "label_ru": "Имя файла (подсказка)",
                "label_en": "Filename hint",
            },
        ],
    },
    {
        "name": "document_extractor",
        "title_ru": "Текст из DOCX/TXT",
        "title_en": "Extract DOCX/TXT",
        "description_ru": "Извлечь текст из DOCX или TXT через Stack4 Tika.",
        "description_en": "Extract text from DOCX or TXT via Stack4 Tika.",
        "async_step": False,
        "requires_confirm": False,
        "fields": [
            {
                "key": "unified_content_id",
                "type": "text",
                "label_ru": "ID файла в каталоге",
                "label_en": "Catalog file ID",
            },
            {
                "key": "filename",
                "type": "text",
                "label_ru": "Имя файла (подсказка)",
                "label_en": "Filename hint",
            },
        ],
    },
    {
        "name": "llm_summarize",
        "title_ru": "Сжать текст",
        "title_en": "Summarize text",
        "description_ru": "Краткое резюме длинного текста (можно подставить вывод предыдущего шага).",
        "description_en": "Summarize long text (can wire prior-step output).",
        "async_step": False,
        "requires_confirm": False,
        "fields": [
            {
                "key": "text",
                "type": "textarea",
                "label_ru": "Текст",
                "label_en": "Text",
                "placeholder_ru": "{{steps.0.output.reply}}",
                "placeholder_en": "{{steps.0.output.reply}}",
            },
            {
                "key": "instruction",
                "type": "text",
                "label_ru": "Инструкция (опционально)",
                "label_en": "Instruction (optional)",
                "placeholder_ru": "кратко для команды, 5 буллетов",
                "placeholder_en": "short for the team, 5 bullets",
            },
        ],
    },
    {
        "name": "llm_classify",
        "title_ru": "Классифицировать текст",
        "title_en": "Classify text",
        "description_ru": "Отнести текст к одной из категорий (метки через запятую).",
        "description_en": "Assign text to one of the given categories (comma-separated labels).",
        "async_step": False,
        "requires_confirm": False,
        "fields": [
            {
                "key": "text",
                "type": "textarea",
                "label_ru": "Текст",
                "label_en": "Text",
            },
            {
                "key": "categories",
                "type": "text",
                "label_ru": "Категории",
                "label_en": "Categories",
                "placeholder_ru": "срочно, обычное, архив",
                "placeholder_en": "urgent, normal, archive",
            },
        ],
    },
    {
        "name": "vision_analyze",
        "title_ru": "Разобрать изображение",
        "title_en": "Analyze image",
        "description_ru": "Описание / OCR / ответ по картинке (vision pipeline).",
        "description_en": "Describe / OCR / answer about an image (vision pipeline).",
        "async_step": False,
        "requires_confirm": False,
        "fields": [
            {
                "key": "prompt",
                "type": "textarea",
                "label_ru": "Вопрос к картинке",
                "label_en": "Question about the image",
                "placeholder_ru": "что на скриншоте? выдели ключевые цифры",
                "placeholder_en": "what is on the screenshot? list key numbers",
            },
            {
                "key": "attachment_id",
                "type": "text",
                "label_ru": "ID вложения (если есть)",
                "label_en": "Attachment ID (if any)",
            },
            {
                "key": "image_url",
                "type": "text",
                "label_ru": "URL изображения",
                "label_en": "Image URL",
            },
        ],
    },
    {
        "name": "telegram_sender",
        "title_ru": "Отправить в Telegram",
        "title_en": "Send to Telegram",
        "description_ru": "Исходящее сообщение в Telegram. Обычно ставьте шаг подтверждения перед ним.",
        "description_en": "Outbound Telegram message. Usually place a confirm gate before this step.",
        "async_step": False,
        "requires_confirm": True,
        "fields": [
            {
                "key": "message_text",
                "type": "textarea",
                "label_ru": "Текст сообщения",
                "label_en": "Message text",
                "placeholder_ru": "{{steps.0.output.reply}}",
                "placeholder_en": "{{steps.0.output.reply}}",
            },
            {
                "key": "chat_id",
                "type": "text",
                "label_ru": "Chat ID (опционально)",
                "label_en": "Chat ID (optional)",
            },
        ],
    },
    {
        "name": "email_dispatcher",
        "title_ru": "Отправить email",
        "title_en": "Send email",
        "description_ru": "Письмо через SMTP оператора. Обычно ставьте шаг подтверждения перед ним.",
        "description_en": "Email via operator SMTP. Usually place a confirm gate before this step.",
        "async_step": False,
        "requires_confirm": True,
        "fields": [
            {
                "key": "to",
                "type": "text",
                "label_ru": "Кому",
                "label_en": "To",
                "placeholder_ru": "team@example.com",
                "placeholder_en": "team@example.com",
            },
            {
                "key": "subject",
                "type": "text",
                "label_ru": "Тема",
                "label_en": "Subject",
            },
            {
                "key": "body",
                "type": "textarea",
                "label_ru": "Текст письма",
                "label_en": "Body",
                "placeholder_ru": "{{steps.0.output.reply}}",
                "placeholder_en": "{{steps.0.output.reply}}",
            },
        ],
    },
)


def sanitize_user_workflow_args(tool_name: str, args: dict[str, Any] | None) -> dict[str, Any]:
    """Keep only allowlisted arg keys for ``tool_name``; drop empty strings."""

    allowed = USER_WORKFLOW_TOOL_ARG_KEYS.get(tool_name, frozenset())
    if not allowed:
        return {}
    out: dict[str, Any] = {}
    for key, value in (args or {}).items():
        if key not in allowed:
            continue
        if value is None:
            continue
        if isinstance(value, str) and not value.strip():
            continue
        out[key] = value.strip() if isinstance(value, str) else value
    return out


__all__ = (
    "USER_WORKFLOW_ALLOWED_TOOLS",
    "USER_WORKFLOW_ASYNC_TOOLS",
    "USER_WORKFLOW_INLINE_DAG_NODE_TYPES",
    "USER_WORKFLOW_MAX_STEPS",
    "USER_WORKFLOW_TOOL_ARG_KEYS",
    "USER_WORKFLOW_TOOL_CATALOG",
    "USER_WORKFLOW_TOOL_RECOMMENDED_ARGS",
    "USER_WORKFLOW_TOOL_REQUIRED_ARGS",
    "USER_WORKFLOW_TOOLS_REQUIRING_CONFIRM",
    "sanitize_user_workflow_args",
)
