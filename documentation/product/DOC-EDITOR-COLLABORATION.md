# Совместное редактирование документов (Doc Editor Collaboration)

Документ описывает реализацию совместного редактирования в Ultimate Document Editor: какие ошибки возникали, как их устраняли, текущую архитектуру и состояние.

**Канон по редактору (форматы, загрузка, перекрёстные ссылки):** [`../../product/ULTIMATE-DOC-EDITOR.md`](ULTIMATE-DOC-EDITOR.md).

---

## 1. Обзор функциональности

- **Редактор:** Ultimate Document Editor (Tiptap + Yjs).
- **Присутствие и курсоры:** Socket.IO (комната на документ, события `join_document`, `leave_document`, `cursor_move`, `user_joined`, `user_left`, `collaborators_list`, `get_collaborators`).
- **Синхронизация контента:** Yjs по WebSocket (`/api/v1/doc-editor/collaboration/{document_id}?token=...`). Сервер рассылает бинарные сообщения Yjs всем клиентам в комнате документа.
- **Приглашения:** REST API (`/api/v1/doc-editor/documents/{id}/invites`, `invites/{id}/accept`, и т.д.) + панель «Совместная работа» (пригласить друга, входящие/исходящие приглашения). **Только владелец документа** может слать приглашения: `create_collaboration_invite` сверяет `doc.user_id`; UI `collabCanSendInvites` требует `isCollabDocumentOwner`. Unified-content bootstrap пишет в store **`ownerUserId` из GET /content**, а не session user (иначе коллаборатор выглядел бы владельцем и ловил 400). Disabled invite CTA copy: **owner** → `inviteRequiresOwner` / «Только владелец»; **not connected** → `inviteRequiresConnect` (`collabInviteBlockedReason.ts`) — не путать с уже подключённым соавтором.

Подключение к совместному редактированию **включается только вручную** (кнопка «Подключиться» в шапке документа). При смене документа или восстановлении версии сессия коллаборации сбрасывается.

---

## 2. Ошибки и решения

### 2.1. WebSocket Yjs: дублирование пути и токена (401 / RS256)

**Симптомы:** Ошибки аутентификации при подключении к Yjs WebSocket, в логах — дублированный токен в URL, неверный issuer.

**Причина:** В `useYjsCollaboration` в `WebsocketProvider` передавался **полный URL** с `documentId` и `token` в пути. Библиотека `y-websocket` сама добавляет `"/" + room` и query-параметры, в результате путь и токен дублировались.

**Решение:** Передавать только **базовый URL** без комнаты и токена в пути:
`wss://host/api/v1/doc-editor/collaboration`, комнату задавать вторым аргументом (`documentId`), токен — в `params: { token }`.

**Файл:** `web/frontend/src/components/UltimateDocEditor/hooks/useYjsCollaboration.ts`.

---

### 2.2. WebSocket «closed before the connection is established»

**Симптомы:** В консоли: `WebSocket is closed before the connection is established` при закрытии панели «Совместная работа» или быстром уходе со страницы.

**Причина:** При размонтировании или вызове `leave()` сразу вызывались `disconnect()` и уничтожение Yjs-провайдера, пока соединение ещё устанавливалось (тот же тик).

**Решение:**
- В **useCollaboration:** в `leave()` при уже установленном соединении — emit `leave_document` и `disconnect()`. Если сокет ещё не подключён — вызов `disconnect()` перенесён в `requestAnimationFrame`, чтобы не закрывать в том же тике. В глобальном cleanup при размонтировании — отложенный disconnect через `requestAnimationFrame`, emit `leave_document` только при `socket.connected`.
- В **useYjsCollaboration:** задержка перед уничтожением провайдера/дока при cleanup увеличена с 0 до **50 ms**, чтобы не вызывать `destroy()` в том же тике, когда создаётся провайдер.

**Файлы:** `useCollaboration.ts`, `useYjsCollaboration.ts`.

---

### 2.3. Контент документа не синхронизировался между участниками

**Симптомы:** Изменения одного участника не отображались у другого.

**Причина:** На бэкенде WebSocket Yjs **возвращал данные только отправителю** (echo). Не было рассылки сообщений остальным клиентам в комнате документа.

