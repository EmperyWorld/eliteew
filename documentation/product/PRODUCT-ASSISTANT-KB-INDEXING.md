# Ассистент: индексация базы знаний (KB → Qdrant)

**Тип:** how-to + reference (Diátaxis).  
**Аудитория:** администратор продукта, автор `kb-*.md`, оператор runtime.  
**Связанный продуктовый канон:** [`PRODUCT-ASSISTANT-HANDBOOK.md`](PRODUCT-ASSISTANT-HANDBOOK.md).  
**Навигация по ролям:** [`SPRAVOCHNIK-AI.md`](SPRAVOCHNIK-AI.md).  
**Исходники статей RAG:** [`handbook-kb-articles/README.md`](handbook-kb-articles/README.md) (**106** файлов `kb-*.md` на 2026-07-18).

## Назначение

База знаний **Ассистента** — это документы в Postgres (`assistant_kb_documents`) и векторные чанки в Qdrant (коллекция **`product_assistant_kb`**). Пока документ не в статусе **`indexed`**, RAG **не** подставляет его фрагменты в промпт чата.

Индексация **отделена** от RAG desktop AI Chat и маркетинговых проектов (см. таблицу контуров в [`PRODUCT-ASSISTANT-HANDBOOK.md`](PRODUCT-ASSISTANT-HANDBOOK.md)).

## Поток данных

```mermaid
flowchart LR
  A["handbook-kb-articles/kb-*.md"] --> B["sync / upload / edit"]
  B --> C["Postgres assistant_kb_documents"]
  C --> D["Chunk + embed"]
  D --> E["Qdrant product_assistant_kb"]
  E --> F["RAG в промпте Ассистента"]
```

| Этап | Где | Результат |
|------|-----|-----------|
| Источник текста | `documentation/product/handbook-kb-articles/kb-*.md` или загрузка в админке | Тело документа в Postgres |
| Upsert | `product_assistant_kb_store.py` | Строка с `source_filename`, `title`, `body` |
| Индексация | `product_assistant_rag_service.py` | Чанки + эмбеддинги в Qdrant |
| Поиск | `search_product_assistant_kb_hybrid` | Фрагменты в `_compose_assistant_prompt` |

**Идемпотентность по имени файла:** повторная синхронизация `kb-foo.md` **обновляет** существующую строку с тем же `source_filename` и **переиндексирует** (меняется `updated_at`).

## Stack0: доступ API к `kb-*.md`

Каталог статей лежит **вне** дерева `shared/api` (`documentation/product/handbook-kb-articles`). Резолвер: `resolve_handbook_kb_articles_dir()` в `product_assistant_kb_sync.py`.

**Порядок резолвера** (первый существующий каталог побеждает):

1. **`ASSISTANT_HANDBOOK_KB_ARTICLES_DIR`** — явный абсолютный путь (CI, нестандартный checkout); если задан, но не каталог → **503** / `FileNotFoundError`.
2. **`/app/documentation/product/handbook-kb-articles`** — stack0 mount или baked COPY.
3. **Repo scan** — поиск `documentation/product/handbook-kb-articles` вверх от `cwd` и от модуля sync (локальный CLI на command-center).
4. **Seeded fallback** — `shared/api/data/handbook-kb-articles` (immutable test-runner / окружения без полного checkout); в логах API — `using seeded fallback`.
5. Иначе — путь по умолчанию от модуля (может не существовать → «Assistant dir not found»).

| Контур | Как API видит `kb-*.md` | Проверка |
|--------|-------------------------|----------|
| **Dev / command-center `.136`** (`stack0_b.yml`, bind-mount) | `../../documentation` → `/app/documentation` | `podman exec stack0-eliteew-api-prod ls /app/documentation/product/handbook-kb-articles \| wc -l` |
| **Prod-core `.111`** (`stack0_b.prod-baked.override.yml`) | **В baked API-образе:** `COPY …/handbook-kb-articles` в `Dockerfile.prod-baked` → `/app/documentation/product/handbook-kb-articles`. **Bind documentation на диске `.111` не нужен.** | `podman exec stack0-eliteew-api-prod-baked ls /app/documentation/product/handbook-kb-articles \| wc -l` |
| **Override** | env **`ASSISTANT_HANDBOOK_KB_ARTICLES_DIR`** — абсолютный путь (CI, нестандартный checkout) | приоритет над mount/bake и seeded fallback |

