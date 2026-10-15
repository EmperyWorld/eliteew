# EWRP — EliteEW Revolutionary Presentations

**Status:** living product SoT (large hub). Day-to-day editor surface: [EWRP-EDITOR.md](EWRP-EDITOR.md). Artifacts lifecycle: [EWRP-GENERATED-FILES-LIFECYCLE.md](EWRP-GENERATED-FILES-LIFECYCLE.md) (classic Reveal.js vs EWRP). Partner pitch decks ≠ this product — [presentations/README.md](presentations/README.md).

Канонический справочник по продукту **EWRP** в монорепозитории: назначение, API, биллинг, UI на рабочем столе, горячие клавиши, производительность и связанные материалы.

**Точки входа (код):**

| Роль | Путь |
|------|------|
| Shell окна (re-export) | **`shared/web/frontend/src/components/EWRP/EWRPGenerator.tsx`** → **`EWRPGeneratorMain.tsx`** |
| UI shell (композиция) | **`EWRPGeneratorMain.tsx`** (~484 строк: Generate + Presentations вкладки + вызов модалок; вызывает оркестратор-хук) |
| Orchestration hook | **`useEwrpGeneratorOrchestration.tsx`** (~2472 строк: state, polling, история, form submit, slide-editor handlers — единственный SoT) |
| Overlays (модалки) | **`EwrpGeneratorModals.tsx`** (history / doc-picker, lazy PDF host, confirms, spotlight guide — props из Main) |
| Generate tab + chrome | **`EwrpGenerateTabPanel.tsx`** facade → **`ewrpGenerateTab/*`** (форма запуска `ewrp-panel-generate`); chrome — **`EwrpGeneratorAppChrome.tsx`** |
| Presentations tab UI | **`EwrpPresentationsTabPanel.tsx`** (статус-колонка + composition extracts — `ewrp-panel-presentations`) |

| Shared chunks | **`EwrpGeneratorChunks.tsx`** (thin barrel) → **`ewrpChunks/*`** (история, строки слайдов, CM, константы) |
| UGS по слайду | **`EwrpSlideEditorPanel.tsx`** |
| API клиент | **`shared/web/frontend/src/services/ewrpApi.ts`** |
| API роутер | **`shared/api/routers/ewrp.py`** |
| i18n | **`shared/web/frontend/src/i18n/locales/ru/ewrp.json` / `shared/web/frontend/src/i18n/locales/en/ewrp.json`** |

**Мастер-саммари UI-сессии 2026-05-27 (waves 2–28):** **`documentation/worklog/README.md` *[session-summaries retired — stub only]***.

**Редактор слайдов (фокусный UX, bullets, nav, scroll) — 2026-06-08:** **`product/EWRP-EDITOR.md`**; session summaries `worklog/session-summaries/2026-06-08-*-ewrp-*.md`.

**Инвариант продукта:** вводные задаёт пользователь (тема, текст, документ из Файловый менеджер); опционально **`web_search_quality`** подтягивает внешние факты через Yandex Search API (см. §Live web search). Без поиска и без фактов во вводных модель **не должна** выдумывать конкретные цифры и адреса — см. **`api/services/ewrp_fact_grounding.py`**.

---

## 1. Назначение и пайплайн

EWRP генерирует презентационные материалы по цепочке (упрощённо):

**лендинг HTML → сгенерированный контент → изображения слайдов (UGS) → скриншоты слайдов → PDF.**

Классический Reveal.js-поток — отдельный контур; EWRP — отдельный роутер и очередь (`ewrp_generate`), см. **`api/RABBITMQ_USAGE.md`**.

---

## 2. Где в продукте

| Канал | Описание |
|-------|----------|
| Рабочий стол | Окно приложения с `app_component` **`EWRP`** (legacy: `Presentations` / `PresentationsArchive`). См. **`product/desktop/DESKTOP-API-AND-APPS.md`**. |
| Assistant chat | Инструмент **`presentation_generation`** создаёт durable run `presentation_generation_background`, вызывает тот же `POST /api/v1/ewrp` от имени пользователя и показывает готовый PDF в панели «Текущие операции». См. **`product/ewa/EWA-COMPANION-OPERATIONS-PANEL.md`** §3.6. |
| Маркетинговый кабинет | Ссылки на презентации EWRP по проекту — см. **`product/handbook-kb-articles/kb-marketing-prezentatsii-ewrp-i-proekt.md`**. |
| Professional Worlds | Cross-app draft «Открыть в EWRP»: капсула в `sessionStorage` → `professionalWorldsCrossAppDraftKey` в payload окна → гидратация формы (тема, заголовок, outline, первый media ref из CM). См. **`product/PROFESSIONAL-WORLDS.md`**, **`openProfessionalDraftDestination.ts`**, **`ewrpProfessionalWorldsDraft.ts`**. |

Визуальная оболочка: токены рабочего стола (`useDesktopShellFrame`, `getDesktopShellContentPanelClassName`, `getDesktopShellToolbarClusterInsetControlClassName` и т.д.) — согласовано с пресетом «Стиль окон».

---

## 3. HTTP API (`/api/v1/ewrp`)

Базовый префикс в коде: **`API_PATHS.EWRP`** → клиент **`ewrpApi`**.

| Метод | Путь | Назначение |
|-------|------|------------|
| `GET` | `/ewrp/quote?num_slides=` | Авторитетная котировка энергии: `credits_per_slide`, `credit_cost`, `available_credits`, `allowed`. SPA использует ответ для soft-gate create (не локальный каталог UGS × локальный баланс). |
| `POST` | `/ewrp` | Создание задачи: тема, опционально заголовок, число слайдов, доп. контекст, `source_content_id` из CM, опционально **`presentation_theme`** (визуальный стиль PDF: фон, палитра), опционально **`default_slide_layout`** (раскладка текста на слайдах 2…N), опционально **`first_slide_style`** (`standard` \| `title_only` — оформление первого слайда). Биллинг: см. §4. |
| `POST` | `/ewrp/{job_id}/duplicate` | Новая задача с теми же вводными; отдельное списание как у create. |
| `POST` | `/ewrp/{job_id}/retry` | Повтор генерации **в той же** задаче: **`failed`** — новое списание (после refund) и полный перезапуск; **зависшие** нефинальные статусы (нет обновления > 2 ч) — повторная постановка в очередь **без** списания. Ответ как у create (`id`, `status=queued`). |
| `GET` | `/ewrp/jobs?limit&offset` | Список задач пользователя (история, пагинация). |
| `GET` | `/ewrp/{job_id}/status` | Статус, прогресс, слайды, вводные для «В форму», `pdf_url`, `pdf_download_token` и т.д. В `slides[]` поле `image_ready` означает, что PNG можно безопасно запрашивать через image endpoint. |
| `GET` | `/ewrp/{job_id}/pdf` | Выдача готового PDF через `FileResponse`; primary SPA download использует короткоживущий `pdf_download_token` как direct browser URL, Blob через `apiClient` остаётся fallback для authenticated-only сценария без token. |
| `GET` | `/ewrp/{job_id}/slides/{slide_index}/image` | Authenticated PNG preview одного слайда. `slide_index` — с нуля; UI запрашивает endpoint только когда `status.slides[slide_index].image_ready=true`. |
| `PUT` | `/ewrp/{job_id}/slides` | Сохранение отредактированных слайдов; перевод в фазу пересборки PDF. **Без дополнительного списания энергии** за сами правки (биллинг за создание/дубликат — отдельно). Сохраняет при необходимости `image_prompt` в `slides_json`. |
| `POST` | `/ewrp/{job_id}/slides/{slide_index}/regenerate-image` | Перегенерация **картинки** одного слайда по промпту через UGS; списание по типу `image_generation_comfyui`; затем пересборка HTML/PDF. Тело: `{ "prompt": "..." }`. **`slide_index`** — с **нуля**, в пределах текущего числа слайдов (в коде API: `ge=0`, `le=19`). |
| `POST` | `/ewrp/{job_id}/slides/{slide_index}/regenerate-text` | Перегенерация **текста** одного слайда (заголовок и буллеты) через продуктовый слой генерации; списание по типу `ewrp_slide_text_regen`; затем пересборка HTML/PDF. Тело: `{ "instruction": "..." }` (опционально). Индекс слайда — как в строке выше. |
| `DELETE` | `/ewrp/{job_id}` | Удаление задачи. |

