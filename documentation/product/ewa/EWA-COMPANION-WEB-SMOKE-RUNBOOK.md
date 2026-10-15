# Assistant — operator web smoke runbook

**Статус:** Канон  
**Обновлено:** 2026-06-20 (migration 021 `parent_run_id`; wave 10: migration 018 `VERIFY_ONLY` / `DRY_RUN`; wave 9: one-shot script; wave 7: operator runbook; wave 5: `run_revision`, `companion_action_notice`)  
**Тип (Diátaxis):** How-to — ручной smoke спутника в браузере на рабочем столе EliteEW.

Операторский чеклист для **десктопного companion chat** на `app.eliteew.ru`: семь UX-сценариев с готовыми фразами и ожидаемым видимым результатом. Не заменяет stack0 admin smoke ([EWA-COMPANION-ADMIN-SMOKE-STACK0.md](EWA-COMPANION-ADMIN-SMOKE-STACK0.md)) и не покрывает маркетинговую AMKA.

> Операторский runtime по умолчанию: **Podman** (stack0). См. [platform/docker-re_doc/STACK-CONTAINER-CONTROL.md](../../platform/docker-re_doc/STACK-CONTAINER-CONTROL.md).

---

## 1. Scope

| # | Сценарий | Что проверяем |
|---|----------|---------------|
| 1 | Body search (content scope) | Поиск по телу файла (`extracted_text`), hybrid scope, честная выдача в чате / Файловый менеджер |
| 2 | Doc insert confirm / resume | Подтверждаемая вставка файла в открытый DocEditor — UI Confirm или «да» в чате |
| 3 | Memory strip | Блок «Помнит о вас» после явной памяти и catalog preferences |
| 4 | Mood chip | Chip настроения рядом с шапкой персоны |
| 5 | Quick presets | Встроенные и user-saved быстрые фразы |
| 6 | Action tray | Свёрнутая полоса «Действия: N» после server actions |
| 7 | Operations panel | «Текущие операции»: active/history, confirm bar, refresh |

**Вне scope:** admin workflow editor, prod-core Celery worker internals, gpu141 remote inference internals (кроме сценариев, где явно нужна фоновая генерация), vision attach, TTS/mic (отдельные каноны).

---

## 2. Preconditions

### 2.1 Runtime (stack0)

