# Ассистент — collaboration (friends in Team chat)

Living canon for inviting friends into ensemble («Команда») Ассистент.

Primary chat product surface remains [DESKTOP-LLAMA-CHAT.md](../DESKTOP-LLAMA-CHAT.md). This doc owns the **human multiplayer** overlay only (not GAF peer chat).

**Memory Cells** (owner portable RAG, including shared chats): [DESKTOP-AI-CHAT-MEMORY-CELLS.md](DESKTOP-AI-CHAT-MEMORY-CELLS.md) — only the chat **owner** may extract/attach; guests see AI answers that used the cell, not a cell editor.

## Status

| Wave | Scope | State |
|------|-------|-------|
| **0** | Schema + access helpers | **Done** (2026-08-01) — commit `1921d44b`; **prod migration applied** 2026-08-01 (`20260801_02`) |
| **1** | Invite / accept / kick / leave API + list union + owner gates | **Done** (2026-08-01) — commit `ecb6582b` |
| **2** | Display-name authorship in prompts + actor quotas + vault-as-owner | **Done** (2026-08-01) — commit `f6e1e0b1` |
| **3** | FE members / leave / capabilities / lock poll | **Done** (2026-08-01) — commit `96965670` |
| **4** | Socket.IO fan-out (turn + membership) | **Done** (2026-08-01) |

## Wave 0 — foundation

### Schema

Migration: `shared/api/migrations/applied/20260801_02_desktop_ai_chat_collaboration.sql`

| Object | Role |
|--------|------|
| `desktop_ai_chat_members` | `(chat_id, user_id)` unique; `status` ∈ pending/accepted/rejected/revoked/left; `role` = guest |
| `desktop_ai_chat_messages.author_user_id` | Human speaker; backfilled to chat owner for existing `role=user` |
| `desktop_ai_chat_attachments.uploaded_by` | Uploader; backfilled to chat owner |

`desktop_ai_chats.user_id` remains the **permanent creator**. Members never rewrite ownership.

### Access helpers

Module: `shared/api/services/desktop_chat/collaboration_access.py`

| Helper | Behavior |
|--------|----------|
| `load_chat_for_participant` | Owner **or** `status=accepted` member → `ChatAccess`; else `None` (left/revoked = personal disappearance) |
| `require_chat_owner` | 403 unless owner |
| `load_chat_for_user` | Compat wrapper returning chat row only; re-exported from `desktop_chat/service.py` |

Wave 1 invite API is live. Pending/left/revoked members have no `ChatAccess`. Accepted guests share the chat; **Discussion** start/continue/finish/cancel/document is owner **or accepted guest**. The Discussion account slot (`session.owner_user_id`) remains the **chat creator** so a later kick/leave does not freeze the guest's other discussions. Invite/kick/members list stay owner-only.

### Tests

`shared/api/tests/test_desktop_chat_collaboration_access.py`

## Wave 1 — invite / ACL / list

### API (`/api/v1/desktop/ai-chat`)

| Method | Path | Who |
|--------|------|-----|
| GET | `/me` | Any auth user → `{ user_id }` = DB `users.id` (FE bubble attribution; same idea as GAF `/gaf-chat/me`) |
| GET | `/chats` | Owned + **accepted** memberships; DTO adds `viewer_role`, `is_shared`, `accepted_member_count`, `capabilities`, `owner_user_id`, **`participants[]`** (owner + accepted guests: `user_id`, `display_name`, `avatar_url`, `is_owner`) |
| GET | `/chats/{id}/members` | **Owner only** (pending + accepted) |
| POST | `/chats/{id}/members/invite` | Owner; ensemble-only; mutual friendship |
| POST | `/chats/{id}/members/{user_id}/remove` | Owner → `revoked` (personal disappearance for target) |
| POST | `/chats/{id}/leave` | Guest → `left` |
| GET | `/invites/pending` | Self |
| POST | `/invites/{member_id}/accept\|decline` | Invitee |
| GET | `/chats/{id}/stream-lock` | Participant peek for poll UX |