Опционально при **`POST /ewrp`**: заголовки **`Idempotency-Key`** или **`X-Idempotency-Key`** (8–128 символов после trim). Повтор запроса с тем же ключом и тем же пользователем возвращает уже созданную задачу **без повторного списания** (кэш в Redis, TTL 24 ч, ключ включает `user_id`).

Assistant использует этот же контракт: `companion_presentation_generation.py` отправляет `Idempotency-Key=ewa-companion-ewrp-{run_id}`, затем зеркалит `GET /ewrp/{job_id}/status` в `ewa_companion_task_runs.result_payload`. EWRP остаётся source of truth для `ewrp_jobs`, биллинга, очереди `ewrp_generate`, редактирования слайдов и PDF.

`pdf_download_token` — случайный Redis-token TTL 1 час, scoped к `job_id`. Он не удаляется после первого успешного GET: один готовый результат должен открываться и скачиваться из EWA/истории несколькими действиями без повторного status-запроса и без 401. Bearer/JWT в URL не допускается.

**Download latency guard (2026-06-30):** видимая задержка «нажали скачать, потом долго ждём, потом браузер начал download» была frontend-side: старый `EWRPGeneratorMain` ждал полный `Blob` от `ewrpApi.downloadPdf(jobId)`, затем создавал object URL и кликал anchor. Backend `GET /ewrp/{job_id}/pdf` уже отдаёт готовый `presentation.pdf` и не пересобирает PDF на download. Новый primary path: если `status.pdf_download_token` есть, `ewrpPdfDirectDownloadUrl(jobId, token)` → `triggerBrowserDownloadFromUrl(...)`; браузер начинает сетевой download сразу и показывает native progress. Если token отсутствует, остаётся authenticated Blob fallback через `apiClient` (без bearer token в URL). Assistant presentation card uses the same token-first behavior for open/download actions.

При **полном падении пайплайна** (статус задачи **`failed`**, итогового PDF нет) выполняется **возврат энергии** за эту генерацию (`num_slides ×` тариф слайда), если тип `ewrp_presentation` настроен в биллинге.

**Очередь RabbitMQ (`ewrp_generate`):** если воркер падает до завершения пайплайна (например недоступен MinIO/S3 на LAN-воркере) или сообщение уходит в DLQ после исчерпания ретраев, **`api/services/ewrp_queue_resilience.py`** переводит `ewrp_jobs` в **`failed`** с `error_message` и при необходимости возвращает списание (как при падении `_run_ewrp_pipeline`). Поведение покрыто **`tests/test_ewrp_queue_resilience.py`** (finalize + DLQ). См. расследование **`documentation/worklog/README.md` *[session-summaries retired — stub only]***.

### Live web search (outline)

Поле **`web_search_quality`** (`off` | `light` | `standard` | `deep`) в **`POST /ewrp`** и UI EWRP (селектор в блоке «Контекст для модели»). При значении ≠ `off` pipeline на этапе **`generating_content`** добавляет блок «Срез из веб-поиска» в `additional_context` для Llama (Yandex Search API, quota-aware — тот же контур, что маркетинговый кабинет). Перед чтением/списанием quota на `users` вызывается **`ensure_encryption_pii_key`** (`api/core/pii_session.py`) — иначе UPDATE encrypted columns на worker падает с `encryption.pii_key must be set`. Legacy **`use_web_search: true`** → **`standard`**. Колонки **`use_web_search`**, **`web_search_quality`** в **`ewrp_jobs`**; миграция **`20260629_ewrp_web_search_quality.sql`**.

| Уровень | Запросов | Hits / запрос |
|---------|----------|---------------|
| `light` | 1 | 5 |
| `standard` | 2 | 6 |
| `deep` | 3 | 8 |

Companion **`presentation_generation`** принимает **`web_search_quality`** в tool args и прокидывает в create.

**Fact grounding (2026-06-30):** при `web_search_quality ≠ off` pipeline добавляет блок **«ПРАВИЛА ДОСТОВЕРНОСТИ»** (`ewrp_fact_grounding.py`): конкретные числа, даты, адреса и имена — только из среза поиска или вводных пользователя; при конфликте фактов в источниках — не смешивать разные сущности; последний блок — слайд «Источники» с URL из среза. Запросы к Yandex строятся по **сущности из темы пользователя** (имя в кавычках, код, «бизнес-центр …» и т.п.), а не по маркетинговому абзацу темы. Temperature outline/slide снижается при включённом поиске.

Ранее колонка **`use_web_search`** была зарезервирована без провайдера — **снято** с релиза quality tiers.

Генерация картинок слайдов в полном пайплайне может выполняться **с ограниченным параллелизмом** (константа `EWRP_PARALLEL_SLIDE_IMAGES` в **`shared/api/services/ewrp_service.py`**) при сохранении мягкой политики по отдельным слайдам (при сбое UGS по слайду задача всё же может завершиться с частично пустыми визуалами).

Схемы: **`shared/api/schemas/ewrp.py`**, сервис: **`shared/api/services/ewrp_service.py`**.

### 3.0. LLM: структурированный JSON (stack2, 2026-06)

| Этап | Код | JSON-режим |
|------|-----|------------|
| Генерация outline/слайдов (полный пайплайн) | `PresentationContentGeneratorService` | OpenAI-compat `response_format: {"type": "json_object"}` |
| Перегенерация текста слайда | `ewrp_service._llm_json_rewrite_slide` | UGS / httpx `json_format=True` → `format=json` |

Промпты описывают поля слайдов и outline; синтаксические инструкции «только JSON» сняты — ограничение на стороне stack2. Парсеры `_parse_json_object_from_llm` / robust extract остаются fallback. Сводка по HTTP-слою: **`documentation/platform/docker-re_doc/STACK0-LLM-OVERVIEW.md`** §7–8.

### 3.1. HTML-шаблоны слайдов (лейауты)

Лендинг для PDF собирается в **`shared/api/services/ewrp_templates.py`** (`build_ewrp_html`). Первый слайд (индекс 0) по умолчанию в лейауте **title/default**. Опционально при create: **`first_slide_style`** = `standard` (как сейчас) или `title_only` (только заголовок + фоновое изображение, без буллетов/подзаголовка/brand/progress/header). Для остальных слайдов шаблон выбирается эвристикой или явным полем **`layout`** / **`slide_layout`** в элементе **`slides_json`**.

