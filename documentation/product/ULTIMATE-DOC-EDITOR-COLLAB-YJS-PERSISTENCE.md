# Ultimate Doc Editor — Yjs и персистентность коллаборации (дизайн)

Состояние на 2026-05: **канонический контент** документа хранится в PostgreSQL (`unified_content`); **Yjs** раздаётся через WebSocket в памяти процесса API без долговременного хранения CRDT-снимков.

## Цели

1. После обрыва сети клиент мог **безопасно** переподключиться, не дублируя и не затирая текст.
2. Иметь опциональный **серверный снимок Yjs** (или экспорт в бинарный блоб) как источник для cold start комнаты.
3. Согласовать политику **canonical save**: кто и когда делает PUT в БД при активной коллабе.

## Текущая реализация (fact)

- Подключение к Yjs **только вручную**; `y-websocket` с `resyncInterval`, seed HTML после sync пустой комнаты (`useYjsCollaboration`, `collabSeedYDoc`).
- Каноническое сохранение на клиенте в коллабе **без** `expected_version` (избегание 409).
- Socket.IO — presence и курсоры; завершение сессии владельцем.

## Предлагаемые шаги (roadmap)

| Шаг | Описание |
|-----|-----------|
| A | **Done (2026-05-22):** Redis LIST `doc_editor:yjs:updates:{document_id}` + in-memory fallback (`api/services/doc_editor_yjs_store.py`); cold start replay первому клиенту в комнате; persist type=2 updates. |
| B | **Done (2026-05-22):** autosave PUT в коллабе — только **владелец** после idle **90 с**; соавтор с правом — ручной «Зафиксировать»; без права — только Yjs. Flush владельца при «Отключиться». Server draft off в live collab. Код: `docEditorCollabSavePolicy.ts`, `useDocEditorAutosave.ts`. |
| C | **Done (2026-05-22):** статусы UI `connecting` / `synced` / `reconnecting` / `offline` — badge в панели коллаба (`docEditorYjsConnectionStatus`, `TiptapEditorCollaboration` → `CollaborationPanel`). |

Связанный канон: **[ULTIMATE-DOC-EDITOR.md](ULTIMATE-DOC-EDITOR.md)**, legacy **[DOC-EDITOR-COLLABORATION.md](DOC-EDITOR-COLLABORATION.md)**.
