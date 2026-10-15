# Ultimate Document Editor и темы рабочего стола

**Канон по редактору (архитектура, форматы, ссылки):** [ULTIMATE-DOC-EDITOR.md](ULTIMATE-DOC-EDITOR.md).

Редактор встроен в desktop shell (`#desktop-main`). Стили панелей рельса и модалок должны опираться на **CSS-переменные `--desktop-*`** и при необходимости на `rgb(var(--desktop-accent-rgb))`, а не на «голые» Tailwind-палитры (`blue-500`, `slate-900`, …) или фиксированные hex в пользовательском UI.

**Body portals (обязательно):** любой UI редактора с `position: fixed` / меню на `document.body` обязан монтироваться через **`ShellPortalMount` / `useShellPortal`** (theme: `getDesktopPortalShellProps()` на обёртке, как у `EditorContextMenu` / `FileManagerDocContextMenu`). Голый `createPortal(..., document.body)` без shell CSS vars даёт «прозрачные» панели — токены `--desktop-*` живут на `#desktop-main`, не на `body`. Канонические места: экспорт в `UltimateDocEditorDocumentHeader`, popover/overflow в `EditorToolbar`, `ColorPicker`. Deprecated `DesktopShellFloatingPortal` не использовать.

**Sticky header meta (2026-08-05):** подписи статуса / вида / метрик / кластеров «Файл»·«Совместно» и метка коллаб-сессии — **sentence-case** через `DOC_EDITOR_HEADER_META_LABEL_CLASS` (`DESKTOP_TYPOGRAPHY.shellMeta10` + `tracking-normal`). Запрещён CSS `uppercase` shout в `HeaderMetricBadge` и section labels `UltimateDocEditorDocumentHeader`. Lock: `UltimateDocEditor/__tests__/HeaderMetricBadge.premium.contract.test.ts`.

**Sticky formatting toolbar (2026-08-05):** `data-doc-guide="editor-toolbar-sticky"` — glass fade + inset sheen (`DOC_EDITOR_TOOLBAR_STICKY_CLASS`); quieter shell/groups/icon buttons in `docEditorToolbarChrome.ts` (no translate bounce on hover). Lock: `UltimateDocEditor/__tests__/docEditorToolbarChrome.premium.contract.test.ts`.

**Left panel rail (2026-08-05):** `data-doc-guide="editor-panel-rail"` — 44px centered icon stack (`DOC_EDITOR_SIDEBAR_*` in `docEditorSidebarChrome.ts`); short hairline section dividers; open state = soft accent mix (not opaque `accent` / `danger` slabs). Lock: `UltimateDocEditor/__tests__/docEditorSidebarChrome.premium.contract.test.ts`.

**Reading canvas (2026-08-05):** quieter nested paper — `DOC_EDITOR_CANVAS_*` / `DOC_EDITOR_TIPTAP_WRAPPER_CLASS` (no stacked opaque panel + drop shadow); ProseMirror focus = soft `ring-1`; dark theme paragraphs get `leading-relaxed` like light. Lock: `UltimateDocEditor/__tests__/docEditorCanvasChrome.premium.contract.test.ts`.

**Collaboration side panel (2026-08-05):** `CollaborationPanel` — `collabPanelChrome.ts` (`DOC_EDITOR_COLLAB_*`): quieter header/icon, sentence-case participants/activity meta (no `uppercase` shout), icon alert instead of emoji. Lock: `Panels/__tests__/collabPanelChrome.premium.contract.test.ts`.

**AI Assistant side panel (2026-08-05):** `aiAssistant/` — `aiAssistantPanelChrome.ts` (`DOC_EDITOR_AI_*`): desktop accent header (no purple wash), Heroicon quick actions (no emoji), quieter empty chat. Lock: `Panels/aiAssistant/__tests__/aiAssistantPanelChrome.premium.contract.test.ts`.

- Светлая/тёмная канва редактора: `useDesktopShellTheme()` и [`tiptapProseThemeClass.ts`](../../shared/web/frontend/src/components/UltimateDocEditor/utils/tiptapProseThemeClass.ts).
- Пресеты окон: `useDesktopShellFrame()` + хелперы из [`desktopVisualSystem.tsx`](../../shared/web/frontend/src/pages/Desktop/utils/desktopVisualSystem.tsx).
- Глобальный `ThemeProvider` (`--theme-*`) для встроенных панелей редактора **не подменяет** `--desktop-*` без отдельного ТЗ — иначе разъезжается chrome окна и рельс.

Поведение оверлеев (2026-04): Escape закрывает гид/тур, карточку quick start, затем любую открытую панель и меню экспорта (`closeAllOverlays` в `UltimateDocEditor.tsx`). Ленивая загрузка панелей показывает общий fallback на токенах `--desktop-overlay-backdrop` / `--desktop-surface-panel-strong`.

Восточная колонка (2026-04): панель **AI** и **генерация изображений** делят одну grid-колонку (`eastDocPanelOpen`); при открытии одной вторая закрывается в `editorStore`. Панель генерации изображений в режиме `layout="dock"` не `fixed`, чтобы не перекрывать поле редактора.

**Генерация картинок в редакторе:** только UGS `type_key: image_generation_comfyui` и Comfy workflow **`01_top`** (поле `workflow_template` в `input_data` из `editorStore.ts`); в UI остаются промпт, статус и галерея результатов.