**Три разных выбора пользователя:** (1) **`presentation_theme`** — внешний вид итогового PDF (фон, цвета; в UI: Лазурь, Полночь, Закат, Сияние, Бумага, Редакция, Техно, Нуар, Лён и т.д.): задаёт класс на `<body>` и дополнительный CSS; в модель контента добавляется короткая подсказка по тону; хранится в **`ewrp_jobs.presentation_theme`**. (2) **`default_slide_layout`** — только раскладка текста (колонки, сетка…): после генерации текста пайплайн записывает ключ в **`layout`** для слайдов с индексом ≥ 1; колонка **`ewrp_jobs.default_slide_layout`** хранит вводной выбор. Значение **`default`** («Список с акцентом») тоже записывается и **не** заменяется эвристикой шаблона — иначе фиксированный список не отличался бы от «Авто». (3) **`first_slide_style`** — оформление **первого** слайда: `standard` | `title_only` (колонка **`ewrp_jobs.first_slide_style`**, миграция `20260826_ewrp_jobs_first_slide_style.sql`). При `title_only` пайплайн очищает bullets слайда 0, пишет `layout=title_only`, а HTML рендерит full-bleed cover.

| Ключ | Назначение |
|------|------------|
| `default` | Заголовок, опциональный lead, маркированный список |
| `section` | Разделитель без буллетов и без картинки |
| `steps` | Пронумерованные шаги |
| `closing` | Финальный слайд с короткими пунктами |
| `quote` | Одна короткая строка (акцент/цитата) |
| `statement` | Один длинный абзац |
| `split` | Два параллельных тезиса (две колонки) |
| `grid` | Сетка из 4–6 коротких карточек |
| `kpi` | 2–4 коротких метрики с цифрами |
| `fullbleed` | Фоновое изображение с блоком поверх |
| `title_only` | Титул: только заголовок на фоне (первый слайд / cover) |

В **`PUT /ewrp/{job_id}/slides`** поле **`layout`** опционально; пустая строка сбрасывает к авто-выбору. Пересборка PDF передаёт **`layout`** из JSON в шаблон (**`rebuild_from_slides`**).

### 3.2. Артефакты на диске (EWRP)

Базовый каталог: **`{GENERATED_FILES_BASE}/generated_files/ewrp/{job_id}/`** (env **`GENERATED_FILES_BASE`**, см. **`project-and-deploy.mdc`**).

| Файл / каталог | Назначение |
|------|------------|
| `index.html` | Лендинг для скриншотов / предпросмотра (offline fonts, без Google CDN) |
| `fonts/` | Vendored TTF рядом с HTML (`stage_ewrp_fonts`); источник — `shared/api/static/ewrp/fonts/` |
| `presentation.pdf` | Итоговый PDF (`GET /ewrp/{job_id}/pdf`) |
| `slides.json` | Снимок слайдов: `title`, `bullets`, `image_filename`, `image_prompt` |
| `slide_N.png` | UGS/ComfyUI PNG слайда (до Playwright) |
| `screenshots/page_NN.png` | Playwright-скрины секций `.ewrp-slide` → stitch в PDF |

`ewrp_jobs.slides_json` хранит те же `image_filename` / `image_prompt` для UI/status. Пайплайн должен записывать slide JSON как dirty JSONB после генерации картинок; статус дополнительно проверяет файл на диске и может восстановить convention filename `slide_N.png` для старых строк, где DB metadata отстала от артефактов. Если файла нет, `image_ready=false`, и frontend не делает повторяющиеся 404-запросы к preview endpoint.

**Offline PDF render (2026-07-22):** HTML не ссылается на `fonts.googleapis.com`. Шрифты вендорятся скриптом **`shared/api/static/ewrp/vendor_ewrp_fonts.py`** → `api/static/ewrp/{fonts,fonts.css}`; пайплайн копирует их в job `fonts/` перед записью `index.html`. Sidecar Playwright ждёт `load` + `document.fonts.ready` (не `networkidle`). Модули: `ewrp_font_assets.py`, `ewrp_templates.py`, `playwright_renderer.py`.

**UGS images:** workflow **`01_top.json`** (z-image-turbo). Sampler params (steps=4, cfg=1) живут в графе; EWRP передаёт согласованные `EWRP_COMFY_IMAGE_*` и **native latent 1024×1024** (не 1024×768 — у turbo часто даёт glitch/pseudo-text). Positive prompt на generic apply-path проходит **`_finalize_z_image_user_prompt`** (anti-text suffix), как у `get_text_to_image_z_turbo_workflow`: в `01_top` negative через `ConditioningZeroOut`, поэтому анти-текст только в positive.

**No text in slide images (2026-07-22):** z-image всё равно рисует псевдобуквы, если в промпте есть «text-bait» сюжеты (sign / blueprint / documents / business card / dashboard / charts). Перед Comfy EWRP: **`scrub_ewrp_text_bait_subjects`** (общая таблица в `ugs/z_image_prompt.py`) + обязательный **`ensure_ewrp_slide_no_text_clause`** в `_prompt_for_4k_workflow` (`ewrp_prompt_utils.py`); Llama image-prompt инструкции запрещают эти сюжеты. UI-заголовок слайда — в HTML поверх картинки, не в PNG.

**Удаление:** `DELETE /ewrp/{job_id}` удаляет строку в `ewrp_jobs` и каталог `{job_id}/` на диске (`shutil.rmtree`, ошибки игнорируются). Классический контур `presentations/` — **`product/EWRP-GENERATED-FILES-LIFECYCLE.md`**.

**Права (Podman / stack0):** API и Celery пишут от **`stack0-runtime` (uid 1000 в контейнере)**. Если `generated_files/ewrp/` после recreate или host `chown` недоступен для записи — в логах `[Errno 13] Permission denied` на mkdir job dir. Исправление: `bash docker/scripts/fix-generated-files-permissions.sh` (входит в `fix-docker-permissions-final.sh` §7b при запущенном `stack0-eliteew-api-prod`).

**Список истории:** `GET /ewrp/jobs` включает **`error_message`** для задач в статусе **`failed`** (краткая причина в UI истории).

---

## 4. Биллинг и энергия (⚡)

| Параметр | Значение (ориентир) |
|----------|---------------------|
| Ключ типа генерации | `ewrp_presentation` (`EWRP_BILLING_TYPE_KEY`). |
| Единый расчёт | **`api/services/ewrp_billing.py`**: `ewrp_presentation_credit_cost(num_slides, gen_type)` → `(credits_per_slide, credit_cost)`. `generation_types.cost_credits` = **за слайд**; fallback **`EWRP_CREDITS_PER_SLIDE = 200`**. |
| Списание при **create** и **duplicate** | **`num_slides × credits_per_slide`** через helper (линейно при 200: 5→1000 … 20→4000 ⚡). UI soft-gate: **`GET /ewrp/quote`**, не локальный `costByTypeKey × ugsBillingStats`. |
| **retry** (`POST .../retry`) | **`failed`** — снова тот же helper. **Зависшая** in-progress (> 2 ч без обновления) — **0 ⚡**, только re-queue. |
| Пересборка после `PUT .../slides` | Отдельного списания нет: тот же контент и картинки, новый PDF (**пересборка**). В UI — **0 ⚡** и зачёркнутая прежняя «полная» сумма. |
| Перегенерация **картинки** слайда (`POST .../regenerate-image`) | Списание по тарифу **`image_generation_comfyui`** (каталог UGS / `generation_types`). |
| Перегенерация **текста** слайда (`POST .../regenerate-text`) | Списание по тарифу **`ewrp_slide_text_regen`** (отдельная строка в каталоге; SQL-миграция `shared/api/migrations/applied/20260407_ewrp_slide_text_regen_generation_type.sql`). |
| Полная новая презентация «с нуля» | Как и раньше: **create** или **duplicate** (списание за слайды по `ewrp_presentation`). |
| Ошибка **полного** пайплайна (`failed`, нет PDF) | Автоматический **возврат** списанной за создание суммы (через `BillingService.refund_credits` в обработчике фоновой задачи). |

