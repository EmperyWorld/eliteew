# Assistant — Doc Editor: `shell_context`, перевод и серверная правка тела документа

**Статус:** канон (по коду на 2026-05)
**Аудитория:** разработчики бэкенда и фронтенда EliteEW.
**См. также:** [EWA-COMPANION-PROFILE-ADR.md](EWA-COMPANION-PROFILE-ADR.md) (профиль спутника), [ULTIMATE-DOC-EDITOR.md](../ULTIMATE-DOC-EDITOR.md) (продуктовый канон редактора). Historical desktop-actions ADR soft-retired → `trash/…/documentation archive tree2026-05-13/EWA-COMPANION-DESKTOP-ACTIONS-ADR.md` (not living canon; living allowlist = companion `actions.py` / code).

---

## 1. Зачем это нужно

Ассистент в окне на рабочем столе должен понимать **контекст открытых приложений** без сканирования DOM и без сохранения больших фрагментов текста в профиле PG. Для **Ultimate Doc Editor** дополнительно нужны:

- **превью документа** (plain text из HTML) — чтобы отвечать «о чём документ»;
- **выделение в редакторе** — чтобы выполнять точечные правки («сократи этот абзац», «оформи списком»);
- **маршрутизация к файлу** через строку листинга **`uc=<unified_content_id>`**.

Тяжёлые поля (`surface_*`, `companionSurface*`) живут **только в теле запроса** companion-chat и в оперативном состоянии SPA; в **`windows_snapshot`** при persist стола они **не попадают** (sanitizer на фронте).

**Server-first v2 (опционально):** при `learned_preferences.ewa_companion_server_first_v2=true` узкая серверная ветка может **полностью переписать тело** именованного файла из каталога пользователя (без обязательного открытого DocEditor), сохранить байты в **`unified_content`**, опционально открыть редактор по той же фразе — см. `api/ewa_platform/companion/companion_server_first_v2.py` и тумблер в **`EwaCompanionChatPanel`**.

---

## 2. Миграции БД

**Не требуются** для полей `shell_context` / payload окон. Схема Postgres профиля companion и `unified_content` для этого документа **не менялась**.

### 2.1 Две базы Postgres (EWA vs приложение)

| DSN / пул | Таблицы (ориентир) | Где в коде |
|-----------|-------------------|------------|
| **`EWA_DATABASE_URL`** → `app.state.ewa_orchestration_pool` | `ewa_companion_profile`, task runs/steps, оркестрация EWA | `companion_pg.*`, HTTP companion-chat принимает этот пул **только** для профиля/задач |
| **`DATABASE_URL`** → `get_asyncpg_pool()` | `unified_content`, пользователи, каталог | `ContentQueryService`, `ContentStorageService`, `_query_service_or_none` / `_storage_service_or_none` в оркестраторе, **Server-first v2** (после фикса — явный main pool) |

Ошибка вида `relation "unified_content" does not exist` на среде с поднятым **EWA**-Postgres почти всегда означает, что код по ошибке ходил в EWA-пул вместо основного. Профиль и файлы **намеренно** разделены.

**Server-first v2 и расширение `.md`:** ветка сохраняет тело как **HTML-фрагменты** (контракт TipTap / Ultimate Doc Editor: промпт и санитайзер ожидают HTML). Имя файла может быть `*.md`, но байты файла — HTML; открытие в Doc Editor согласовано. «Чистый» Markdown этим путём не гарантируется.

---

## 3. HTTP API

### 3.1 Эндпоинты

| Метод и путь | Назначение |
|--------------|------------|
| `POST /api/v1/ewa/companion-chat/message` | Синхронный ход: ответ + `actions` |
| `POST /api/v1/ewa/companion-chat/stream` | SSE: `delta`, затем `final` с `reply`, `actions`, ревизией |

Схемы: `shared/api/ewa_platform/schemas/pydantic/companion_chat.py` (`CompanionChatMessageIn`, `CompanionShellContextIn`, `CompanionShellWindowIn`, `CompanionChatMessageOut`).

### 3.2 Тело запроса: `shell_context` (schema v1)

Клиент отправляет объект:

- `schema_version`: `1`
- `active_desktop_id`, `active_window_id` (опционально)
- `windows`: до **40** строк окон приложений и папок

Каждая строка (`CompanionShellWindowIn`):

| Поле (wire) | Источник на фронте | Смысл |
|-------------|-------------------|--------|
| `window_id` | id окна desktop | Идемпотентность и порядок |
| `app_component` | например `DocEditor`, `DesktopFolder` | Routing действий и эвристик |
| `title` | заголовок окна | Обрезается на сервере (~120 симв.), маскируются email-подобные фрагменты |
| `z_index`, `minimized`, `desktop_id` | состояние стола | Фокус / виртуальные столы |
| `surface_excerpt` | `companionSurfaceExcerpt` | Plain **превью тела** документа (debounced из HTML) |
| `surface_selection` | `companionSurfaceSelectionPlain` | Plain **выделение** в Doc Editor (debounced) |
| `surface_listing` | `companionListingPlain` | Текстовые списки (папки, файловый менеджер, **строка смонтированного файла**) |

Лимиты на wire (Pydantic): для `surface_*` строк — **`max_length=4000`** на поле.

### 3.3 Строка «файл смонтирован в редакторе»

Для Doc Editor хост добавляет одну строку в `companionListingPlain`, например:

```text
- My Notes [document] uc=<uuid>
```

На сервере из листинга извлекается **`unified_content_id`** для действий **`open_app`** и для **перевода/правки тела файла** (см. `companion_doceditor_content_resolve.py`, `resolve_doc_editor_unified_id_for_shell()`).

---

## 4. Промпт: нормализация и бюджет

Модуль: `shared/api/ewa_platform/companion/sidecar/shell_context.py`.

- **`normalize_shell_context_payload()`** — парсинг, санитизация, clamp `z_index` (до `2_000_000`), отсечение пустых полей.
- **`shell_context_prompt_section()`** — компактная секция для system prompt LLM companion.
- В JSON по каждому окну в промпт попадают ключи (**при наличии**): `excerpt`, `selection`, `listing` — на общий **глобальный бюджет** `_EXCERPT_GLOBAL_PROMPT_BUDGET` (порядка 12k символов), плюс верхний предел всей секции `MAX_SHELL_PROMPT_CHARS`.

Цель бюджетов: не съедать весь контекст модели обрывками документов.

---

## 5. Серверное замещение тела документа (`doc_editor_set_body`)

### 5.1 Инварианты безопасности

1. **`doc_editor_set_body` не принимается из хвоста `<<ACTIONS>>` модели** — только **инъекция на сервере** после успешного **owner-read** файла (`ContentStorageService.read_file_bytes_for_owner`).
2. Доступ к байтам файла только для **владельца** (как у обычного чтения каталога); общие без владения — путь отклоняется.
3. После генерации HTML проходит **allow-list санитизация** (см. §6).

### 5.2 Порядок в `chat_turn.py`

После ответа LLM и **`extract_visible_reply_memory_actions`**:

1. **`_finalize_companion_actions`** — эвристики `open_app`, поиск по каталогу для Doc Editor и т.д.
2. **`augment_companion_doc_editor_translate_actions`** (`companion_doceditor_translate_body.py`) — если сработала эвристика **перевода целого документа** и есть `uc` в shell.
3. Если **`doc_editor_set_body` ещё нет**: **`augment_companion_doc_editor_edit_actions`** (`companion_doceditor_edit_body.py`) — **правка / форматирование / перефраз** по сообщению пользователя.
4. **`coerce_companion_chat_reply_when_doc_body_action`** — если в действиях есть `doc_editor_set_body`, **видимый текст ответа в чате заменяется короткой фразой** (отдельно для **перевода** и для **прочей замены тела**), чтобы полный HTML не сохранялся в транскрипт.

### 5.3 Форма действия (ответ API)

Клиент уже принимает в `actions` объект вида:

- `type`: `"doc_editor_set_body"`
- `app_component`: `"DocEditor"`
- `body_html`: строка HTML
- `rationale`: короткая строка
- `unified_content_id`: опционально, целевой файл

