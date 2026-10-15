# Document Editor V2 — master plan

**Статус:** living foundation (backend + desktop shell + OpenAPI pilot) · обновлён 2026-07-18.
**Scope:** новый редактор документов EliteEW рядом с `UltimateDocEditor`. Старый редактор остаётся fallback; см. [ULTIMATE-DOC-EDITOR.md](ULTIMATE-DOC-EDITOR.md).

Этот документ фиксирует архитектурные решения для нового редактора документов: единый write-path, совместная работа, EWA как партнёр в документе, импорт/экспорт форматов и безопасный rollout. Детали текущего редактора остаются в [ULTIMATE-DOC-EDITOR.md](ULTIMATE-DOC-EDITOR.md).

---

## 0. Implementation status

| Wave | Status | Результат |
|------|--------|-----------|
| Foundation canon | Done, 2026-06-05 | Этот документ + навигация по `documentation/`. |
| Backend contract foundation | Done, 2026-06-05 | `GET /health`, `GET /capabilities`, `POST/GET/PUT /documents` под `/api/v1/doc-editor-v2`; storage только `unified_content`; старые документы не мутируются. |
| V2 contract expansion | Done, 2026-06-05 | Draft lifecycle, import/export MVP, structure, collaboration state/snapshot, EWA suggestion/apply endpoints; suggestion apply keeps 409 conflict payloads. |
| Frontend shell foundation | Done, 2026-06-05 | Отдельный desktop component id `DocEditorV2`, без замены legacy `DocEditor`; explicit fallback to old editor when a legacy target exists. |
| Editor core + rollout MVP | Done, 2026-06-05 | TipTap/ProseMirror canvas, create/save/draft/conflict state, import file, Markdown export, EWA suggestion/apply, collaboration participant rail, V2 telemetry and new-document deep-link helper. |
| Visible desktop app catalog | Done, 2026-06-06 | `app-doc-editor-v2` добавлен в frontend launcher, backend allowlists, assistant/EWA open-app allowlists and `desktop_app_catalog` migration `20260606_01`. |
| RU/EN i18n + compact header | Done, 2026-06-06 | Добавлен namespace `docEditorV2`, RU/EN локали, русское имя каталога `Редактор документов V2`; высокий product header заменён на компактную панель статусов/действий. |
| Файловый менеджер open-in V2 | Done, 2026-06-06 | Для документных файлов Файловый менеджер добавлен отдельный пункт `В редакторе документов V2`, который открывает `DocEditorV2` по `unifiedContentId`; legacy `В редакторе документов` оставлен на старом `DocEditor`. |
| OpenAPI pilot | Done, 2026-07-14 | `openapi/pilot/doc-editor-v2.openapi.json` + `src/generated/doc-editor-v2-openapi.ts`; `documentEditorV2Api.ts` aliases DTO from generated schemas; Vitest `documentEditorV2Api.contract.test.ts`. |
| FE type unlock (wave E) | Done, 2026-07-28 | Optional structure/participants coalesce to `[]`; EWA suggestion apply sends required `force_save`; DesktopAppButton `accent` (not legacy `primary`). |

Текущие реализации foundation:

- Backend: `shared/api/routers/doc_editor_v2.py`, `shared/api/services/doc_editor_v2/`, `shared/api/schemas/doc_editor_v2.py`.
- Frontend: `shared/web/frontend/src/features/documentEditorV2/`, `shared/web/frontend/src/services/documentEditorV2Api.ts`, visible desktop app registration for `DocEditorV2`, i18n namespace `docEditorV2`.
- Catalog: `shared/api/migrations/applied/20260606_01_desktop_app_catalog_doc_editor_v2.sql` seeds `app-doc-editor-v2` (`DocEditorV2`) as a factory app in `desktop_app_catalog`.
- Tests: `shared/api/tests/test_doc_editor_v2_contract.py`, `shared/web/frontend/src/features/documentEditorV2/__tests__/DocEditorV2Shell.test.tsx`, `shared/web/frontend/src/features/documentEditorV2/__tests__/docEditorV2State.test.ts`, `shared/web/frontend/src/pages/Desktop/utils/__tests__/desktopDocEditorV2Registry.test.ts`.

---

## 1. Почему v2 отдельный

Текущий `UltimateDocEditor` накопил несколько перекрывающихся контуров:

- desktop TipTap-редактор: `shared/web/frontend/src/components/UltimateDocEditor/`;
- большой backend router: `shared/api/routers/doc_editor.py`;
- `unified_content` как фактическая база документов;
- legacy `/unified-editor` и `/elite-editor` с отдельными историческими путями;
- EWA embedded markdown surface: `CompanionDocumentEditorMode`, не тот же TipTap UI;
- Yjs/Socket.IO collaboration с process-local room state и Redis replay.

Главный риск — продолжать чинить всё внутри старого контура. V2 должен получить чистую модель документа и совместимости, а старый редактор должен остаться fallback до миграции.

---

## 2. Product goals

V2 должен быть редактором, в котором пользователь может:

1. Создавать и редактировать документы без гонок сохранения и смешения вкладок.
2. Работать вместе с другими пользователями в одном документе.
3. Работать с EWA как с партнёром: обсуждать, просить правки, получать предложения, применять их явно.
4. Открывать основные форматы: Markdown, HTML, TXT, DOCX/DOC, ODT/RTF, PDF.
5. Экспортировать в PDF, DOCX, HTML, Markdown, TXT.
6. Безопасно возвращаться к старому редактору, если документ или сценарий ещё не поддержан v2.

---

## 3. Non-goals на старте

- Не переписывать старый `UltimateDocEditor` в месте.
- Не использовать legacy `documents` table и `/api/v1/unified-editor/*` как основу v2.
- Не обещать полноценное редактирование исходного PDF. PDF на старте: preview, OCR, extract-to-editable-document, export.
- Не делать EWA “автозаменителем” тела документа без явного apply/approve.
- Не запускать 20 coding-субагентов в один и тот же код одновременно. Разрешены волны по независимым work packages.

---

## 4. Rollout policy

| Сценарий | Поведение |
|----------|-----------|
| Новый документ | Можно открыть через desktop app `Редактор документов V2`; explicit helper `requestOpenNewDocEditorV2()` также открывает v2. |
| Старый документ | Открывается в старом `UltimateDocEditor` по умолчанию. |
| Совместимый старый документ | Можно открыть в v2 вручную через preview/flag. |
| Ошибка v2 | Пользователь видит fallback “Открыть в старом редакторе”. |
| Миграция | Только после hardening, отчёта совместимости и rollback-плана. |

Feature flag / routing decision должны жить в desktop shell и API capabilities, а не в случайных `if` внутри editor core.

### 4.1 Как открыть V2

1. Открой EliteEW Desktop.
2. В списке приложений / App Store найди **Редактор документов V2** (`app-doc-editor-v2`).
3. Запусти приложение — оно открывает новый v2-документ; старый **Doc Editor** продолжает открывать legacy `UltimateDocEditor`.
4. Если приложение не видно сразу после deploy, обнови страницу Desktop или открой App Store: backend auto-installs factory apps через `/api/v1/desktop/installed` / catalog read.

### 4.2 Как открыть файл из Файловый менеджер в V2

1. Открой **Файловый менеджер**.
2. Найди документный файл (`document`, `text`, `pdf`, `spreadsheet`, `presentation`, `code`, `ai_result`).
3. Открой меню файла через кнопку `...` или правый клик.
4. Выбери **В редакторе документов V2**. Пункт **В редакторе документов** остаётся старым редактором и нужен как fallback.
5. V2 получает файл через `unifiedContentId`, поэтому открытие не меняет сам файл в Файловый менеджер до явного сохранения в редакторе.

---

## 5. Canonical write-path

V2 обязан иметь один канонический write-path для документов.

**Решение:** v2 пишет только в `unified_content` через v2 document service/adapter. Старые `/doc-editor` endpoints могут использоваться только как compatibility adapter на переходный период, но не как второй равноправный источник истины.

### 5.1 Документная модель