### Owner gates (critical)

Guest via `require_chat_access` may open/stream/attach; **403** on regenerate, truncate-delete, PATCH, DELETE chat, members list, solo-slot. Attachment delete: owner any / guest own `uploaded_by` only. Stream-lock clear: owner or lock-holder. **Discussion** start/continue/finish/cancel/document: **owner or accepted guest** (see [DESKTOP-AI-CHAT-DISCUSSION-MODE.md](DESKTOP-AI-CHAT-DISCUSSION-MODE.md)).

### Modules

- `api/services/desktop_chat/collaboration_members.py`
- Router: `api/routers/desktop_ai_chat.py`
- Tests: `test_desktop_chat_collaboration_members.py` + updated stream router contract

## Wave 2 — authorship / vault / quotas

### Prompt labels

Module: `api/services/desktop_chat/collaboration_authors.py`

| Piece | Behavior |
|-------|----------|
| `resolve_author_display_name` / `disambiguate_display_names` | Display name → LLM label; duplicates get `@username` or short id |
| `format_user_turn_for_llm` | Shared only: `[Сообщение от Автор чата · …]: …` |
| `SHARED_CHAT_SPEAKER_NUDGE` | Appended to system prompt when `accepted_members ≥ 1` |
| `load_speaker_context` | Builds labels for history authors + actor (in `service.py`) |

`messages_for_llama` and `ensemble_messages_for_llama` label **user** turns only when `is_shared`. Solo / ensemble without members keep raw «Пользователь» / unlabeled body.

### Stream invariants

| Axis | Rule |
|------|------|
| Vault / project RAG entitlement | `chat.user_id` (owner), not the guest actor |
| Tool / web-search coins | Actor (`user_id` of stream initiator); log `[STEP] desktop_ai_chat collab_tool_quota actor=… owner=…` |
| Persist user row | **Always** set `author_user_id` (DB `users.id` of stream actor), not only when `is_shared`. Shared also adds metadata `author_display_name` / `author_is_owner` |
| List messages | `role=user` with null `author_user_id` → API responds with **chat owner** id (legacy rows) |

### Tests

`shared/api/tests/test_desktop_chat_collaboration_authors.py` — distinct labels for two humans; solo remains unlabeled.

## Wave 3 — FE collaboration UX

### Client + helpers

Module: `shared/web/frontend/src/features/desktop-ai-chat/api/desktopChatClient.ts`

| Method | Path |
|--------|------|
| `getDesktopAiChatMe` | GET `/me` → DB `user_id` for own/peer bubbles (never Keycloak `sub`) |
| `listDesktopAiChatMembers` | GET `/chats/{id}/members` |
| `inviteDesktopAiChatMember` | POST `/chats/{id}/members/invite` |
| `removeDesktopAiChatMember` | POST `/chats/{id}/members/{user_id}/remove` |
| `leaveDesktopAiChat` | POST `/chats/{id}/leave` |
| `listDesktopAiChatPendingInvites` | GET `/invites/pending` |
| `acceptDesktopAiChatInvite` / `declineDesktopAiChatInvite` | POST `/invites/{member_id}/accept\|decline` |
| `peekDesktopAiChatStreamLock` | GET `/chats/{id}/stream-lock` |

Capabilities helper: `utils/desktopChatCapabilities.ts` — **deny-by-default** when `capabilities` missing; legacy solo owner fallback when collab fields absent.

Own-bubble helper: `utils/desktopAiChatOwnUserMessage.ts` — **shared**: compare `author_user_id` (null → `owner_user_id`) to `/me` id; never treat peer/owner as own when self id unknown. **Solo**: missing author/self → own (optimistic).

Local leave UX: `utils/desktopChatCollabLocal.ts` — `removeChatFromLocalList` (guest leave = personal disappearance in sidebar).

### UI surfaces

