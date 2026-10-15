# Виртуализированные списки и паттерны производительности (фронт)

Справка для разработчиков EliteEW: общие компоненты **`VirtualList`** / **`VirtualVariableList`** / **`VirtualGrid`**, вкладка «Файлы» в Файловый менеджер, панель файлов в Ultimate Doc Editor, стабильные колбэки в крупных экранах.

Пользовательского UX здесь нет — только отсылки к файлам и принятые приёмы.

## Где код

| Область | Путь (от `shared/web/frontend/`) |
|--------|-----------------------------------|
| Виртуализаторы | `src/components/shared/VirtualList.tsx` |
| Файловый менеджер — корень | `src/pages/ContentManager/ContentManagerPro.tsx` |
| Файловый менеджер — вкладка «Файлы» | `src/pages/ContentManager/ContentManagerFilesTab.tsx` |
| Хук списка (серверный поиск с debounce в родителе) | `src/pages/ContentManager/hooks/useContentList.ts` |
| File Manager редактора (facade) | `src/components/UltimateDocEditor/Panels/FileManagerPanel.tsx` |
| File Manager — реализация / строки / хук | `src/components/UltimateDocEditor/Panels/fileManager/` (`FileManagerPanel.tsx`, `FileManagerDocRow.tsx`, `useFileManagerPanel.ts`, `fileManagerConstants.ts`) |
| Панель библиотеки (отдельный чанк) | `src/components/UltimateDocEditor/Panels/FileLibraryPanel.tsx` |

## VirtualList / VirtualGrid

- **Ключи элементов:** по возможности из `id` элемента (хелперы уровня модуля и `getItemKey` для `@tanstack/react-virtual`), а не «голый» индекс — иначе при обновлении данных возможны артефакты прокрутки и лишние перемонтирования.
- **Infinite loading:** `onEndReached` вызывается один раз на текущий размер списка; повтор возможен только после изменения `items.length`.
- **`VirtualGrid`:** проп **`rowHeight`** — только **estimate** для `@tanstack/react-virtual`; реальная высота строки **измеряется** (`VirtualVariableRow` + `measureElement` + `ResizeObserver`), иначе высокие `ContentManagerFileCard` наезжают друг на друга. Проп **`overscanRows`** (у CM задаётся явно, например `5`); у фиксированного списка — **`overscanCount`** на `VirtualList`.
- **Файловый менеджер:** блок **`ContentManagerFilesGridVirtualBlock`** (`React.memo`) держит стабильный **`renderCell`** для `VirtualGrid` при фиксированной геометрии группы (`groupStart`, `columnCount`, `renderGridFileCard`), чтобы не сбрасывать виртуализатор на каждом ререндере родителя. Estimate ряда — `estimateContentManagerVirtualGridRowHeightPx(columnWidth)` (thumb/meta chrome карточки); пороги — `pages/ContentManager/utils/contentManagerVirtualization.ts`; wiring — `ContentManagerFilesListBody.tsx`.
- **CM blob concurrency:** `CM_BLOB_FETCH_MAX_CONCURRENT` (6) + `withBlobFetchConcurrency` gate on `ContentThumbnail` / `HoverPreview` blob GETs; `runWithBlobFetchConcurrency` for explicit batches. Prefer `thumbnail_path`/WebP; no `/download` after stored-thumb fail. Plan: `documentation/plans/platform/API-AUTH-SESSION-POOL-AND-CONTENT-BLOB-PERF-PLAN.md` *[operator-local process plan; gitignored — not living canon]*.

Подробнее по продукту и карте файлов: [CONTENT-MANAGER.md](CONTENT-MANAGER.md).

## Variable-height virtualization (2026-05)

Для списков с плавающей высотой карточек (новые тосты/бейджи, длинные заголовки, локализованные строки) используется измерение строки:

- `@tanstack/react-virtual` + `ref={virtualizer.measureElement}` на wrapper элемента;
- `ResizeObserver` в wrapper строки перевымеряет высоту после lazy media, wrapping text, i18n или раскрытых деталей; callback батчится через `requestAnimationFrame` и отменяется при unmount;
- `getItemKey` на стабильный id (`notification.id`, `task.id`, `alert.id`, first card id в строке grid);
- wrapper остаётся `position:absolute` + `translateY(start)`, а размер берётся из измерения вместо жёсткого `estimateSize`.

Где применено:

- `src/pages/Desktop/components/notificationHub/NotificationHubVirtualLists.tsx`
- `src/pages/MarketingCabinet/dashboard-widgets/widgets/alertsWidget.tsx`
- `src/pages/MarketingCabinet/dashboard-widgets/widgets/tasksWidget.tsx`
- `src/components/UnifiedContent/components/VirtualizedGrid/VirtualizedGrid.tsx`
- `src/components/shared/VirtualList.tsx` → **`VirtualGrid`** (Файловый менеджер dense grid)

## Файловый менеджер (ContentManagerPro) — стабильные колбэки вкладок

В **`ContentManagerPro`** для вкладок, где дочерние компоненты могут быть обёрнуты в **`memo`**, колбэки обновления данных вынесены в **`useCallback`** (без inline-функций на каждом рендере родителя):

- комментарии к файлу — обновление списка и деталей выбранного контента;
- поиск дубликатов — перезагрузка списка и статистики;
- вкладка «Мне предоставили доступ» — обновление списка шаринга.