Исполнение на SPA: `EwaCompanionChatPanel`, fanout через `desktopDeepLink.ts` (**`DESKTOP_DOC_EDITOR_COMPANION_SET_BODY_EVENT`**), регистрация в **`UltimateDocEditorInner`** (в т.ч. lazy-chunk через глобальный listener в `useDesktopWorkspaceGlobalWindowEvents`).

---

## 6. Два режима: перевод и правка

### 6.1 Перевод (`companion_doceditor_translate_body.py`)

- Включено по умолчанию: **`EWA_COMPANION_DOC_BODY_TRANSLATE`** не `"0|false|…"`.
- Эвристика: ключевые слова перевода + направление (`на` / `to` / `into`) + область документа/редактора.
- Реализация: файл → извлечение plain/HTML → чанки → отдельные вызовы перевода → сборка **`_reassemble_translated_units`** (`<p>` + `<br />`).
- Приоритет: если сработало **перевод**, путь **edit** не добавляется.

### 6.2 Правка / форматирование (`companion_doceditor_edit_body.py`)

- Включено по умолчанию: **`EWA_COMPANION_DOC_BODY_EDIT`** не `"0|false|…"`.
- Не выполняется, если сработал **переводческий** intent (см. выше).
- Требует: **сообщение с эвристикой правки**, **`content_catalog_user_id`** (обычный DB user id пользователя для owner-read), **`uc` в shell** (`resolve_doc_editor_unified_id_for_shell`).
- Дополнительный **сигнал фокуса** (иначе правка может не запуститься): в сообщении упомянут документ/редактор/выделение **или** в shell уже есть **`surface_selection`** (длина ≥ 4 после trim) **или** **`surface_excerpt`** у Doc Editor (длина ≥ 12 после sanitize).
- Один проход HTTP LLM: инструкция пользователя + опционально блок **`USER_SELECTION_FROM_EDITOR`** + **`CURRENT_DOCUMENT`** (усечённый по **`EWA_COMPANION_DOC_EDIT_PROMPT_BODY_CHARS`**).
- Выход модели прогоняется через **`sanitize_companion_doc_body_html()`** — allow-list тегов, вырезание `script`/`style`/опасных вложений, нормализация `a[href]`.

Разрешённые теги (ориентир; полный список в коде): `p`, `br`, `hr`, `strong`, `b`, `em`, `i`, `u`, `s`, `ul`, `ol`, `li`, `h1`–`h4`, `blockquote`, `pre`, `code`, `div`, `span`, `a` (без опасных `href`).

### 6.3 Переменные окружения (сводка)

| Переменная | Область | Смысл |
|------------|---------|--------|
| `EWA_COMPANION_DOC_BODY_TRANSLATE` | translate | Выключатель перевода тела документа (`0` / `false` / …) |
| `EWA_COMPANION_DOC_BODY_EDIT` | edit | Выключатель серверной правки тела (`0` / `false` / …) |
| `EWA_COMPANION_DOC_BODY_MAX_DOWNLOAD_BYTES` | оба | Потолок размера файла при чтении |
| `EWA_COMPANION_DOC_BODY_MAX_ACTION_HTML_CHARS` | оба | Потолок длины `body_html` в действии |
| `EWA_COMPANION_DOC_TRANSLATE_CHUNK_CHARS` | translate | Размер чанков plain для перевода |
| `EWA_COMPANION_DOC_EDIT_PROMPT_BODY_CHARS` | edit | Максимум символов тела в промпт LLM |

---

## 7. SSE и «утечка» полного документа в чат

Если включён режим перевода документа **или** (включён **edit** и в shell уже есть **`uc`** для перевода сообщения пользователя через эвристику edit), основной вызов LLM на **SSE** выполняется **без потоковой раздачи токенов** (`httpx_compat_chat_completion_json`): после ответа отдаётся один `delta` с уже **принудительно усечённым** текстом, затем финал с `doc_editor_set_body`.

Синхронный `POST …/message` изначально не стримит.

---

## 8. Фронтенд: сборка контекста

