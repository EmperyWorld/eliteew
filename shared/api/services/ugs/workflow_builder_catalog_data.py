#!/usr/bin/env python3
# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Legacy workflow builder constants and generation node catalog data for UGS WorkflowService.
# Invariants:
# - Child module of WorkflowService decomposition; must not import workflow_service.
# Related:
# - api/services/ugs/workflow_service.py
# ---

from typing import Any

LEGACY_EXECUTABLE_NODE_TYPES = {
    "input",
    "output",
    "generation",
    "condition",
    "transform",
    "section",
    "constant",
    "merge",
    "delay",
    "split",
    "pick",
    "wrap",
    "json_encode",
    "json_decode",
    "text_case",
    "text_join",
}
LEGACY_GENERATION_TYPE_MAP = {
    "text_to_image": "image_generation_comfyui",
    "text_generation": "text_chat_response",
    "chat_completion": "text_chat_response",
    "llama_summarize": "text_chat_response",
    "llama_translate": "text_chat_response",
    "llama_rewrite": "text_chat_response",
    "llama_key_points": "text_chat_response",
    "llama_sentiment": "text_chat_response",
    "llama_table_md": "text_chat_response",
    "llama_expand": "text_chat_response",
    "llama_simplify": "text_chat_response",
    "llama_proofread": "text_chat_response",
    "llama_title": "text_chat_response",
    "llama_keywords": "text_chat_response",
    "llama_list_numbered": "text_chat_response",
    "llama_paraphrase": "text_chat_response",
    "llama_formal": "text_chat_response",
    "llama_casual": "text_chat_response",
    "llama_sql": "text_chat_response",
    "llama_regex": "text_chat_response",
    "llama_commit": "text_chat_response",
    "llama_yaml": "text_chat_response",
    "llama_brainstorm": "text_chat_response",
    "llama_risks": "text_chat_response",
    "llama_shorten": "text_chat_response",
    "llama_jtbd": "text_chat_response",
    "llama_swot": "text_chat_response",
    "llama_personas": "text_chat_response",
    "llama_tams": "text_chat_response",
    "text_to_speech": "audio_generation_tts",
    "speech_to_text": "audio_transcription_faster_whisper",
}
LEGACY_CONDITION_OPERATORS = {
    "exists",
    "not_exists",
    "equals",
    "not_equals",
    "contains",
    "greater_than",
    "less_than",
    "not_empty",
    "empty",
}
LEGACY_TRANSFORM_TYPES = {
    "passthrough",
    "extract_key",
    "template",
    "to_text",
    "json_stringify",
    "json_parse",
    "trim",
    "upper",
    "lower",
}
BUILDER_CONTRACT_VERSION = "legacy-v2"