### 4.1. Предпосылки для UGS по слайду (оператор / развёртывание)

Чтобы **перегенерация картинки** и **перегенерация текста** работали в проде:

1. **Таблица `generation_types`** должна содержать строки с **`type_key`**:
   - **`image_generation_comfyui`** — тариф для картинки (тот же тип, что и в полном пайплайне EWRP).
   - **`ewrp_slide_text_regen`** — отдельный тариф для текста слайда; начальное значение задаётся SQL-миграцией **`shared/api/migrations/applied/20260407_ewrp_slide_text_regen_generation_type.sql`** (при необходимости скопировать в `pending/` и применить по **`shared/api/migrations/README.md`** / `apply_migrations.sh`, если на стенде миграция ещё не накатывалась).
2. После изменений схемы БД — **перезапуск API** (контейнер `stack0-eliteew-api-prod` или эквивалент), чтобы биллинг и каталог типов совпадали с фактом в БД.
3. Если типа нет или сервис генерации недоступен, клиент может получить **503**; **402** — недостаточно энергии (как у create/duplicate).

Динамическое списание и возвраты: **`BillingService`** (`check_limits`, `record_usage`, `refund_credits` с опциональным `credit_amount`) — см. журнал работ **`documentation/worklog/README.md` *[monthly journals retired — stub only]*** (блоки про EWRP и биллинг).

---

## 5. UI рабочей области (фронтенд)

Макет: **две вкладки** — «Новая презентация» (форма запуска) и «Мои презентации» (статус, редактор слайдов, PDF). На широком экране форма и рабочая область используют ширину окна; на узких — контент стекается. На вкладке формы — баннер активной задачи (in-progress / ready / failed) с переходом на «Мои презентации»; на табе «Мои презентации» — чип статуса (визуально `aria-hidden` + **`tabs.presentationsStatus`** для скринридеров), пока пользователь остаётся на форме.

### 5.1. Форма запуска

- Поля: **тема** (обязательно), **стиль оформления PDF** … выбор **файла из Файловый менеджер** (модалка); длинное имя файла — **`EwrpExpandableClampedText`** (форма и строки модалки CM).
- При **`submitting`**: баннер «Создаём задачу…», `aria-busy` на форме; поля недоступны до ответа API.
- **Sticky context bar** на вкладке формы: тема/заголовок + чипы (число слайдов, тема PDF, файл CM); заголовок — **`resolveEwrpGenerateWorkspaceLabel`** (`ewrpGenerateWorkspaceLabel.ts`: поля формы → title/topic активной задачи через **`resolveEwrpStatusPresentationLabel`**), иначе `sticky.draftUntitled`; mismatch slide/theme — pure helpers **`ewrpStickyContextMismatch.ts`** (`ewrpStickySlidesMismatch`, `ewrpStickyThemeMismatch`, `resolveEwrpStatusSlideCount`); amber-чипы **`sticky.metaSlidesJob`** / **`sticky.metaThemeJob`**; пока имя источника подгружается — **`sticky.metaSourceLoading`** с `aria-busy`.
- Баннер активной задачи на форме: тот же приоритет заголовка + fallback **`form.activeJobUntitled`**; «Открыть статус» и блок **`formLockedHint`** вызывают **`openPresentationsStatus`** (вкладка «Мои презентации» + scroll + sr-only **`a11y.presentationsStatusFocused`**); открытие задачи из истории (**`openJobFromHistory`**) — тот же scroll/focus announce; блок источника CM — `aria-busy` на контейнере; кнопки «Очистить» / «Выбрать из библиотеки» disabled при `sourceDocumentLoading` или `formLocked`.
- Подсказка под кнопкой запуска — **`form.generateFootnote`** (без горячих клавиш).
- Под полем числа слайдов — **подсказка по списанию** и ориентир 5→1000 … 20→4000; у поля `aria-describedby` на эту подсказку.
- Кнопка запуска: **строка стоимости** в ⚡ (`useCreativeStudioUgsCosts` + fallback), зачёркнутая прежняя сумма, для скринридеров — скрытый текст «было / сейчас»; `title` с итогом списания.
- Ошибки **402** / **503** при create, duplicate, retry, regen: единый helper **`notifyEwrpHttpError`** (`ewrpHttpErrors.ts`) — toast «Недостаточно энергии» / «Сервис временно недоступен» + detail от API.
- **`formLocked`**: пока задача не в финальном `completed`/`failed`, поля формы заблокированы; **`ewrpFormLockedFromJob`** / опрос — **`ewrpShouldStopStatusPolling`**, **`ewrpPollStatusOutcome`**, **`clampEwrpStatusProgress`** в **`ewrpClientJobPolicy.ts`** / **`ewrpStatusPolling.ts`**. Редактор слайдов и UGS-кнопки: **`ewrpSlideRegenAllowed`**, **`ewrpSlideRebuildInProgress`** (включая `generating_content` после text regen), **`ewrpSlideEditorJobBusy`** (совпадают с guard API `POST .../regenerate-*`).

### 5.2. История генераций

- Список с **пагинацией** (размер страницы константа, «Показать ещё»). Первый запрос: **скелетон**-плейсхолдеры вместо «Загрузка…»; в строке — **чип** статуса (PDF готов / в работе / ошибка) + число слайдов + дата.
- **Поиск** по теме, названию, статусу, ID, **тексту ошибки** (`error_message`) и локализованной метке статуса (`useDeferredValue` для тяжёлого фильтра).
- При длинном списке — **виртуализация** (`VirtualVariableList`), порог переключения — константа в компоненте.
- **Подгрузка при прокрутке** к концу виртуального списка (`onEndReached` в **`VirtualVariableList`** — см. **`shared/web/frontend/src/components/shared/VirtualList.tsx`**).
- Действия по строке: **Открыть**, **В форму**, **Повторить** (failed — со списанием ⚡; зависшая in-progress >2 ч — **0 ⚡**), **Ещё раз** (дубликат), **Удалить** (`historyList.delete`, `ConfirmDeleteModal`). **Открыть** — вкладка «Мои презентации» + scroll к статусу (как **`openPresentationsStatus`**). Фаза — **`EwrpStatusPhaseChip`** (`size="sm"`). Активная задача — бейдж **`historyList.current`**; длинное **название** раскрывается (`historyList.titleExpand`); контейнер действий — **`aria-busy`** при in-flight; кнопки retry/duplicate/delete — **`aria-busy`** по отдельности.
- Для **`failed`**: **`error_message`** в строке — **`EwrpExpandableClampedText`** (`tone="error"`).
- Длинная **тема** в строке — тот же компонент (`tone="secondary"`), кнопки «Показать тему полностью».
- Ошибка загрузки истории: блок с кнопкой **«Повторить загрузку»** (`EwrpInlineErrorAlert`).
- Модалка истории: backdrop dismiss, focus trap, `aria-describedby`, **`aria-busy`** при загрузке; кнопка «Обновить список» — **`aria-busy`** при refresh; фокус в `#ewrp-history-search` при открытии; **`historyListCount*`** под поиском; футер **`historyModalFootnote`** (без hotkeys в UI); подтверждение удаления — **`historyList.delete`**.