После правки `stack0_b.yml` или rebake API — **recreate** (`eectl --yes recreate --include stack0-backend` на `.136`; на prod-core — `bash docker/scripts/eliteew-deploy.sh release stack0 --all`).

**Синхронизация в Qdrant:** после изменения `kb-*.md` в git на `.136` — sync/reindex (админка или CLI). На prod-core **новые статьи попадают в API только после** release stack0 `--all` (baked образ) и recreate; отдельный rsync `documentation/` на `.111` **не** используется.

## API (admin, префикс `/api/v1/product-desktop`)

Роутер: `shared/api/routers/product_desktop_assistant_kb.py` (подключается из `product_desktop.py`). Статические пути (`summary`, `upload-limits`, `sync-handbook`, `purge`, `uploads`) объявлены **до** `/kb/{doc_id:uuid}`.

| Метод | Путь | Назначение |
|-------|------|------------|
| GET | `/admin/assistant/kb/summary` | Сводка: total, indexed, indexing, error, total_chunks |
| GET | `/admin/assistant/kb/upload-limits` | Лимиты загрузки: `max_files`, `max_bytes_per_file` (из env) |
| GET/PATCH/DELETE | `/admin/assistant/kb/{doc_id:uuid}` | Документ по UUID; литералы вроде `summary` не попадают в `{doc_id}` |
| GET | `/admin/assistant/kb` | Список документов (`status`, `last_error`, `chunk_count`, …) |
| POST | `/admin/assistant/kb/sync-handbook` | Sync всех `kb-*.md` (**202** фон; `?dry_run=true` — **200** JSON) |
| POST | `/admin/assistant/kb/{doc_id:uuid}/reindex` | Переиндекс одного документа |
| POST | `/admin/assistant/kb/reindex-all` | Переиндекс всех (**202** фон) |
| POST | `/admin/assistant/kb/upload` | Загрузка одного файла (Tika) |
| POST | `/admin/assistant/kb/uploads` | Пакетная загрузка (multipart `files[]`; частичный успех: `ok` + `failed`) |
| POST | `/admin/assistant/kb/purge` | Удалить **все** строки KB + сбросить коллекцию Qdrant (`{"confirm":"purge"}`) |
| POST | `/admin/assistant/kb` | Ручной текст |

**OpenAPI / Swagger:** для фоновых операций контракт — **`202 Accepted`** с телом `{"status":"started",…}`, а не `200`:

- `POST …/sync-handbook` **без** `dry_run=true`
- `POST …/reindex-all`

Dry-run sync и синхронные CRUD/reindex одного документа возвращают **200** (или 4xx/5xx при ошибке).

## Чеклист оператора после деплоя / правок `kb-*.md`

1. `podman exec stack0-eliteew-api-prod-baked ls /app/documentation/product/handbook-kb-articles | wc -l` (prod-core) или `stack0-eliteew-api-prod` (`.136` dev) — каталог виден (~106 `kb-*.md`).
2. Админка → **Проверить sync (dry-run)** — `files` совпадает с числом статей.
3. **Синхронизировать kb-*.md** — дождаться toast «Индексация завершена»; summary: `error=0`.
4. При `error > 0` — **Показать ошибки**, прочитать `last_error`, исправить embed/Qdrant/текст → **Переиндексировать**.
5. Preview промпта + вопрос в desktop Ассистент — футер источников KB.


| Статус | Смысл | Действие оператора |
|--------|-------|-------------------|
| `indexing` | Индексация в процессе | Дождаться; в админке строка «Индексация в процессе» |
| `indexed` | Чанки в Qdrant, RAG доступен | — |
| `error` | Сбой (см. `last_error` в списке) | Исправить текст/сервисы → **Переиндексировать** |

Сводка по всем документам: **`GET /api/v1/product-desktop/admin/assistant/kb/summary`** (total / indexed / indexing / error / total_chunks).

## Сценарии

### 1. Одна статья из git (разработчик)

1. Отредактировать файл в `handbook-kb-articles/` (один файл ≈ одна тема).
2. На стенде с доступом к Postgres, Qdrant и embed-сервису:

```bash
cd shared/api && PYTHONPATH=.. UV_PROJECT_ENVIRONMENT=../../.venv uv run python scripts/sync_handbook_kb_articles.py --dry-run
cd shared/api && PYTHONPATH=.. UV_PROJECT_ENVIRONMENT=../../.venv uv run python scripts/sync_handbook_kb_articles.py
```

Флаг **`--limit N`** — обработать только первые N файлов (отладка).

3. Проверить в админке **«Ассистент»** (`?section=assistant`): документ **`indexed`**, в summary вырос `total_chunks`.
4. В desktop **Ассистент** задать вопрос по теме статьи — в ответе футер **«Источники справочника»** (если RAG включён в настройках).

### 2. Массовая синхронизация всех `kb-*.md`

**CLI** (оператор на хосте API, env как у stack0):

```bash
cd shared/api && PYTHONPATH=.. UV_PROJECT_ENVIRONMENT=../../.venv uv run python scripts/sync_handbook_kb_articles.py
```

**Админка:** кнопка **«Синхронизировать kb-*.md из репозитория»** → `POST /admin/assistant/kb/sync-handbook` (**202**, фон). Без лимита — **диалог подтверждения** (~106 статей); с **«Лимит файлов»** — sync сразу.  
**Проверка без записи:** **«Проверить sync (dry-run)»** → `POST .../sync-handbook?dry_run=true` (сразу ответ: `files`, `ok`, `fail`, `handbook_dir`; **без** Postgres/Qdrant/embed). Поле **«Лимит файлов»** (1–500, пусто = все) передаёт `limit=N` — удобно для отладки на prod без полного прогона **106** статей; toast и строка «Последний dry-run» показывают **лимит**, если он задан; под полем — подсказка про пустое значение (= весь каталог).

**Caveat dry-run:** поле **`fail` в dry-run всегда `0`** — проверяется только чтение `kb-*.md` с диска; сбои embed/Qdrant/Postgres **не** симулируются. После полного sync смотрите `fail` в ответе фоновой задачи (логи `[STEP] assistant_kb`), summary `error` и `last_error` в списке документов.

Сервис: `shared/api/services/product_assistant_kb_sync.py`.  
Каталог в git: `documentation/product/handbook-kb-articles/`. В контейнере: **`/app/documentation/product/handbook-kb-articles`** (dev — bind на `.136`; prod-core — baked в API-образ). Override: **`ASSISTANT_HANDBOOK_KB_ARTICLES_DIR`**. См. раздел **Stack0** выше.

### 3. Загрузка файла или ручной текст (админка)

- **Один файл:** `POST …/upload` — Tika (`TIKA_URL`, обычно stack4) извлекает текст.
- **Пакет:** `POST …/uploads` — несколько файлов; лимиты заранее: `GET …/upload-limits` → `max_files`, `max_bytes_per_file`.
- **Env загрузки:** **`ASSISTANT_KB_UPLOAD_MAX_BYTES`** (по умолчанию 20 МБ на файл); **`ASSISTANT_KB_BULK_MAX_FILES`** (по умолчанию 256, clamp 1–500 в API).
- **Текст вручную:** поле «Добавить и проиндексировать» → `POST …/kb`.
- После сохранения статус проходит `indexing` → `indexed` или `error`.

### 3a. Полный сброс KB (оператор)

`POST …/kb/purge` с телом `{"confirm":"purge"}` — удаляет **все** строки `assistant_kb_documents` и сбрасывает коллекцию Qdrant `product_assistant_kb`. Использовать перед чистым re-sync из git или после смены embedder/dimension; **необратимо** для текущих документов в Postgres/Qdrant.

### 4. Переиндексация

| Объём | UI | API |
|-------|-----|-----|
| Один документ | **Переиндексировать** в строке KB | `POST .../kb/{id}/reindex` |
| Все документы | **Переиндексировать все документы** | `POST .../kb/reindex-all` (фон) |

Используйте после смены модели эмбеддингов, починки Qdrant или правки `body` без смены `source_filename`.

### 5. FAQ (не KB)

Записи FAQ (`assistant_faq_entries`) **не** проходят Qdrant; попадают в промпт по релевантности (`select_faq_entries_for_prompt`). Редактирование — вкладка FAQ в той же админке; отдельная переиндексация не нужна.