| Компонент / файл | Роль |
|------------------|------|
| `buildEwaCompanionShellContext.ts` | Сборка snapshot v1 для POST/stream: **`surface_excerpt`**, **`surface_selection`**, **`surface_listing`**, клипинг длины под wire |
| `DesktopWorkspaceContent.tsx` (+ bridge) | `includeAllVirtualDesktops`, merge payload окон |
| `UltimateDocEditorInner.tsx` (facade) → `hooks/useDocEditorCompanionShellPayload.ts` (via `useUltimateDocEditorInnerChromeCompose`) | Debounce **excerpt** (~2.2s) из HTML; debounce **selection** (~450ms) из `selectedText` |
| `WindowInitialPayload` (`desktop.types.ts`) | `companionSurfaceExcerpt`, `companionSurfaceSelectionPlain`, `companionListingPlain` |
| `sanitizePersistedDesktopWindowPayload.ts` | Перед сохранением снимка стола убирает все `companionSurface*` чтобы не раздувать PG |

Карта полей SPA → wire:

| SPA payload | Shell JSON |
|-------------|------------|
| `companionSurfaceExcerpt` | `surface_excerpt` |
| `companionSurfaceSelectionPlain` | `surface_selection` |
| `companionListingPlain` | `surface_listing` |

### 8.1 Встроенный `document_editor` в output surface (устойчивость, 2026-05-28)

Контур `CompanionDocumentEditorMode` получил отдельные UX-инварианты поверх API-контракта:

1. **Явная семантика Replace:** если выделения нет, `Replace document` заменяет весь markdown, а не делает append.
2. **Безопасный выход:** при несохранённых изменениях кнопка «К чату» подтверждает выход; браузерный `beforeunload` тоже предупреждает.
3. **Recover local draft:** локальный черновик сохраняется per-document scope в `localStorage` и предлагается к восстановлению при повторном открытии.
4. **Optimistic save conflict handling:** при fallback `PUT /api/v1/doc-editor/documents/{id}` с
   `409 document_version_conflict` UI предлагает загрузить серверную версию или принудительно сохранить текущую (`force_save=true`).
5. **Горячие клавиши / control:** `Ctrl/Cmd+S` для save и явная кнопка остановки AI stream.
6. **Server draft lifecycle:** при загрузке редактор читает `GET /api/v1/doc-editor/documents/{id}/draft`, предлагает восстановление
   межсессионного черновика и показывает `Draft vN`; при локальных несохранённых правках автосейвит через
   `PUT /api/v1/doc-editor/documents/{id}/draft` с `expected_draft_version`, а после успешного publish удаляет черновик
   через `DELETE /api/v1/doc-editor/documents/{id}/draft`.
7. **Server draft conflict handling:** при `409 draft_version_conflict` UI не теряет локальные правки, показывает операционную
   подсказку и перебазирует следующий autosave на актуальный `draft_version` после следующего изменения.
8. **Autosync status telemetry:** footer редактора показывает состояние синхронизации server draft (`queued` / `syncing` /
   `retrying` / `failed` / `conflict` / `synced age`), чтобы оператор видел, когда правки только в очереди, когда идёт retry,
   и как давно черновик реально записан на сервер.
9. **Manual sync action:** при несохранённых изменениях footer даёт явную кнопку `Sync draft now` / `Retry draft sync`,
   которая форсирует immediate flush server draft (без debounce), включая кейс после terminal `failed` состояния.
10. **Companion-centric transform contract:** видимый UI embedded-редактора (placeholder, selection hints, action panel, stop/apply)
    больше не маркирует действие как «AI»; streaming transform отправляет запрос как действие спутника (`companion_*`
    persona/style payload + generation tuning из profile), при этом в запросе отсутствует transcript чата, а
    `companion_no_dialogue=true` фиксирует формат «только текст правки».
11. **Split suggestion/editor layout + persona naming:** surface работает как визуальный split 50/50 (`document` + `suggestion`),
    header copy `Editor in response window` скрыт, имя документа показано в строке `Markdown document`, а кнопки/лейблы
    action-блока используют имя текущего persona (`Discuss with {{name}}`, `Ask {{name}}`, `{{name}} suggestion`).