**Вставка контента (2026-04):** формулы — узел TipTap `inlineMath` (KaTeX), не сырой текст `$...$`. Диаграммы — JSON + `blob:` для SVG, чтобы не терялся `<img>`. Длинные `data:` для картинок сокращаются до `blob:` перед `setImage`; **URL с сервера после UGS** (`/api/...` или https) вставляются как есть. У TipTap `Link` добавлен протокол `blob:` — иначе ссылки на локальный PDF превращались в голый текст. PDF из панели: при вставке файл грузится в **unified content** (`POST /api/v1/content`, `content_type=document`), в документ — `<a href="/api/v1/content/{id}/download">`; при ошибке upload — fallback на `blob:`.

**Плагины редактора:** «Установить» = список id в профиле на сервере; рантайм расширений в TipTap пока нет — см. шапку панели плагинов.

**Шаблоны:** полный Markdown приходит из API; миграция `pending/20260404_doc_editor_templates_richer_content.sql` расширяет текст трёх стандартных шаблонов в БД.

**Панель «Файлы» (FileManagerPanel, 2026-04):** стабильный lazy-import — `Panels/FileManagerPanel.tsx` (facade); реализация — `Panels/fileManager/`. Список через `GET /api/v1/doc-editor/documents` с `skip`/`limit`/`search` (поиск на сервере по имени и `extracted_text`), в store — `documentsTotal`, `isLoadingMoreDocuments`, догрузка страниц («Загрузить ещё»); сортировка по загруженной странице на клиенте; длинные списки — `VirtualVariableList`; тексты — `ultimateDocEditor.json` (`fileManager.*`). **Premium chrome (2026-08-05):** `fileManagerChrome.ts` — sentence-case section/sort meta (не `uppercase` «НЕДАВНИЕ» / «СОРТИРОВКА»), quieter header accent icon. Панель **библиотеки** (`FileLibraryPanel`) — отдельный чанк: **`React.lazy`** + **`Suspense`**, prefetch при открытии менеджера файлов (idle) и по наведении на кнопку; стабильные колбэки — см. **[FRONTEND-VIRTUAL-LIST-AND-PERF-PATTERNS.md](FRONTEND-VIRTUAL-LIST-AND-PERF-PATTERNS.md)**.

**Панель «Голос» (VoiceTranscriptionPanel, 2026-07):** стабильный import — `Panels/VoiceTranscriptionPanel.tsx` (facade); реализация — `Panels/voiceTranscription/`. Встроенная модалка (не east dock): z-index через **`useEmbeddedPortaledModalZIndex`**, backdrop/контент на `--desktop-*`; вкладки Record / Upload / Synth; STT/TTS через `voice-core`.

**Загрузка документа (2026-04):** в `editorStore` флаг `isLoadingDocument` отделён от общего `isLoading` (список документов, поиск, версии и т.д.). Скелетон основного поля показывается при `isLoadingDocument && !currentDocument`. При смене id контент предыдущего документа сбрасывается до прихода ответа; ответы `loadDocument` с устаревшим порядком запросов игнорируются (счётчик поколений). Автовосстановление черновика ждёт `isLoadingDocument`, а не любой фоновый `isLoading`.

**Doc Editor vs Unified Content (2026-04):** в store добавлен `documentSource: 'doc_editor' | 'unified_content' | null`. `PUT` в Doc Editor API (`updateDocument`) не вызывается для сценария unified content (лог + ранний выход). Файл из обмена помечает `documentSource: 'unified_content'` при синхронизации в store. В embedded-режиме `onPayloadChange` обновляет `initialPayload` окна: при открытом файле из каталога — `unifiedContentId` и сброс `documentId`; при документе из Doc Editor — `documentId` и сброс `unifiedContentId` (то же при выборе из поиска/импорта). Тип `UltimateDocEditorProps.onPayloadChange` расширен под оба поля.

**GET server draft vs unified content (2026-04):** `GET /api/v1/doc-editor/documents/{id}/draft` проверяет доступ тем же слоем, что и `GET /api/v1/content/{id}` (`ContentStorageService.get_content`), а не только `doc_collaboration_invites`. Иначе пользователь с доступом через шаринг/friends видит документ, но получал 403 на черновик. Запись/удаление черновика по-прежнему требуют владельца или принятого инвайта коллаборации (`comment`).

**Сохранение HTML в тот же `content_id` (2026-04):** `useDocumentFileExchange.saveCurrentDocument` вызывает `POST /api/v1/content/{content_id}/replace-file` (`contentApi.replaceContentFile`), а не повторный `POST /api/v1/content`, чтобы логический id документа не менялся при каждом сохранении. Бэкенд: `ContentStorageService.replace_file_content` + снимок версии и переиндексация как при upload.

**Leave/close guard (2026-04):** предупреждение при уходе со страницы и закрытии окна рабочего стола работает по единому решению:
- блокировать только при `reason=dirty` (есть реальные несохранённые изменения в текущей или сохранённой сессии вкладки);
- не блокировать в переходных состояниях `loading` / `saving` и в `empty_state`;
- единая телеметрия `desktop-telemetry` событием `doc_editor_leave_guard` с `channel` (`beforeunload` / `window_close` / `direct_close`) и `requestId`, чтобы отлавливать ложные подтверждения.

## См. также

- Менеджер файлов редактора (UX, контекстное меню, ИИ из списка, порядок Escape, ссылки на модули): [ULTIMATE-DOC-EDITOR-FILE-MANAGER.md](ULTIMATE-DOC-EDITOR-FILE-MANAGER.md).