## Проверка после индексации

1. **Админка → Ассистент → документы KB:** summary `indexed` ≈ `total`, `error` = 0 (или разобрать `last_error`).
2. **Preview промпта:** `POST /admin/assistant/preview` с тестовым вопросом — в блоке RAG есть метки источников.
3. **Desktop Ассистент:** вопрос двумя формулировками; при стриме — раннее SSE `meta.rag_source_labels` и футер источников в ответе.
4. **Логи API:** `[STEP] assistant_kb`, `synced kb-….md`, ошибки embed/Qdrant.

## Зависимости runtime

| Компонент | Назначение |
|-----------|------------|
| Postgres (EWA / stack) | `assistant_kb_documents` |
| Qdrant (stack1) | коллекция `product_assistant_kb` |
| Embed HTTP (stack2 / TEI profile) | векторизация чанков |
| Tika (stack4) | только загрузка бинарных файлов в админке |
| Llama / LLM (stack2) | **не** участвует в индексации; только в ответе чата |

### Env: эмбеддинги и индексация (stack0)

| Env | Назначение | Примечание |
|-----|------------|------------|
| **`LLAMA_EMBEDDING_URL`** | HTTP base для `/v1/embeddings` или `/api/embed` | если пуст — fallback на **`LLAMA_URL`** |
| **`LLAMA_EMBEDDING_MODEL`** / **`LLAMA_MODEL_EMBEDDING`** | id модели эмбеддингов | unified_settings |
| **`LLAMA_EMBED_TIMEOUT_SEC`** / **`LLAMA_EMBEDDING_TIMEOUT_SEC`** | таймаут HTTP embed | |
| **`AI_EMBEDDINGS_DIMENSION`** | размерность вектора Qdrant | по умолчанию **768**; смена → reindex-all |
| **`AI_EMBEDDINGS_BATCH_SIZE`** | размер batch при embed чанков | |
| **`AI_EMBEDDINGS_ENABLED`** | master-switch embed | `false` → индексация падает в `error` |
| **`RAG_RERANK_BASE_URL`** | cross-encoder rerank в hybrid search | пусто = только vector + keyword; **не** блокирует индексацию |
| **`ASSISTANT_HANDBOOK_KB_ARTICLES_DIR`** | каталог `kb-*.md` для sync | см. порядок резолвера выше |
| **`ASSISTANT_KB_UPLOAD_MAX_BYTES`** | max размер одного upload | default 20 MiB |
| **`ASSISTANT_KB_BULK_MAX_FILES`** | max файлов в `POST …/uploads` | default 256, clamp ≤500 |
| **`TIKA_URL`** | извлечение текста из бинарных upload | stack4 |

При **`Assistant dir not found`** на API: на **`.136`** — bind `documentation` в `stack0_b.yml` + recreate; на **prod-core** — `bash docker/scripts/eliteew-deploy.sh release stack0 --all` (handbook в baked образе) + recreate `*-prod-baked`; либо **`ASSISTANT_HANDBOOK_KB_ARTICLES_DIR`**; либо CLI на хосте с полным checkout (см. **Stack0**); в CI/test-runner — seeded fallback `api/data/handbook-kb-articles`.

## Типовые сбои

| Симптом | Вероятная причина | Шаг |
|---------|-------------------|-----|
| `error`, `last_error` embed timeout | stack2 / embed недоступен | `eectl status`, health embed, retry reindex |
| `error`, body too short | Пустой или короткий `.md` | Дополнить текст (мин. ~20 символов) |
| RAG пустой при `indexed` | `rag_enabled=false` или вопрос вне темы KB | Настройки RAG + формулировка из статьи |
| sync 202, долго `indexing` | Много файлов / медленный embed | Summary polling в админке, логи API |
| Дубликаты по смыслу | Несколько `kb-*.md` на одну тему | Объединить или уточнить синонимы в одном файле |

## Связанные файлы кода