| Поле | Назначение |
|------|------------|
| `document_id` | UUID `unified_content.id`. |
| `owner_user_id` | Владелец документа. |
| `editor_format` | Канонический формат editor-source. Предпочтительно ProseMirror JSON. |
| `editor_json` | Структурная модель редактора. |
| `content_html` | Rendered HTML projection для preview/export/compat. |
| `content_markdown` | Markdown projection для EWA, export, text tools. |
| `plain_text` | Текст для поиска, структуры, EWA context и word count. |
| `source_format` | Исходный формат импорта: `markdown`, `html`, `text`, `docx`, `doc`, `odt`, `rtf`, `pdf`, etc. |
| `parse_warnings` | Список предупреждений импорта/конвертации. |
| `version` | Оптимистичная версия canonical save. |
| `capabilities` | `can_read`, `can_edit`, `can_comment`, `can_collaborate`, `can_apply_ewa`, `can_export`. |

### 5.2 Инварианты записи

- Все save/publish пути обновляют projections вместе: editor JSON, HTML, Markdown, plain text.
- `extracted_text` / search projection не расходится с видимым документом.
- Версионный конфликт возвращает серверную версию и понятный conflict reason.
- `force_save` допустим только после явного действия пользователя.
- Любой v2 API response возвращает capabilities; UI не выводит права из `user.role`.
- Панель комментариев Ultimate Doc Editor (`Panels/CommentsReviewPanel.tsx` → `Panels/commentsReview/`): при отсутствии/`null` server `capabilities` (ещё не загружены или ошибка списка) все write/resolve/assign действия **deny-by-default** — не выводить права из prop `permissionRole`. Helper: `resolveCommentPanelCapabilities`; загрузка capabilities — `useCommentsReviewQueries`. Dual thread state: panel `threads` → `onThreadsChange` → session → TipTap anchors (`useCommentsReviewSelectionEffects`). Review-tab status — client-local до API persistence (out of scope).

---

## 6. Backend target

Новый backend-контур:

- `shared/api/routers/doc_editor_v2.py` — тонкий HTTP router.
- `shared/api/services/doc_editor_v2/` — сервисы домена.
- `shared/api/schemas/doc_editor_v2.py` — Pydantic v2 DTO.
- `shared/api/tests/test_doc_editor_v2_*.py` — контракты, ACL, сохранение, импорт, EWA actions.

### 6.1 Первые endpoints

| Метод | Путь | Назначение |
|-------|------|------------|
| `GET` | `/api/v1/doc-editor-v2/health` | **Done:** health + storage policy. |
| `GET` | `/api/v1/doc-editor-v2/capabilities` | **Done:** feature surface для staged rollout. |
| `POST` | `/api/v1/doc-editor-v2/documents` | **Done:** создать новый v2-документ. |
| `GET` | `/api/v1/doc-editor-v2/documents/{id}` | **Done:** открыть документ + projections + capabilities. |
| `PUT` | `/api/v1/doc-editor-v2/documents/{id}` | **Done:** canonical save с `expected_version` для v2-owned rows. |
| `GET/PUT/DELETE` | `/api/v1/doc-editor-v2/documents/{id}/draft` | **Done:** серверный черновик в `metadata.doc_editor_v2.draft`, без canonical body mutation. |
| `POST` | `/api/v1/doc-editor-v2/import` | **Done MVP:** text-like import locally; Office/PDF create editable representation with fidelity warnings until Stack4 full adapter. |
| `POST` | `/api/v1/doc-editor-v2/documents/{id}/export` | **Done MVP:** HTML/Markdown/TXT projections; PDF/DOCX return adapter-pending warnings. |
| `GET` | `/api/v1/doc-editor-v2/documents/{id}/structure` | **Done:** backend-first outline/summary for UI and EWA context. |
| `GET` | `/api/v1/doc-editor-v2/documents/{id}/collaboration` | **Done MVP:** room metadata, participants and snapshot state. |
| `PUT` | `/api/v1/doc-editor-v2/documents/{id}/collaboration/snapshot` | **Done MVP:** compact snapshot persisted in v2 metadata. |
| `POST` | `/api/v1/doc-editor-v2/documents/{id}/ewa/suggest` | **Done MVP:** EWA suggestion/context packet, без прямой записи. |
| `POST` | `/api/v1/doc-editor-v2/documents/{id}/suggestions/{sid}/apply` | **Done MVP:** явное применение предложения через canonical save + audit metadata. |

### 6.2 OpenAPI

Для v2 нужен отдельный OpenAPI pilot:

- `shared/web/frontend/openapi/pilot/doc-editor-v2.openapi.json`;
- `shared/web/frontend/src/generated/doc-editor-v2-openapi.ts`;
- строки в `documentation/api/FRONTEND-BACKEND-HTTP.md`;
- frontend service layer imports generated types, UI не дублирует DTO вручную.

