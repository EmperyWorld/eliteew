# Продукт «Ассистент» (FAQ + чат, админка)

**Точка входа по ролям (пользователь / админ / KB / разработчик):** [`SPRAVOCHNIK-AI.md`](SPRAVOCHNIK-AI.md).

В интерфейсе это **не** каталог `documentation/` репозитория. Здесь — встроенный помощник на рабочем столе и **раздел единой админ-панели** с той же подписью «Ассистент».

## Назначение

- Пользователь в приложении **«Ассистент»** на рабочем столе видит FAQ и ведёт диалог; ответ собирается **на сервере** (Llama), в промпт подмешиваются FAQ, **последние сообщения чата** (до 6 turn'ов) и при включённом RAG — фрагменты из базы документов (семантический индекс; запрос обогащается предыдущим вопросом пользователя для уточнений).
- **Тематика ответов:** только продукт EliteEW. Вопросы вне темы (погода, общие факты и т.п.) — вежливый отказ; если ответа нет в FAQ/RAG — модель предлагает оформить запрос в приложении **«Обращения»** на рабочем столе. Логика задана системным текстом в `_compose_assistant_prompt` (`product_desktop.py`); доп. инструкции админа — поле `extra_system_prompt` в настройках.
- Администратор в **админке** редактирует FAQ, загружает тексты для KB, задаёт модель Llama, доп. системный промпт и параметры RAG.

**Начальное наполнение FAQ:** при пустой таблице `assistant_faq_entries` выполняется SQL-миграция `20260407_assistant_faq_default_seed.sql` в `shared/api/migrations/` (кладётся в `pending/`, после `apply_migrations.sh` — в `applied/`). В ней базовые пары на русском про рабочий стол, Ассистент, Обращения, контент, плеер, EWDesk и т.д. Если в таблице уже есть хотя бы одна строка, вставка не выполняется.

## RAG: отдельный контур (сравнение)

| Контур | Коллекция Qdrant | Назначение |
|--------|------------------|------------|
| **Ассистент (этот продукт)** | `product_assistant_kb` | Глобальная KB из `assistant_kb_documents`; один индекс на весь справочник. |
| Ассистент | `desktop_chat_rag` | Вложения **конкретного чата** (фильтр по `desktop_chat_id`). |
| Маркетинг / vault | `marketing_project_rag` | Документы **проекта** (фильтр по `marketing_project_id` + ACL). |

Чанки маркетингового проекта и десктоп-чата **не** попадают в `product_assistant_kb` и наоборот.

## Где в UI

| Место | Код / маршрут |
|-------|----------------|
| Рабочий стол | `AssistantApp.tsx`: FAQ (**клик по вопросу** → вставить); hotkeys `/`, Ctrl+.; copy answer; scroll; export |
| MobileAndroid (0.2.154+) | `#/mobile-handbook` → `MobileAssistantPage` → `AssistantApp embeddedMobile`; вход EW hub / Desktop Hub. Layout: `embeddedMobileLayout` + `mobileEmbeddedTheme.css` (см. [MOBILE-ANDROID-EMBEDDED-SPA-UI-STYLE.md](mobile/MOBILE-ANDROID-EMBEDDED-SPA-UI-STYLE.md) §4.3) |
| Админка | `AssistantAdminSection`: KB sync dry-run + limit + **last path + copy**; polling индексации; preview |
| Deep link в админку | query-параметр **`?section=assistant`** (см. `UnifiedAdminPage.tsx`) |

В Markdown-ответах поддерживаются ссылки на приложения рабочего стола: предпочтительно `[подпись](/__eliteew-desktop-open-app__/ИмяКомпонента)` (обычный путь, не ломается sanitize); также `eliteew-desktop:///…` — клик открывает окно через `requestOpenDesktopApp` (`desktopDeepLink.ts`). Оболочка: `EliteEwShellStartMenu` (меню «Пуск»), `EliteEwShellSettings` и опционально второй сегмент пути (`/icons`, `/personalize`, …) — события `desktop-open-start-menu` и `desktop-open-shell-settings` в `Taskbar` / `DesktopWorkspaceContent`.

**Allowlist (единый manifest):** `shared/assistant_desktop_link_components.json` — поле `app_components` (GAF + справочник) и `shell_link_components` (оболочка). Бэкенд: `ALLOWED_DESKTOP_APP_COMPONENTS` / `ASSISTANT_SHELL_LINK_COMPONENTS` в `api/gaf_chat/system_gaf_instruction.py` (загрузка через `assistant_desktop_link_manifest.py`). Фронт: `assistantDesktopLinkComponents.ts` импортирует тот же JSON; legacy-алиасы `MusicGenerator` / `MusicEvolutionApp` → `MusicForgeApp` в `resolveAllowedComponent`. При добавлении приложения на стол — обновить manifest и прогнать `tests/test_assistant_desktop_components_parity.py`.

Формат и подсказка модели задаются в `_compose_assistant_prompt` (`product_desktop_assistant.py`), в т.ч. правило: на вопросы вида «как открыть плеер / приложение» модель должна вставлять такую ссылку, а не только текстовые шаги. Если модель не вставила ссылку на **нужное** приложение, но по тексту вопроса ясно, какое открыть, сервер дописывает кнопку в конец ответа (`_maybe_inject_desktop_app_markdown_link` в `product_desktop_assistant.py`) перед сохранением в историю (stream `done` и non-stream); уже существующая ссылка на **другое** приложение (например «Пуск») inject не блокирует.

### Трей (фоновые процессы)

**`AssistantApp` не входит в трей:** `useDesktopTrayItems` строит список только из реальных фоновых состояний (GAF, музыка, друзья, UGS, свёрнутые persistent-приложения). Статические ярлыки «Ассистент» и «Обращения» не добавляются; legacy-ключи `tray_show_assistant` / `tray_show_feedback` в `shell_state` frontend для трея не читает. Канон: [`product/desktop/DESKTOP-TASKBAR-ARCHITECTURE.md`](desktop/DESKTOP-TASKBAR-ARCHITECTURE.md) §«Фоновые процессы в трее».

Быстрый переход в **Обращения** из чата: **«Не помогло — в Обращения»** под ответом модели, **«FAQ не помог — в Обращения»** под готовым FAQ, **«Открыть Обращения»** в empty state (`AssistantChatMessageList`).

## API

Роутер: `shared/api/routers/product_desktop.py` (facade), подмодули `product_desktop_assistant.py`, `product_desktop_assistant_kb.py`, `product_desktop_feedback.py`, `product_desktop_news.py`; префикс **`/api/v1/product-desktop`**.

| Назначение | Путь (относительно префикса) |
|------------|------------------------------|
| Публичный FAQ | `GET /assistant/faq` |
| История чата пользователя | `GET /assistant/messages`, `POST /assistant/chat`, `POST /assistant/chat/stream` (SSE, keep-alive по `POST-API.mdc`) |
| Админ: FAQ | `GET/POST/PATCH/DELETE /admin/assistant/faq` … |
| Админ: настройки | `GET/PATCH /admin/assistant/settings`, `POST /admin/assistant/preview` (промпт без LLM) |
| Админ: документы KB | `GET /admin/assistant/kb/summary`, `POST /admin/assistant/kb/sync-handbook` (202, фон; `dry_run=true` — только подсчёт), … |

Сервис индексации/RAG: `shared/api/services/product_assistant_rag_service.py`.

**Загрузка файла (админ):** извлечение текста через Apache Tika (`TIKA_URL`, в Docker обычно `stack4-tika`). Лимит размера: **`ASSISTANT_KB_UPLOAD_MAX_BYTES`** (по умолчанию 20 МБ); пакетная загрузка — **`ASSISTANT_KB_BULK_MAX_FILES`** (env, по умолчанию **256**, верхняя граница в коде **500**). Суммарный размер multipart ограничен прокси (часто ~100 МБ). Момент первой загрузки фиксируется в **`created_at`**; повторная загрузка файла с **тем же `source_filename`** обновляет существующую строку (и переиндексирует), дубликаты по имени файла в БД при этом сливаются в одну запись. Редактирование/переиндексация меняют **`updated_at`**. В БД сохраняются метаданные источника: `source_filename`, `source_mime` (миграция `pending/20260407_assistant_kb_source_meta.sql` — применить через `api/migrations/apply_migrations.sh`).

### Лимиты и бюджет контекста

- **Rate limit** на `POST /assistant/chat` и `POST /assistant/chat/stream`: per `user_id`, включается если `RATE_LIMIT_ENABLED=true`. Env: **`ASSISTANT_CHAT_RATE_LIMIT_PER_MINUTE`**, **`ASSISTANT_CHAT_RATE_LIMIT_BURST`** (см. `unified_config.py`).
- При превышении: **429** и заголовок `Retry-After`.
- Блок FAQ в промпте ограничен по суммарной длине (константа в `product_desktop.py`); **подбор по релевантности** к текущему вопросу (`select_faq_entries_for_prompt`, до 16 пар из 200 в БД).
- **История чата в промпте:** до **6** turn'ов, бюджет **8000** символов (`format_assistant_chat_history_block` в `product_assistant_prompt_helpers.py`); загружается до INSERT текущего сообщения. RAG-запрос для уточнений дополняется предыдущим вопросом пользователя (`build_assistant_rag_query`). RAG: **гибрид** — семантический поиск с fallback `min_score=0.08` (`search_product_assistant_kb_with_fallback`) + keyword-дополнение из Postgres title/body (`search_product_assistant_kb_keyword`, merge в `search_product_assistant_kb_hybrid`); при непустом **`RAG_RERANK_BASE_URL`** (GPU `.141`, llama-server `/v1/rerank`) — расширенный пул кандидатов и **cross-encoder rerank** (`apply_rerank_to_chunks` в `search_product_assistant_kb_hybrid`, тот же контур, что Ассистент и marketing vault RAG).
- **Источники KB:** если RAG дал фрагменты, в конец ответа дописывается markdown-футер «Источники справочника» (`maybe_append_rag_sources_footer`), если модель сама не указала источники.
- **Генерация ответа:** llama.cpp **schema-constrained JSON** (`ASSISTANT_REPLY_JSON_SCHEMA` в `product_assistant_llm_contract.py`, поле `reply_markdown`) через `httpx_compat_generate_json` + **`json_schema=`**. При OpenAI-detected stack2 raw schema уходит на native **`POST /api/chat`** с `format=<schema>` (OpenAI-shim не принимает schema в `response_format`). System и user prompt разделены в `_compose_assistant_prompt`; разбор — `parse_assistant_reply_markdown` (salvage `reply_markdown` из обрезанного/много-блочного JSON, затем `guard_assistant_reply_quality`). HTTP-слой: **`documentation/platform/docker-re_doc/STACK0-LLM-OVERVIEW.md`** §7.4.
- **Качество ответа:** `_finalize_assistant_reply` → `sanitize_assistant_model_reply` (в т.ч. снятие leaked `` ```json `` / обёртки), `guard_assistant_reply_quality(user_message=…)` с контекстным fallback (песня → MusicForge / «Студия песен», картинка → ImageStudio, звонок → GAF Chat / VideoCallApp). Детектор деградации ловит repetition loops, JSON-leak, `_р_`-spam. Испорченные turn не попадают в history. Stream: finalize **до** SSE-чанков (пользователь не видит сырой JSON); `num_predict=1024`.
- RAG: дедупликация по `document_id`, обрезка суммарной длины блока (см. `DEFAULT_ASSISTANT_RAG_PROMPT_MAX_CHARS` в `product_assistant_rag_service.py`).

## Готовые тексты для KB (RAG)

Короткие статьи простым языком (для загрузки в админку → документы KB → индексация): **`product/handbook-kb-articles/`** (`README.md` — список файлов). Темы: Ассистент, Обращения, рабочий стол, магазин, **GAF Chat** (удаление, контекстные меню по сообщению и списку чатов, копирование и закреп), **UGS Studio / UGS Хаб**, центр уведомлений, **EWRP** (презентации, PDF, редактор слайдов). Пользовательские инструкции без RAG-синонимов — отдельно **`product/handbook-user-docs/`**.

**Операторский runbook индексации (KB → Qdrant):** [`PRODUCT-ASSISTANT-KB-INDEXING.md`](PRODUCT-ASSISTANT-KB-INDEXING.md) — статусы документов, CLI/admin sync, dry-run, переиндексация, проверка RAG, типовые сбои.

**Массовая синхронизация из репозитория (оператор):** из каталога `shared/api` с env Postgres/Qdrant/embed:

```bash
cd shared/api && PYTHONPATH=.. UV_PROJECT_ENVIRONMENT=../../.venv uv run python scripts/sync_handbook_kb_articles.py  # shared/api/scripts/sync_handbook_kb_articles.py
```

Флаги: `--dry-run`, `--limit N`. То же из админки: кнопки **«Проверить sync (dry-run)»** и **«Синхронизировать kb-*.md из репозитория»** (`POST /admin/assistant/kb/sync-handbook`, параметр `dry_run=true` для проверки). Сервис: `api/services/product_assistant_kb_sync.py` (CLI — тонкая обёртка в `shared/api/scripts/sync_handbook_kb_articles.py`). Каталог в контейнере: **`/app/documentation/product/handbook-kb-articles`** — dev bind на `.136`, prod-core baked в API-образ (см. [`PRODUCT-ASSISTANT-KB-INDEXING.md`](PRODUCT-ASSISTANT-KB-INDEXING.md)).

**Стрим чата:** клиент может прервать генерацию (`AbortSignal`); сервер при `request.is_disconnected()` **не сохраняет** частичный ответ assistant в историю. В начале SSE-сессии сервер отдаёт событие `{ "type": "meta", "rag_source_labels": [...] }` — клиент показывает источники до первого токена и дописывает тот же markdown-футер, что и `_finalize_assistant_reply`, чтобы не было «скачка» в конце. При **429** клиент читает заголовок `Retry-After` и показывает обратный отсчёт до следующего запроса.

**Админ: preview промпта** — `POST /admin/assistant/preview` с `{ "message": "…", "include_my_history": false }` возвращает модель, бюджеты FAQ/RAG/истории, метки источников, **`prompt_preview`** (до ~8000 симв. для UI) и **`prompt_full`** (полный текст для копирования). Без вызова LLM. При `include_my_history: true` в блок истории подставляются последние сообщения **чата текущего админа**.

**Синхронизация с продуктом (пример EWRP):** чтобы ответы ассистента совпадали с интерфейсом — **бесплатные** правки текста/порядка (каждая строка в поле текста — пункт на слайде), пересборка PDF (**Ctrl/⌘+S**), навигация по номерам слайдов; **отдельно** перегенерация картинки или текста слайда через **UGS** за **энергию** — поддерживайте в KB статьи **`kb-ewrp-prezentatsii.md`** (раздел «Редактор»), **`kb-ewrp-sozdat-prezentatsiyu-i-pdf.md`** (таблица тем в `handbook-kb-articles/README.md`). После правок — **переиндексация** документа в админке. Техсправочник для разработчиков — **`product/EWRP-REVOLUTIONARY-PRESENTATIONS.md`**, редактор — **`product/EWRP-EDITOR.md`** (в RAG целиком не подставлять; в промпт попадают пользовательские формулировки из `kb-*.md`).

**Синхронизация с продуктом (магазин приложений на рабочем столе):** после заметных изменений витрины, поиска и фильтров, экрана подробностей о приложении или блока баланса EW обновите статьи **`kb-magazin-prilozheniy.md`**, **`kb-magazin-kategorii-filtry-i-poisk.md`** (при необходимости **`kb-magazin-pochemu-nelzya-udalit-prilozhenie.md`**). Тексты для RAG — простым языком, без путей к коду и имён таблиц. Технический канон и сводка слоёв UI — **`product/desktop/DESKTOP-APP-STORE.md`** (раздел **«Оформление интерфейса»**). После правок — **переиндексация** соответствующих документов в админке «Ассистент».

**Синхронизация с продуктом (центр уведомлений):** список в центре может **синхронизироваться с аккаунтом** между устройствами; в полном окне — **группировка по типу или по источнику**, подтверждение **«Очистить все»**, экспорт. После изменений UX или лимитов обновите статьи **`kb-tsentr-uvedomleniy.md`**, **`kb-tsentr-uvedomleniy-kompakt-i-polnyy-ekran.md`**, **`kb-tsentr-uvedomleniy-prochitano-i-ochistka.md`** (при необходимости **`kb-uvedomleniya-zvuk-i-ne-bespochoy.md`**). Технический канон для разработчиков и блок **«Ассистент для ИИ»** — **`product/desktop/DESKTOP-NOTIFICATIONS-APP.md`**. После правок — **переиндексация** затронутых документов KB в админке.

**Синхронизация с продуктом (генератор песен):** короткая инструкция для людей — **`product/handbook-user-docs/06-generator-pesen.md`**; для RAG развёрнутый блок в **`handbook-kb-articles/kb-muzykalnyj-pleer-i-generator-pesen.md`** (раздел «Генератор песен»); API, UGS, разметка lyrics/tags — **`product/MUSIC-GENERATOR.md`**, **`MUSIC-GENERATOR-REFERENCE.md`**. После смены подписей в UI или шагов мастера — обновите KB и **переиндексируйте** документ.

**Синхронизация с продуктом (Ассистент — сам продукт):** при изменении `AssistantApp`, трея или админки KB держите в актуальном состоянии статьи **`kb-spravochnik-i-obrashcheniya.md`**, **`kb-spravochnik-chastye-voprosy-i-vstavka.md`**, **`kb-spravochnik-interfeys-chata-i-export.md`**, **`kb-spravochnik-ssylki-otkryt-prilozhenie-v-otvete.md`**, **`kb-spravochnik-limity-zaprosov-i-ozhidanie.md`**, **`kb-spravochnik-populyarnye-voprosy-i-chipy.md`**, **`kb-spravochnik-istochniki-i-podbor-dokumentov.md`**, **`kb-spravochnik-rannye-soobshcheniya-i-prokrutka.md`**, **`kb-spravochnik-ochistit-chat-i-dlinnyy-vopros.md`**, **`kb-spravochnik-goryachie-klavishi-i-vvod.md`**, **`kb-spravochnik-pomoglo-i-obratnaya-svyaz.md`**, **`kb-admin-spravochnik-sync-handbook-limity.md`**, **`kb-trey-spravochnik-obrashcheniya-i-bystrye-deystviya.md`** (таблица — [`PRODUCT-ASSISTANT-KB-INDEXING.md`](PRODUCT-ASSISTANT-KB-INDEXING.md)); пользовательский текст — **`handbook-user-docs/01-spravochnik-prilozhenie.md`**. Каталог **106** файлов `kb-*.md` — [`handbook-kb-articles/README.md`](handbook-kb-articles/README.md). После правок — **sync-handbook** или переиндексация затронутых документов.

## Документация репозитория

Тексты для разработчиков и операторов монорепозитория — **`documentation/README.md`**. Чтобы не путать термины, см. **`documentation/reference/PROJECT-GLOSSARY.md`** (блок «Не путать»).