**Решение:** Введено хранилище подключений по `document_id`: при получении бинарного сообщения от одного клиента оно **рассылается всем остальным** в этой комнате (отправитель не получает свой же пакет). При отключении клиент удаляется из списка.

**Файл:** `api/routers/doc_editor.py` — `_yjs_document_connections`, цикл рассылки в `yjs_collaboration_websocket`.

---

### 2.4. «Сейчас в документе 0» у второго участника

**Симптомы:** У того, кто принял приглашение, в панели отображалось «Сейчас в документе 0», хотя первый участник видел второго.

**Причина:** В python-socketio вызов был **`get_participants(room, "/")`** — аргументы перепутаны (должно быть `namespace`, затем `room`). Кроме того, участники — это просто список `sid`, а не пары `(sid, _)`.

**Решение:**
- Использовать **`get_participants("/", room)`** и **`list(participants)`** без распаковки второго элемента.
- Сразу после `join_document` отправлять присоединившемуся клиенту **`collaborators_list`**, чтобы он сразу видел себя и остальных в «Сейчас в документе (N)».
- В объектах collaborators добавлены поля `username`, `email`, `color` (пустые/дефолтные), чтобы фронт не падал и показывал «Участник».

**Файл:** `api/routers/socketio_handler.py`.

---

### 2.5. Закрытие панели «Совместная работа» разрывало соединение

**Симптомы:** При закрытии панели коллаборация отключалась, хотя пользователь этого не просил.

**Причина:** Логика join/leave была привязана к открытию/закрытию панели: при монтировании панели вызывался `join()`, при размонтировании (закрытии) — `leave()`.

**Решение:** Управление подключением вынесено на уровень **UltimateDocEditor** и **шапки документа**. Панель только отображает данные (приглашения, участников, активность). В шапке добавлен блок: индикатор подключения, количество участников, кнопки «Подключиться» / «Отключиться» и кнопка открытия панели. Закрытие панели больше не вызывает `leave()`.

**Файлы:** `UltimateDocEditor.tsx`, `CollaborationPanel.tsx` (убраны вызовы useCollaboration join/leave, панель получает `isConnected` и при необходимости `connectionError` из родителя).

---

### 2.6. Маркер/каретка в тексте — только подсветка номера строки

**Симптомы:** Пользователь хотел видеть, кто где редактирует, не в виде каретки в тексте, а только подсветкой **номера строки**.

**Решение:** В редакторе есть колонка нумерации строк (блоки документа). Для каждой строки проверяется, есть ли в `activeCollaborators` участник с `cursor_position.line === номер_строки`; если да — ячейка номера подсвечивается цветом участника (фон + полоска слева). В документе каретка других пользователей скрыта через CSS (класс `collaboration-cursor__caret`). Выделение (selection) других оставлено видимым с полупрозрачным фоном. Реализована передача позиции курсора (line/column) из редактора в хук и на сервер при изменении выделения.

**Файлы:** `TiptapEditor.tsx` (подсветка строк, CSS, расчёт line/column в onSelectionUpdate), `UltimateDocEditor.tsx` (handleSelectionUpdate вызывает updateCursor), типы и API курсора в `editor.types.ts`, `useCollaboration.ts`.

---

### 2.7. Синхронизация только при открытой панели и дублирование контента

**Симптомы:** Без открытой панели коллаборация не работала; при синхронизации контент «удваивался» (как копия в конце).

**Причины:**
- **Yjs включался только при открытой панели:** в разметке было `enableCollaboration={!!(currentDocument?.id) && collabPanelOpen}`.
- **Ключ редактора** содержал `collabPanelOpen`, из‑за чего при открытии/закрытии панели редактор пересоздавался (новый Y.Doc, переподключение).
- **Перезапись контента из пропсов:** при активной коллаборации источник истины — Y.Doc, но эффекты в UltimateDocEditor и TiptapEditor при смене `editorInitialContent` / `initialContent` вызывали `setContent(...)`, из‑за чего поверх уже слитого с другими клиентами состояния подставлялся «начальный» HTML и контент дублировался.