12. **Action rail separation (desktop):** ask/custom/selection actions для embedded `document_editor` на `lg+` рендерятся
    не в колонке предложения, а в правом rail «Текущие операции» (hosted panel above operations list), чтобы suggestion pane
    и action controls не смешивались в одном `aside`; на узкой ширине сохраняется inline fallback в самом surface.
13. **Suggestion apply controls alignment:** кнопки применения результата (`Append below` / `Replace selection|document`) находятся
    в верхней части правой колонки перед suggestion pane. Сам блок предложения остаётся `flex-1`, поэтому его нижняя граница
    визуально ближе к markdown textarea и кнопки не съедают нижнюю высоту панели.
14. **Backend-first document structure:** кнопка `Structure` вызывает `GET /api/v1/content/{content_id}/document-structure`;
    браузер не парсит Markdown, а только показывает готовые секции и применяет серверные `char_start` / `char_end` для
    фокуса/выделения в textarea. При первом открытии документа структура подгружается автоматически (debounced), панель по умолчанию свёрнута.
15. **User-facing copy (2026-06):** без DocEditor/EwaFile/Markdown в основных подписях; policy-block с кнопкой «Править текст»; единый баннер восстановления черновика (server > local) с опциональным сравнением.
16. **Mobile / narrow layout:** колонки `editor → suggestion → actions`; sticky footer Save/Back; action rail на `lg+` (внутри surface — `useMediaQuery`, fallback inline controls).
17. **Draft footer details:** версия/черновик/parse warnings — за ссылкой «Подробнее»; offline-баннер при сбое server-draft sync.
18. **Desktop bridge:** CTA «Открыть на столе» → `requestOpenDocEditorV2WithUnifiedContent`; optional preview toggle; one-shot hint «Обсудить с {{name}}».
19. **Session restore:** при F5 в non-chat surface — info toast «Продолжаем …» (`companionOutputSurfaceRestoreNotice.ts`).

Код:

- `shared/web/frontend/src/features/ewa/companionOutputSurface/CompanionDocumentEditorMode.tsx` — thin facade (stable import)
- `shared/web/frontend/src/features/ewa/companionOutputSurface/companionDocumentEditor/` — implementation (compose + hook + view + action controls + helpers; ≤800 LOC per child)
- `shared/web/frontend/src/features/ewa/companionOutputSurface/CompanionDocumentStructurePanel.tsx`
- `shared/web/frontend/src/features/ewa/companionOutputSurface/companionDocumentSurfaceDraftState.ts`
- `shared/web/frontend/src/features/ewa/companionOutputSurface/useCompanionDocumentServerDraftSync.ts`
- `shared/web/frontend/src/features/ewa/companionOutputSurface/CompanionDocumentSuggestionPane.tsx`
- `shared/web/frontend/src/services/ewa/ewaCompanionDocumentSurfaceApi.ts`

---

### 8.2 Backend-first Document Structure Tool

Контракт структуры документа живёт в `unified_content`, рядом с `document-body`:

- `GET /api/v1/content/{content_id}/document-structure` повторяет тот же permission/storage/projection путь, что и
  `GET /api/v1/content/{content_id}/document-body`.
- Для текстовых/Markdown/HTML документов API строит bounded response: `title`, `source_format`, `version`, `total_lines`,
  `total_chars`, `sections[]`, `truncated`, `max_sections`.
- Каждая секция содержит `id`, `level`, `title`, `slug`, `line_start`, `line_end`, `char_start`, `char_end`, `preview`,
  `word_count`, `children_count`.
- `char_start` / `char_end` считаются как UTF-16 code-unit offsets, чтобы frontend мог напрямую использовать
  `HTMLTextAreaElement.setSelectionRange(...)`.
- Если заголовков нет, backend возвращает одну fallback-секцию `document` на весь текст.
- Markdown-заголовки внутри fenced code blocks не считаются секциями.
- Для unsupported binary без metadata projection API возвращает `415 document_structure_unavailable`.

Frontend-инвариант: `CompanionDocumentStructurePanel` и `ewaCompanionDocumentSurfaceApi.ts` не извлекают headings из текста.
Они только коэрсят payload API, показывают список секций и передают offsets в textarea.