| Surface | Behavior |
|---------|----------|
| Header | Human `participants` stack (`DesktopAiChatHumanRosterStack` + SecureAvatar) **before** AI ensemble stack when chat DTO has participants |
| Header overflow | «Участники» when `can_manage_members`; «Выйти из чата» when `can_leave` (confirm) |
| `DesktopAiChatMembersPanel` | Owner modal: accepted + pending roster; invite from `listFriends()`; remove with confirm copy |
| Sidebar | Shared/team chats: card chrome + chips «Команда» / «Общий»; human avatar stack from `participants` alongside AI preview on ensemble cards |
| Messages | Own vs peer via `author_user_id` + `GET /me` `user_id`; peer left-aligned with SecureAvatar from participants map when available. Sticky load-older banner dismissible per chat (`sessionStorage`) |
| Members panel | Opaque `DESKTOP_OVERLAY.panelSurfaceStrong` (not transparent glass) |
| Composer | Disable send + status when stream lock held by another; poll `peekStreamLock` ~2 s while locked or after 409 `turn_in_progress` |
| Capabilities gates | Regenerate, delete chat/messages, export, title rename, project/ensemble settings hidden or disabled per API map |

Hooks: `useDesktopAiChatCollab`, `useDesktopAiChatStreamLockPoll`; compose loads `/me` once and passes `currentUserId` into stream / collab / realtime / header / sidebar / messages.

i18n: `src/i18n/locales/{ru,en}/desktopAiChat.json` — collab keys under `desktopAiChat`.

### Tests (Vitest)

- `__tests__/desktopChatCapabilities.test.ts` — deny-by-default + legacy owner fallback
- `__tests__/desktopChatCollabLocal.test.ts` — leave removes chat from local list
- `__tests__/desktopChatCollabApi.contract.test.ts` — client method paths including `/me`
- `__tests__/desktopAiChatOwnUserMessage.test.ts` — own vs peer bubble attribution helper (shared owner fallback)
- `__tests__/DesktopAiChatHumanRosterStack.test.tsx` — stacked human avatars + overflow

### Known MVP gaps (post Wave 4)

- Pending invite **inbox** row may still show chat id prefix rather than chat title (members panel uses friend/participant display names)

## Wave 4 — Socket.IO fan-out

### Transport

| Piece | Behavior |
|-------|----------|
| Room | `desktop_ai_chat:{chat_id}:user:{user_id}` on default namespace `/`; server-derived after participant ACL |
| Join | Client `desktop_ai_chat_join` `{ chat_id }` → ACL via `load_chat_for_participant` → ack `desktop_ai_chat.joined` |
| Leave | Client `desktop_ai_chat_leave` `{ chat_id? }` |
| Outbound module | `api/routers/socketio_emit_desktop_ai_chat.py` (lazy `_sio()`; re-exported from `socketio_handler`) |

### Server → client events

| Event | When |
|-------|------|
| `desktop_ai_chat.turn_started` | After stream lock acquired (`POST …/stream`) |
| `desktop_ai_chat.message_new` | After user/assistant message is committed (REST-shaped DTO; GAF-aligned) |
| `desktop_ai_chat.turn_done` | After SSE ends and lock released; also after manual stream-lock clear |
| `desktop_ai_chat.member_changed` | After invite / accept / decline / remove / leave succeeds |

Payload shapes: turn events `{ chat_id, actor_user_id, … }`; `message_new` adds `message` (list_messages item shape) and optional `actor_user_id`; member events add `reason` ∈ invite/accept/decline/remove/leave and optional `target_user_id`.

When `target_user_id` is set, the same `member_changed` payload is also emitted to personal room `gaf_user_{uuid}` so invitees (not yet in the chat room) refresh pending-invites inbox.

### In-app invite notification

On successful `POST …/members/invite`, the invitee also receives a **persistent** Notification Center row (Socket.IO), mirroring Doc Editor collab invites:

| Field | Value |
|-------|-------|
| `id` | `desktop_ai_chat_invite_{member_id}` |
| `source` | `desktop_ai_chat` |
| `metadata.kind` | `desktop_ai_chat_invite` |
| Actions | accept / decline / open → `executeServerNotificationAction` |
| Open app | `DesktopAiChatApp` + `desktopAiChatId` |