| Модуль | Роль |
|--------|------|
| `shared/api/services/product_assistant_kb_sync.py` | Sync `kb-*.md` → upsert + index; `resolve_handbook_kb_articles_dir()` |
| `shared/api/services/product_assistant_kb_store.py` | CRUD, chunk, статусы |
| `shared/api/services/product_assistant_rag_service.py` | Qdrant search, hybrid RAG |
| `shared/api/scripts/sync_handbook_kb_articles.py` | CLI-обёртка |
| `shared/api/routers/product_desktop_assistant_kb.py` | Admin KB API (sync, purge, bulk upload, upload-limits) |
| `shared/api/routers/product_desktop.py` | include `kb_router` |
| `shared/api/data/handbook-kb-articles/` | seeded fallback для sync без полного checkout |
| `docker/stack/stack0_b.yml` | Dev `.136`: bind `documentation` → `/app/documentation` |
| `docker/builders/stack0-api/Dockerfile.prod-baked` | Prod-core: COPY `handbook-kb-articles` в API-образ |
| `docker/stack/stack0_b.prod-baked.override.yml` | Prod-core: **без** bind `documentation` |
| `shared/web/frontend/src/pages/Admin/assistant/AssistantKbPanel.tsx` | UI KB (dry-run, sync, bulk, purge, фильтр) |
| `shared/web/frontend/src/pages/Admin/assistant/useAssistantKbAdmin.ts` | HTTP-клиент admin KB |
| `shared/web/frontend/src/pages/Desktop/services/productDesktopAssistantOpenApi.ts` | OpenAPI SSOT bridge (Wave 3); SSE stream overlay остаётся hand в `productDesktopApi/assistant.ts` |
| `shared/api/tests/test_product_assistant_kb_sync.py` | Тест резолвера пути kb-*.md |

## Когда обновлять статьи и переиндексировать

После заметных изменений UX продукта обновите соответствующие `kb-*.md` (таблица тем — [`handbook-kb-articles/README.md`](handbook-kb-articles/README.md)) и выполните sync или переиндексацию. Точечные чеклисты по подсистемам — блоки «Синхронизация с продуктом» в [`PRODUCT-ASSISTANT-HANDBOOK.md`](PRODUCT-ASSISTANT-HANDBOOK.md) (EWRP, магазин, уведомления, генератор песен и др.).

### Статьи про сам Ассистент (держать в sync с UI)

При изменении `AssistantApp` / админки KB обновляйте и **переиндексируйте** (или полный sync) минимум:

| Файл | Темы |
|------|------|
| `kb-spravochnik-i-obrashcheniya.md` | Что такое Ассистент, Обращения, лимиты |
| `kb-spravochnik-chastye-voprosy-i-vstavka.md` | FAQ, поиск, «Показать в чате» |
| `kb-spravochnik-interfeys-chata-i-export.md` | Экспорт, стоп, «Помогло», источники, hotkeys |
| `kb-spravochnik-ssylki-otkryt-prilozhenie-v-otvete.md` | Кликабельные ссылки на приложения в ответе |
| `kb-spravochnik-limity-zaprosov-i-ozhidanie.md` | Лимит частых запросов, обратный отсчёт секунд |
| `kb-spravochnik-populyarnye-voprosy-i-chipy.md` | Chips в пустом чате, «Показать в чате» без модели |
| `kb-spravochnik-istochniki-i-podbor-dokumentov.md` | «Источники справочника», «Подбираю по документам» |
| `kb-spravochnik-rannye-soobshcheniya-i-prokrutka.md` | «Ранние сообщения», «К новым сообщениям» |
| `kb-spravochnik-ochistit-chat-i-dlinnyy-vopros.md` | Очистить чат, лимит ввода, копировать ответ FAQ |
| `kb-spravochnik-goryachie-klavishi-i-vvod.md` | Enter, Shift+Enter, Ctrl+., /, Escape |
| `kb-spravochnik-pomoglo-i-obratnaya-svyaz.md` | «Помогло», обратная связь по ответу |
| `kb-admin-spravochnik-sync-handbook-limity.md` | Sync handbook, dry-run, лимит файлов (админ) |
| `kb-trey-spravochnik-obrashcheniya-i-bystrye-deystviya.md` | Трей, ПКМ, быстрый доступ |

Тексты — **простым языком**, без путей к коду и имён таблиц; синонимы формулировок пользователей приветствуются (см. [`handbook-kb-articles/README.md`](handbook-kb-articles/README.md)).