---

## 9. Тесты

| Файл | Что покрывает |
|------|----------------|
| `shared/api/tests/test_ewa_companion_doc_edit_body.py` | Intent edit vs translate, selection из shell, sanitizer HTML |
| `shared/api/tests/test_doc_editor_companion_transform_contract.py` | Companion-centric `POST /api/v1/doc-editor/ai/complete`: no-dialogue directive shaping, persona/style metadata handling, and stream/non-stream prompt contract |
| `shared/api/tests/test_doc_editor_document_structure.py` | Backend parser: nesting, duplicate slugs, no-heading fallback, UTF-16 offsets, bounds; route-level permission-preserving structure response |
| `shared/api/tests/test_ewa_companion_shell_context.py` | Нормализация, промпт с `selection` |
| `shared/web/frontend/src/pages/Desktop/utils/__tests__/buildEwaCompanionShellContext.test.ts` | Маппинг `companionSurfaceSelectionPlain` → `surface_selection` |
| `shared/web/frontend/src/pages/Desktop/utils/__tests__/sanitizePersistedDesktopWindowPayload.test.ts` | Stripping selection с persist |
| `shared/web/frontend/src/services/ewa/__tests__/ewaCompanionDocumentSurfaceApi.test.ts` | Контракты `GET/PUT/DELETE` server draft, `draft_version_conflict`, document structure coercion/fetch, и wire payload companion transform (`companion_*`, tuning, no-dialogue) |
| `shared/web/frontend/src/features/ewa/__tests__/companionDocumentEditorCopy.test.ts` | i18n-regression на hint-copy embedded editor (`placeholder` + `selection` + `noSelection`) без explicit `AI/АИ` |
| `shared/web/frontend/src/features/ewa/companionOutputSurface/__tests__/CompanionDocumentEditorMode.test.tsx` | Hotkey save, force-save conflict retry, restore server draft, queued/retrying sync indicators, manual sync-now, synced-age hint, structure click → backend offsets |
| `shared/web/frontend/src/features/ewa/companionOutputSurface/companionDocumentEditor/__tests__/CompanionDocumentEditorMode.atomization.contract.test.ts` | Facade ≤50 LOC; children ≤800; stable `CompanionOutputSurface` import; no duplicated sibling draft/sync/structure modules |

---

## 10. Ограничения и эксплуатация

1. **Слабый сигнал контекста:** запрос вида только «сократи» без слов про документ, без выделения и без прогретого **`surface_excerpt`**, может **не** активировать серверную правку (защита от ложных срабатываний в чате).
2. **Нет `uc` в listing:** перевод и правка тела **не смогут** привязаться к файлу — проверить, что файл открыт из каталога и строка `uc=` присутствует в `surface_listing`.
3. **Совместное редактирование (live collaboration):** на стороне редактора при активной collab-сессии применение `doc_editor_set_body` может блокироваться или предупреждаться (логика в `UltimateDocEditorInner`).
4. **Язык короткой подмены текста ответа** (`coerce_…`): эвристика по **наличию кириллицы в сообщении пользователя**, не по языку GUI.
5. **Модели и таймауты** companion-chat задаются общими переменными (`EWA_COMPANION_CHAT_*`, см. `chat_turn.py`).

---

## 11. Связанные пути к коду

**API**

- `shared/api/ewa_platform/gateways/routers/companion_chat.py`
- `shared/api/ewa_platform/companion/turn/chat_turn.py`
- `shared/api/ewa_platform/companion/sidecar/shell_context.py`
- `shared/api/ewa_platform/companion/storage/doceditor_translate_body.py`
- `shared/api/ewa_platform/companion/storage/doceditor_edit_body.py`
- `shared/api/ewa_platform/companion/storage/doceditor_content_resolve.py`
- `shared/api/ewa_platform/schemas/pydantic/companion_chat.py`
- `shared/api/services/doc_editor_document_structure.py`
- `shared/api/routers/unified_content.py` (`document-body`, `document-structure`)
- `shared/api/schemas/unified_content.py` (`UnifiedContentDocumentStructure*`)
- `shared/api/ewa_platform/companion/actions/` (общий allowlist действий; `doc_editor_set_body` только с сервера)