**Решение:**
- **Коллаборация не привязана к панели:** `enableCollaboration` зависит только от наличия документа и явного решения пользователя (см. ниже про ручное подключение).
- **Ключ редактора:** только `key={currentDocument?.id ?? 'no-doc'}` — без панели, чтобы редактор не пересоздавался при открытии/закрытии панели.
- **При активной коллаборации не перезаписывать контент из пропсов:** в UltimateDocEditor эффект, синхронизирующий `editorInitialContent` в редактор, при `collaborationEnabledByUser` не выполняется. В TiptapEditor эффект «применить initialContent» при `hasCollab` не вызывает `setContent(initialContent)`.

**Файлы:** `UltimateDocEditor.tsx`, `TiptapEditor.tsx`.

---

### 2.8. Подключение только вручную и сброс при смене документа/версии

**Требование:** При открытии документа не подключаться автоматически; подключаться только по кнопке «Подключиться». При смене документа или восстановлении версии — отключаться и не подключаться снова автоматически.

**Решение:**
- Введено состояние **`collaborationEnabledByUser`** (по умолчанию `false`). **Yjs включается** только при `!!(currentDocument?.id) && collaborationEnabledByUser`.
- **Авто-join при монтировании убран.** Подключение только по нажатию «Подключиться»: `setCollaborationEnabledByUser(true)` и `collabJoin(currentDocument.id)`. «Отключиться» вызывает `collabLeave()` и `setCollaborationEnabledByUser(false)`.
- При **смене документа** (`currentDocument?.id` изменился) в `useEffect` вызываются `collabLeave()` и `setCollaborationEnabledByUser(false)`.
- При **восстановлении версии** в `onVersionRestored`: сначала `collabLeave()` и `setCollaborationEnabledByUser(false)`, затем `loadDocument(currentDocument.id)`, чтобы контент подтянулся с API без конфликта с Yjs.

**Файлы:** `UltimateDocEditor.tsx`, `VersionHistoryPanelV2` (onVersionRestored).

---

### 2.9. Визуализация правок и стабильный цвет участника

**Требование:** Правки каждого участника как-то визуально отображать; стабильный цвет на пользователя.

**Решение:**
- **Цвет пользователя:** вычисляется по имени (хэш) из фиксированного набора цветов (`stableColorForUser` в TiptapEditor), чтобы один и тот же пользователь всегда имел один цвет.
- **В документе:** каретка других скрыта (CSS по `collaboration-cursor__caret`), **выделение (selection)** других участников видимо — полупрозрачный фон (opacity 0.45), скругление.
- **В колонке строк:** подсветка номера строки цветом участника; при **нескольких участниках на одной строке** — tooltip со всеми именами, справа от номера до 3 цветных точек по цвету участника.

**Файлы:** `TiptapEditor.tsx` (stableColorForUser, COLLAB_USER_COLORS, стили, логика нескольких участников на строке).

---

### 2.10. Комментарии к документу — 500 (content_metadata does not exist)

**Симптомы:** `GET /api/v1/doc-editor/documents/{id}/comments` возвращал 500, в логах — `column unified_content.content_metadata does not exist`.

**Причина:** Проверка владельца контента загружала полную модель SQLAlchemy `UnifiedContent`, в которой есть поле `content_metadata`, отсутствующее в реальной таблице БД.

**Решение:** В `_check_content_owner` вместо `select(UnifiedContent)` выполняется сырой SQL: **`SELECT id, user_id FROM unified_content WHERE id = :id AND deleted_at IS NULL`**. Проверка существования и владельца делается по этой выборке, без обращения к отсутствующей колонке.

**Файл:** `api/routers/doc_editor.py`.

---

### 2.11. DesktopWorkspaceContent — undefined is not iterable (Array.from)

**Симптомы:** В консоли: `undefined is not iterable (cannot read property Symbol(Symbol.iterator))` при вызове `Array.from` в чанке DesktopWorkspaceContent.

**Причина:** В части сценариев в `Array.from(...)` передавалось значение, которое могло быть `undefined` (например, `selected`, `toDeleteIds`, `ids` при определённых состояниях/гонках).

**Решение:** Везде, где вызывается `Array.from` по состоянию/ref, добавлена защита: `Array.from(selected ?? new Set())`, `Array.from(toDeleteIds ?? new Set())`, `Array.from(ids ?? new Set())`, а также проверки `selected?.size` и использование `const sel = selected ?? new Set()` перед итерацией.