---

## 7. Frontend target

Новый frontend-контур:

- `shared/web/frontend/src/features/documentEditorV2/` — **создан shell + TipTap core MVP**;
- отдельный desktop app component `DocEditorV2` — **видимое приложение** `Редактор документов V2` в desktop catalog / App Store после миграции `20260606_01`;
- старый `DocEditor` остаётся на `UltimateDocEditor` и остаётся default;
- new-document helper `requestOpenNewDocEditorV2()` открывает `DocEditorV2`; Файловый менеджер uses `requestOpenDocEditorV2WithUnifiedContent()` for the explicit V2 menu action, while legacy helpers keep opening `DocEditor`;
- shared API client через `src/services/api/client.ts`, без отдельного axios/fetch.

### 7.1 UI layout

| Зона | Назначение |
|------|------------|
| Header | Компактная строка: название, save status, version, collaborators, fallback to old editor. |
| Left rail | Outline, document files, import warnings. |
| Center | Editor canvas. |
| Right rail | EWA partner, suggestions, comments, review queue. |
| Footer/status | Draft sync, offline/reconnect, word count, parse warnings. |

### 7.2 State model

Frontend state должен быть локально изолирован per editor window. Нельзя возвращаться к глобальному editor store на все окна.

Обязательные state slices:

- `documentSession`;
- `editorDocument`;
- `draftAndSave`;
- `collaboration`;
- `ewaPartner`;
- `commentsAndSuggestions`;
- `importExport`;
- `uiPanels`.

---

## 8. Collaboration model

V2 рассматривает collaboration как базовую часть документа, а не панельный add-on.

### 8.1 Контур

| Слой | Решение |
|------|---------|
| Текстовые изменения | Yjs document updates. |
| Presence | Awareness / Socket.IO presence. |
| Durability | Redis update log + periodic compact snapshot. |
| Cold start | Snapshot → replay bounded updates. |
| Canonical save | Merge/export editor state → v2 save. |
| Multi-instance | Требуется sticky session или Redis pub/sub/broadcast до production rollout collab. |

### 8.2 Permissions

Единая модель capabilities должна покрывать:

- owner;
- collaborator via invite;
- shared user via `content_shares`;
- viewer;
- comment-only/review-only в будущем.

`content_shares.edit` и doc collaboration save rights не должны расходиться в UI и API.

### 8.3 Save policy

| Участник | Live edit | Canonical save |
|----------|-----------|----------------|
| Owner | Да | Auto idle + explicit save. |
| Collaborator with save | Да | Explicit commit или owner-approved policy. |
| Collaborator without save | Да/предложения | Suggestion only, no canonical write. |
| Viewer | Нет | Нет. |

---

## 9. EWA as document partner

EWA в v2 — не “AI button”, а партнёр в документе.

### 9.1 Context packet

На запрос к EWA отправляется bounded context:

- `document_id`, title, version;
- capabilities;
- outline/structure;
- selected range;
- nearby excerpt;
- optional whole-document summary;
- user instruction;
- active collaborators summary;
- source format and parse warnings.

Большие документы не отправляются целиком в prompt без chunking/retrieval.

### 9.2 EWA actions

| Action | Поведение |
|--------|-----------|
| `discuss` | Ответ по документу без изменения. |
| `rewrite_selection` | Предложение patch для выделения. |
| `summarize_section` | Summary блока/раздела. |
| `translate_selection` | Перевод выделения/раздела. |
| `make_outline` | Предложение структуры. |
| `create_comment` | Комментарий/review note. |
| `apply_patch` | Только после явного user approve. |

### 9.3 Safety invariants

- EWA suggestion не мутирует документ до apply.
- Pre-insert/pre-apply guard обязателен.
- Для collab active session применяются правила merge/conflict; нельзя молча заменить тело.
- Audit trail фиксирует: кто запросил, что предложено, кто применил, к какой версии.

---

## 10. Formats

