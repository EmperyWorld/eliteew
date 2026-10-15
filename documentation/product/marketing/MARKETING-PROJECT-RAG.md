# Маркетинговый кабинет: RAG по проекту и автозаполнение

Документ описывает **текущую** реализацию: откуда берётся контекст, как устроена векторная коллекция Qdrant, как вызывается семантический поиск и как связаны **автозаполнение из документа** и **генерация из контекста проекта**.

См. также обзор кабинета: [MARKETING-CABINET.md](MARKETING-CABINET.md). Агент с инструментами (router + RAG + UGS): [MARKETING-TOOL-AGENT.md](MARKETING-TOOL-AGENT.md). Канонический контракт `stack2` для chat/embed/rerank: [../../platform/STACK2-LLM-CONTRACT.md](../../platform/STACK2-LLM-CONTRACT.md).

---

## 1. Два слоя контекста для AI

| Слой | Источник | Содержание |
|------|----------|------------|
| **Структурированный контекст (Postgres)** | `build_project_context` → `format_project_context_for_prompt` | Карточка проекта, компания, цели, сегменты, ключевые сущности кабинета — то, что агрегируется в SQL/JSON для промпта. |
| **Семантический слой (Qdrant)** | Коллекция **`marketing_project_rag`** | Чанки **`extracted_text`** из **`unified_content`**, привязанные к **`project_id`** и подходящие по MIME/длине. |

Оба слоя **дополняют друг друга**: RAG не заменяет Postgres и не содержит чаты, SWOT-тексты целиком и т.п., если они не лежат в извлечённом тексте загруженных файлов. В вектор попадают **строки `unified_content`** с достаточным `extracted_text` (файлы проекта и при необходимости **синтетические записи** с результатом ИМК, см. §2.3). Полное «зеркало» прочих сущностей кабинета в Qdrant — вне текущего объёма.

---

## 2. Qdrant: коллекция `marketing_project_rag`

### 2.1 Назначение

