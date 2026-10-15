# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Plain-language titles and descriptions for EWA admin «Настройки» (non-technical operators).
# Invariants:
# - Keys must match ``GENERATED_CATALOG`` / ``ewa_platform_setting.setting_key``.
# Related:
# - api/ewa_platform/settings/operator_help.py
# ---

from __future__ import annotations

# (title_ru, title_en, description_ru, description_en)
PLAIN: dict[str, tuple[str, str, str, str]] = {
    # --- Workflows & admin ---
    "EWA_COMPANION_WF_ENGINE_ENABLED": (
        "Цепочки действий (workflows)",
        "Action workflows master switch",
        "Вкл (1): спутник может запускать многошаговые сценарии (музыка целиком, пакеты файлов) с подтверждением шагов. "
        "Состояние прогонов и шагов фиксируется в Postgres, поэтому цепочки можно безопасно возобновлять после "
        "перезапуска сервисов. Для фонового исполнения обязательно держите EWA_COMPANION_ASYNC_JOBS_ENABLED=1. "
        "Выкл (0): работают только простые команды из одного шага.",
        "On (1): companion can run multi-step scenarios with confirmations. Off (0): single-step commands only.",
    ),
    "EWA_COMPANION_WF_MUSIC_FULL_V1": (
        "Сценарий «полный цикл музыки»",
        "Full music workflow pilot",
        "Вкл (1): доступен сценарий от текста до готового трека (текст → параметры → генерация). "
        "Нужны «Цепочки действий» и «Фоновые задачи».",
        "On (1): lyrics-to-track workflow is available. Requires workflow engine and background jobs.",
    ),
    "EWA_COMPANION_WF_DOC_PACKAGE_V1": (
        "Сценарий «пакет документов»",
        "Document package workflow",
        "Вкл (1): операторский сценарий создания нескольких файлов разом. Обычно выкл, если не используете пакетную сборку.",
        "On (1): operator workflow to create multiple files at once.",
    ),
    "EWA_COMPANION_WF_PG_CATALOG": (
        "Каталог сценариев в базе",
        "Workflow catalog in database",
        "Вкл (1): сценарии можно включать и править из админки и сохранять в Postgres. "
        "Выкл (0): только встроенные сценарии из кода, без редактирования.",
        "On (1): workflows editable in admin and stored in Postgres.",
    ),
    "EWA_COMPANION_USER_WORKFLOWS_ENABLED": (
        "Личные сценарии пользователя",
        "User personal workflows",
        "Вкл (1): пользователь может создавать свои цепочки по фразам-триггерам. "
        "Выкл (0): сохранённые цепочки остаются, но не запускаются автоматически.",
        "On (1): users can define phrase-triggered personal workflows.",
    ),
    "EWA_COMPANION_DAG_CELERY_ORCHESTRATION_ENABLED": (
        "DAG v2: Celery-оркестрация",
        "DAG v2: Celery orchestration",
        "Вкл (1): многошаговые v2-сценарии хранят состояние в Postgres и продвигаются по одному узлу на Celery task. "
        "Требует «Цепочки действий» и «Фоновые задачи».",
        "On (1): v2 workflows persist dag_state in Postgres and advance one node per Celery task. "
        "Requires workflow engine and background jobs.",
    ),
    "EWA_COMPANION_WORKFLOW_ENGINE_V2_ENABLED": (
        "Workflow engine v2 (DAG)",
        "Workflow engine v2 (DAG)",
        "Вкл (1): пользовательские сценарии schema_version:2 идут через DAG Celery engine. "
        "Выкл (0): v2-определения не стартуют, v1 legacy path сохраняется.",
        "On (1): user workflows with schema_version:2 use the DAG Celery engine. "
        "Off (0): v2 definitions are skipped at trigger time.",
    ),
    "EWA_COMPANION_DAG_TOOL_REGISTRY_ADAPTER_ENABLED": (
        "DAG v2: tool registry adapter",
        "DAG v2: tool registry adapter",
        "Вкл (1): tool-узлы DAG (например image_gen) исполняются через tool_registry с async resume. "
        "Требует Celery-оркестрацию v2.",
        "On (1): tool-backed DAG nodes (e.g. image_gen) dispatch via tool_registry with async resume. "
        "Requires DAG Celery orchestration.",
    ),
    "EWA_COMPANION_ADMIN_ENABLED": (
        "Раздел админки «EWA — спутник»",
        "Companion admin section",
        "Вкл (1): в админке продукта видны Tools, сценарии и настройки. Выкл (0): раздел недоступен (ошибка загрузки).",
        "On (1): companion admin tabs are visible. Off (0): admin section returns errors.",
    ),
    "EWA_COMPANION_ADMIN_WRITE": (
        "Правка сценариев в редакторе",
        "Edit workflows in Monaco",
        "Вкл (1): можно сохранять версии сценариев в каталоге. "
        "Вкл/выкл настроек на вкладке «Настройки» от этого не зависит.",
        "On (1): can save workflow versions in catalog editor.",
    ),
    "EWA_AGENTIC_SUBSTRATE_ENABLED": (
        "Agentic substrate (многошаговые сессии)",
        "Agentic substrate master switch",
        "Вкл (1): /agent и длинные work-session промпты создают durable agentic-сессию. "
        "Требует «Фоновые задачи» = 1. Значение в Postgres, не в compose env.",
        "On (1): /agent and long work-session prompts start durable agentic sessions. "
        "Requires background jobs on. Stored in Postgres, not compose env.",
    ),
    # --- Core chat & jobs ---
    "EWA_COMPANION_ASYNC_JOBS_ENABLED": (
        "Фоновые задачи спутника",
        "Companion background jobs",
        "Вкл (1): музыка, картинки и длинные цепочки идут в фоне; в чате виден прогресс в «Текущих операциях». "
        "Выкл (0): риск зависания чата на долгих операциях.",
        "On (1): long work runs in background with progress UI. Off (0): chat may hang on long ops.",
    ),
    "EWA_COMPANION_ASYNC_MUSIC_ENABLED": (
        "Музыка в фоне",
        "Async music generation",
        "Вкл (1): генерация музыки не блокирует ответ в чате. Требует «Фоновые задачи» = 1.",
        "On (1): music generation does not block chat. Requires background jobs on.",
    ),
    "EWA_COMPANION_BACKEND_MUSIC_GENERATION": (
        "Генерация музыки",
        "Music generation tool",
        "Вкл (1): спутник может создавать музыку по запросу. Выкл (0): команды на музыку игнорируются.",
        "On (1): companion can generate music on request.",
    ),
    "EWA_COMPANION_CHAT_USE_HTTP_LLM": (
        "Ответы чата через сервис ИИ",
        "Chat via AI HTTP service",
        "Вкл (1): ответы строятся через отдельный сервис модели (рекомендуется на проде). "
        "Выкл (0): чат может работать нестабильно или медленно.",
        "On (1): replies use dedicated AI service (recommended on prod).",
    ),
    "EWA_COMPANION_SERVER_FIRST_V2": (
        "Сервер управляет действиями",
        "Server-first chat path",
        "Вкл (1): открытие файлов, тема стола и инструменты решаются на сервере — интерфейс только показывает результат. "
        "Рекомендуется оставить включённым.",
        "On (1): server decides tools/actions; UI only displays results.",
    ),
    "EWA_COMPANION_ACTION_VALIDATION_ENABLED": (
        "Проверка команд перед показом",
        "Action validation",
        "Вкл (1): спутник не отправит в интерфейс «сломанную» команду (безопаснее для пользователя).",
        "On (1): blocks malformed commands before they reach the UI.",
    ),
    # --- Tool router ---
    "EWA_COMPANION_TOOL_ROUTER_ENABLED": (
        "Умный выбор действия",
        "Smart tool router",
        "Вкл (1): перед действием отдельная модель понимает, что хочет пользователь (открыть файл, музыка и т.д.). "
        "Выкл (0): только простые шаблоны по тексту.",
        "On (1): AI router picks the right action before execution.",
    ),
    "EWA_COMPANION_TOOL_ROUTER_MODE": (
        "Режим умного роутера",
        "Tool router mode",
        "shadow — только пишет в лог, не выполняет; partial — часть действий; full — все действия через роутер. "
        "На проде обычно full после проверки.",
        "shadow = log only; partial = subset; full = all actions via router.",
    ),
    "EWA_COMPANION_TOOL_ROUTER_MIN_CONFIDENCE": (
        "Порог уверенности роутера",
        "Router confidence threshold",
        "Число от 0 до 1. Ниже порога роутер не срабатывает — спутник отвечает как обычный чат. "
        "Выше — меньше ложных действий, но чаще «просто текст».",
        "0–1 float. Below threshold router is skipped.",
    ),
    "EWA_COMPANION_TOOL_ROUTER_TIMEOUT_SEC": (
        "Таймаут роутера (сек)",
        "Router timeout (sec)",
        "Сколько секунд ждать ответ роутера. Меньше — быстрее чат, но чаще пропуск действий.",
        "Seconds to wait for router before falling back.",
    ),
    "EWA_COMPANION_TOOL_ROUTER_MAX_TOKENS": (
        "Размер ответа роутера",
        "Router max tokens",
        "Ограничение длины ответа роутера (JSON с выбранным действием).",
        "Max tokens for router JSON output.",
    ),
    "EWA_COMPANION_TOOL_ROUTER_MODEL": (
        "Модель роутера",
        "Router model id",
        "Пусто — модель по умолчанию с сервера. Заполняйте только если знаете имя GGUF на stack2.",
        "Empty = server default model id.",
    ),
    "EWA_COMPANION_TOOL_ROUTER_URL": (
        "URL роутера",
        "Router URL override",
        "Пусто — адрес из внутренней сети автоматически. Меняйте только при отладке.",
        "Empty = default internal service URL.",
    ),
    # --- Memory / HCM ---
    "EWA_COMPANION_HCM_EPISODIC_ENABLED": (
        "Запись воспоминаний",
        "Episodic memory ingest",
        "Вкл (1): спутник сохраняет эпизоды разговора и наблюдений для будущего контекста.",
        "On (1): stores conversation episodes for later recall.",
    ),
    "EWA_COMPANION_HCM_RETRIEVAL_ENABLED": (
        "Подмешивать память в чат",
        "Memory in chat context",
        "Вкл (1): в ответ подставляются релевантные воспоминания. Требует «Запись воспоминаний» и адрес хранилища векторов.",
        "On (1): relevant memories are added to replies.",
    ),
    "EWA_COMPANION_EPISODIC_RERANK_ENABLED": (
        "Уточнение релевантности памяти",
        "Episodic rerank",
        "Вкл (1): после поиска память пересортировывается для точности (чуть дольше ответ).",
        "On (1): reranks memory hits for better relevance.",
    ),
    "EWA_COMPANION_RETRIEVAL_ROUTER_ENABLED": (
        "Выбор источника памяти",
        "Retrieval router",
        "Вкл (1): система сама решает, откуда брать контекст — каталог файлов или память.",
        "On (1): picks catalog vs memory sources automatically.",
    ),
    "EWA_COMPANION_RETRIEVAL_BUDGET_MS": (
        "Лимит времени на память (мс)",
        "Memory time budget (ms)",
        "Сколько миллисекунд максимум тратить на поиск памяти в одном ответе. "
        "4500 — баланс; меньше — быстрее, но беднее контекст.",
        "Max milliseconds for memory lookup per reply.",
    ),
    "EWA_COMPANION_EPISODES_REEMBED_BATCH": (
        "Пакет индексации памяти",
        "Reembed batch size",
        "Сколько записей памяти обрабатывать за один фоновый проход (128 — быстрее разгрести очередь).",
        "Episodes processed per background indexing tick.",
    ),
    "EWA_COMPANION_EPISODES_REEMBED_ROW_DELAY_MS": (
        "Пауза между записями (мс)",
        "Delay between reembed rows",
        "Пауза между строками при индексации — снижает нагрузку на сервер (40–50 типично).",
        "Pause between rows during indexing.",
    ),
    "EWA_COMPANION_EPISODES_REEMBED_DRAIN_MAX_ROUNDS": (
        "Раундов разгребания очереди",
        "Backlog drain max rounds",
        "Сколько «кругов» сделать при ручном разгребании очереди pending (операторская задача).",
        "Max rounds for one-shot backlog drain.",
    ),
    "EWA_COMPANION_OBSERVATION_RATE_LIMIT_PER_MIN": (
        "Лимит наблюдений в минуту",
        "Observations per minute",
        "Сколько раз в минуту записывать «наблюдение» со стола — меньше = меньше мусора в очереди памяти.",
        "Caps desktop observation writes per minute.",
    ),
    "EWA_COMPANION_EPISODIC_INTENT_PRIORITIZE": (
        "Приоритет намерений в памяти",
        "Prioritize episodic intent",
        "Вкл (1): при поиске памяти сильнее учитываются намерения пользователя.",
        "On (1): boosts intent-related memory hits.",
    ),
    "EWA_COMPANION_EPISODIC_SESSION_TOPIC_PRIORITIZE": (
        "Приоритет темы сессии",
        "Prioritize session topic",
        "Вкл (1): сильнее поднимаются воспоминания по теме текущего разговора.",
        "On (1): boosts current-session topic hits.",
    ),
    # --- Context / chat size ---
    "EWA_COMPANION_CONTEXT_CONTROLLER_ENABLED": (
        "Сжатие длинной истории",
        "Context controller",
        "Вкл (1): при переполнении контекста старые сообщения обрезаются по правилам — чат не «ломается» от длины.",
        "On (1): trims history when context is too large.",
    ),
    "EWA_COMPANION_CONTEXT_ANCHOR_ENABLED": (
        "Краткое резюме сессии",
        "Session anchor",
        "Вкл (1): в начало подмешивается короткое резюме «о чём мы говорили».",
        "On (1): adds a short session summary to context.",
    ),
    "EWA_COMPANION_CONTEXT_ANCHOR_LLM": (
        "Резюме через отдельный запрос ИИ",
        "LLM session anchor",
        "Вкл (1): резюме обновляется отдельным запросом к модели (дороже). Обычно выкл — достаточно эвристики.",
        "On (1): anchor refreshed via extra LLM call.",
    ),
    "EWA_COMPANION_CHAT_CONDENSE_ENABLED": (
        "Сжатие старых реплик",
        "Condense old messages",
        "Вкл (1): Condense сворачивает очень старые сообщения в краткий профиль и сохраняет этот профиль в Postgres, "
        "чтобы он переживал перезапуски и оставался доступен в следующих сессиях.",
        "On (1): condenses very old chat into a short profile.",
    ),
    "EWA_COMPANION_CHAT_NUM_CTX": (
        "Размер окна контекста",
        "Chat context window",
        "Сколько токенов максимум «видит» модель (16384 типично). Больше — длиннее диалог, выше нагрузка.",
        "Max context tokens for the chat model.",
    ),
    "EWA_COMPANION_CHAT_NUM_PREDICT": (
        "Макс. длина ответа",
        "Max reply tokens",
        "Ограничение длины одного ответа спутника (защита от бесконечного текста).",
        "Cap on tokens in one companion reply.",
    ),
    "EWA_COMPANION_CHAT_TIMEOUT_SEC": (
        "Таймаут ответа чата (сек)",
        "Chat timeout (sec)",
        "Через сколько секунд обрывать ожидание ответа модели (150 — для длинных ответов).",
        "Seconds before chat LLM call times out.",
    ),
    "EWA_COMPANION_CHAT_LLM_HISTORY_TOKEN_BUDGET": (
        "Бюджет истории в чате",
        "History token budget",
        "Сколько токенов истории диалога отдавать в модель (остальное обрезается).",
        "Token budget for chat history.",
    ),
    "EWA_COMPANION_SESSION_COMPRESS_TOKEN_BUDGET": (
        "Бюджет сжатия системы",
        "Session compress budget",
        "Лимит токенов при сжатии служебного блока в длинных сессиях.",
        "Token budget for system prompt compression.",
    ),
    "EWA_COMPANION_CHAT_MODEL": (
        "Модель чата",
        "Chat model override",
        "Пусто — модель по умолчанию. Указывайте только при смене модели на stack2.",
        "Empty = default chat model.",
    ),
    # --- Catalog & files ---
    "EWA_COMPANION_CATALOG_FIND": (
        "Поиск по файлам",
        "Catalog find",
        "Вкл (1): спутник может искать и показывать файлы пользователя.",
        "On (1): companion can search user files.",
    ),
    "EWA_COMPANION_CATALOG_DISCUSS_ENABLED": (
        "Обсуждение файла",
        "Discuss file mode",
        "Вкл (1): «расскажи про файл» читает содержимое и отвечает по нему.",
        "On (1): discuss-mode reads file content for answers.",
    ),
    "EWA_COMPANION_CATALOG_DISCUSS_MAX_CHARS": (
        "Лимит текста файла для обсуждения",
        "Discuss max chars",
        "Сколько символов из файла подставлять в обсуждение (больше — точнее, но тяжелее).",
        "Max characters from file for discuss mode.",
    ),
    "EWA_COMPANION_DOC_OPEN_VIA_CONTENT_SEARCH": (
        "Открыть документ по содержимому",
        "Open doc via search",
        "Вкл (1): «открой про …» ищет по тексту внутри документов, а не только по имени.",
        "On (1): open-by-topic uses content search.",
    ),
    "EWA_COMPANION_DOC_BODY_EDIT": (
        "Правка текста документа",
        "Edit document body",
        "Вкл (1): спутник может менять текст открытого документа по инструкции.",
        "On (1): companion can edit open document body.",
    ),
    "EWA_COMPANION_DOC_BODY_TRANSLATE": (
        "Перевод документа",
        "Translate document",
        "Вкл (1): спутник может переводить тело документа.",
        "On (1): companion can translate document body.",
    ),
    "EWA_COMPANION_DOC_BODY_MAX_DOWNLOAD_BYTES": (
        "Лимит скачивания документа",
        "Max doc download bytes",
        "Максимальный размер тела документа для обработки (защита от гигантских файлов).",
        "Max document body bytes to fetch.",
    ),
    "EWA_COMPANION_DOC_BODY_MAX_ACTION_HTML_CHARS": (
        "Лимит HTML в команде",
        "Max action HTML chars",
        "Максимум символов HTML в одной команде правки для интерфейса.",
        "Max HTML chars in one edit action.",
    ),
    "EWA_COMPANION_DOC_EDIT_PROMPT_BODY_CHARS": (
        "Лимит текста в запросе к ИИ",
        "Doc edit prompt chars",
        "Сколько символов документа отправлять модели при правке.",
        "Chars of document sent to model on edit.",
    ),
    "EWA_COMPANION_DOC_TRANSLATE_DEFAULT_TARGET_LANG": (
        "Язык перевода по умолчанию",
        "Default translation language",
        "Код языка (ru, en, …) если пользователь не указал.",
        "ISO language code when user did not specify.",
    ),
    "EWA_COMPANION_LISTING_ORDINALS": (
        "«Третий файл из списка»",
        "Ordinal file picks",
        "Вкл (1): понимает «второй», «третий» из списка на столе.",
        "On (1): understands ordinal picks from shell lists.",
    ),
    # --- Image / voice / plans ---
    "EWA_COMPANION_IMAGE_GENERATION_ENABLED": (
        "Генерация фоновых картинок",
        "Background image generation",
        "Вкл (1): спутник может запускать генерацию фона (долго, в фоне). "
        "Нужны рабочий сервис картинок и ключи type/slug ниже.",
        "On (1): companion can trigger background image jobs.",
    ),
    "EWA_COMPANION_IMAGE_GENERATION_TYPE_KEY": (
        "Тип генерации картинки",
        "Image generation type key",
        "Технический ключ шаблона в сервисе генерации — не менять без инструкции.",
        "UGS type_key for image jobs.",
    ),
    "EWA_COMPANION_IMAGE_GENERATION_WORKFLOW_SLUG": (
        "Шаблон картинки",
        "Image workflow slug",
        "Имя шаблона пайплайна картинки — не менять без инструкции.",
        "Workflow template slug for images.",
    ),
    "EWA_COMPANION_VOICE_ENABLED": (
        "Голосовой режим",
        "Voice mode",
        "Вкл (1): кнопка голоса в чате (запись и озвучка). Не включает прослушивание без нажатия.",
        "On (1): voice button in chat (on-demand only).",
    ),
    "EWA_COMPANION_REACTIVE_CHROME_ENABLED": (
        "Живое оформление окна",
        "Reactive window chrome",
        "Вкл (1): окно спутника плавно меняет aura/свечение от настроения и активных операций. Выкл (0): статичная палитра персоны.",
        "On (1): companion window smoothly shifts aura/glow with mood and active work. Off (0): static persona palette.",
    ),
    "EWA_COMPANION_PLAN_ENABLED": (
        "Планы и дорожные карты",
        "Plans and roadmaps",
        "Вкл (1): спутник ведёт планы целей/задач на сервере, интерфейс показывает roadmap.",
        "On (1): server-first plans/roadmaps in UI.",
    ),
    "EWA_COMPANION_PLAN_LLM_ENABLED": (
        "ИИ для шагов плана",
        "LLM plan steps",
        "Вкл (1): шаги плана структурирует модель (доп. нагрузка). Обычно выкл.",
        "On (1): LLM structures plan steps.",
    ),
    "EWA_COMPANION_PLAN_MODEL": (
        "Модель для планов",
        "Plan model override",
        "Пусто — модель по умолчанию.",
        "Empty = default plan model.",
    ),
    # --- Intent / correction / evolution (usually off) ---
    "EWA_COMPANION_INTENT_PLANNER": (
        "Отдельный планировщик намерений",
        "Intent planner",
        "Вкл (1): перед роутером ещё один запрос к ИИ (медленнее, дублирует роутер). На проде обычно 0.",
        "On (1): extra LLM pass before router (usually off on prod).",
    ),
    "EWA_COMPANION_INTENT_PLANNER_FORCE": (
        "Планировщик на каждый ответ",
        "Force intent planner",
        "Вкл (1): планировщик на каждую реплику — сильно замедляет чат. Держите 0.",
        "On (1): planner every turn — very slow.",
    ),
    "EWA_COMPANION_INTENT_PLANNER_MIN_CONFIDENCE": (
        "Порог планировщика",
        "Intent planner confidence",
        "Используется только если планировщик включён.",
        "Only used when intent planner is on.",
    ),
    "EWA_COMPANION_INTENT_TIMEOUT_SEC": (
        "Таймаут планировщика (сек)",
        "Intent planner timeout",
        "Таймаут sidecar планировщика.",
        "Intent sidecar timeout seconds.",
    ),
    "EWA_COMPANION_INTENT_NUM_PREDICT": (
        "Длина ответа планировщика",
        "Intent num_predict",
        "Лимит токенов ответа планировщика.",
        "Intent planner max tokens.",
    ),
    "EWA_COMPANION_INTENT_MODEL": (
        "Модель планировщика",
        "Intent model",
        "Пусто — по умолчанию.",
        "Empty = default.",
    ),
    "EWA_COMPANION_SEMANTIC_CATALOG_ENABLED": (
        "Умный поиск по каталогу (тяжёлый)",
        "Semantic catalog augment",
        "Вкл (1): поиск файлов тянет векторный поиск внутри чата — риск тормозов. "
        "На проде обычно 0; память — через «Подмешивать память».",
        "On (1): heavy in-chat vector catalog search (usually off).",
    ),
    "EWA_COMPANION_SELF_CORRECTION_ENABLED": (
        "Второй проход «исправления»",
        "Self-correction",
        "Вкл (1): после ответа ещё один запрос к ИИ — дольше ждать. Обычно 0.",
        "On (1): second LLM pass after reply.",
    ),
    "EWA_COMPANION_SELF_CORRECTION_EPISODES_ENABLED": (
        "Исправление с памятью",
        "Self-correction with memory",
        "Как «Второй проход», но с эпизодами — ещё тяжелее.",
        "Self-correction using episodic context.",
    ),
    "EWA_COMPANION_AMBIENT_ACTIONS_ENABLED": (
        "Действия без запроса",
        "Ambient actions",
        "Вкл (1): спутник может менять стол/приложения без явной просьбы — непредсказуемо. Обычно 0.",
        "On (1): actions without user ask (usually off).",
    ),
    "EWA_COMPANION_AUTO_AMBIENT_FROM_AFFECTIVE": (
        "Фон из «настроения»",
        "Ambient from mood",
        "Вкл (1): усиливает фоновые действия от эмоционального слоя. Обычно 0.",
        "On (1): mood-driven ambient actions.",
    ),
    "EWA_COMPANION_CONTINUITY_V1_ENABLED": (
        "Непрерывность образа (continuity)",
        "Continuity of self (v1)",
        "Вкл (1): сохраняет короткий decaying micro-state (настроение/оттенки) между репликами — не факты HCM. Обычно 0.",
        "On (1): persist a short decaying micro-self (mood tint) across turns — not HCM facts. Usually off.",
    ),
    "EWA_COMPANION_CONTEMPLATION_ENABLED": (
        "Созерцание (тишина)",
        "Contemplation (silence)",
        "Вкл (1): режим «рядом без слов» — observation без anticipation-подсказок. Обычно 0.",
        "On (1): contemplation mode — observe without anticipation hint bubbles. Usually off.",
    ),
    "EWA_COMPANION_SOFT_INITIATIVE_ENABLED": (
        "Мягкая инициатива",
        "Soft initiative",
        "Вкл (1): partner-tone rewrite anticipation-подсказок с дневным бюджетом. Обычно 0.",
        "On (1): partner-tone rewrite of anticipation hints with a daily budget. Usually off.",
    ),
    "EWA_COMPANION_SOFT_INITIATIVE_DAILY_CAP": (
        "Лимит мягких подсказок / день",
        "Soft initiative daily cap",
        "Макс. soft-initiative подсказок на principal в сутки UTC (0–24). При 0 — всегда тишина.",
        "Max soft-initiative hints per principal per UTC day (0–24). 0 = always quiet.",
    ),
    "EWA_COMPANION_SOFT_INITIATIVE_MIN_GAP_MIN": (
        "Пауза между мягкими подсказками (мин)",
        "Soft initiative min gap (min)",
        "Минимальный интервал между soft-initiative подсказками (0–1440 мин).",
        "Minimum minutes between soft-initiative hints (0–1440).",
    ),
    "EWA_COMPANION_AMBIENT_FROM_CONTINUITY": (
        "Фон из continuity",
        "Ambient from continuity",
        "Вкл (1): mood_tint continuity → ambient_adjust (нужен также ambient actions). Обычно 0.",
        "On (1): continuity mood_tint → ambient_adjust (also needs ambient actions). Usually off.",
    ),
    "EWA_COMPANION_AMBIENT_MAX_PER_HOUR": (
        "Лимит ambient / час",
        "Ambient max per hour",
        "Макс. continuity→ambient injects на principal в скользящий час (0–60). 0 = никогда.",
        "Max continuity→ambient injects per principal per rolling hour (0–60). 0 = never.",
    ),
    "EWA_COMPANION_AMBIENT_THEME_COOLDOWN_MIN": (
        "Пауза ambient после темы (мин)",
        "Ambient theme cooldown (min)",
        "Минуты без continuity-ambient после ручной темы или прошлого inject (0–1440).",
        "Minutes without continuity-ambient after user theme or last inject (0–1440).",
    ),
    "EWA_COMPANION_EVOLUTION_USE_LLM": (
        "Эволюция персоны через ИИ",
        "LLM persona evolution",
        "Фоновое обновление «профиля» персоны через модель — обычно выкл.",
        "Background LLM persona evolution summaries.",
    ),
    "EWA_COMPANION_EVOLUTION_AUTO_FROM_CHAT": (
        "Авто-эволюция из чата",
        "Auto evolution from chat",
        "Вкл (1): периодически пишет эволюцию из переписки — лишняя нагрузка. Обычно 0.",
        "On (1): triggers evolution from chat.",
    ),
    "EWA_COMPANION_META_EVOLUTION_ENABLED": (
        "Обход всех профилей",
        "Meta-evolution sweep",
        "Фоновый обход профилей — конкурирует с индексацией памяти. Обычно 0.",
        "Background sweep across profiles.",
    ),
    "EWA_COMPANION_META_EVOLUTION_BEAT_ENABLED": (
        "Расписание meta-evolution",
        "Meta-evolution schedule",
        "Периодический запуск обхода — обычно 0.",
        "Periodic meta-evolution beat.",
    ),
    "EWA_COMPANION_INFER_OPEN_FROM_USER": (
        "Угадать «открой приложение»",
        "Infer open app",
        "Вкл (1): лучше понимает просьбы открыть программу без точной команды.",
        "On (1): infers open-app from free text.",
    ),
    "EWA_COMPANION_INFER_DESKTOP_THEME_PATCH": (
        "Угадать смену темы",
        "Infer theme change",
        "Вкл (1): лучше понимает просьбы сменить тему/акцент стола.",
        "On (1): infers desktop theme changes.",
    ),
    "EWA_COMPANION_WORKFLOW_REFLECT_WEEK_ENABLED": (
        "Сценарий «итоги недели»",
        "Weekly reflection workflow",
        "Вкл (1): отдельный сценарий подведения итогов недели.",
        "On (1): weekly reflection chat workflow.",
    ),
    "EWA_COMPANION_WORKFLOW_FILE_FOCUS_ENABLED": (
        "Сценарий file_focus (резерв)",
        "File focus workflow",
        "Зарезервировано — обычно 0, фокус на файле уже в основном пути.",
        "Reserved workflow flag — usually off.",
    ),
    "EWA_COMPANION_WORKFLOW_PLAN_MONTH_ENABLED": (
        "Сценарий plan_month (резерв)",
        "Monthly plan workflow",
        "Зарезервировано — используйте «Планы» вместо этого.",
        "Reserved — use Plans feature instead.",
    ),
    # --- Desktop orchestration ---
    "EWA_ORCH_USE_HTTP_LLM": (
        "ИИ для оркестрации стола",
        "Desktop orch HTTP LLM",
        "Вкл (1): сценарии на рабочем столе (не чат спутника) используют тот же сервис модели.",
        "On (1): desktop orchestration uses HTTP LLM.",
    ),
    "EWA_ORCH_USE_ELITEEW_HTTP": (
        "Внутренние вызовы API",
        "EliteEW HTTP self-call",
        "Вкл (1): шаги оркестратора вызывают API продукта по HTTP (стандарт для прода).",
        "On (1): orch steps call product API over HTTP.",
    ),
    "EWA_ORCH_ATTACH_UGS_HTTP": (
        "Профиль генерации на столе",
        "Attach generation profile",
        "Вкл (1): к контексту стола подмешивается профиль сервиса генерации.",
        "On (1): attaches generation profile to desktop context.",
    ),
    "EWA_ORCH_ATTACH_CONTENT_SHELL_HINT": (
        "Подсказки контента со стола",
        "Content shell hints",
        "Вкл (1): оркестратор видит, что открыто в контенте на столе.",
        "On (1): orch sees content shell hints.",
    ),
    "EWA_ORCH_ATTACH_DOCUMENTS_SHELL_HINT": (
        "Подсказки документов",
        "Documents shell hints",
        "Вкл (1): оркестратор видит список/контекст документов на столе.",
        "On (1): orch sees document shell hints.",
    ),
    "EWA_ORCH_LLM_CONTEXT_LOG": (
        "Логировать контекст ИИ (отладка)",
        "Log LLM context",
        "Вкл (1): полный контекст в логи — только для отладки, на проде 0.",
        "On (1): verbose LLM context logs (debug only).",
    ),
    "EWA_ORCH_LLM_SLIM_DOMAIN_HINTS_UTF8": (
        "Короткие подсказки домена",
        "Slim domain hints",
        "Вкл (1): меньше служебного текста — быстрее ответы оркестратора.",
        "On (1): smaller prompts for desktop orch.",
    ),
    "EWA_ORCH_LLM_SLIM_OBSERVATION_WINDOWS": (
        "Короткие окна наблюдений",
        "Slim observation windows",
        "Вкл (1): меньше «шума» с наблюдений стола в запросе к ИИ.",
        "On (1): trims observation windows in orch prompt.",
    ),
    "EWA_ORCH_SSE_KEEPALIVE_SEC": (
        "Интервал keep-alive SSE (сек)",
        "SSE keep-alive interval",
        "Как часто слать пустой пинг длинному потоку (2 сек — чтобы прокси не рвал соединение).",
        "Keep-alive interval for long desktop streams.",
    ),
    "EWA_ORCH_UGS_PROFILE": (
        "ID профиля генерации",
        "Generation profile id",
        "Пусто — профиль по умолчанию. Заполняйте, если знаете id профиля на сервере.",
        "Empty = default UGS profile.",
    ),
    "EWA_DESKTOP_ORCH_APP_ALLOWLIST": (
        "Список разрешённых приложений",
        "Allowed desktop apps",
        "Через запятую id приложений, которые оркестратор может открывать. Пусто — по политике продукта.",
        "Comma-separated app ids orch may open.",
    ),
    # --- Atoms & infra ---
    "EWA_ATOM_LAYER_ENABLED": (
        "Слой «атомов» памяти",
        "Atom memory layer",
        "Экспериментальный граф фактов — дублирует episodic. Обычно 0.",
        "Experimental fact graph — usually off.",
    ),
    "EWA_ATOM_IMPORTANCE_FLOOR": (
        "Порог важности атома",
        "Atom importance floor",
        "Факты ниже порога не хранятся (0–1).",
        "Facts below threshold are dropped.",
    ),
    "EWA_ATOM_TTL_DEFAULT_SEC": (
        "Срок жизни атома (сек)",
        "Atom TTL seconds",
        "Через сколько секунд забывать факт (604800 = 7 дней).",
        "Seconds until atom expires.",
    ),
    "EWA_ATOM_RETRIEVAL_DROP_STALE": (
        "Не показывать устаревшие атомы",
        "Drop stale atoms",
        "Вкл (1): при ответе отбрасывать просроченные факты.",
        "On (1): drops expired atoms at retrieval.",
    ),
    "EWA_HEALTH_PG_PROBE": (
        "Проверка БД EWA в health",
        "EWA Postgres health probe",
        "Вкл (1): /api/health показывает состояние базы EWA — полезно для мониторинга.",
        "On (1): health endpoint checks EWA Postgres.",
    ),
    "EWA_QDRANT_URL": (
        "Адрес хранилища векторов",
        "Vector store URL",
        "HTTP-адрес сервиса памяти (например http://stack1-qdrant:6333). Пусто — память и индексация не работают.",
        "HTTP URL for vector memory (required for HCM).",
    ),
    "EWA_QDRANT_API_KEY": (
        "Ключ доступа к векторам",
        "Vector store API key",
        "Пусто, если на сервере нет пароля. Иначе — секрет из инфраструктуры.",
        "Empty if Qdrant has no auth.",
    ),
}

__all__ = ["PLAIN"]
