# Stack0 ↔ LLM: переменные, дефолты и когда «нет Llama»

Цель документа — снять путаницу: **`LLAMA_*` и слово «Llama» в коде означают слой текстового LLM**, а не требование поднять именно продукт [Llama](https://llama.com).

## 1. Какие HTTP-бэкенды допустимы

- Нативный API Llama: `/api/chat`, `/api/generate`, часто `/api/tags` для здоровья.
- Сервер с **OpenAI-совместимым** HTTP (типично **llama.cpp** на stack2, например `stack2-llama-chat`), см. **`LLAMA_USE_OPENAI_API`** и зонды в `LlamaService` / `llm_openai_compat_http`.

## 2. `LLAMA_URL` (env)

Задаётся в **`docker/env_file/.env.stack0.backend`** и пробрасывается **`docker/stack/stack0_b.yml`** в API и воркеры.

**Важно для `eliteew-api-prod`:** в compose переменные в блоке `environment` подставляются при **`docker compose up`** из файла, переданного как **`--env-file docker/env_file/.env.stack0.backend`**. Если поднять API без этого файла или не сделать **`--force-recreate`** после смены `LLAMA_EMBEDDING_MODEL` / **`AI_EMBEDDINGS_DIMENSION`**, в контейнере могут остаться **старые** значения — тогда эмбеддинги возвращают одну размерность, а приложение ждёт другую (`invalid embedding shape`, 503 на ИМК RAG).

### Таблица `LLAMA_URL`

| Ситуация | Что происходит |
|----------|----------------|
| **`LLAMA_URL` задан** | `UnifiedConfig.llama_base_url` принимает значение; `llama_url` в приложении совпадает с ним (без сборки из host:port). |
| **`LLAMA_URL` пустой** | Свойство **`llama_url`** строится из **`LLAMA_HOST` / `LLAMA_PORT`** с дефолтами **`stack2-llama`** и **11434** в `UnifiedConfig.create()`. То есть **пустой URL в env не отключает** обращение к LLM со стороны Python — возможны запросы к дефолтному docker-хосту. |

**Рекомендация:** всегда указывать реальный базовый URL сервиса инференса (например `http://stack2-llama-chat:8080`), если используете не классический `stack2-llama:11434`.

### `LLAMA_MODEL` vs id в `GET /v1/models` (llama.cpp)

В env обычно basename: **`LLAMA_MODEL=gemma-4-26B.gguf`**.
llama-server в **`/v1/models`** отдаёт id с путём: **`/models/gemma-4-26B.gguf`**.

Резолвер **`api/utils/llama_models.py`** (`resolve_model_id` / `get_model_or_default`) матчит по **точному id** и по **basename**, и в запрос к серверу подставляет **server id**. Без basename-матча в логах был ложный WRN «Requested model … not available, using default» при том же файле модели.

### Отдельный канал UGS (текстовый LLM)

Если ни админский URL провайдера, ни **`LLAMA_URL`** не заданы, **`resolve_ugs_text_llm_base_url`** падает на **`http://stack2-llama-chat:8080`** (`CANONICAL_DOCKER_TEXT_LLM_URL` в `shared/api/services/ugs/text_llm_constants.py`). Это другой резервный путь — не смешивать с «отсутствием LLM».

## 3. `start_all.sh` (preflight контейнера)

- Строки с **`import llama`** проверяют **Python-пакет** в образе, а не живой процесс «Llama».
- HTTP-проверка LLM выполняется **только если `LLAMA_URL` непустой**. Путь после базового URL — **`STACK0_LL_HTTP_HEALTH_SUFFIX`** (**`.env.stack0.backend`**): для **llama-server** обычно **`/health`**, для нативного Llama — **`/api/tags`**. При **`LLAMA_USE_OPENAI_API=true`** и суффиксе **`/api/tags`** `start_all.sh` автоматически пробует **`/health`**.
- Пустое значение `LLAMA_URL` в shell **не** означает, что приложение позже не использует **`unified_settings.llama_url`** с дефолтом **`stack2-llama:11434`** — см. п. 2.

## 4. Литералы `http://stack2-llama:11434` в коде

В отдельных сервисах остаются последним fallback литералы (например AI SDK-провайдер, генератор музыки). При кастомном стеке задавайте **`LLAMA_URL`** / **`LLAMA_PRIMARY_URL`** явно.

## 5. Если инференса в контуре нет

API и воркеры **не требуют** успешного ответа LLM для старта uvicorn по умолчанию, но многие маршруты при вызове будут ошибаться по сети или таймауту при обращении к дефолтным именам сервисов. Единой переменной «полностью отключить LLM» для всего приложения может не быть — это точечные фичи и админские настройки; при полном отсутствии модели согласуйте с продуктом границы экспозиции.

## 6. Отладочный дамп тел запросов к LLM (stack2)

Если задана непустая **`STACK2_LLM_DEBUG_SAVE_DIR`** (абсолютный путь внутри контейнера, например **`/app/generated_files/stack2_llm_debug`** при монтировании `host/generated_files`), модуль **`api/utils/llm_openai_compat_http.py`** **перед** каждым исходящим `POST` с JSON-телом к выбранному LLM-бэкенду (Llama `/api/*` или OpenAI-compat `/v1/*`) пишет файл:

`{STACK2_LLM_DEBUG_SAVE_DIR}/{kind}/stack2_llm_{timestamp}_{uuid}.json`

Внутри — `saved_at`, `kind`, `base_url`, `path`, **`correlation_stem`** (базовое имя файла) и **`request_body`** (то, что уходит в HTTP). После ответа HTTP (включая стримы: агрегированный текст в **`stream_aggregated_text`**) пишется пара:

`{STACK2_LLM_DEBUG_SAVE_DIR}/responses/{kind}/{correlation_stem}.json`

с полями `http_status`, при ошибках — `error_message` / `response_text_preview`, при JSON-ответах — **`response_body`** (для эмбеддингов длинные `embedding` в массиве заменены на `embedding_len` + короткий **`embedding_preview`**). Идея та же, что у **`COMFYUI_DEBUG_SAVE_PROMPT_DIR`** для ComfyUI. На проде держите переменную **не заданной** (объём и PII).

**Права:** API пишет от **`stack0-runtime` (uid 1000)**. Bind-mount `host/generated_files` после recreate/host `chown` может остаться **`root:root` без записи** → в логах `[WRN] stack2 LLM debug save failed (IO): Permission denied`. Исправление: `bash docker/scripts/fix-generated-files-permissions.sh` (авто-выбор `stack0-eliteew-api-prod-baked` или dev-контейнера; создаёт `stack2_llm_debug/` и прочие debug-подкаталоги). См. также **`documentation/product/EWRP-REVOLUTIONARY-PRESENTATIONS.md`** (тот же паттерн для `ewrp/`).

## 7. Структурированный JSON и маршрутизация HTTP (`llm_openai_compat_http.py`)

Единая прослойка stack0 для **`stack2-llama-chat`** и других OpenAI-compat / native Llama бэкендов: **`api/utils/llm_openai_compat_http.py`**.

### 7.1 Backend probe

| Зонд | Результат | Поведение generate-json |
|------|-----------|-------------------------|
| `GET /health` → `{"status":"ok"}` | backend = **`openai`** (llama-server) | **не** пробует legacy **`POST /v1/completions`** — сразу chat path (см. §7.3) |
| `GET /api/tags` → 200 | backend = **`llama`** | native **`POST /api/generate`** / **`POST /api/chat`** |
| иначе `GET /v1/models` → 200 | backend = **`openai`** | completions probe допустим только если нет health-ok shortcut |

Хелперы: **`detect_llm_backend_httpx`**, **`detect_llm_backend_aiohttp`**, **`invalidate_llm_backend_cache`**.

### 7.2 `response_format` → native `format`

| Запрос | OpenAI-shim `/v1/chat/completions` | Native `/api/chat` или `/api/generate` |
|--------|--------------------------------------|----------------------------------------|
| `{"type": "json_object"}` | `{"type": "json_object"}` | `format: "json"` |
| `{"type": "json_schema", "schema": {...}}` | **не** raw schema — см. §7.4 | `format: <JSON Schema dict>` |
| Pydantic `model_json_schema()` (raw dict) | — | `format: <schema dict>` |
| `httpx_compat_generate_json(..., json_format=True)` | chat path, `json_object` | `format: "json"` |
| `httpx_compat_generate_json(..., json_schema=...)` | chat path → §7.4 | `format: <schema dict>` |

Хелперы: **`llama_native_format_from_response_format`**, **`openai_compat_response_format_payload`**.

**Override UGS:** `input_data["json_format"]=true` — gate **`ugs_generation_requests_json_object()`** (`text_llm_constants.py`).

### 7.3 `generate_json`: chat вместо `/v1/completions`

**`httpx_compat_generate_json`** / **`aiohttp_compat_generate_json`** идут в **`/v1/chat/completions`** (или native chat), **минуя** legacy completions, когда:

- backend probe увидел llama-server **`/health` ok** (авто **`_prefer_chat_completion_for_generate`**, reason `llama_server_health_ok`);
- **`json_format=True`** или задан **`json_schema`**;
- ранее completions вернул пустой text / HTTP 400–422 / parser 500 — кэш prefer-chat на base URL.

**Зачем:** chat-tuned GGUF на stack2 на **`/v1/completions`** даёт HTTP 500 `Failed to parse input at pos 0` на длинном markdown (AMKA prose, audit summaries). Retry работал, но лишний round-trip и шум в логах.

Plain-text AMKA (**`amka_llm_text`**, `json_format=False`) после health-ok идёт сразу в chat.

### 7.4 JSON Schema на OpenAI-detected backend

Когда probe классифицирует stack2 как **OpenAI** (`/health` ok), OpenAI-shim принимает в `response_format` только **`text`** | **`json_object`**, не raw schema.

Правило stack0 API:

- если нужна grammar (**json_schema** / raw schema dict) → **`POST /api/chat`** с **`format=<schema>`**, даже при backend = `openai`;
- иначе на OpenAI-ветке **`openai_compat_response_format_payload`** нормализует payload (`json_schema` → `{"type":"json_object"}`).

Контуры: Product Assistant (`ASSISTANT_REPLY_JSON_SCHEMA`), AMKA autofill, AI SDK `generate_object`.

### 7.5 Concurrency gate (`stack2_text_llm_slot`)

Модуль **`api/utils/stack2_text_llm_slot.py`** — process-wide semaphore, зеркало **`LLAMA_CHAT_PARALLEL`** (compose **`stack2-llama-chat`**, дефолт **`1`**, clamp 1–8).

| Env | Где | Назначение |
|-----|-----|------------|
| **`LLAMA_CHAT_PARALLEL`** | `.env.stack2` → проброс в stack0 API/workers | Число параллельных слотов llama-server; API не шлёт больше одновременных HTTP к main chat, чем сервер |

Оборачивает в **`llm_openai_compat_http`**: chat JSON, stream, generate JSON для **`stack2-llama-chat`** (не tool-router / embed / rerank). Reentrant для вложенных compat-вызовов. Лог ожидания: **`[STEP] stack2_text_llm_slot acquired … wait_ms=…`**.

**Зачем:** параллельные AMKA autofill + desktop ensemble stream на single-slot chat → **`ServerDisconnected`** / обрыв SSE.

Desktop ensemble blueprint stream: **`desktop_stream_chat_completion`** (`desktop_chat/llm/runtime.py`) → httpx_compat + slot; **`LlamaService.chat_stream`** делегирует в тот же compat-слой.

### 7.6 Отладка

Непустая **`STACK2_LLM_DEBUG_SAVE_DIR`** — dump request/response JSON (см. §6 выше).

Канон llama-server HTTP: upstream llama.cpp docs (не в дереве канона). Stack2 contract: **`documentation/platform/STACK2-LLM-CONTRACT.md`**.

## 8. UGS gate: какие `generation_type` получают JSON

Источник: `shared/api/services/ugs/text_llm_constants.py` → `ProviderManagerServiceV2` / `LlamaProvider.chat_completion(json_format=…)`.

### 8.1 Music (`MUSIC_LLM_JSON_OBJECT_GENERATION_TYPES`)

| `type_key` | Назначение |
|------------|------------|
| `music_generator_suggest_params` | `POST /suggest-production-params` |
| `music_generator_v3_suggest_params` | V3 suggest |
| `music_generator_evolution_brief` | Music Evolution recipe brief |
| `music_generator_promo_script` | `POST /promo-script` (lyrics+tags JSON) |

**Миграция (stack1):** `shared/api/migrations/applied/20260620_music_promo_script_generation_type.sql` — upsert `music_generator_promo_script`.

Текстовые шаги **без** server JSON: `music_generator_lyrics`, `music_generator_style`, `music_generator_improve_lyrics`, `music_generator_v3_lyrics`, `music_generator_v3_style`.

### 8.2 Marketing cabinet (`MARKETING_LLM_JSON_OBJECT_GENERATION_TYPES`)

| `type_key` | Назначение |
|------------|------------|
| `document_structured_extract` | Autofill preview/async (`document_autofill.py`), без fallback на `text_chat` |
| `marketing_swot_analysis` | SWOT analysis module |
| `marketing_jtbd_extract` | JTBD extract; модель возвращает `{"items":[...]}` (legacy array парсится) |
| `marketing_porter_analysis` | Porter (зарезервировано в gate) |
| `marketing_competitor_report` | Competitor report |
| `marketing_financial_projection` | Financial projection |
| `marketing_channel_mix` | Channel mix |
| `marketing_customer_insights` | Customer insights |

**Миграция (stack1):** `shared/api/migrations/applied/20260620_marketing_structured_llm_generation_types.sql` — upsert `marketing_swot_analysis`, `marketing_jtbd_extract`.

### 8.3 Прочие UGS и прямые HTTP

| Контур | JSON-режим |
|--------|------------|
| `professional_worlds_realtor_object_extract` | UGS gate + schema prompt; intake SSE |
| Site Studio AI | `DocEditorService.ai_complete(..., json_format=True)` → UGS `text_chat` + `input_data.json_format` |
| Presentation / EWRP slides | `PresentationContentGeneratorService` → `response_format: json_object`; EWRP slide text regen → `json_format=True` |
| Desktop AI JSON sidecars | `DESKTOP_AI_CHAT_JSON_RESPONSE_FORMAT` default **`1`**; `desktop_llm_json_object` |
| Assistant plan / wrath / orch | `httpx_compat_chat_completion_json` + `json_object` |
| AMKA | `amka_llm_json*` / `amka_llm_json_raw` → `json_format=True`; `amka_llm_text` → plain chat path (§7.3) |
| i18n rewrite | `response_format: json_object` в `i18n_rewrite_stack2_service` |
| AI SDK `generate_object` | `httpx_compat_generate_json(..., json_schema=schema)` |

### 8.4 Контрактные тесты

`shared/api/tests/test_music_llm_json_mode.py`, `test_marketing_llm_json_mode.py`, `test_misc_llm_json_mode.py`, `test_amka_llm_json_mode.py`, `test_llm_json_schema_pass_through.py`, `test_desktop_llm_json_sidecar.py`, `test_llm_chat_compat.py`, **`test_stack2_text_llm_slot.py`**.

Продуктовые каноны: **`documentation/product/MUSIC-GENERATOR.md`**, **`documentation/product/MUSIC-FORGE-APP.md`**, **`documentation/product/marketing/MARKETING-PROJECT-RAG.md`**, **`documentation/product/DESKTOP-LLAMA-CHAT.md`**, **`documentation/product/SITE-STUDIO.md`**, **`documentation/product/EWRP-REVOLUTIONARY-PRESENTATIONS.md`**, **`documentation/product/PROFESSIONAL-WORLDS.md`**. (Historical `MUSIC-GENERATOR-FLOW.md` soft-retired under `trash/` (id 20260812-155119).)

## Ссылки

- Старт API: **`STACK0-API-STARTUP.md`**.
- Правило агента/IDE (кратко): **`.cursor/rules/eliteew-llm-env-and-naming.mdc`**.