**Файл:** `web/frontend/src/pages/Desktop/DesktopWorkspaceContent.tsx`.

---

### 2.12. Дополнительные улучшения коллаборации

- **Реактивное состояние Socket.IO:** вместо чтения `socketRef.current?.connected` используется `useState(isConnected)` с подпиской на `connect` / `disconnect` / `connect_error`, чтобы UI корректно показывал «Подключено» / «Не подключено».
- **join_document и get_collaborators** вызываются в обработчике `connect` (и при уже установленном соединении), чтобы не слать события до подключения.
- **Троттлинг курсора:** отправка `cursor_move` не чаще раз в 120 ms и не при той же позиции (line/column); при leave очищаются ref и таймер.
- **Шапка:** при неподключённой коллаборации отображается «Не подключено» и серый индикатор с подсказкой «Нажмите «Подключиться»».
- **Панель «Сейчас в документе»:** у участника отображается «строка N», если известна позиция курсора.
- **leave():** при вызове сразу выполняется `setIsConnected(false)` и очистка ref/таймера курсора.

**Файлы:** `useCollaboration.ts`, `UltimateDocEditor.tsx`, `CollaborationPanel.tsx`.

---

### 2.13. Приглашение к совместной работе: 403 на `/draft` и уведомления на рабочем столе

**Симптомы:** После принятия приглашения `GET /documents/{id}` и список приглашений возвращали 200, а `GET /documents/{id}/draft` — 403 «Access denied». Входящее приглашение было видно только в панели «Совместная работа» в редакторе.

**Причина:** Проверка чтения черновика опиралась только на `ContentStorageService.get_content` (владелец / шаринг / публичность). Пользователь с **принятым** приглашением `doc_collaboration_invites` не получал право чтения через этот слой, хотя `get_document` и `_require_content_access(..., "read")` уже учитывали коллаборатора.

**Решение:** `_require_unified_content_readable` для черновика при `PermissionError` дополнительно проверяет контекст `_get_content_access_context` и разрешает доступ, если пользователь — принятый коллаборатор. После создания приглашения сервер шлёт Socket.IO `notification` с `persistent: true`, стабильным `id` вида `doc_collab_invite_{invite_id}` и полем `actions` (Принять / Отклонить / «Только панель»); в центре уведомлений кнопки вызывают REST accept/decline или открывают редактор с `openCollabPanel`. При принятии, отклонении или отзыве — событие `notification_dismiss` с тем же `id`. Клиент держит Sonner-тост с бесконечной длительностью для `persistent`, слушает `notification_dismiss`, панель коллаборации дополнительно вызывает `dismiss` по тому же id.

**Файлы:** `api/routers/doc_editor.py`, `api/services/doc_editor_service.py`, `api/services/notification_service.py`, `EmperyworldSocketService.ts`, `DesktopSocketNotificationsBridge.tsx`, `useSocketNotifications.ts`, `CollaborationPanel.tsx`, `openAppFromMetadata.ts`.

---

### 2.14. Desktop: «Connection rejected by server» и crash autosave `cached` (2026-07-05)

**Симптомы:** В консоли при открытом Doc Editor на рабочем столе — повторяющиеся `[UltimateDocEditor] Socket.IO connection error` / `Connection rejected by server`. На API раньше: `presence: reject duplicate browser` (`single_browser_realtime`). Параллельно autosave мог падать с `Cannot read properties of null (reading 'cached')` при `getHTML()`.

**Причина:**
- **Socket:** `useCollaboration` создавал **второй** `io()` поверх уже активного desktop-сокета `Services.socket` (GAFChatProvider / `EmperyworldSocketService`). Политика API — одна browser Socket.IO-sessия на пользователя (**с 2026-08-29:** newest-wins `force_claim` + supersede вместо reject newcomer).
- **HTML:** autosave/analytical pipeline вызывали `editor.getHTML()` без guard, когда ProseMirror view/schema уже размонтированы (гонка unmount + debounced flush).