LEGACY_GENERATION_NODE_CATALOG: dict[str, dict[str, Any]] = {
    "text_to_image": {
        "label": "Текст в изображение",
        "description": "Генерация изображения по текстовому prompt.",
        "category": "generation.image",
        "icon_key": "image",
        "accent_color": "#3b82f6",
        "inputs": ["prompt", "negative_prompt"],
        "outputs": ["images"],
    },
    "image_to_image": {
        "label": "Изображение в изображение",
        "description": "Трансформация входного изображения по prompt.",
        "category": "generation.image",
        "icon_key": "image",
        "accent_color": "#8b5cf6",
        "inputs": ["image", "prompt"],
        "outputs": ["images"],
    },
    "text_generation": {
        "label": "Генерация текста",
        "description": "Текстовый ответ по prompt и системным инструкциям.",
        "category": "generation.text",
        "icon_key": "file-text",
        "accent_color": "#10b981",
        "inputs": ["prompt", "system_prompt"],
        "outputs": ["text"],
    },
    "speech_to_text": {
        "label": "Речь в текст",
        "description": "Транскрибация аудио в текст.",
        "category": "generation.audio",
        "icon_key": "volume-2",
        "accent_color": "#f59e0b",
        "inputs": ["audio_file"],
        "outputs": ["transcription"],
    },
    "text_to_speech": {
        "label": "Текст в речь",
        "description": "Синтез речи из текста.",
        "category": "generation.audio",
        "icon_key": "volume-2",
        "accent_color": "#ef4444",
        "inputs": ["text", "voice"],
        "outputs": ["audio"],
    },
    "vision_analysis": {
        "label": "Анализ изображения",
        "description": "Анализ визуального контента и извлечение описания.",
        "category": "generation.vision",
        "icon_key": "eye",
        "accent_color": "#6366f1",
        "inputs": ["image", "prompt"],
        "outputs": ["analysis"],
    },
    "chat_completion": {
        "label": "Чат-ответ",
        "description": "Ответ по истории сообщений.",
        "category": "generation.chat",
        "icon_key": "message-square",
        "accent_color": "#06b6d4",
        "inputs": ["messages"],
        "outputs": ["response"],
    },
    "llama_summarize": {
        "label": "Llama: краткое содержание",
        "description": "Сжимает входной текст в короткое резюме (Llama / UGS).",
        "category": "generation.text",
        "icon_key": "align-left",
        "accent_color": "#34d399",
        "inputs": ["prompt"],
        "outputs": ["text"],
        "default_config": {
            "system_prompt": (
                "Ты помощник для суммаризации. По тексту пользователя сделай краткое содержание "
                "на русском: только главные факты и выводы, без воды, 3–7 предложений. "
                "Не добавляй вступлений вроде «Вот кратко»."
            ),
            "options": {"temperature": 0.35, "num_predict": 2000},
        },
    },
    "llama_translate": {
        "label": "Llama: перевод",
        "description": "Переводит текст на язык из поля «Целевой язык» (Llama).",
        "category": "generation.text",
        "icon_key": "languages",
        "accent_color": "#38bdf8",
        "inputs": ["prompt"],
        "outputs": ["text"],
        "default_config": {
            "system_prompt": (
                "Ты профессиональный переводчик. Переведи текст пользователя на язык, "
                "указанный в инструкции ниже (целевой язык). Сохраняй смысл и тон. "
                "Ответь только переводом, без комментариев и без исходного текста."
            ),
            "target_language": "English",
            "options": {"temperature": 0.25, "num_predict": 4096},
        },
    },
    "llama_rewrite": {
        "label": "Llama: переписать текст",
        "description": "Улучшает формулировки, ясность и стиль (Llama).",
        "category": "generation.text",
        "icon_key": "wand",
        "accent_color": "#a855f7",
        "inputs": ["prompt"],
        "outputs": ["text"],
        "default_config": {
            "system_prompt": (
                "Ты редактор. Перепиши текст пользователя на русском языке: исправь ошибки, "
                "сделай формулировки яснее и легче читать, сохрани смысл и факты. "
                "Ответь одним цельным текстом без пояснений."
            ),
            "options": {"temperature": 0.45, "num_predict": 4096},
        },
    },
    "llama_key_points": {
        "label": "Llama: тезисы",
        "description": "Список ключевых пунктов по тексту (Llama).",
        "category": "generation.text",
        "icon_key": "list-ordered",
        "accent_color": "#fbbf24",
        "inputs": ["prompt"],
        "outputs": ["text"],
        "default_config": {
            "system_prompt": (
                "Из текста пользователя извлеки 5–12 ключевых тезисов. Формат: маркированный список "
                "на русском, каждый пункт — одна короткая строка. Без вступления и заключения."
            ),
            "options": {"temperature": 0.3, "num_predict": 2000},
        },
    },
    "llama_sentiment": {
        "label": "Llama: тональность",
        "description": "Оценка тональности (плюс краткое пояснение) через Llama.",
        "category": "generation.text",
        "icon_key": "gauge",
        "accent_color": "#fb7185",
        "inputs": ["prompt"],
        "outputs": ["text"],
        "default_config": {
            "system_prompt": (
                "Определи тональность текста пользователя: положительная, нейтральная или отрицательная. "
                "Ответь строго в формате: первая строка — одно слово: positive / neutral / negative; "
                "вторая строка — одно короткое предложение-пояснение на русском."
            ),
            "options": {"temperature": 0.15, "num_predict": 256},
        },
    },
    "llama_table_md": {
        "label": "Llama: таблица (Markdown)",
        "description": "Преобразует текст или список в таблицу Markdown (Llama).",
        "category": "generation.text",
        "icon_key": "table",
        "accent_color": "#2dd4bf",
        "inputs": ["prompt"],
        "outputs": ["text"],
        "default_config": {
            "system_prompt": (
                "По данным пользователя построй одну таблицу в формате GitHub Markdown "
                "(строка заголовков |---| и строки данных). Заголовки колонок — на русском. "
                "Только таблица, без пояснений до и после."
            ),
            "options": {"temperature": 0.25, "num_predict": 3000},
        },
    },
    "llama_expand": {
        "label": "Llama: развернуть",
        "description": "Расширяет черновик в связный текст (Llama).",
        "category": "generation.text",
        "icon_key": "text-cursor",
        "accent_color": "#94a3b8",
        "inputs": ["prompt"],
        "outputs": ["text"],
        "default_config": {
            "system_prompt": (
                "Разверни набросок пользователя в связный текст на русском языке: добавь логичные детали "
                "и переходы, не выдумывай факты, которых нет во входе. Объём примерно в 2–4 раза больше исходного."
            ),
            "options": {"temperature": 0.55, "num_predict": 4096},
        },
    },
    "llama_simplify": {
        "label": "Llama: упростить текст",
        "description": "Простыми словами, для неспециалиста (Llama).",
        "category": "generation.text",
        "icon_key": "sparkles",
        "accent_color": "#4ade80",
        "inputs": ["prompt"],
        "outputs": ["text"],
        "default_config": {
            "system_prompt": (
                "Объясни и перепиши текст пользователя простым языком на русском, коротко, без потери смысла. "
                "Без вступлений."
            ),
            "options": {"temperature": 0.4, "num_predict": 3000},
        },
    },
    "llama_proofread": {
        "label": "Llama: вычитка",
        "description": "Орфография и пунктуация (Llama).",
        "category": "generation.text",
        "icon_key": "file-text",
        "accent_color": "#fcd34d",
        "inputs": ["prompt"],
        "outputs": ["text"],
        "default_config": {
            "system_prompt": (
                "Вычитай текст пользователя на русском: исправь орфографию и пунктуацию, не меняй смысл и стиль. "
                "Ответ — только исправленный текст."
            ),
            "options": {"temperature": 0.2, "num_predict": 4096},
        },
    },
    "llama_title": {
        "label": "Llama: заголовок",
        "description": "Один заголовок к тексту (Llama).",
        "category": "generation.text",
        "icon_key": "zap",
        "accent_color": "#f472b6",
        "inputs": ["prompt"],
        "outputs": ["text"],
        "default_config": {
            "system_prompt": (
                "Придумай одну цепкую строку-заголовок на русском к тексту пользователя. "
                "Только заголовок, без кавычек и пояснений."
            ),
            "options": {"temperature": 0.65, "num_predict": 128},
        },
    },
    "llama_keywords": {
        "label": "Llama: ключевые слова",
        "description": "Список ключевых слов через запятую (Llama).",
        "category": "generation.text",
        "icon_key": "hash",
        "accent_color": "#818cf8",
        "inputs": ["prompt"],
        "outputs": ["text"],
        "default_config": {
            "system_prompt": (
                "Из текста пользователя извлеки 8–20 ключевых слов или фраз на русском. "
                "Ответ: одна строка, разделитель — запятая, без нумерации."
            ),
            "options": {"temperature": 0.35, "num_predict": 512},
        },
    },
    "llama_list_numbered": {
        "label": "Llama: нумерованный список",
        "description": "Шаги или пункты 1. 2. 3. (Llama).",
        "category": "generation.text",
        "icon_key": "list-ordered",
        "accent_color": "#fb923c",
        "inputs": ["prompt"],
        "outputs": ["text"],
        "default_config": {
            "system_prompt": (
                "Преобразуй текст пользователя в нумерованный список шагов или тезисов на русском. "
                "Только список, формат 1. … 2. …"
            ),
            "options": {"temperature": 0.35, "num_predict": 2500},
        },
    },
    "llama_paraphrase": {
        "label": "Llama: перефразировать",
        "description": "Другими словами, тот же смысл (Llama).",
        "category": "generation.text",
        "icon_key": "languages",
        "accent_color": "#5eead4",
        "inputs": ["prompt"],
        "outputs": ["text"],
        "default_config": {
            "system_prompt": (
                "Перефразируй текст пользователя на русском: другие формулировки, тот же смысл и факты. "
                "Один связный абзац или короткий текст без пояснений."
            ),
            "options": {"temperature": 0.6, "num_predict": 4096},
        },
    },
    "llama_formal": {
        "label": "Llama: деловой стиль",
        "description": "Официально-деловой тон (Llama).",
        "category": "generation.text",
        "icon_key": "braces",
        "accent_color": "#64748b",
        "inputs": ["prompt"],
        "outputs": ["text"],
        "default_config": {
            "system_prompt": (
                "Перепиши текст пользователя на русском в нейтральном деловом стиле (письмо, памятка). "
                "Без разговорных оборотов."
            ),
            "options": {"temperature": 0.35, "num_predict": 4096},
        },
    },
    "llama_casual": {
        "label": "Llama: разговорный стиль",
        "description": "Живой неформальный тон (Llama).",
        "category": "generation.text",
        "icon_key": "message-square",
        "accent_color": "#f97316",
        "inputs": ["prompt"],
        "outputs": ["text"],
        "default_config": {
            "system_prompt": (
                "Перепиши текст пользователя на русском разговорно и дружелюбно, без канцелярита. Сохрани смысл."
            ),
            "options": {"temperature": 0.55, "num_predict": 4096},
        },
    },
    "llama_sql": {
        "label": "Llama: SQL по описанию",
        "description": "Черновик SQL под PostgreSQL (Llama, проверяй вручную).",
        "category": "generation.text",
        "icon_key": "code",
        "accent_color": "#22c55e",
        "inputs": ["prompt"],
        "outputs": ["text"],
        "default_config": {
            "system_prompt": (
                "По описанию пользователя на русском сгенерируй один запрос SQL для PostgreSQL. "
                "Только код SQL, без markdown и без объяснений."
            ),
            "options": {"temperature": 0.25, "num_predict": 2000},
        },
    },
    "llama_regex": {
        "label": "Llama: Regex по описанию",
        "description": "Шаблон regex (Llama, проверяй).",
        "category": "generation.text",
        "icon_key": "zap",
        "accent_color": "#e879f9",
        "inputs": ["prompt"],
        "outputs": ["text"],
        "default_config": {
            "system_prompt": (
                "По описанию на русском верни одну строку регулярного выражения (Python/PCRE-стиль). "
                "Только паттерн, без объяснений и без слэшей по краям."
            ),
            "options": {"temperature": 0.2, "num_predict": 400},
        },
    },
    "llama_commit": {
        "label": "Llama: сообщение коммита",
        "description": "Краткий commit message (Llama).",
        "category": "generation.text",
        "icon_key": "git-merge",
        "accent_color": "#0ea5e9",
        "inputs": ["prompt"],
        "outputs": ["text"],
        "default_config": {
            "system_prompt": (
                "По краткому описанию изменений пользователя сгенерируй одну строку commit message на английском, "
                "стиль conventional commits (например feat: …). Только одна строка."
            ),
            "options": {"temperature": 0.35, "num_predict": 120},
        },
    },
    "llama_yaml": {
        "label": "Llama: YAML из текста",
        "description": "Структура в YAML (Llama).",
        "category": "generation.text",
        "icon_key": "align-left",
        "accent_color": "#bef264",
        "inputs": ["prompt"],
        "outputs": ["text"],
        "default_config": {
            "system_prompt": (
                "Преобразуй описание пользователя в валидный YAML. Только YAML, без markdown-ограждения и без комментариев вне YAML."
            ),
            "options": {"temperature": 0.25, "num_predict": 2500},
        },
    },
    "llama_brainstorm": {
        "label": "Llama: идеи",
        "description": "Мозговой штурм, список идей (Llama).",
        "category": "generation.text",
        "icon_key": "sparkles",
        "accent_color": "#c084fc",
        "inputs": ["prompt"],
        "outputs": ["text"],
        "default_config": {
            "system_prompt": (
                "По теме пользователя предложи 8–15 идей на русском в виде маркированного списка. "
                "Короткие формулировки, без вступления."
            ),
            "options": {"temperature": 0.75, "num_predict": 2000},
        },
    },
    "llama_risks": {
        "label": "Llama: риски",
        "description": "Риски и ограничения по тексту (Llama).",
        "category": "generation.text",
        "icon_key": "gauge",
        "accent_color": "#f43f5e",
        "inputs": ["prompt"],
        "outputs": ["text"],
        "default_config": {
            "system_prompt": (
                "Проанализируй текст пользователя: перечисли возможные риски, пробелы и ограничения на русском. "
                "Маркированный список, 5–10 пунктов."
            ),
            "options": {"temperature": 0.4, "num_predict": 2000},
        },
    },
    "llama_shorten": {
        "label": "Llama: сильно сократить",
        "description": "В 2–3 раза короче, главное (Llama).",
        "category": "generation.text",
        "icon_key": "align-left",
        "accent_color": "#2dd4bf",
        "inputs": ["prompt"],
        "outputs": ["text"],
        "default_config": {
            "system_prompt": (
                "Сильно сократи текст пользователя на русском (примерно в 2–3 раза), оставь только суть. "
                "Связный текст, без списка «удалено»."
            ),
            "options": {"temperature": 0.35, "num_predict": 1500},
        },
    },
    "llama_jtbd": {
        "label": "Llama: JTBD (job stories)",
        "description": "Сценарии «когда / хочу / чтобы» по материалу кампании или продукта (Llama).",
        "category": "generation.text",
        "icon_key": "target",
        "accent_color": "#e879f9",
        "inputs": ["prompt"],
        "outputs": ["text"],
        "default_config": {
            "system_prompt": (
                "Ты продуктовый маркетолог. По тексту пользователя выпиши job stories в логике JTBD на русском: "
                "каждый пункт в формате «Когда [ситуация], хочу [действие/мотивация], чтобы [ожидаемый результат]». "
                "6–12 пунктов, маркированный список. Опирайся только на факты из входа; не выдумывай функции продукта."
            ),
            "options": {"temperature": 0.45, "num_predict": 3500},
        },
    },
    "llama_swot": {
        "label": "Llama: SWOT",
        "description": "SWOT-анализ по описанию оффера, рынка или кампании (Llama).",
        "category": "generation.text",
        "icon_key": "layout-grid",
        "accent_color": "#14b8a6",
        "inputs": ["prompt"],
        "outputs": ["text"],
        "default_config": {
            "system_prompt": (
                "Сделай SWOT-анализ по материалу пользователя на русском. Четыре блока с подзаголовками "
                "**Сильные стороны**, **Слабости**, **Возможности**, **Угрозы** — в каждом 4–8 маркированных пунктов, "
                "конкретно и с опорой на входной текст. Без вводных абзацев и общих фраз без привязки к тексту."
            ),
            "options": {"temperature": 0.4, "num_predict": 3500},
        },
    },
    "llama_personas": {
        "label": "Llama: персоны и путь",
        "description": "Маркетинговые персоны, боли и каналы по описанию (Llama).",
        "category": "generation.text",
        "icon_key": "users",
        "accent_color": "#a78bfa",
        "inputs": ["prompt"],
        "outputs": ["text"],
        "default_config": {
            "system_prompt": (
                "По описанию продукта, услуги или кампании пользователя предложи 3–5 маркетинговых персон на русском. "
                "Для каждой: название персоны, сегмент, цель, боль, критерии выбора, предпочтительные каналы — кратко. "
                "Формат: для каждой персоны блок с жирным заголовком (##). Без выдуманных цифр и имён реальных людей."
            ),
            "options": {"temperature": 0.5, "num_predict": 4000},
        },
    },
    "llama_tams": {
        "label": "Llama: TAM / SAM / SOM",
        "description": "Рамка оценки рынка и допущения (качественно, без фейковых цифр) (Llama).",
        "category": "generation.text",
        "icon_key": "chart-pie",
        "accent_color": "#f59e0b",
        "inputs": ["prompt"],
        "outputs": ["text"],
        "default_config": {
            "system_prompt": (
                "Ты маркетолог. По описанию рынка или продукта пользователя опиши на русском рамку TAM / SAM / SOM: "
                "что входит в каждый уровень, как обычно оценивают, какие данные нужны для честной оценки, "
                "какие типичные допущения. Явно укажи, что без исходных данных числовую оценку давать нельзя — только "
                "методологию и вопросы для исследования. Деловой тон, маркированные списки где уместно."
            ),
            "options": {"temperature": 0.35, "num_predict": 3200},
        },
    },
}