### 5.3. Колонка статуса

- **Тулбар вкладки «Мои презентации»:** история + локальный черновик; **`EwrpPresentationsScrollButton`** (`tabs.scrollToStatus` / `tabs.scrollToEditor`, icon-only `<640px`); gates **`ewrpPresentationsScrollToEditorVisible`** / status anchor; при открытом редакторе и статус off-screen — **`EwrpPresentationsMiniStatusBar`** (`useEwrpPresentationsScrollTargets`).
- Чип фазы с **иконкой и семантикой как в истории** — единый **`EwrpStatusPhaseChip`** (`ewrpStatusPhaseIndicator`): PDF готов / ошибка / **«Не завершена»** (amber) для зависших in-progress. **Блок ошибки** (`error_message`) — сразу под шагами pipeline (`EwrpInlineErrorAlert` + раскрытие длинного текста через **`EwrpExpandableClampedText`**), с подсказками retry/editor.
- **Пустое состояние** без выбранной задачи: при первой загрузке истории — `presentationsEmptyLoading` + `aria-busy`; при ошибке загрузки — **`EwrpInlineErrorAlert`** + «Повторить загрузку» и CTA «Новая презентация» + «История»; после загрузки — `presentationsEmpty*` с CTA «Новая презентация» + «История» (счётчик задач на кнопке и подсказка `presentationsEmptyHistoryAvailable`, если список не пуст); без hotkeys в UI.
- **Hydration статуса:** при `jobId` без `status` — **`EwrpStatusColumnSkeleton`**; ошибка poll — **`EwrpInlineErrorAlert`** + «Повторить».
- Заголовок колонки статуса показывает **title/topic** задачи (с раскрытием длинного текста).
- **Failed без slides:** отдельный блок `failedNoSlides*` (ошибка до сохранения структуры).
- На форме при **`formLocked`:** заметка `formLockedHint` + переход на вкладку статуса.
- Кнопка **обновить статус** доступна и для **`failed`** (повторный poll).
- **ID задачи** с копированием; длинный UUID — раскрытие **«Показать ID полностью»**; метаданные — **чипы**: число слайдов, **updated_at**, тема PDF, **источник CM** (`statusMeta*`, имя через `contentApi.getContent` или prefetch `docItems`; пока имя не готово — чип **`statusMetaSourceLoading`** с `aria-busy`).
- **`extra_context`** задачи — блок с **`EwrpExpandableClampedText`** (`statusExtraContext*`).
- Кнопки **Вводные в форму** / **Повторить** / **Ещё раз** — контейнер с **`aria-busy`** при in-flight действиях; каждая кнопка — **`aria-busy`** по отдельности; ручное обновление статуса — **`aria-busy`** на icon-кнопке и в блоке PDF.
- **Прогресс** с `role="progressbar"` и нормализованным процентом (`statusProgressClamped` в `useMemo`).
- Ручное обновление статуса: **`handleManualPollStatus`** (ожидание `pollStatus`, индикатор на кнопках, `aria-busy`).
- **PDF:** скачивание (`aria-busy` при загрузке), **открытие в новой вкладке** и **копирование ссылки** (`ewrpPdfAbsoluteUrl` + `pdf_download_token`), встроенный просмотр (`EwrpPdfPresentationViewer`, focus trap, раскрытие длинного заголовка).
- Парсинг ответа статуса — единый **`parseEwrpStatusResponse`** в **`ewrpStatusResponse.ts`** (re-export из chunks / slide editor helpers).

### 5.4. Редактор слайдов (черновик)

Детальный канон редактора (bullets, scroll, hotkeys, smoke): **`product/EWRP-EDITOR.md`**.

#### Базовые возможности

- **Шаблон слайда** (со **второго** слайда): выпадающий список «Авто» или явный ключ лейаута (см. §3.1); для титула подсказка, что оформление фиксировано. Сохраняется в **`slides_json.layout`** и уходит в **`PUT /ewrp/{job_id}/slides`**.
- **Текст слайда:** textarea «одна строка — пункт»; нормализация **`ewrpDraftBullets.ts`** (зеркало **`ewrp_slide_bullets.py`**). Label/hint: `draftSlide.titleFieldLabel`, `bulletsFieldLabel`, `bulletsFieldHint`.
- Перестановка **DnD** (`@dnd-kit`) при двух и более слайдах (отключается при virtual list); стрелки вверх/вниз; удаление/добавление в пределах лимитов; **«Развернуть все» / «Свернуть все»**.
- **UGS по слайду** … Pure helpers: **`ewrpSlideEditorHelpers.ts`**, **`ewrpHttpErrors.ts`**, **`EwrpInlineErrorAlert`**. Модалки UGS: focus trap (`useEwrpDialogFocusTrap`), backdrop dismiss, `aria-describedby`.
- Пока задача снова в фазах **`generating_content`** / **`generating_images`** / **`building_pdf`**, панель редактора **остаётся открытой**; inline-баннер «Дождитесь пересборки» + disabled UGS с **tooltip** (`ewrpSlideEditorDisabledTitle`).
- После платного действия фронт возобновляет опрос статуса (**`resumeActivePolling`**) и при возврате в **`completed`** подставляет актуальные слайды из **`GET .../status`** в черновик (синхронизация draft — при смене фазы, см. **`EWRP-EDITOR.md`** §2).
- Экспорт структуры в буфер и **файл Markdown** (вне режима редактирования — из outline).
- Поиск по слайдам: `#ewrp-slide-editor-search`, счётчик совпадений, **«Сбросить поиск»**; quick nav при фильтре показывает только найденные индексы.
- **Локальный черновик:** **`EwrpDraftRestoreBanner`**, `localStorage` `ewrp-draft-{jobId}`; выход с правками — confirm modal.
- **Prefetch CM** на вкладке «Мои презентации».

#### Фокусный режим редактирования (2026-06)

При **`isEditing`**:

| UI | Поведение |
|----|-----------|
| Lead | `form.editingFocusLead` |
| Шапка | **«Завершить редактирование»** (`exitEditMode`) |
| Outline | Скрыт |
| Progress в статусе | Скрыт |
| **Детали задачи** | `EwrpCollapsibleSection` + **`EwrpPresentationJobAdminBlock`** (pipeline, ID, meta, retry/duplicate, preview PDF) — свёрнуто по умолчанию |
| **Подсказки** | Спойлер: onboarding (`ewrp-editor-onboarding-v1`), `editorHelp`, DnD / virtual hint |
| Toolbar редактора | Плотность списка (comfortable/compact), expand/collapse all, счётчик слайдов |

Компоненты: **`EwrpCollapsibleSection`**, **`EwrpSlideEditorQuickNav`**, **`EwrpSlideEditorStickyFooter`**.

#### Навигация и scroll