**Решение:**
- **Socket multiplex:** на desktop `useCollaboration` **заимствует** нативный клиент через `EmperyworldSocketService.getClientSocket()`; doc-editor события вешаются tracked handlers + `leave_document` без `disconnect()` на shared socket. **Follower browser tabs** (single-tab policy) **не** открывают отдельный `io()`. Desktop leader ждёт borrow пока socket **connected** (до ~5 с); при `skip_leader_wait` — авто-retry без refresh; после `presence_superseded` / `connection-restored` — **re-bind + `join_document`** на новый `io()` instance (`docEditorCollabSocketRecovery.ts`). Отдельный `io()` — только вне single-tab policy (например admin).
- **Safe serialize:** `safeEditorGetHtml()` + wiring в `useDocEditorResolveHtmlForSave`, `useDocEditorEditorHtmlStoreSync`, `docEditorAnalyticalPipeline` — null/destroyed/throw → fallback на store content, без uncaught exception.

**Файлы:** `useCollaboration.ts`, `docEditorCollabSocketRecovery.ts`, `docEditorCollabSocketPolicy.ts`, `EmperyworldSocketService.ts`, `useDesktopSocketLeader.ts`, `safeEditorGetHtml.ts`, …

---

## 3. Текущая архитектура

### 3.1. Стек

| Компонент | Технология |
|-----------|------------|
| Редактор | Tiptap (ProseMirror) |
| Синхронизация контента | Yjs + y-websocket |
| Присутствие, курсоры, комната | Socket.IO |
| Приглашения | REST API doc-editor (invites) |
| Бэкенд Yjs | FastAPI WebSocket, рассылка по комнате документа |

### 3.2. Основные файлы

| Путь | Назначение |
|------|------------|
| `web/frontend/.../UltimateDocEditor.tsx` | Шапка (индикатор, Подключиться/Отключиться, панель), ключ редактора, collaborationEnabledByUser, onVersionRestored |
| `web/frontend/.../EditorCore/TiptapEditor.tsx` | Стабильный entry: `TiptapEditor` (collab Suspense gate), `TiptapEditorCore` (lazy optional extensions) |
| `web/frontend/.../EditorCore/TiptapEditorInner.tsx` | useEditor shell: gutter, context menu, runtime dialogs, comment anchors, floating chrome |
| `web/frontend/.../EditorCore/createCoreTiptapExtensions.ts` | Shared TipTap schema (StarterKit + formatting + tables + images); aligned with `collabSeedYDoc.ts` |
| `web/frontend/.../EditorCore/collabSeedYDoc.ts` | Y.Doc HTML seed before WebSocket sync (uses `createCoreTiptapExtensions`, no comment-anchor decorations) |
| `web/frontend/.../EditorCore/useTiptapGutterLayout.ts` | Visual line gutter measurement, debounced layout, scroll anchor |
| `web/frontend/.../EditorCore/useTiptapRuntimeDialogs.ts` | Link/image/formula dialogs, color picker, `DOC_EDITOR_RUNTIME_DIALOG_EVENT` |
| `web/frontend/.../EditorCore/useTiptapCommentAnchors.ts` | Comment anchor decorations, jump flash, quick menu state |
| `web/frontend/.../EditorCore/TiptapLineGutter.tsx` | Line-number gutter UI + collaborator row highlights |
| `web/frontend/.../EditorCore/TiptapEditorCollaboration.tsx` | Yjs/Collaboration/CollaborationCaret wiring (imports `TiptapEditorCore` from `./TiptapEditor`) |
| `web/frontend/.../hooks/useCollaboration.ts` | Socket.IO: join/leave на shared desktop socket (`getClientSocket`); follower tabs skip dedicated `io()`; cursor_move (троттл), collaborators_list, isConnected |
| `web/frontend/.../hooks/docEditorCollabSocketPolicy.ts` | Pure plan: borrow / skip follower / skip leader wait / dedicated io |
| `web/frontend/.../utils/safeEditorGetHtml.ts` | Guard для autosave/analytical `getHTML` при destroyed/teardown |
| `web/frontend/.../hooks/useYjsCollaboration.ts` | Y.Doc, WebsocketProvider, базовый URL комнаты, 50 ms задержка при cleanup |
| `web/frontend/.../Panels/CollaborationPanel.tsx` | Панель: приглашения, список участников («строка N»), активность; только отображение, без join/leave. **Premium chrome (2026-08-05):** токены `collabPanelChrome.ts` (`DOC_EDITOR_COLLAB_*`) — sentence-case meta участников/активности, quieter header; lock `Panels/__tests__/collabPanelChrome.premium.contract.test.ts` |
| `web/frontend/.../Panels/collabPanelChrome.ts` | Shared Tailwind chrome for collab side panel shell/header/sections |
| `web/frontend/.../Panels/CommentsReviewPanel.tsx` | Lazy facade: named export `CommentsReviewPanel` |
| `web/frontend/.../Panels/commentsReview/CommentsReviewPanel.tsx` | Comments/review side panel shell; compose — `useCommentsReviewCompose.ts` |
| `web/frontend/.../Panels/commentsReview/useCommentsReviewSelectionEffects.ts` | Dual thread sync (`onThreadsChange`), focus scroll/flash, mark-read, external action token |
| `web/frontend/.../Panels/commentsReview/CommentsReviewThreadCard.tsx` | Thread card for virtualized list |
| `api/routers/doc_editor.py` | WebSocket Yjs (broadcast по комнате), _check_content_owner (SQL без content_metadata) |
| `api/routers/socketio_handler.py` | join_document, leave_document, get_collaborators, collaborators_list (get_participants("/", room)) |