| Проверка | Команда / ожидание |
|----------|-------------------|
| API healthy | Prod-core baked: `ssh prod-core 'curl -sf http://127.0.0.1:29000/api/health'`; legacy/dev bind-mount: `curl -sf http://127.0.0.1:8000/api/health` inside `stack0-eliteew-api-prod` |
| EWA Postgres | `stack-ewa-postgres` running; профиль companion читается |
| Migration **018** (`run_revision`) | Apply only as an authorized database change using the [current migration runner](../../../shared/api/ewa_platform/migrations/README.md#migration-018--run_revision-operator-runbook). Diagnostic: `bash docker/scripts/ewa-platform-migrations-verify.sh`; verify `run_revision`. The previously advertised one-shot apply/verify/dry-run wrapper is absent from this checkout. |
| Migration **021** (`parent_run_id`) | Apply: [migrations README §021](../../../shared/api/ewa_platform/migrations/README.md#migration-021--parent_run_id-operator-runbook) or prod-core `ssh 192.168.1.111 'podman exec …'` — [EWA-POSTGRES-RUNBOOK](../../platform/docker-re_doc/EWA-POSTGRES-RUNBOOK.md). **Verify column** (локально или на `.111`): `podman exec stack-ewa-postgres psql -U "$EWA_POSTGRES_USER" -d "$EWA_POSTGRES_DB" -t -A -c "SELECT column_name, data_type FROM information_schema.columns WHERE table_name='ewa_companion_task_runs' AND column_name='parent_run_id';"` → одна строка `parent_run_id|text`. После деплоя UI: user workflow с async step — в «Текущие операции» **одна** parent card, без отдельной child music/image row (§3.7) |
| Main Postgres + каталог | Есть хотя бы **2 текстовых документа** в библиотеке пользователя (один — с уникальной фразой в теле, см. §3.1) |
| Stack2 chat LLM | Ответ companion не пустой (см. [EWA-COMPANION-STACK2-OPERATOR.md](EWA-COMPANION-STACK2-OPERATOR.md)) |

Опционально для §3.7 (фоновая музыка): `EWA_COMPANION_BACKEND_MUSIC_GENERATION=1`, Celery worker running.

### 2.2 Браузер

1. Войти на **`https://app.eliteew.ru`** (Keycloak SSO, роль с доступом к desktop).
2. Открыть **рабочий стол** (не маркетинговый кабинет).
3. Открыть окно **Assistant** (панель чата спутника) — sidebar или отдельное окно на столе.
4. Убедиться, что транскрипт загружается (нет вечного skeleton / 503 на `/api/v1/ewa/companion-profile`).

### 2.3 Тестовые данные (рекомендуется один раз)

| Артефакт | Зачем |
|----------|-------|
| Документ **«SmokeSource.md»** с текстом `SMOKE_BODY_MARKER amortization note` | Body search §3.1 |
| Пустой или короткий документ в **Ultimate Doc Editor** (открыт на столе, в listing есть `uc=…`) | Doc insert §3.2 |
| Любая сохранённая user quick preset (опционально) | §3.5 delete/rename |

---

## 3. Manual checklist

Фиксируйте **PASS** / **FAIL** для каждого подпункта. Фразы — RU; EN-эквиваленты работают там, где в коде есть regex (doc insert, body search).

### 3.1 Body search (content scope)

**Цель:** companion находит файл по **содержимому**, не только по имени; в ответе — релевантные имена или открытие Файловый менеджер с очищенным запросом (не весь prompt).

| # | Действие | Ожидаемый видимый результат |
|---|----------|----------------------------|
| 1 | «**найди документы где написано amortization**» | В ответе упоминается **SmokeSource.md** (или ваш файл с маркером); не пустой «ничего не нашла» при наличии текста в каталоге |
| 2 | «**найди файлы про договор в контент менеджере**» | Открывается **Файловый менеджер** / действие каталога; фильтр по **`договор`**, не полная исходная фраза |
| 3 | «**посмотри список всех документов без аудио**» | Browse-листинг документов; в «Помнит о вас» может появиться preference про исключение аудио (после refresh профиля) |
| 4 | «**где в моих файлах написано SMOKE_BODY_MARKER**» | Hybrid search; snippet или имя файла с маркером в ответе |

**FAIL hints:** пустой каталог при известном файле → проверить `extracted_text` / FTS; лог API `companion_catalog_discuss_skip` vs `companion_search_intent`. Канон: [EWA-COMPANION-CHAT-TURN-PHASES.md](EWA-COMPANION-CHAT-TURN-PHASES.md) §4, `companion/sidecar/search_intent.py`.

### 3.1b Catalog discuss — read file into memory (Wave C)

**Цель:** «прочитай / обсуди» именованный файл в **EwaFile** подгружает тело в memory; ответ main LLM опирается на текст, без требования открытого DocEditor.

| # | Действие | Ожидаемый результат |
|---|----------|---------------------|
| 1 | «**прочитай SmokeSource.md**» | Ответ по содержимому файла; лог `companion_catalog_discuss_injected` |
| 2 | «**прочитай SmokeSource.md и открой в редакторе**» | Текст в ответе + DocEditor open (compound); branch `compound_file_chain` |
| 3 | После (1): «**что думаешь о нём?**» | `file_focus_chat`, без music/image side effects |

Канон: [EWA-COMPANION-CATALOG-DISCUSS.md](EWA-COMPANION-CATALOG-DISCUSS.md). Pytest: `tests/test_ewa_companion_catalog_discuss_wave_c.py`.

**FAIL / skip hints:** если inject не случился — в API debug-логах искать `companion_catalog_discuss_skip` и `companion_degrade context=catalog_discuss_*` (resolve empty, ambiguous, read_denied, focus empty). Отключить degrade noise: `EWA_COMPANION_DEGRADE_DEBUG=0`.

- [ ] **PASS** / **FAIL** — §3.1b

---

### 3.2 Doc insert — confirm и resume

**Цель:** durable task run `doc_insert_file_into_editor` с confirm gate; продолжение через **Confirm** в панели операций или «да» в чате.

**Подготовка:** Doc Editor открыт с целевым документом; в каталоге есть **SmokeSource.md** (или другой исходник).

| # | Действие | Ожидаемый видимый результат |
|---|----------|----------------------------|
| 1 | «**вставь файл SmokeSource в документ**» | Ответ: «Нашла файл … подготовила вставку … **Подтверди**»; в **«Текущие операции»** — run «Вставка файла в редактор», статус **ожидает подтверждения** |
| 2 | Нажать **Confirm** в `CompanionConfirmBar` (не отправлять «да») | Run → **completed**; тело Doc Editor дополнено содержимым исходника (заголовок + текст) |
| 3 | Повторить с другим исходником; на confirm отправить «**да**» | Тот же финал через chat resume (`_resume_pending_task`) |
| 4 | Без открытого Doc Editor: «**вставь файл Notes в документ**» | Честный blocker: «**Открой документ в редакторе**» — без ложного «сделала» |

- [ ] **PASS** / **FAIL** — §3.2

---

### 3.3 Memory strip («Помнит о вас»)

**Цель:** `memory_display` из профиля виден в левой колонке чата (до 8 строк).

| # | Действие | Ожидаемый видимый результат |
|---|----------|----------------------------|
| 1 | «**запомни, что я предпочитаю короткие ответы**» | После ответа и refresh профиля — новая строка в блоке **«Помнит о вас»** |
| 2 | «**меня зовут SmokeOperator**» | Строка с именем в memory strip |
| 3 | Свернуть/развернуть секцию **brain icon** | Accordion работает; badge = число строк |
| 4 | На свежем профиле без памяти | Placeholder «Здесь появятся заметки о вас после переписки» |

- [ ] **PASS** / **FAIL** — §3.3

---

### 3.4 Mood chip

**Цель:** chip настроения в шапке companion (ambient copy из persona + `character_state.mood`).

| # | Действие | Ожидаемый видимый результат |
|---|----------|----------------------------|
| 1 | Отправить 2–3 нейтральных реплики («привет», «как дела») | Chip виден рядом с role line; текст **не пустой** (ambient / steady band) |
| 2 | «**спасибо, ты очень помогла**» | После хода chip может сменить формулировку (bounded mood update) |
| 3 | «**извини, я был резок**» | Chip / tone softens (repair_need path — без гарантии exact текста) |
| 4 | Перезагрузить страницу (F5) | Chip восстанавливается из `/ewa/companion-profile`, без JS error |

- [ ] **PASS** / **FAIL** — §3.4

---

### 3.5 Quick presets

**Цель:** strip «Быстрые фразы» над composer — built-in + user CRUD.

| # | Действие | Ожидаемый видимый результат |
|---|----------|----------------------------|
| 1 | Развернуть strip → нажать chip **«Краткий итог»** | Текст preset попадает в composer и отправляется; ответ — краткое резюме |
| 2 | Набрать черновик → **«Сохранить»** (иконка дискеты) → имя «Smoke preset» | Новый user chip появляется в strip |
| 3 | Карандаш → переименовать в «Smoke v2» | Label chip обновился после PATCH |
| 4 | × на user chip → confirm delete | Chip исчез; built-in presets остаются |
| 5 | Chip **«Что на столе»** (`deskSnapshot`) | Ответ описывает открытые окна из `shell_context` |

- [ ] **PASS** / **FAIL** — §3.5

---

### 3.6 Action tray (свёрнутые действия)

**Цель:** после server `open_app` / focus tray показывает **«Действия: N»** collapsed; expand → карточки с Undo.

| # | Действие | Ожидаемый видимый результат |
|---|----------|----------------------------|
| 1 | «**открой файловый менеджер**» | Файловый менеджер открывается на столе; в companion — tray **«Действия: 1»** (или больше) |
| 2 | Развернуть tray (chevron) | Карточка «Открыла приложение …» + rationale; кнопка **Undo** |
| 3 | Нажать **Undo** | Окно закрывается / focus откатывается; запись уходит из tray |
| 4 | «**открой редактор документов**» | Новая запись в tray; счётчик увеличился |
| 5 | Фраза, вызывающая tool **error** без desktop action (например несуществующее приложение / env-off music) | Tray: **`companion_action_notice`** с badge **failed** (или **blocked** если tool так пометил `outcome`); rationale виден в карточке; окно на столе **не** открывается |

Контракт notice / `outcome`: [EWA-COMPANION-CHAT-TURN-PHASES.md](EWA-COMPANION-CHAT-TURN-PHASES.md) §9.2.

- [ ] **PASS** / **FAIL** — §3.6

---

### 3.7 Operations panel («Текущие операции»)

**Цель:** polling/SSE task runs, confirm bar, history limit 10, refresh.

| # | Действие | Ожидаемый видимый результат |
|---|----------|----------------------------|
| 1 | Chip **«Фоновые задачи»** или «**что сейчас выполняется в фоне?**» | Панель раскрыта/подсвечена; subtitle «Сейчас: N · в истории: M» |
| 2 | «**Запусти автономную генерацию песни — жанр выбери сама**» (при включённой music) | Active run `music_generation_xl_base_background`; шаги pipeline в карточке |
| 3 | «**смени тему на тёмную**» | Immediate run `theme_set` в истории (completed), без блокировки чата |
| 4 | Кнопка **Refresh** на панели | Список синхронизируется с `GET …/task-runs?limit=10` |
| 5 | Сценарий §3.2 на confirm | **CompanionConfirmBar** на карточке run; Confirm без текста в чате |
| 6 | (Опционально) DevTools: confirm с устаревшим **`expect_run_revision`** | **409** `companion_task_run_revision_conflict`; UI refetch list и повтор с актуальным **`run_revision`** |

**FAIL hints:** 503 `ewa_orchestration_pool_unavailable` → EWA Postgres; пустая панель при music → env `EWA_COMPANION_BACKEND_MUSIC_GENERATION`. Revision / confirm HTTP: [EWA-COMPANION-CHAT-TURN-PHASES.md](EWA-COMPANION-CHAT-TURN-PHASES.md) §9.1. Канон UI: [EWA-COMPANION-OPERATIONS-PANEL.md](EWA-COMPANION-OPERATIONS-PANEL.md).

- [ ] **PASS** / **FAIL** — §3.7

### 3.8 User UX Program paths (desktop + mobile WebView)

**Цель:** витрина **Инструментов**, **центр активности**, mobile **Операции** / **Инструменты**, **Мои фразы**, **Цепочки**, retry/cancel. Канон IA: [EWA-COMPANION-USER-UX-MAP.md](EWA-COMPANION-USER-UX-MAP.md).

| # | Действие | Ожидаемый результат |
|---|----------|---------------------|
| 1 | Пустой чат → **«Показать инструменты»** или кнопка **Инструменты** | Compact popover (desktop) / bottom sheet (mobile); список прокручивается; **Попробовать** вставляет prompt |
| 2 | Закрепить инструмент (pin) → закрыть каталог | До 3 chips в composer row (`data-testid=ewa-companion-pinned-tools`) |
| 3 | Запустить музыку / image long-run | In-transcript banner + sticky **центр активности**; клик → highlight в операциях |
| 4 | Mobile WebView `#/mobile-ewa-companion` → rail **Операции** (✨) | Bottom sheet со списком runs |
| 5 | **Мои фразы** → список user presets | Surface `my_phrases`; apply возвращает в чат |
| 6 | **Цепочки** → пустой list | 4 quick-start карточки; фильтр Все/Включённые/Выключенные |
| 7 | Failed music run (если есть) | Кнопка **Повторить** на card; active run — **Отменить** |
| 8 | Proactive suggestion | **Не сегодня** скрывает до конца локального дня |
| 9 | Пустой transcript (первый визит) | Dismissible hint «показывается последний ответ» (`data-testid=ewa-companion-latest-reply-hint`) |
| 10 | Долгий pending без stream (>8s) | Banner «Ответ задерживается» в transcript |
| 11 | Composer strip | Legend «Инструменты · Мои фразы · Слэш» под presets / slash |
| 12 | Output surface ≠ chat (Мои фразы / doc editor) | Кнопка **Операции** остаётся доступной (`ewa-companion-non-chat-operations-entry`) |
| 13 | Desktop: окно EWA в фоне | Subtle hint «панель в фоне» без broken UI |
| 14 | Desktop `lg+` bond arc (первый раз) | Tooltip на sigil arc → dismiss сохраняется |
| 15 | Pull-to-refresh mid-scroll | Refresh только при scrollTop ≤ 2px (dead-zone) |
| 16 | Turn plan strip hint | Нет snake_case tool ids в user-visible hint text |

- [ ] **PASS** / **FAIL** — §3.8

---

## 4. Сводная таблица PASS/FAIL

| § | Сценарий | PASS |
|---|----------|------|
| 3.1 | Body search | ☐ |
| 3.2 | Doc insert confirm/resume | ☐ |
| 3.3 | Memory strip | ☐ |
| 3.4 | Mood chip | ☐ |
| 3.5 | Quick presets | ☐ |
| 3.6 | Action tray | ☐ |
| 3.7 | Operations panel | ☐ |
| 3.8 | UX Program (tools, activity, mobile) | ☐ |

**Критерий релиза smoke:** §3.1–3.7 — **PASS**; §3.8 — **PASS** после деплоя UX Program (2026-06-20).

---

## 5. Troubleshooting (кратко)

| Симптом | Куда смотреть |
|---------|----------------|
| Пустой ответ companion | `companion_visible_blankish_fallback` в API log; stack2 `content`-only mode — [EWA-COMPANION-CHAT-TURN-PHASES.md](EWA-COMPANION-CHAT-TURN-PHASES.md) §2 |
| Body search всегда пусто | `extracted_text` в unified_content; degraded ILIKE — worklog 2026-05-09 |
| Confirm не появляется | DevTools → `task-runs` API; SSE `task_awaiting_confirmation` |
| Confirm 409 revision | Response `companion_task_run_revision_conflict` — stale `run_revision`; refetch `GET …/task-runs` — §9.1 pipeline doc |
| Tray без badge на ошибке tool | Network → `actions[]` должен содержать `companion_action_notice` или action с `outcome: failed` — §9.2 pipeline doc |
| Memory strip не обновляется | `/ewa/companion-profile` → `memory_display`; revision bump |
| Quick preset 4xx | EWA pool; `/ewa/companion-profile/quick-actions` CRUD |

Логи API: eliteew-api.log *[runtime under docker/logs/stack0/eliteew-api-prod/]*.

---

## 6. Связанные документы

- [EWA-COMPANION-CHAT-TURN-PHASES.md](EWA-COMPANION-CHAT-TURN-PHASES.md) — HTTP LLM, orchestrator order, catalog discuss; **§9.1** `run_revision` / confirm 409; **§9.2** nested `parent_run_id` + `companion_action_notice`
- [EWA-COMPANION-DOC-EDITOR-AND-SHELL-CONTEXT.md](EWA-COMPANION-DOC-EDITOR-AND-SHELL-CONTEXT.md) — DocEditor, `shell_context`, insert flow
- [EWA-COMPANION-OPERATIONS-PANEL.md](EWA-COMPANION-OPERATIONS-PANEL.md) — task runs API и UI
- [EWA-COMPANION-HCM-MEMORY.md](EWA-COMPANION-HCM-MEMORY.md) — episodic memory и display lines
- [EWA-COMPANION-ADMIN-SMOKE-STACK0.md](EWA-COMPANION-ADMIN-SMOKE-STACK0.md) — admin + workflow smoke (скрипт)
- [EWA-COMPANION-STACK2-OPERATOR.md](EWA-COMPANION-STACK2-OPERATOR.md) — модели и env sidecar
- Hub: [product/ewa/README.md](README.md)