- **Quick nav:** номера слайдов + **‹ ›**; при **≥ 15** слайдах — `VirtualVariableList` + `virtualListRef.scrollToIndex`; активный слайд — `onVisibleIndexChange` или `IntersectionObserver`.
- **Scroll-область слайдов:** в **focus mode** — `flex-1 min-h-0` (единственный scroll списка; без vh min-height). Вне focus — `max-h-[min(65vh,640px)] overflow-y-auto` (не virtual); virtual list — внутренний скролл `height={560}` / measured. См. **`EWRP-EDITOR.md`** §5.
- **Sticky footer** редактора: добавить слайд, 0 ⚡ hint, PDF preview, save/cancel.
- **Mini status bar** (`ewrpPresentationsMiniStatusVisible`): save **всегда видна** (disabled без `draftIsDirty`); compact `<640px`.

**Outline (read-only, вне edit):** **`EwrpSlideOutlineRow`** + **`EwrpExpandableClampedText`**.

### 5.5. Модалка Файловый менеджер

- Типы: документ / презентация / таблица; фильтрация имён «как картинка» при ошибочном типе.
- Поиск по списку с `useDeferredValue`; длинные списки — **`VirtualList`**.
- Ошибка загрузки: **`retryDocPickerLoad`** и кнопка **«Повторить»** (`EwrpInlineErrorAlert`).
- У диалога: backdrop dismiss, focus trap (`useEwrpDialogFocusTrap`), **`aria-describedby`** на подзаголовок, **`aria-busy`** при загрузке списка; после загрузки — фокус в `#ewrp-doc-picker-search`; при пустом фильтре — **`docSearchReset`**; **`docListCount*`** под поиском; текущий источник формы — **`aria-current`** + галочка в строке.

---

## 6. Горячие клавиши и фокус

| Действие | Условие |
|----------|---------|
| **`/`** | Фокус в поле поиска истории; не из textarea/select/contentEditable; из полей формы слева — только если уже в `#ewrp-history-search`. |
| **`R`** | Обновление списка истории; не в полях ввода (`input`/`textarea`/`select`/contentEditable). |
| **`Ctrl`/`⌘` + `Enter`** | Отправка формы, если фокус внутри формы и нет блокировок (модалки, `formLocked`). |
| **`Ctrl`/`⌘` + `S`** | **Режим редактора слайдов:** сохранить и пересобрать PDF (`handleSaveSlides`; confirm при нескольких новых картинках без PNG). |
| **`Alt` + `←` / `↑` / `→` / `↓`** | **Режим редактора:** предыдущий / следующий слайд в текущем наборе quick nav (в т.ч. при поиске — только совпадения). |
| **`Esc`** | В модалке CM: при непустом поиске — сброс строки; иначе закрытие. В модалке истории: при непустом `#ewrp-history-search` — сброс запроса; иначе закрытие (с очисткой поиска). Модалка удаления не перехватывается первым обработчиком (отдаётся `ConfirmDeleteModal`). |

Подсказки в UI (форма, модалка истории) **не перечисляют** горячие клавиши — см. **`form.generateFootnote`**, **`historyModalFootnote`**. Полный перечень сочетаний — в таблице ниже (для операторов и a11y-документации).

---

## 7. Производительность и клиентские оптимизации

- Виртуализация истории и списка файлов CM при пороге по числу строк.
- **`useDeferredValue`** для строк поиска (история, модалка).
- Стабильные **`useCallback`** для рендер-функций виртуальных списков и выбора файла.
- **`useMemo`** для строки энергии на кнопке, прогресса, `absolutePdfHref`, классов shell, где уместно.
- Строки истории вынесены в **`memo`** (`EwrpHistoryRow` и др.).
- **`VirtualVariableList`**: опциональные `onEndReached` / `endReachedThreshold`; с 2026-06 — **`virtualListRef`** (`scrollToIndex`) и **`onVisibleIndexChange`** (EWRP slide editor quick nav).
- Редактор слайдов: virtual list при **`draftSlides.length >= EWRP_EDITOR_SLIDES_VIRTUAL_THRESHOLD`** (15); порог в **`ewrpChunks/ewrpGeneratorConstants.ts`** (re-export через **`EwrpGeneratorChunks.tsx`**).

---

## 8. Клиентское восстановление сессии

- **`localStorage`**, ключ активной задачи (константа в компоненте): при перезагрузке SPA подставляется `jobId`, далее работает опрос статуса.
- **Professional Worlds cross-app draft:** при открытии EWRP из PW в `WindowInitialPayload.professionalWorldsCrossAppDraftKey` передаётся ключ `sessionStorage`; компонент один раз читает капсулу, подставляет поля формы и показывает toast (без автозапуска генерации). Повторное открытие черновика в уже открытое окно EWRP — merge payload + focus (как GAF Chat).

Опрос: первый запрос с задержкой, затем интервал (константы `FIRST_POLL_DELAY_MS`, `POLL_INTERVAL_MS`); при `completed`/`failed` интервал снимается. После **UGS-перегенерации слайда** из уже завершённой задачи интервал мог быть снят — компонент снова запускает таймеры через **`resumeActivePolling`**, чтобы дождаться нового **`completed`** и обновить PDF/слайды.

---

## 9. Связанные документы

| Файл | Содержание |
|------|------------|
| **`documentation/worklog/README.md` *[monthly journals retired — stub only]*** | Покомпонентные записи по EWRP (UI, API, биллинг, виртуализация, клавиши). |
| **`api/RABBITMQ_USAGE.md`** | Очередь EWRP и воркер. |
| **`product/EWRP-EDITOR.md`** | Редактор слайдов: bullets, focus UX, nav, scroll, smoke. |
| **`product/handbook-kb-articles/kb-ewrp-prezentatsii.md`**, **`kb-ewrp-sozdat-prezentatsiyu-i-pdf.md`** | Тексты для базы знаний (пользователи). |
| **`product/desktop/DESKTOP-API-AND-APPS.md`** | `app_component` EWRP. |
| **`docker/scripts/ewrp-stack0-smoke.sh`** | Автоматизированный smoke stack0 (health, `generation_types`, pytest через **`ewrp-api-pytest.sh`**). |
| **`docker/scripts/ewrp-api-pytest.sh`** | EWRP pytest в контейнере API. |
| **`documentation/worklog/README.md` *[session-summaries retired — stub only]*** | Мастер-саммари UI waves 2–28 (2026-05-27). |
| **`platform/docker-re_doc/UGS-IDEMPOTENCY.md`** | Контекст UGS (связанные генерации). |

Технические отчёты по очередям и deadlock (EWRP + UGS) — в **`documentation/worklog/README.md` *[monthly journals retired — stub only]*** / **`2026-03.md`** (поиск по «EWRP»).

---

## 11. Архитектура фронтенда (модули)

Каталог: **`shared/web/frontend/src/components/EWRP/`** (~69 файлов). Принцип: **тяжёлая логика в pure helpers + unit-тесты**; UI-компоненты тонкие; общие паттерны a11y (focus trap, `aria-busy`, sr-only announce).

### 11.1. Слои