| Формат | Open | Edit | Export | Notes |
|--------|------|------|--------|-------|
| `.md`, `.markdown` | Да | Да | Да | First-class. |
| `.html`, `.htm` | Да | Да | Да | Sanitized. |
| `.txt` | Да | Да | Да | Plain text projection. |
| `.docx` | Да | Да | Да | Import через Stack4/Tika/Gotenberg, fidelity warnings. |
| `.doc` | Да | Да | В `.docx`/PDF | Legacy fidelity warnings. |
| `.odt`, `.rtf` | Да | Да | DOCX/PDF/HTML | Stack4. |
| `.pdf` | Preview/OCR/extract | Как imported editable copy | PDF/TXT/MD | Не редактирование исходного PDF. |
| `.xlsx`, `.pptx` | Preview/extract | Не first-class на старте | PDF/TXT | Не документный rich edit на старте. |

Stack4 gateway: `shared/api/services/stack4/document_gateway.py`.

---

## 11. Work packages for subagents

Не запускать все пакеты в один рабочий каталог одновременно. Безопасная волна — 4–6 параллельных потоков с явным integration owner.

| Package | Scope | Can run parallel |
|---------|-------|------------------|
| `docs-adr` | Этот канон, API/OpenAPI plan, acceptance matrix | Да |
| `backend-contract` | schemas/router/service skeleton/tests | Да, отдельно от frontend |
| `frontend-shell` | `features/documentEditorV2`, app shell, desktop registration behind flag | Да |
| `editor-core` | TipTap/ProseMirror core, document state, projections client tests | После или рядом с shell |
| `collab-core` | Yjs lifecycle, snapshot/replay contract, permission matrix | Да, но API contracts согласовать |
| `ewa-partner` | context packet, suggestions, guarded apply | Да, после API shape |
| `formats-pipeline` | import/export via Stack4, fixtures, warnings | Да |
| `rollout-telemetry` | new-doc routing, fallback, telemetry, smoke | После shell/backend |

Для 20 субагентов допустимы только research/best-of-N worktrees. Для merge-ready реализации — волны.

---

## 12. Acceptance matrix

### 12.1 Automated

| Gate | Что проверяет |
|------|---------------|
| Ruff | Backend v2 files. |
| API tests | create/open/save/conflict/draft/import/export/ACL/EWA suggestion. |
| OpenAPI pilot | v2 generated types без ручных DTO. |
| Biome | Frontend v2 source. |
| Vitest | editor state, projections, conflict UI, EWA suggestion apply. |
| React Compiler build | Production frontend compatibility. |

### 12.2 Manual smoke

1. Создать новый v2-документ, сохранить, закрыть, открыть снова.
2. Импортировать `.md`, `.docx`, `.pdf`; увидеть warnings там, где fidelity неполная.
3. Открыть документ двумя пользователями; проверить presence, edit sync, reconnect.
4. Попросить EWA переписать выделение; увидеть suggestion; применить; сохранить.
5. Получить version conflict; выбрать серверную или свою версию без потери текста.
6. Нажать fallback и открыть документ в старом редакторе.

---

## 13. First implementation order

1. Backend v2 DTO + router skeleton + tests.
2. Frontend v2 shell behind flag, без регистрации как default.
3. New document routing: create-new → v2, legacy open → old.
4. Editor core save/open/reopen.
5. Import/export MVP.
6. Collaboration MVP.
7. EWA partner MVP.
8. Hardening, telemetry, migration report.

---

## 14. Related documents

- [ULTIMATE-DOC-EDITOR.md](ULTIMATE-DOC-EDITOR.md) — текущий редактор.
- [DOC-EDITOR-COLLABORATION.md](DOC-EDITOR-COLLABORATION.md) — текущая collaboration история и инциденты.
- [ULTIMATE-DOC-EDITOR-COLLAB-YJS-PERSISTENCE.md](ULTIMATE-DOC-EDITOR-COLLAB-YJS-PERSISTENCE.md) — Redis replay/save policy.
- [CONTENT-MANAGER.md](CONTENT-MANAGER.md) — `unified_content` и document body projections.
- [ewa/EWA-COMPANION-DOC-EDITOR-AND-SHELL-CONTEXT.md](ewa/EWA-COMPANION-DOC-EDITOR-AND-SHELL-CONTEXT.md) — EWA ↔ document editor.
- [../api/FRONTEND-BACKEND-HTTP.md](../api/FRONTEND-BACKEND-HTTP.md) — OpenAPI pilots.