**Frontend**

- `shared/web/frontend/src/features/ewa/EwaCompanionChatPanel.tsx`
- `shared/web/frontend/src/pages/Desktop/utils/buildEwaCompanionShellContext.ts`
- `shared/web/frontend/src/pages/Desktop/utils/desktopDeepLink.ts`
- `shared/web/frontend/src/pages/Desktop/hooks/useDesktopWorkspaceGlobalWindowEvents.ts`
- `shared/web/frontend/src/components/UltimateDocEditor/UltimateDocEditorInner.tsx` (facade) + `hooks/useDocEditorCompanionShellPayload.ts` / `hooks/useUltimateDocEditorInnerChromeCompose.ts`
- `shared/web/frontend/src/features/ewa/companionOutputSurface/CompanionDocumentEditorMode.tsx` (facade) + `companionDocumentEditor/`
- `shared/web/frontend/src/features/ewa/companionOutputSurface/CompanionDocumentStructurePanel.tsx`
- `shared/web/frontend/src/services/ewa/ewaCompanionDocumentSurfaceApi.ts`
- `shared/web/frontend/src/services/ewa/ewaCompanionChatApi.ts` (`coerceCompanionActions`)

---

## 12. Плейбук: как добавлять новые «инструменты» для Doc Editor

Опирайтесь на уже сделанные **перевод** (`companion_doceditor_translate_body.py`) и **правку** (`companion_doceditor_edit_body.py`) — это эталон паттерна «серверный инструмент + `shell_context`».

### 12.1 Выберите класс инструмента

| Класс | Пример | Где живёт логика |
|-------|--------|------------------|
| **Жест SPA (низкий риск)** | `open_app` / `focus_app` | Модель может предложить действие в **`<<ACTIONS>>`** / JSON **`actions`**, парсер **`actions.py`**, allowlist **`ALLOWED_ACTION_TYPES`**. |
| **Привилегированное изменение данных** | Замена всего HTML документа (**`doc_editor_set_body`**) | **Только сервер:** после **owner-read** байтов и санитизации; из хвоста модели **никогда** не принимать (см. §5). |

Новый опасный или идентификатор-зависимый сценарий оформляйте как **второй класс** — отдельный `augment_*` и вызов из **`chat_turn.py`** после **`_finalize_companion_actions`** (как translate → edit).

### 12.2 Контракт `shell_context` (без него инструмент «слепой»)

1. Для привязки к файлу нужна строка листинга с **`uc=<unified_content_id>`** (`resolve_doc_editor_unified_id_for_shell`, формат см. §3.3).
2. Для операций «по тексту документа» — **`surface_excerpt`** (прогретый plain с редактора), для «по выделению» — **`surface_selection`** (`doc_editor_surface_selection_from_shell`).
3. Бюджеты и санитизация на wire — **`shell_context.py`**; при новых полях: схема **`ewa_companion_chat.py`**, нормализация, промпт-секция, фронт **`buildEwaCompanionShellContext.ts`** и **не persist** больших blob в **`windows_snapshot`** (sanitizer уже есть для excerpt/selection/listing-паттерна).

### 12.3 Типичный каркас модуля `augment_*`

1. **`…_enabled() -> bool`** — переменная окружения вкл/выкл (как **`EWA_COMPANION_DOC_BODY_EDIT`**).
2. **`…_user_intent_* (user_line: str) -> bool`** — узкая regex/keyword эвристика; **переводческий интент исключить раньше** (`companion_user_intent_translate_replace_editor`), чтобы не конфликтовать с translate.
3. **`augment_companion_<name>_actions(...)`** — async:
   - ранний выход если нет **`content_catalog_user_id`**, **`shell_norm`**, `uc`;
   - **чтение файла только владельцем** (как **`ContentStorageService.read_file_bytes_for_owner`** или существующий helper),
   - отдельный вызов HTTP LLM при необходимости,
   - сборка действия через **`build_doc_editor_set_body_action`** / свой dict с тем же wire-типом, что понимает фронт.