| Слой | Назначение | Примеры |
|------|------------|---------|
| **Shell** | Точка монтирования окна desktop | `EWRPGenerator.tsx` → `EWRPGeneratorMain.tsx` |
| **UI shell** | Композиция панелей + вызов overlays (без локального state SoT) | `EWRPGeneratorMain.tsx` (≤1000 LOC) |
| **Orchestrator** | Состояние, polling, history, form submit, slide-editor handlers | `useEwrpGeneratorOrchestration.tsx` (один экземпляр на Main) |
| **Overlays** | History / doc-picker, lazy PDF, confirms, guide (props из Main/hook) | `EwrpGeneratorModals.tsx` |
| **Generate tab UI** | Форма запуска (props из Main/hook); facade + sections | `EwrpGenerateTabPanel.tsx` → `ewrpGenerateTab/*` |
| **App chrome** | Header + Generate/Presentations tablist | `EwrpGeneratorAppChrome.tsx` |
| **Presentations tab UI** | Статус-колонка + composition sibling extracts (props из Main/hook) | `EwrpPresentationsTabPanel.tsx` (≤1000 LOC) + `EwrpPresentationsSlideEditorSurface.tsx`, `EwrpPresentationsStatusOutline.tsx`, `EwrpPresentationsCompletedPdfActions.tsx`, `EwrpPresentationsIdleColumn.tsx` |
| **Shared UI chunks** | История, строки редактора, баннеры, константы | `EwrpGeneratorChunks.tsx` (thin barrel ≤200 LOC) → `ewrpChunks/*` |
| **Feature components** | PDF viewer, pipeline, skeleton, mini-bar, scroll | см. §11.2 |
| **Pure helpers** | Политики, парсинг, gates, i18n-safe labels | `ewrp*.ts` (см. §11.3) |
| **Hooks** | Orchestration + observer, focus trap, scroll targets | `useEwrpGeneratorOrchestration.tsx`, `useEwrp*.ts` |
| **Tests** | Vitest рядом с helpers | `ewrp*.test.ts` — **120 tests**, **28 files** (2026-05-27); contracts `EwrpGenerateTabPanel.contract.test.ts` (facade ≤50 LOC + `ewrpGenerateTab/*` ≤800 + Main wiring), `EwrpPresentationsTabPanel.contract.test.ts` (Main → hook + panels + `EwrpGeneratorModals`; Main ≤1000 LOC) |

### 11.2. UI-компоненты (ключевые)

| Компонент | Файл | Роль |
|-----------|------|------|
| Expandable text | `EwrpExpandableClampedText.tsx` | Длинные темы, ошибки, CM-имена, PDF title |
| Inline errors | `EwrpInlineErrorAlert.tsx`, `EwrpExpandableErrorText.tsx` | Ошибки API/poll/history |
| Status skeleton | `EwrpStatusColumnSkeleton.tsx` | Hydration статуса |
| Phase chip | `EwrpStatusPhaseChip.tsx` | Единый чип фазы (history / status / tab / mini-bar) |
| Mini status bar | `EwrpPresentationsMiniStatusBar.tsx` | Sticky контекст при редактировании ниже fold |
| Scroll CTA | `EwrpPresentationsScrollButton.tsx` | «К статусу» / «К редактору», compact `<640px` |
| Draft restore | `EwrpDraftRestoreBanner` (chunks) | Локальный черновик vs сервер |
| PDF viewer | `EwrpPdfPresentationViewer.tsx` | Lazy, focus trap |
| Pipeline | `EwrpPipelineSteps.tsx` | Шаги генерации |
| Collapsible panel | `EwrpCollapsibleSection.tsx` | Спойлеры «Детали задачи» / «Подсказки» |
| Job admin block | `EwrpPresentationJobAdminBlock.tsx` | ID, meta, retry/duplicate в спойлере |
| Generate tab + chrome | `EwrpGenerateTabPanel.tsx` (facade) → `ewrpGenerateTab/*`, `EwrpGeneratorAppChrome.tsx` | Форма запуска (`ewrp-panel-generate`) + header/tabs |
| Presentations tab | `EwrpPresentationsTabPanel.tsx` | Статус-колонка + composition (`ewrp-panel-presentations`, ≤1000 LOC) |
| Presentations slide editor | `EwrpPresentationsSlideEditorSurface.tsx` | Chrome/search/list/sticky footer (props из panel) |
| Presentations outline | `EwrpPresentationsStatusOutline.tsx` | Read-only outline + not-ready/failed empty |
| Presentations PDF actions | `EwrpPresentationsCompletedPdfActions.tsx` | Download/open/copy PDF (completed, non-edit) |
| Presentations idle column | `EwrpPresentationsIdleColumn.tsx` | Skeleton / history error / empty CTAs |
| Quick nav | `EwrpSlideEditorQuickNav.tsx` | Номера слайдов, ‹ › |
| Editor sticky footer | `EwrpSlideEditorStickyFooter.tsx` | Save/cancel/add/PDF внизу редактора |
| Slide editor UGS | `EwrpSlideEditorPanel.tsx` | UGS regenerate image/text |
| Orchestration hook | `useEwrpGeneratorOrchestration.tsx` | State/effects/handlers SoT for Main |
| Generator overlays | `EwrpGeneratorModals.tsx` | History / doc-picker, lazy PDF host, confirms, guide |
| Draft bullets | `ewrpDraftBullets.ts` | Нормализация bullets textarea ↔ API |

### 11.3. Pure helpers (карта)

| Модуль | Назначение |
|--------|------------|
| `ewrpClientJobPolicy.ts` | `formLocked`, stop polling, slide regen/rebuild guards |
| `ewrpStatusPolling.ts` | Progress clamp, poll outcome |
| `ewrpStatusResponse.ts` | `parseEwrpStatusResponse` |
| `ewrpHttpErrors.ts` | 402/503 toasts |
| `ewrpStickyContextMismatch.ts` | Slide/theme mismatch chips на форме |
| `ewrpGenerateWorkspaceLabel.ts` | Headline sticky/banner (form → status) |
| `ewrpStatusPhaseIndicator.tsx` | Label/class/icon payload для phase chip |
| `ewrpPresentationsMiniStatusVisible.ts` | Gate mini-bar |
| `ewrpPresentationsScrollToEditorVisible.ts` | Gates scroll-to-editor (toolbar + mini-bar) |
| `ewrpMiniStatusEditorActions.ts` | Save/cancel enabled на mini-bar |
| `ewrpMiniStatusProgressVisible.ts` | Progress % на mini-bar при rebuild |
| `ewrpMiniStatusCompactLayout.ts` | Compact breakpoint + порядок action-кнопок |
| `ewrpDraftDateFormat.ts` | `formatEwrpLocalDraftSavedAt` |
| `ewrpExpandableClampedText.ts` | `ewrpClampedTextNeedsExpand` |
| `ewrpPdfAbsoluteUrl.ts` | Absolute PDF URL + token |
| `ewrpHistoryRowEnergyLabels.ts` | Retry/duplicate energy copy |
| `ewrpProfessionalWorldsDraft.ts` | Cross-app draft из PW |

### 11.4. Hooks

| Hook | Файл | Назначение |
|------|------|------------|
| `useEwrpDialogFocusTrap` | `useEwrpDialogFocusTrap.ts` | Focus trap модалок (history, CM, UGS, PDF) |
| `useEwrpAnchorVisibility` | `useEwrpAnchorVisibility.ts` | `IntersectionObserver` — anchor in viewport |
| `useEwrpPresentationsScrollTargets` | `useEwrpPresentationsScrollTargets.ts` | Refs + visibility status panel и slide editor |

### 11.5. Инварианты UI (a11y / copy)