Имена в коде: `handleFileCommentsAfterUpdate`, `handleDuplicateFinderChange`, `handleSharedContentsRefresh`.

Связанные ранее приёмы (см. worklog): **`viewGridFile`**, **`handleGridArrowNavigate`** через refs, **`renderGridFileCard`** / **`renderListFileRow`** во вкладке файлов, **`closePreviewModal`** для модалки предпросмотра.

## Ultimate Doc Editor — панель файлов и библиотека

**`FileManagerPanel`** (facade `Panels/FileManagerPanel.tsx`, реализация `Panels/fileManager/`):

- длинный список документов — **`VirtualVariableList`**, поиск с **debounce** на сервер, сортировка и рендер строк через **`useCallback`** / **`memo`** там, где это уже сделано в коде;
- панель **`FileLibraryPanel`** подключается **лениво** (**`React.lazy`** + **`Suspense`**, fallback при первой загрузке чанка);
- **prefetch** того же динамического `import()`:
  - при **открытии** панели менеджера файлов — по возможности **`requestIdleCallback`**, иначе немедленный `import()` (тот же паттерн намерения, что prefetch **`AppStoreCard`** в **`DesktopWorkspaceAppStoreLayer`**);
  - при **наведении** на кнопку открытия библиотеки — вызов того же `import()`;
- колбэки **`closeLibraryPanel`**, **`handleLibraryFileSelect`** — **`useCallback`** для стабильных ссылок у ленивой панели.

Аналог по смыслу (lazy + idle prefetch): [desktop/DESKTOP-APP-STORE.md](desktop/DESKTOP-APP-STORE.md) (раздел «Производительность»).

Темизация панелей редактора под shell: [ULTIMATE-DOC-EDITOR-DESKTOP-THEMING.md](ULTIMATE-DOC-EDITOR-DESKTOP-THEMING.md). Пользовательские сценарии и карта кода менеджера файлов: [ULTIMATE-DOC-EDITOR-FILE-MANAGER.md](ULTIMATE-DOC-EDITOR-FILE-MANAGER.md).

## Heavy UI lifecycle notes (2026-05)

- Monaco admin tabs (`EnsemblePlanMonacoTab`, `CompanionWorkflowMonacoTab`) set `keepCurrentModel={false}` and `saveViewState={false}` so tab switches do not retain editor models/view state.
- `useLlamaAI` aborts the active streaming request on unmount; new streams abort previous streams.
- Файловый менеджер media and text previews pass `AbortSignal` to authenticated blob downloads and ignore stale decode results after cleanup.
- Ultimate Doc Editor collaboration tracks deferred Socket.IO disconnect `requestAnimationFrame` and cancels it before scheduling another teardown.
- Music Generator list playback aborts stale authenticated blob downloads, clears delayed `audio.play()` timers, and revokes the previous preview object URL before replacing it.
- Assistant image attach reads selected images via `FileReader.readAsDataURL` in `companionImageAttachment.ts`; avoid reintroducing `arrayBuffer -> Uint8Array -> binary string -> btoa` because it creates avoidable transient JS heap pressure.

## Workflow Builder (ReactFlow) performance

- Historical `WorkflowBuilder` graph-history coalesce (`WORKFLOW_HISTORY_COALESCE_MS`) — **retired** with the builder shell; do not copy as a living pattern. For living lists use `VirtualList` / coalesced fetch helpers below.
- `useHistoryState` accepts a custom serializer and bounded `maxEntries`; Workflow Builder fingerprints only stable node/edge fields instead of ReactFlow transient selection/view fields.
- Execution history polling is no longer a fixed 5s interval: active executions keep fast polling, idle executions back off, and hidden idle tabs pause until visibility returns.

## Tiptap editor transaction load

- `TiptapEditor` debounces full `editor.getHTML()` serialization before parent `onUpdate`; blur still flushes pending HTML.
- Selection updates now compare a cheap `from:to:docSize` signature before extracting selected text with `doc.textBetween`, avoiding repeated work for unchanged cursor/range events.
- Visual gutter measurements remain debounced and cancel `requestAnimationFrame`/timers on cleanup.

## Query cache / infinite lists

- Feedback Hub user/admin infinite queries use explicit `staleTime`/`gcTime` and no focus/mount refetch storms; mutations still invalidate/refetch the affected query keys explicitly.
- GAF Chat hover prefetch is capped (`GAF_MESSAGE_PREFETCH_MAX_CHATS`), ignores touch pointer enters, evicts inactive prefetched message queries, and sets a short message query `gcTime`.
- Clipboard Manager persists history through `clipboardHistoryPersistence.ts`: shell-state records are capped to backend limits and oversized image data URLs are skipped from persistence instead of sending large JSON payloads.

## См. также

- Файловый менеджер (API, ACL, кодовая карта): [CONTENT-MANAGER.md](CONTENT-MANAGER.md)
- Вход фронтенда (сборка, проверки): [FRONTEND-DEVELOPER-ENTRY.md](FRONTEND-DEVELOPER-ENTRY.md)
- Browser cache / RQ infinite lists: [FRONTEND_BROWSER_CACHE_MODEL.md](FRONTEND_BROWSER_CACHE_MODEL.md)
- Хронология правок: `git log -- documentation/product/FRONTEND-VIRTUAL-LIST-AND-PERF-PATTERNS.md shared/web/frontend/src/components/shared/VirtualList.tsx` (worklog retired)