4. **Лимиты:** размер скачанного файла, длина HTML в действии, длина промпта — env-константы + clamp в коде.

### 12.4 Встройка в `chat_turn.py`

1. После **`extract_visible_reply_memory_actions`** и **`_finalize_companion_actions`** вызывать цепочку augment (**сначала translate, потом edit** — или явно документировать другой порядок).
2. Новый augment либо **внутри общей функции-помощника** (аналог **`_augment_translate_and_scrub_visible_reply_for_doc_body`**), либо отдельным шагом **до/**после существующих — без дубля `doc_editor_set_body`.
3. Всегда прогоните **`coerce_companion_chat_reply_when_doc_body_action`** (или расширьте её), если полный текст не должен попадать в **транскрипт companion** в PG.

### 12.5 SSE (stream)

Если новый инструмент может вернуть **большую простыню** в «видимый» ответ до scrub, для **`POST …/stream`** включите режим **`httpx_compat_chat_completion_json`** (non-stream основного ответа) по условию, **аналогично** блоку **`use_nonstream_doc_replace`** в **`iter_companion_chat_stream`** — иначе в чат утекут куски черновика по дельтам.

### 12.6 Фронт при новом типе действия

- Если достаточно **`doc_editor_set_body`** — менять только **`UltimateDocEditorInner`** / обработчик событий (семантика body), контракт в **`ewaCompanionChatApi.coerceCompanionActions`**.
- Если новый **`type`** — расширить **`coerceCompanionActions`**, **`EwaCompanionChatPanel.tsx`**, по образцу в **`desktopDeepLink.ts`** (CustomEvent + глобальный listener для lazy-mount).

### 12.7 Тесты и документация

- Юниты: расшифровать intent (**ру/англ** ключевые фразы), ветку «нет uc», санитизация, конфликт translate vs edit (`test_ewa_companion_doc_edit_body.py` — образец).
- Обновить **этот файл** и при смене wire — **`schemas/ewa_companion_chat.py`** + оглавление **`documentation/INDEX.md`** при новом топ-level документе.

---

## 13. Журнал изменений (кратко)

Детальный лог правок по датам: git log (worklog retired) (блоки про `doc_editor_set_body`, `surface_excerpt`, `surface_listing`, `surface_selection` + edit).

---

## 14. Листинг: ординалы и поиск по каталогу (keyword)

Дополнительно к «открой по имени» / `uc=` в строках листинга:

| Возможность | Модуль | Комментарий |
|-------------|--------|--------------|
| **Порядковый номер строки листинга** (`surface_listing`, только строки с `uc=`). | `api/ewa_platform/companion/companion_shell_listing_ordinals.py` | Фразы с подсказкой «listing/список…», глагол открытия, `EWA_COMPANION_LISTING_ORDINALS` (выкл. `0`). |
| **«Найди файлы …» по имени каталога** + markdown-приложение к ответу + опционально `open_app` **Файловый менеджер** с `content_manager_initial_filter.search_query`. | `api/ewa_platform/companion/companion_catalog_find.py` | `list_content`; `EWA_COMPANION_CATALOG_FIND`; не срабатывает при чистом intent «открыть в редакторе». |
| **«Список файлов» без листинга в shell** (browse): `list_content` без `search_query`, блок **`Catalog (browse):`** (до **200** строк из PG, в сообщении до **120** имён + лимит символов; при `total` > показанных — строка «Total rows…»; ≠ окно CM при фильтрах). | `companion_catalog_find.py` | Факты в **system** (`Server_catalog_snapshot`) до LLM + **один** блок в конце ответа (`chat_turn`: снятие эха модели + merge); промпт запрещает второй выдуманный список и копипаст каталога в prose. |

Общая функция обхода строк: `flat_surface_listing_entries` в `companion_doceditor_content_resolve.py` — тот же порядок, что у `collect_surface_listing_anchors`.

**Дорожная карта семантики (P2):** [EWA-COMPANION-SEMANTIC-SEARCH-P2.md](EWA-COMPANION-SEMANTIC-SEARCH-P2.md).