- **Без hotkeys в видимом UI** с wave 10+: footnotes `form.generateFootnote`, `historyModalFootnote` — action-oriented; горячие клавиши только в §6 (операторы).
- **`aria-busy`** на контейнерах и per-action кнопках при in-flight (history, status, editor save, PDF download).
- **sr-only announce** после programmatic scroll: `a11y.presentationsStatusFocused`, `a11y.presentationsEditorFocused`.
- **Compact breakpoint** presentations UI: **`639px`** (`EWRP_MINI_STATUS_COMPACT_MQ`) — icon-only scroll, двухстрочный mini-bar, save-first.

---

## 12. Навигация и scroll (вкладка «Мои презентации»)

Система добавлена в waves **19–28** для длинной страницы (статус + outline + редактор + PDF).

### 12.1. Якоря и observers

| Ref | Элемент | Observer |
|-----|---------|----------|
| `statusColumnRef` | `<section>` колонки | — (target scroll «к статусу») |
| `statusPanelAnchorRef` | Shell панели статуса | `useEwrpPresentationsScrollTargets` |
| `slideEditorAnchorRef` | Shell редактора слайдов | `useEwrpPresentationsScrollTargets` |

`statusPanelVisible` / `slideEditorPanelVisible` — через **`useEwrpAnchorVisibility`** (`threshold: 0.08`, `rootMargin: -8px 0px 0px 0px`).

### 12.2. Функции focus/scroll

| Функция | Действие | Announce |
|---------|----------|----------|
| `openPresentationsStatus()` | Tab → presentations + scroll | `presentationsStatusFocused` |
| `focusPresentationsStatusColumn()` | Smooth scroll к `statusColumnRef` | то же |
| `focusPresentationsSlideEditor()` | Scroll к editor + focus `#ewrp-slide-editor-search` | `presentationsEditorFocused` |
| `openJobFromHistory(id)` | Open job + parity scroll/focus (wave 21) | status announce |

### 12.3. Gates видимости CTA

| CTA | Pure gate | Условие (кратко) |
|-----|-----------|------------------|
| Toolbar «К статусу» | — | `jobId && status && !statusPanelVisible && !showSlideEditorPanel` |
| Toolbar «К редактору» | `ewrpPresentationsScrollToEditorVisible` | editing + status visible + editor off-screen |
| Mini-bar | `ewrpPresentationsMiniStatusVisible` | editing + status off-screen |
| Mini-bar «К редактору» | `ewrpMiniStatusScrollToEditorVisible` | mini-bar up + editor still off-screen |
| Mini-bar Save/Cancel | `ewrpMiniStatusEditorActionsEnabled` | save **кнопка всегда** (enabled if dirty); block if saving/rebuild |

### 12.4. Mini status bar (sticky)

Показывается когда пользователь **редактирует слайды** и **прокрутил мимо панели статуса**.

Содержимое:

- Headline (`resolveEwrpGenerateWorkspaceLabel` / `activeJobUntitled`)
- **`EwrpStatusPhaseChip`** (sm)
- Progress **N%** при rebuild (`ewrpMiniStatusProgressVisible`)
- Amber **«Есть правки»** / **«Edited»** при `draftIsDirty`
- **Save** / **Cancel** (те же handlers что **`EwrpSlideEditorStickyFooter`**); save видна даже без правок (disabled, tooltip `editorSaveNoChangesTitle`)
- **`EwrpPresentationsScrollButton`** — status / editor

**Compact (`<640px`):** две строки (контекст + actions); порядок кнопок — **`ewrpMiniStatusBarActionOrder`** (save перед scroll).

### 12.5. Sticky context bar (вкладка «Новая презентация»)

- Headline: **`resolveEwrpGenerateWorkspaceLabel`**
- Amber mismatch: **`ewrpStickySlidesMismatch`**, **`ewrpStickyThemeMismatch`**
- Loading source: **`sticky.metaSourceLoading`**

---

## 13. Тестирование фронтенда

### 13.1. Vitest (unit)

Из **`shared/web/frontend`**:

```bash
pnpm exec vitest run src/components/EWRP/ewrp*.test.ts
```

Ожидание (2026-05-27): **120 passed**, **28 test files**.

Покрытие helpers: client policy, polling, status parse, sticky mismatch, workspace label, scroll gates, mini-bar actions/compact layout, history filter, retry, idempotency, PDF URL, expandable text, и др.

### 13.2. Smoke (оператор)

1. **Форма:** тема + slides + theme → create; sticky bar; mismatch chips при расхождении с job.
2. **История:** search, virtual list, Open → scroll status; failed expand error.
3. **Presentations:** status meta, PDF open/copy, edit slides, local draft restore banner.
4. **Scroll:** прокрутка вниз → toolbar «К статусу» / «К редактору»; при edit → mini-bar с save/cancel.
5. **Editor focus (2026-06):** «Редактировать слайды» → спойлеры свёрнуты; правка bullets; nav + scroll; `Ctrl+S`; sticky footer.
6. **Narrow `<640px`:** icon scroll buttons, compact mini-bar.

### 13.3. Backend pytest

```bash
docker/scripts/ewrp-api-pytest.sh
# или stack0 smoke:
docker/scripts/ewrp-stack0-smoke.sh
```

### 13.4. Changelog UI-сессии 2026-05-27

Полная таблица waves 2–28 и backend phases — **`documentation/worklog/README.md` *[session-summaries retired — stub only]***.

Кратко по волнам:

| Waves | Тема |
|-------|------|
| pre + 2–3 | Errors, modals, expandable text, focus trap |
| 4–6 | Clamped text, tab badge, PDF actions |
| 7–9 | Status context, PDF viewer, doc picker, parse/submit |
| 10–12 | Skeleton, sticky meta, no hotkeys in UI, onboarding, prefetch |
| 13–15 | Draft restore, focus search, empty states |
| 16–18 | History error, source loading, workspace label |
| 19–21 | Sticky mismatch, scroll status, history parity |
| 22–28 | Scroll system, mini-bar, phase chip, save/cancel, compact layout |

### 13.5. Changelog UI — редактор (2026-06-08)

| Тема | Session summary |
|------|-----------------|
| Fix редактирования bullets (import) | `worklog/session-summaries/2026-06-08-0250-ewrp-slide-bullets-edit-fix.md` |
| Фокусный режим, спойлеры деталей/подсказок | `worklog/session-summaries/2026-06-08-0255-ewrp-editor-focus-ux.md` |
| Quick nav + sticky footer | `worklog/session-summaries/2026-06-08-0310-ewrp-editor-nav-sticky-footer.md` |
| Virtual list nav, mini-bar save always | `worklog/session-summaries/2026-06-08-0310-ewrp-editor-nav-virtual-mini-save.md` |
| Восстановление scroll в редакторе | `worklog/session-summaries/2026-06-08-0320-ewrp-editor-scroll-fix.md` |

Канон редактора: **`product/EWRP-EDITOR.md`**.

---

## 14. Обновление справочника

При существенных изменениях контракта API, биллинга или ключевого UX:

1. Обновить этот файл (**`product/EWRP-REVOLUTIONARY-PRESENTATIONS.md`**).
2. `documentation/worklog/` retired → `trash/` — не требовать monthly journal; chronology via chat / `git log`.
3. При изменении терминов для нескольких доменов — **`documentation/reference/PROJECT-GLOSSARY.md`**.

Правило Cursor: **`documentation-maintenance.mdc`**.
