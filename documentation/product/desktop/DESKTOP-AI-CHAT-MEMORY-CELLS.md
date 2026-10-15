# Ассистент — Memory Cells (personal portable RAG)

Living canon for owner-scoped Memory Cells extracted from Ассистент.

Primary surface: [DESKTOP-LLAMA-CHAT.md](../DESKTOP-LLAMA-CHAT.md). Collaboration overlay: [DESKTOP-AI-CHAT-COLLABORATION.md](DESKTOP-AI-CHAT-COLLABORATION.md).

## Status

| Wave | Scope | State |
|------|-------|-------|
| **0** | Schema + Qdrant + settings | **In prod** — migration `20260801_03`; runner key `20260801_03|desktop_ai_memory_cells` in `docker/scripts/apply-eliteew-migrations.sh` |
| **1** | Extract create/update + hard-delete chat | **In prod** |
| **2** | Attach + stream retrieval + done.context | **In prod** |
| **3–4** | FE chat UX / profile / admin section | **In prod** (baked `prod-baked-20260802-0616`, git `5403975b`) — extract in header menu; create-chat cell picker; Profile → More → Memory cells; Admin `?section=desktopAiChat&aiChatTab=memoryCells` |

### Follow-up polish (not blocking v1)

- Header **chip** when a cell is attached to the open chat.
- Settings rail control to **clear** `memory_cell_id` (`PATCH` `clear_memory_cell` already exists).

## Product rules

- **Storage:** stack0 PG (`desktop_ai_memory_cells`) + Qdrant `desktop_memory_cells` — **not** KBSEW barrels.
- **Quota:** soft max **3** per user (admin `memory_cells_max_per_user` 1..5); DB hard ceiling **5**.
- **One cell per chat** via `desktop_ai_chats.memory_cell_id` (owner’s cell only).
- **Parallel chats** may use different cells of the same owner.
- **Extract** (owner only): `POST /chats/{id}/memory-cells/extract` with `mode=create|update`.
  - `create` — chat must be unbound; free quota slot.
  - `update` — only the cell **already bound** to this chat.
  - After **successful** index → **hard-delete** chat (messages/members/attachments/`desktop_chat_rag`/episodic memory).
  - On index failure → chat **kept**; cell may be `failed`.
- Block extract while stream lock held → `409 turn_in_progress`.

## API

Prefix: `/api/v1/desktop/ai-chat`

| Method | Path | Who |
|--------|------|-----|
| GET | `/memory-cells` | self |
| GET/PATCH/DELETE | `/memory-cells/{id}` | owner |
| POST | `/chats/{id}/memory-cells/extract` | chat owner |
| POST `/chats` | optional `memory_cell_id` | owner |
| PATCH `/chats/{id}` | `memory_cell_id` or `clear_memory_cell` | owner |

## Stream

`build_rag_prefix(..., memory_cell_id=chat.memory_cell_id)` searches Qdrant filtered by `memory_cell_id` + `owner_user_id`.

SSE `done.context` additive keys: `memory_cell_chunks`, `memory_cell_requested`, `memory_cell_cap`, `memory_cell_id`, `memory_cell_quality`.

## Admin defaults (`desktop_ai_chat_config.defaults`)

| Key | Default |
|-----|---------|
| `memory_cells_enabled` | true |
| `memory_cells_max_per_user` | 3 |
| `memory_cells_max_messages` | 400 |
| `memory_cells_max_chunks` | 256 |
| `memory_cells_retrieval_top_k` | 8 |
| `memory_cells_min_score` | 0.2 |

## UX surfaces

| Surface | Path / entry |
|---------|----------------|
| Extract | Ассистент header overflow → create/update (owner); chat hard-deleted after success |
| Attach on create | Hero picker → optional ready cell → `POST /chats` `memory_cell_id` |
| Profile manager | Social Hub / Profile → More → Memory cells (`ProfileMemoryCellsPanel`) |
| Admin | Unified Admin → Ассистент → tab **Memory cells** (`aiChatTab=memoryCells`) |

## Modules

- `api/services/desktop_chat/memory_cells_settings.py`
- `api/services/desktop_chat/memory_cells_rag.py`
- `api/services/desktop_chat/memory_cells_service.py`
- FE: `features/desktop-ai-chat/hooks/useDesktopAiChatSoloSlot.ts`, `components/DesktopAiChatModals.tsx`, `components/profile/ProfileMemoryCellsPanel.tsx`, `pages/Admin/desktopAiChat/DesktopAiChatMemoryCellsTab.tsx`
- Migration: `shared/api/migrations/applied/20260801_03_desktop_ai_memory_cells.sql`
- Tests: `shared/api/tests/test_desktop_ai_memory_cells.py`; FE `memoryCellCreateAttach.contract.test.ts`, `desktopAiChatAdminMemoryCells.test.ts`