Accept/decline dismisses the notification (`emit_dismiss_for_user`). Pending-invites sidebar remains the secondary surface.

**No live SSE token fan-out** — peers receive persisted `message_new` DTOs as soon as rows commit; `turn_done` still reconciles the tail (and Wave 3 lock poll remains). Streaming tokens stay on the initiator's SSE only.

### Frontend

| Module | Role |
|--------|------|
| `hooks/useDesktopAiChatRealtime.ts` | Join/leave when socket is connected (late-connect safe); listen turn + `message_new` + member events |
| `utils/desktopAiChatSocketMessageMerge.ts` | Dedupe by id; replace `local-*` optimistic rows |
| `types/desktopAiChatRealtimeTypes.ts` | Event name constants + payload guards |
| `emperyworldSocketInboundHandlers.ts` | Bridge inbound socket events → `Services.socket.addEventListener` |
| `notifications/executeServerNotificationAction.ts` | Accept/decline/open from Notification Hub |
| `buildDesktopAiChatOpenPayload` | Deep-link `desktopAiChatId` into window payload |

Wired from `useDesktopAiChatAppCompose`: `message_new` → merge into messages; remote `turn_done` → `retryLoadMessages`; `member_changed` → `refreshAll` + pending invites; remote `turn_started` → arm stream-lock poll.

**Busy turn UX (no live SSE token fan-out to peers):**
- Peers see `message_new` user bubbles immediately; assistant tokens stay on the initiator SSE only.
- While lock held: soft status «Команда отвечает…», composer **typing stays enabled**, **Send** disabled; hint under composer.
- Concurrent `409 turn_in_progress`: restore draft to input + toast; strip `local-*` optimistic rows; do **not** push guests into owner-only «Сбросить блокировку» (clear button only if viewer is owner). Soft toast instead of harsh wipe/reset dialog.

Header: human participant names use primary text color; AI ensemble roster subtitle stays accent uppercase. Members panel invite/accepted rows resolve display names + `SecureAvatar` from friends / `participants`.

Thread UX: message bubble columns are **horizontally centered** (`mx-auto`); own vs peer only flips avatar row direction inside the column.

### Tests

- API: `tests/test_desktop_ai_chat_socket_emit.py` — room name, emit targets (incl. `message_new`), join ACL mocks
- API: `tests/test_desktop_ai_chat_invite_notification.py` — notification id + send/dismiss helpers
- FE: `__tests__/desktopAiChatRealtime.contract.test.ts`
- FE: `__tests__/desktopAiChatSocketMessageMerge.test.ts`
- FE: `notifications` / `desktopOpenPayloads` invite open-app builders

## Product invariants (Wave 3+)

- Invite only into `desktop_chat_mode=ensemble`; mutual friends; accept required.
- Membership permanent until **owner remove** or **guest leave**.
- Leave / kick = chat vanishes **only for that user** (404); history kept for others.
- Owner-only: members list, remove, project bind, regen, truncate, settings, delete chat.
- Tools/web-search coins charge the **message initiator**.
- AI sees people via display-name labels in history (**Wave 2 Done**).

## Related

- [DESKTOP-LLAMA-CHAT.md](../DESKTOP-LLAMA-CHAT.md)
- Friends API: `shared/api/routers/friends.py` (Social Hub — separate from this chat)

### Delivery after membership changes

Every chat event resolves current owner/accepted recipients from storage and emits to their chat-specific user rooms, including when sent by a separate worker. Remove/leave closes the revoked user's room across the Socket.IO manager; pending/revoked/left members receive no subsequent chat content. The targeted personal membership notification is retained. Room eviction is best effort, while recipient lookup fails closed. Events already in flight before revocation may still arrive. Reconnect requires a fresh participant ACL check. Generic `subscribe` cannot enter a chat delivery room.