### 3.3. Поток данных

1. **Подключение:** Пользователь нажимает «Подключиться» → `collaborationEnabledByUser = true`, `collabJoin(documentId)` → Socket.IO подключается, в `connect` отправляются `join_document` и `get_collaborators` → TiptapEditor получает `enableCollaboration === true` → создаётся Y.Doc и WebsocketProvider, подключается к `/api/v1/doc-editor/collaboration/{document_id}?token=...`.
2. **Курсор:** При изменении выделения в редакторе вычисляются line/column → `handleSelectionUpdate` → `updateCursor` (с троттлингом) → Socket.IO `cursor_move` → сервер рассылает `cursor_update` → в сторе обновляется `activeCollaborators` → в колонке строк и в панели отображаются позиции.
3. **Контент:** Изменения в Tiptap уходят в Y.Doc через Collaboration extension → y-websocket отправляет по WebSocket → сервер рассылает всем в комнате → у других клиентов Y.Doc обновляется и редактор перерисовывается.
4. **Отключение / смена документа:** «Отключиться» или смена `currentDocument?.id` или восстановление версии → `collabLeave()`, `setCollaborationEnabledByUser(false)` → Yjs отключается, контент при смене документа/версии подтягивается с API без перезаписи из Yjs.

---

## 4. Текущее состояние

- **Подключение:** Только вручную по кнопке «Подключиться». При смене документа или восстановлении версии коллаборация сбрасывается.
- **Синхронизация контента:** Работает через Yjs при включённой коллаборации; дублирования контента при merge нет.
- **Присутствие:** Список участников и «Сейчас в документе (N)» корректны; второму участнику сразу приходит `collaborators_list`.
- **Визуализация:** Подсветка номера строки по цвету участника (несколько участников на одной строке — точки и tooltip); выделение других участников видимо в документе (полупрозрачный фон); каретка в тексте скрыта.
- **Панель:** Закрытие панели не отключает коллаборацию; в панели отображаются «строка N» у участников и активность. UI chrome — sentence-case (`DOC_EDITOR_COLLAB_META_LABEL_CLASS`), без CSS `uppercase` shout на блоках участников/активности.
- **Комментарии:** Эндпоинт комментариев не падает с 500 (проверка владельца без колонки content_metadata).
- **Десктоп:** Ошибка «undefined is not iterable» при `Array.from` в DesktopWorkspaceContent устранена защитными проверками.

Деплой: сборка только на **command-center** `.136` (`pnpm run build:react-compiler` в `shared/web/frontend`). Prod-core stack0 — line A `bash docker/scripts/eliteew-deploy.sh release stack0 --all` или hotfix line B `eeprodline sync` → `eeprodline up-dev-bind --yes` (см. `platform/PROD-CORE-DEV-BIND-LINE.md`). Не `podman restart` / rebuild на `.111` как замена release.