- Семантический поиск по **фрагментам документов** проекта (не по имени файла, а по смыслу чанка).
- Те же эмбеддинги, инфраструктурно, что и у chat memory. **Live Phase 2 (gpu141):** **`Qwen3-Embedding-0.6B-Q8_0.gguf`** → **`AI_EMBEDDINGS_DIMENSION=1024`** (канон: [STACK2-LLM-CONTRACT.md](../../platform/STACK2-LLM-CONTRACT.md)). Legacy 4B/**2560** и 8B/**4096** — только rollback + полный реиндекс Qdrant. Расстояние **cosine** (`shared/api/services/marketing_project_rag_service.py`, общий клиент с `chat_memory_service`). При смене dim — реиндекс коллекции.

### 2.2 Payload точки

- `marketing_project_id` — фильтр поиска (изоляция проектов).
- `content_id` — строка `unified_content.id`.
- `chunk_index` — порядковый номер чанка внутри документа.
- `text` — текст фрагмента.
- `mime_type`, `content_type`, `name` — метаданные для отладки/логов.

Идентификатор точки детерминирован: `uuid5` от namespace + `{project_id}_{content_id}_{chunk_index}` — переиндексация **идемпотентна**.

### 2.3 Что попадает в индекс

Условия (упрощённо):

- `unified_content.project_id IS NOT NULL`, `deleted_at IS NULL`.
- MIME из набора «документы/текст» — см. `_mime_eligible_for_marketing_rag` (PDF, Office, plain text и т.д.; не «голые» картинки без текста).
- `extracted_text` после trim ≥ **60** символов.
- **`marketing_rag_included IS TRUE`** — иначе строка не индексируется, а при очередном вызове индексации чанки в Qdrant для этой пары `(project_id, content_id)` **удаляются** (колонка и поведение: миграция `shared/api/migrations/applied/20260331_02_unified_content_marketing_rag_included.sql`, логика `index_unified_content_marketing_rag` в `marketing_project_rag_service.py`).
- Чанки: размер ~900 символов, перекрытие 100, максимум **200** чанков на документ.

**Синтетические строки `unified_content` для ИМК:** отчёт прогона можно вынести в RAG без отдельного файла — создаётся/обновляется одна запись с `content_type = 'ai_result'`, `mime_type = text/markdown`, `extracted_text = result_text`, в **`metadata`**: `{"source": "imc_research_run", "imc_research_run_id": "<uuid>"}` (идемпотентный upsert по проекту и id прогона). В **`file_data`** пишутся те же UTF-8 байты, что и текст отчёта (`storage_backend = postgresql`), иначе скачивание через файловый менеджер (`GET /api/v1/content/{id}/download`) возвращало бы 404. Реализация: `shared/api/services/marketing_project_rag_sources_service.py`, эндпоинт `POST .../rag-sources/from-imc-run/...`. Записи, созданные до этого исправления без `file_data`, можно починить повторным вызовом того же `from-imc-run` для соответствующего `imc_research_run_id`.

### 2.4 Когда вызывается индексация

- После успешной обработки контента в очереди: **`queue_handlers.handle_unified_content_processing`** → `index_unified_content_marketing_rag` (best-effort; сбой RAG не ломает пайплайн контента).
- При обновлении контента через **`ContentStorageService.update_content`** (в т.ч. после появления/смены `extracted_text`).
- Перед upsert для документа старые точки по паре `(project_id, content_id)` **удаляются**, затем пишутся новые.
- При soft delete / снятии привязки к проекту — удаление чанков из Qdrant (см. сервис и вызовы из `content_storage_service`).

### 2.5 UI и API «Источники RAG»

Префикс **`/api/v1/marketing-cabinet`** (и legacy `/api/marketing-cabinet`):

| Метод | Путь | Назначение |
|--------|------|------------|
| GET | `/projects/{project_id}/rag-sources` | Список строк `unified_content` проекта, пригодных для списка (достаточный текст + MIME **или** синтетика ИМК), с полем `marketing_rag_included`. |
| GET | `/projects/{project_id}/rag-sources/semantic-search?q=…` | Семантический поиск по чанкам в Qdrant (`search_marketing_project_rag_chunks`): эмбеддинг запроса + `query_points`, только чтение, проверка доступа к проекту. Параметры: **`limit`** (по умолчанию **16**, макс. 32), опционально **`min_score`**. |
| PATCH | `/projects/{project_id}/rag-sources/content/{content_id}` | Тело `{ "marketing_rag_included": true/false }` — обновление флага; при `true` — переиндексация, при `false` — удаление чанков в Qdrant. Права: мутации как у кабинета (`get_accessible_project`, `for_mutation=True`). |
| POST | `/projects/{project_id}/rag-sources/from-imc-run/{imc_research_run_id}` | Upsert синтетической записи из `imc_research_runs.result_text` и индексация. |

Роутер: `shared/api/routers/marketing_cabinet/project_rag_sources.py`. Фронт: модуль кабинета «Источники RAG», клиент `shared/web/frontend/src/services/api/marketingProjectRagApi.ts`, кнопки на экране детали ИМК (`ImcResearchView`).

### 2.6 Backfill

Скрипт: `shared/api/scripts/backfill_marketing_project_rag.py` — проходит подходящие строки `unified_content` и вызывает ту же функцию индексации (строки с `marketing_rag_included = false` при вызове **не** получат чанков).

---

## 3. Поиск RAG (`search_marketing_project_rag`)

1. Проверка доступа к проекту: **`get_accessible_project`** (тот же пользователь, что и в API кабинета).
2. Эмбеддинг **текста запроса** через `LLAMA_EMBEDDING_URL` (обрезка запроса, напр. до 4000 символов).
3. **`query_points`** в Qdrant с **фильтром** `marketing_project_id == project`.
4. Опционально **`min_score`** (cosine): отсекаются слабые совпадения — используется в IMC (например порог по умолчанию **0.35** для `imc_cabinet_filler`).
5. Возвращается список **строк-текстов чанков** (не сырые id документов).

Форматирование для промпта: **`format_rag_chunks_for_prompt`** — нумерованные блоки и заголовок «Семантически релевантные фрагменты из документов проекта (RAG)».

Объединение с Postgres: **`merge_project_context_text_with_rag`** — к уже готовому тексту из `format_project_context_for_prompt` **дописывается** блок RAG (по умолчанию до **16** чанков, параметр **`limit`**), если запрос не пустой и поиск что-то нашёл. При недоступности Qdrant/Llama возвращается **исходный** текст без RAG.

---

## 4. Где вызывается RAG (потребители)

| Место | Как формируется запрос к RAG |
|--------|------------------------------|
| **AI Studio / tool-agent** | `marketing_cabinet/ai.py` — query строится из запроса пользователя + свежего excerpt диалога; merge в контекст проекта идёт с `min_score=0.22`, чтобы снизить шум от слабых совпадений. |
| **Контекстный чат** | `chat.py` — query строится из текущего сообщения + последних реплик диалога; merge в контекст проекта идёт с `min_score=0.22`, чтобы follow-up вопросы чаще подтягивали релевантные документы, а не случайный шум. |
| **JTBD, Analysis (SWOT), Researches** | `jtbd.py`, `analysis.py`, `researches.py` — `merge_project_context_text_with_rag` с query из задачи. |
| **Document autofill** | `document_autofill.py` — см. §5. |
| **IMC: заполнитель** | `imc_service.py`: тип **`imc_cabinet_filler`** — `build_project_context` + merge с query из брифа; провайдер **`imc_cabinet_filler_provider`**, ответ JSON. Лимиты/порог: `type_metadata.imc_rag_limit`, `imc_rag_min_score`. |
| **IMC: исследования `imc_rag_*`** | `imc_service.py`: для типов с **`imc_use_merged_context`** / префиксом **`imc_rag_`** — объединённый контекст (Postgres + RAG), исполнение через **`imc_rag_research_provider`** (markdown, без веб-поиска). См. [IMC-MISO-ARCHITECTURE.md](IMC-MISO-ARCHITECTURE.md). |

**Про MISO:** типы UGS с `provider = miso_provider` по-прежнему идут в MISO; **пять ключей `imc_rag_*` после миграции RAG-only на MISO не маршрутизируются** — см. [IMC-MISO-ARCHITECTURE.md](IMC-MISO-ARCHITECTURE.md). Исторический проектный пакет IMC вынесен в archive reality-audit и может отставать от кода.

Провайдеры UGS (**`imc_rag_research_provider`**, **`imc_cabinet_filler_provider`**, **`miso_provider`**) читают **`marketing_project_rag_context`** из `input_data`, если оно заполнено на этапе сборки запуска.

---

## 5. Автозаполнение разделов (`document_autofill`)

Роутер: **`/api/v1/marketing-cabinet/autofill/...`** (`shared/api/routers/marketing_cabinet/document_autofill.py`).

### 5.1 Цели (target_section)

Строковые enum’ы вроде `jtbd`, `value_propositions`, `swot`, `competitors`, `researches`, `segments`, `campaigns`, `funnels`, `tasks`, `alerts` — соответствуют разделам кабинета; модель возвращает **JSON с черновиками** под выбранную схему (см. Pydantic-модели `*Draft` в том же файле).

### 5.2 Режимы

- **`preview`** — сгенерировать черновики, **не** писать в БД сущности (пользователь выбирает, что применить).
- **`apply`** — применить переданные **`draft_items`** (после preview) к таблицам маркетинга (вставки/обновления через существующие хелперы разделов).

Есть **синхронные** и **асинхронные** (`/async`) варианты preview; тяжёлая генерация идёт через UGS **`document_structured_extract`** со stack2 **`format=json`** (без fallback на `text_chat`), запись в **`marketing_ai_runs`**, опрос статуса по `request_id`.

**Структурированные type_key (stack2 JSON gate, 2026-06):**

| `type_key` | Роутер / модуль | Примечание |
|------------|-----------------|------------|
| `document_structured_extract` | `document_autofill.py` | Основной autofill preview/async |
| `marketing_swot_analysis` | `analysis.py` | SWOT JSON |
| `marketing_jtbd_extract` | `jtbd.py` | Ответ `{"items":[...]}`; legacy array в парсере |

**Миграции stack1:** `20260620_marketing_structured_llm_generation_types.sql` (SWOT + JTBD). Gate: `ugs_generation_requests_json_object()` в `text_llm_constants.py`. Канон HTTP: **`documentation/platform/docker-re_doc/STACK0-LLM-OVERVIEW.md`** §8.2.

### 5.3 Источник «Из документа»

- **`content_id`** — файл из **`unified_content`** проекта; текст для промпта берётся из обработанного контента (с ограничением длины, см. `_MAX_SOURCE_TEXT_LENGTH`).
- Контекст для модели: **`build_project_context` + `merge_project_context_text_with_rag`**, где **query для RAG** собирается из **`user_instruction`** и начала текста документа (чтобы подтянуть релевантные чанки из других файлов проекта).

### 5.4 Генерация только из проекта (без файла)

- Эндпоинт **`POST .../autofill/generate-from-project/async`** — «синтетический» источник: **`_PROJECT_CONTEXT_SOURCE_ID`**, не реальный `unified_content`.
- Промпт строится через **`_build_prompt_project_only`**; RAG-query — из **`user_instruction`** и имени проекта.
- Массовый запуск «Все разделы» в UI — очередь из целей **`MARKETING_PROJECT_AUTOFILL_ALL_TARGETS`** (`marketingCabinetApi.ts`); после UGS — reconciliation с применением черновиков к сущностям (см. `MARKETING-CABINET.md`).
- Для staged-runtime `AMKA` используется тот же project-only prompt и тот же safe write-back слой, но собственные `run/step` таблицы и отдельная timeline-история.

### 5.5 Лимиты и идемпотентность

- **Rate limit** маркетингового AI: `check_marketing_cabinet_ai_rate_limit`.
- **Идемпотентность** async-запусков: `ensure_marketing_idempotency` по ключу пользователя.

---

## 6. Связанные файлы (код)

| Назначение | Путь |
|------------|------|
| Сервис RAG (индекс, поиск, merge) | `shared/api/services/marketing_project_rag_service.py` |
| Список источников / флаг / ИМК → UC | `shared/api/services/marketing_project_rag_sources_service.py` |
| Роутер источников RAG | `shared/api/routers/marketing_cabinet/project_rag_sources.py` |
| Контекст проекта (Postgres) | `shared/api/routers/marketing_cabinet/common.py` — `build_project_context`, `format_project_context_for_prompt` |
| Автозаполнение | `shared/api/routers/marketing_cabinet/document_autofill.py` |
| Индексация после очереди | `shared/api/workers/queue_handlers.py` |
| Обновление контента и reindex | `shared/api/services/unified_content/content_storage_service.py` |
| IMC + RAG | `shared/api/services/imc/imc_service.py` |
| Клиент фронта (autofill API) | `shared/web/frontend/src/pages/MarketingCabinet/marketingCabinetApi/` |

---

## 7. Направления развития (не в коде)

- **Внутреннее зеркало** сущностей кабинета (чаты, блоки разделов) **только для вектора**, без отдельного UI-списка: служебные фрагменты → тот же пайплайн с расширенным `payload` (`source_kind`, `entity_id`). Синтетические **`unified_content`** для **ИМК** уже поддерживаются (см. §2.3).
