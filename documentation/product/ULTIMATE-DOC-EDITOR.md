# Ultimate Document Editor — канон

Один вход по **редактору документов** на рабочем столе EliteEW: архитектура, форматы контента, связь с API и материалами для пользователей и Ассистента (RAG).

**V2:** новый редактор строится отдельным контуром рядом со старым. Канон решений и rollout — [DOCUMENT-EDITOR-V2.md](DOCUMENT-EDITOR-V2.md). Этот файл остаётся baseline текущего `UltimateDocEditor` и fallback-сценариев.

**Код:** `shared/web/frontend/src/components/UltimateDocEditor/` — публичный вход **`UltimateDocEditor.tsx`** (**провайдер** Zustand-контекста + **`UltimateDocEditorInner`**). **`UltimateDocEditorInner.tsx`** — тонкий facade (named export `UltimateDocEditorInner`): compose **`hooks/useUltimateDocEditorInnerCompose.ts`** (stages: **`useUltimateDocEditorInnerBootstrapCompose`**, **`useUltimateDocEditorInnerContentCompose`**, **`useUltimateDocEditorInnerChromeCompose`**) + view **`inner/UltimateDocEditorInnerView.tsx`** (`UltimateDocEditorChromeStack`). Zustand — **`store/editorStore.ts`**. **EditorCore/TiptapEditor.tsx** — стабильный export-path (`TiptapEditor`, `TiptapEditorCore`); тело редактора — **`TiptapEditorInner.tsx`** + модули atomization (gutter hook, runtime dialogs, comment anchors, `createCoreTiptapExtensions`). **EditorCore/EditorToolbar.tsx** — named export `EditorToolbar`; форматные группы — **`EditorToolbar*Group.tsx`** (history, inline, structure, lists, align, insert, accent), popover state — **`useEditorToolbarPopovers.ts`** / compose — **`useEditorToolbarCompose.ts`**, overflow ≤900px — **`EditorToolbarOverflowLayout.tsx`** (`#editor-toolbar-overflow-panel`). **Panels/CommentsReviewPanel.tsx** — named export `CommentsReviewPanel` (lazy facade); реализация — **`Panels/commentsReview/`** (mappers `mapCommentApi.ts`, filters `filterSortCommentThreads.ts`, hooks `useCommentsReviewQueries.ts` / `useCommentsReviewMutations.ts` / `useCommentsReviewSelectionEffects.ts` / `useCommentsReviewHotkeys.ts` / `useCommentsReviewCompose.ts`, UI `CommentsReview*Panel*.tsx`, `CommentsReviewThreadCard.tsx`). **Panels/AIAssistantPanel.tsx** — named export `AIAssistantPanel` (lazy facade for `UltimateDocEditorMainGrid`); реализация — **`Panels/aiAssistant/`** (mappers `aiAssistantErrorMappers.ts`, types `aiAssistantTypes.ts`, hooks `useAIAssistantChat.ts` / `useAIAssistantVoice.ts` / `useAIAssistantInsertPolicy.ts` / `useAIAssistantSuggestions.ts` / `useAIAssistantCompose.ts`, UI `AIAssistantHeader` / `ContextBanners` / `Toolbar` / `ChatRegion` / `SuggestionsList` / `SavedPrompts` / `Composer` / `SavePromptModal`). **Panels/DocumentImportPanel.tsx** — named export `DocumentImportPanel` (lazy facade for `UltimateDocEditorPanelOverlays`); реализация — **`Panels/documentImport/`** (types `documentImportTypes.ts`, mappers `importPayloadMappers.ts` / `detectFileFormat.ts`, hooks `useDocumentImportFormatHelpers.tsx` / `useDocumentImportDropzone.ts` / `useDocumentImportBatch.ts` / `useDocumentImportCompose.ts`, UI `DocumentImportHeader` / `Dropzone` / `FileList` / `Progress` / `Results` / `Actions`). **Panels/VoiceTranscriptionPanel.tsx** — named export `VoiceTranscriptionPanel` (stable facade); реализация — **`Panels/voiceTranscription/`** (hook `useVoiceTranscriptionPanel`, tabs Record/Upload/Synth, voice-core STT/TTS). Слой **chrome/** (layout, модалки, **`UltimateDocEditorChromeStack`**) и **hooks/** — living tree under `shared/web/frontend/src/components/UltimateDocEditor/` (wave modularity notes soft-retired → `trash/…/documentation archive tree2026-05-24-doc-reality-audit/product/ULTIMATE-DOC-EDITOR-WAVE*.md`; not living canon). API Doc Editor — `shared/api/routers/doc_editor.py`, совместное присутствие и курсоры — `shared/api/routers/socketio_handler.py` (события `join_document`, `leave_document`, `cursor_move`, `kick_document_user`, `doc_editor_session_ended` и др.). Карта модулей collab/TipTap — **[DOC-EDITOR-COLLABORATION.md](DOC-EDITOR-COLLABORATION.md)** §3.2.

---

## 1. Назначение

- Редактирование **документов** пользователя: HTML в TipTap, экспорт в PDF/Markdown и др., история версий (если включено), импорт файлов.
- Встраивание в **desktop shell** (`#desktop-main`): темы `--desktop-*`, см. **[ULTIMATE-DOC-EDITOR-DESKTOP-THEMING.md](ULTIMATE-DOC-EDITOR-DESKTOP-THEMING.md)**.
- **Совместное редактирование** (Yjs + WebSocket) и **Socket.IO** для присутствия — подробно: **[DOC-EDITOR-COLLABORATION.md](DOC-EDITOR-COLLABORATION.md)**.

---

## 2. Форматы и загрузка контента

### 2.1 Типы (`UltimateDocument.content_type`)

| Значение   | Смысл |
|------------|--------|
| `html`     | Основной режим: в хранилище — HTML-строка для TipTap. |
| `markdown` | В API хранится **исходный Markdown**; при открытии в редакторе конвертируется в HTML. |
| `text`     | Плоский текст → абзацы и `<br />` через `convertPlainTextToHtml`. |
| `docx`     | Как правило после импорта — HTML в контенте. |

### 2.4 Stack4 document gateway (2026-06)

Единая точка HTTP к **stack4** (без отдельного LibreOffice-контейнера — LO внутри Gotenberg):

| Путь | Stack4 | Назначение |
|------|--------|------------|
| `shared/api/services/stack4/document_gateway.py` | Tika, Gotenberg, OCRmyPDF, Tesseract | parse / export / OCR |
| `POST /api/v1/doc-editor/convert/upload` | через `DocConverterService` | preview office в Unified Content |
| `DocEditorService.export_document` | Gotenberg Chromium + LO | PDF/DOCX export из редактора |

**Preview (Unified Content / `UniversalViewer`):** `.docx/.doc/.odt/.rtf` → Tika HTML; `.xlsx/.xls/.pptx` → Gotenberg LO → PDF (base64) → iframe.

**OCR scan-PDF:** OCRmyPDF `/ocr` → searchable PDF → Tika plain text (исправлены старые вызовы `/process` и неверный JSON-контракт).

См. также compose: `docker/stack/stack4.yml`.

### 2.2 Нормализация при открытии

- **`normalizeContentToHtml`** (внутренний хелпер): если строка **похожа на HTML** (есть теги), внутри текстовых узлов переводы строк заменяются на `<br />`; иначе текст обрабатывается как **плоский** (абзацы по `\n\n`, одиночные `\n` → `<br />` внутри абзаца).
- **`normalizeDocumentContentForEditor`** (загрузка из API в редактор); реализация — **`shared/web/frontend/src/components/UltimateDocEditor/utils/ultimateDocEditorBootstrap.ts`**:
  - **`markdown`** → парсинг через **`marked`** (GFM, `breaks`), модуль **`utils/markdownToHtml.ts`** (`markdownToEditorHtml`, эвристики «сжатой» одной строки при необходимости).
  - **`text`** → `convertPlainTextToHtml`.
  - **HTML** → если документ сведён к **одному `<p>...</p>`** и по тексту похож на Markdown, выполняется **восстановление структуры** (`repairHtmlIfSingleParagraphMarkdown`), иначе прежняя логика с `normalizeNewlinesInHtml`.

Так исправляется типичный случай: визуально текст переносится по ширине, но в модели документа **один блок** и одна «логическая» строка; экспорт в MD склеивает всё в одну строку. После правок структура (заголовки, списки) соответствует ожидаемой разметке.

### 2.3 Режим «Исходник Markdown»

- Конвертация HTML → Markdown: **`utils/htmlToMarkdown.ts`** (Turndown).
- Переключение Markdown ↔ визуальный редактор, предпочтение в `localStorage`, ограничения при совместной сессии — **[ULTIMATE-DOC-EDITOR-DESKTOP-THEMING.md](ULTIMATE-DOC-EDITOR-DESKTOP-THEMING.md)** (блок про Markdown 2026-04).

---

## 3. Совместная работа (кратко)

- Подключение только по кнопке **«Подключиться»**; панель коллаба не рвёт сессию при закрытии.
- Список участников: отображаемое имя без email; свой курсор синхронизируется на клиенте; приглашения друзьям — после подключения к сессии.
- Владелец документа (по `owner_user_id` при `join_document`): завершение сессии при выходе владельца, отключение участника (kick).
- Детали протокола, Yjs, приглашения REST — **[DOC-EDITOR-COLLABORATION.md](DOC-EDITOR-COLLABORATION.md)**.

---

## 4. Связанные документы

| Документ | Тема |
|----------|------|
| [DOCUMENT-EDITOR-V2.md](DOCUMENT-EDITOR-V2.md) | Новый редактор рядом со старым: единый write-path, collaboration, EWA partner, форматы и rollout |
| [ULTIMATE-DOC-EDITOR-DESKTOP-THEMING.md](ULTIMATE-DOC-EDITOR-DESKTOP-THEMING.md) | Темы, панели, вставки, мульти-вкладки, unified content |
| Wave 2–6 modularity notes (historical) | Soft-retired → `trash/…/documentation archive tree2026-05-24-doc-reality-audit/product/ULTIMATE-DOC-EDITOR-WAVE{2..6}-MODULARITY.md` — **not** living canon; do not recreate the documentation archive tree (forbidden as living canon) |
| [ULTIMATE-DOC-EDITOR-FILE-MANAGER.md](ULTIMATE-DOC-EDITOR-FILE-MANAGER.md) | Менеджер файлов, поиск, виртуализация |
| [ULTIMATE-DOC-EDITOR-OPS-RUNBOOK.md](ULTIMATE-DOC-EDITOR-OPS-RUNBOOK.md) | Ops triage / rollback |
| [ULTIMATE-DOC-EDITOR-E2E-CI.md](ULTIMATE-DOC-EDITOR-E2E-CI.md) | Wave E Playwright smoke, env, CI scope (honest gaps) |
| [ULTIMATE-DOC-EDITOR-CANARY-ROLLBACK-CHECKLIST.md](ULTIMATE-DOC-EDITOR-CANARY-ROLLBACK-CHECKLIST.md) | Staged rollout / rollback |
| [FRONTEND-VIRTUAL-LIST-AND-PERF-PATTERNS.md](FRONTEND-VIRTUAL-LIST-AND-PERF-PATTERNS.md) | Списки и perf |
| [DOC-EDITOR-COLLABORATION.md](DOC-EDITOR-COLLABORATION.md) | Коллаб, сокеты, Yjs |
| [ULTIMATE-DOC-EDITOR-COLLAB-YJS-PERSISTENCE.md](ULTIMATE-DOC-EDITOR-COLLAB-YJS-PERSISTENCE.md) | Персистентность Yjs / политика save (дизайн) |
| [SPRAVOCHNIK-AI.md](SPRAVOCHNIK-AI.md) | Продукт «Ассистент» и KB |
| [handbook-kb-articles/kb-doc-editor.md](handbook-kb-articles/kb-doc-editor.md) | Текст для RAG (обзор) |
| [handbook-kb-articles/kb-doc-editor-struktura-format-i-sovmestnaya-rabota.md](handbook-kb-articles/kb-doc-editor-struktura-format-i-sovmestnaya-rabota.md) | Формат, структура, совместная работа (пользователи) |

---

## 5. Пользователи и Ассистент (RAG)

Короткие инструкции без стека: **`handbook-user-docs/`** (при наличии темы). Развёрнутые статьи для индекса ассистента: **`handbook-kb-articles/kb-doc-editor*.md`**. После правок интерфейса — обновить статью и **переиндексировать** в админке Ассистента (см. **[PRODUCT-ASSISTANT-HANDBOOK.md](PRODUCT-ASSISTANT-HANDBOOK.md)**).

---

## 6. Baseline поведения (регрессия и ручная проверка)

Этот раздел фиксирует **ожидаемое** поведение редактора до и после доработок. Не дублирует UX-гайд; нужен разработчикам и операторам для smoke/regression.

### 6.1 Карта сценариев (runtime)

| Сценарий | Точки входа / проверка |
|----------|-------------------------|
| Открытие с рабочего стола | Окно приложения с `documentId` / мульти-вкладки `docEditorTabs` / `activeDocEditorTab`; синхронизация payload (`onPayloadChange`). |
| Открытие из Файловый менеджер | Unified Content (`unifiedContentId`, `documentSource`), путь сохранения через **`/api/v1/content/.../replace-file`**, не PUT doc-editor. |
| Создание нового документа | Режим create / пустой документ; после записи в БД — стабильный `id`, версия, история через триггер. |
| Импорт файла | Панель импорта → Tika/конвертация; контент в TipTap, тип `content_type` согласован с каналом сохранения. |
| File Manager: список / поиск / выбор | **`GET /api/v1/doc-editor/documents`** (пагинация, поиск); для лёгкого списка — **`list_profile=compact`** (без тяжёлого HTML в строках). |
| Каноническое сохранение | **`PUT /api/v1/doc-editor/documents/{id}`** с `expected_version` при версионном lock (autosave); кнопка **«Сохранить»** в solo-режиме — `force_save` (явное действие пользователя). При конфликте **409** `document_version_conflict` — модальное разрешение (сервер / моя версия). |
| Автосохранение | Debounce ~3s + fallback ~30s; в коллабе без `expected_version` (см. комментарии в orchestrator). Эквивалентная HTML-сериализация без смыслового изменения документа не должна повторно помечать редактор как dirty и плодить новые версии. |
| Черновики | Локальный `localStorage` + серверный draft (`doc_editor_document_drafts`) для канонических документов; debounce ~4.5s **после** autosave. При **409** `draft_version_conflict` клиент rebases `expected_draft_version` или отбрасывает stale PUT после canonical save + DELETE draft (generation token в `useDocEditorDraftPersistence`). In-flight server PUT отменяется через `AbortSignal` при смене документа, canonical save (clean) и unmount — без ложных warn и без записи версии в другой документ. Локальный конфликт — по `storage`. |
| Коллаборация | Ручное «Подключиться»; Yjs WebSocket + Socket.IO presence; смена вкладки / документа — выход из сессии; владелец — kick / завершение. |
| Markdown-режим | HTML ↔ MD (Turndown / marked), предпочтение в `localStorage`; в коллабе ограничения по UX — см. теминг. |
| Комментарии / review | **`/documents/{id}/comments`**; capabilities с API должны ограничивать UI (не только роль `user.role`). |
| Закрытие окна / leave guard | `beforeunload` / крестик окна desktop — не терять несохранённое без подтверждения (см. `resolveDocEditorLeaveGuardDecision`). |

### 6.2 Автоматические проверки (фронт)

Из каталога **`shared/web/frontend`**:

| Команда | Назначение |
|---------|------------|
| `pnpm run build:react-compiler` | Сборка с React Compiler (обязательный gate перед релизом редактора). |
| `pnpm run typecheck` | TypeScript. |
| `pnpm run test` | Vitest; для редактора есть точечные тесты в **`src/components/UltimateDocEditor/**/*.test.ts`**. |
| `pnpm run test:e2e` | Playwright (полный каталог); для редактора — **`e2e/content-manager-doceditor.spec.ts`** только при **`CM_DOC_E2E_RUN=1`** и **`MC_E2E_BASE_URL`**. Канон CI/smoke/fixtures: **`ULTIMATE-DOC-EDITOR-E2E-CI.md`**. |
| `pnpm run check:release` | Полный gate (`check:local` + i18n + bundle); на ветке может быть красным из-за накопленных ошибок вне редактора — смотреть отчёт `tsc`. |

### 6.3 Ручной чеклист (smoke)

1. **Большой документ** (~2–5k слов): прокрутка, gutter, комментарии, без зависаний при наборе.
2. **Две вкладки** (doc editor UUID): переключение, грязное состояние не смешивается.
3. **Unified Content**: открытие, правка, сохранение, повторное открытие — тот же файл.
4. **Коллаб**: два браузера/профиля — синхрон текста, список участников, отключение при смене документа.
5. **Потеря сети**: обрыв WS — осмысленный статус, после восстановления можно переподключиться.
6. **Конфликт версий**: два клиента с одним документом — 409, модальное разрешение (сервер / моя версия), данные не теряются.
7. **Reload / закрытие с несохранённым**: диалог подтверждения, опционально сохранить.
8. **Markdown**: переключение источник ↔ визуально, экспорт MD.
9. **Вставки**: chart/diagram, AI image, table, template apply (`replace` / `insert` / `append`) — без битых placeholder и без `script`/inline handlers после save+reload.

Хронология: `git log` + chat; monthly `worklog/` retired → `trash/`. Staged rollout: [ULTIMATE-DOC-EDITOR-CANARY-ROLLBACK-CHECKLIST.md](ULTIMATE-DOC-EDITOR-CANARY-ROLLBACK-CHECKLIST.md).
