# Ассистент — Discussion Mode

Explicit multi-turn **Discussion** mode inside Ассистент (not a separate Desktop app). Never auto-started from Council, blueprint, or normal `/stream`.

**Naming:** product **Discussion mode** ≠ Council ensemble flag `delivery_mode=separate` → internal council label `discussion` (see [DESKTOP-LLAMA-CHAT.md](../DESKTOP-LLAMA-CHAT.md) Council sequential). Different APIs, queues, and UX.

## Product contract

| Axis | Behavior |
|------|----------|
| Start | User opens setup (⋯ → «Начать дискуссию»), picks preset + topic + roster + **должность** (default **инкогнито**), CTA **Начать дискуссию**. **Interview handoff:** prep card with «Тема интервью» / «Цель интервью», optional **«Панель интервью»** (`hero_id` + role) and **«Гайд для панели»**, or `metadata.interview_handoff`, shows **Пройти интервью**. Start roster precedence: prep panel → blueprint contributors → chat `desktop_ensemble_ids` (never SPA picker defaults). Session stores `panel_guide` / `panel_roles`; speech prompts receive them. Never auto-start from `/stream`. Template `interview_prep_v1` v2 requires the panel section. |
| Participant label | AI transcript / prompts use `«{display_name} ({role_title})»` from session columns; display name from `User.full_name` → `username`; role persists in `User.preferences.desktop_ai_discussion.role_title`. |
| One active | At most **one active discussion per chat-owner account** (`desktop_ai_discussion_sessions.owner_user_id` = `desktop_ai_chats.user_id`). An accepted guest may start, but the unique slot stays on the chat creator so kick/leave cannot freeze the guest's other chats. Second start on that owner → `409 discussion_already_active_for_account`. Per-chat active → `409 discussion_already_active`. Concurrent unique-index races map to the same 409s, not 500. |
| Batches | Worker generates at most **5** AI turns (or fewer on raise-hand / goal / error), then pauses and exits. |
| Raise hand | Sets `pause_requested`; after the current AI reply finishes, worker refreshes DB and pauses as `paused_user` (wins over checkpoint). |
| User replies | Allowed in any `paused_*` (checkpoint / user / goal / error); FE composer + main chat send → interjection. Session stays paused until **Продолжить**. |
| Document | Default: only `POST …/generate-document`; never auto `assistant_document_replace`. **Exception:** sessions started via interview handoff (`settings.interview_handoff.auto_document=true`) synthesize the document on **Завершить** and post it as a new assistant message in the same chat (`artifact_type=discussion_interview`). LLM failure logs skip; finish still succeeds. General Discussion stays explicit. |
| Isolation | Active discussion (`queued`/`running`) blocks `POST …/stream` with `409 discussion_active`. FE maps that 409 to `apiErrors.conflictDiscussionActive` (banner, toast, and assistant bubble). Bubble must not interpolate the transport string. Composer send does not open Discussion APIs. After **Завершить**/`completed` (or cancel), the normal chat composer must work again — a bound completed session must not keep `soloSendsBlocked`. |
| Version sync | Lifecycle verbs send `expected_version`. Concurrent continue/finish/interject from another participant → `409 discussion_version_conflict`. FE rehydrates the session via GET so the next action uses the fresh version/status (and does not keep posting interjections into an already finished room). |
| Live SSE | Redis stream fields are read as **str or bytes** (`decode_responses=True` pools). Empty `event: message` must not be the only signal — named types (`discussion_session`, `council_turn`, …) trigger PG GET refresh. SSE `onOpen` also hydrates once so a stuck `queued` UI recovers after worker progress. Preferred role persist on start sets `encryption.pii_key` before touching `users.preferences`. |
| Observability | Batch end logs `[METRIC] discussion_batch speakers= produced= duration_ms= parallel=0 status= reason= preset=` (mirror `[METRIC] ensemble_council_budget`). No user UI. `claim_miss` does not emit the metric. |

**Regression locks (2026-08-13, `desktop-ai-chat-025`):** `tests/test_desktop_chat_discussion_contracts.py` (accepted-guest start/continue/finish/cancel/document, chat/account 409, unique-index race → 409, isolation helper, lease reaper) + `test_desktop_chat_stream_router_contract.py::test_stream_returns_409_discussion_active_when_session_running`. Pause/planner units remain in `test_desktop_chat_discussion.py`.
**Interview handoff (2026-08-15):** `tests/test_desktop_chat_interview_handoff.py` (RU heading extract, `source_message_id` forces `interview` + auto-document, missing source 404, finish without flag does not post). FE: `discussion/__tests__/interviewHandoff.test.ts` (`canShowInterviewHandoffCta`) + blueprint CTA in `DesktopAiBlueprintArtifactBubble.ui.test.tsx` + freeform CTA in `FreeformInterviewHandoffBar.test.tsx`. Template `interview_prep_v1` is a room card; bare «интервью» in a research ask still picks `research_plan_v1`.

**Operator smoke (after FE refresh / hotfix sync):** new Team prep with `interview_prep_v1` v2 (panel section) → refresh SPA → **Пройти интервью** → finish → assistant document (`artifact_type=discussion_interview`) in the same chat. Old sessions do not rewrite themselves.
**W2 isolation copy (2026-08-15):** Council Process subtitle for internal `mode=discussion` is user «по очереди» / «in turn» (`councilModeDiscussion`) — not product Дискуссия. Huddle EN is «Conferring». Locks: `desktopAiChat.jargon.test.ts` (Council vs Discussion names) + `desktopChatStreamError.contract.test.ts` (`409 discussion_active`) + `DesktopAiCouncilProcessTab.test.tsx`.

## State graph

`queued → running → paused_checkpoint | paused_user | paused_goal | paused_error → queued | completed | cancelled`

## API (under `/api/v1/desktop/ai-chat`)

- `GET /discussion/presets`
- `GET /discussion/participant-profile` — `{ display_name, role_title, default_role_title }`
- `POST /chats/{chat_id}/discussion/start` — body includes optional `role_title` (default `инкогнито`) and optional `source_message_id` (interview handoff: forces preset `interview`, topic/goal from the assistant message, `settings.interview_handoff.auto_document=true`; empty roster falls back to `chat.settings.desktop_ensemble_ids`)
- `GET /chats/{chat_id}/discussion/{session_id}`
- `GET /chats/{chat_id}/discussion/{session_id}/events` (SSE; Redis stream; PG is SoT). OpenAPI Wave B5: `text/event-stream` + `DiscussionEventsStreamSsePayloadDoc` (pilot `desktop.openapi.json`). Solo/Team `POST …/chats/{id}/stream` documents `DesktopAiChatStreamSsePayloadDoc` (same pilot).
- `POST …/raise-hand`, `…/interjections`, `…/continue`, `…/finish`, `…/cancel`
- `POST …/generate-document`

ACL: owner **or accepted member** for start/continue/finish/cancel/document; the same participants may view, raise-hand, interject. Pending/left/revoked still have no chat access (`require_chat_access` → 404). `owner_user_id` on the session is the **chat creator**. Display name, preferred role, and the empty anchor `author_user_id` are the **acting participant** (`ChatAccess.viewer_user_id`).

## Backend layout

- Package: `shared/api/services/desktop_chat_ensemble/discussion/`
- ORM: `DesktopAiDiscussionSession`, `DesktopAiDiscussionTurn` (`models/desktop_ai_chat.py`) — session columns `participant_display_name`, `participant_role_title`
- Migrations: `20260807_01|desktop_ai_discussion` + `20260807_02|desktop_ai_discussion_participant` (partial unique index `idx_desktop_ai_discussion_sessions_active_owner`)
- Celery queue: `desktop_discussion` — task `api.tasks.desktop_discussion_batch.discussion_batch_task`
- Lease reaper: `api.tasks.desktop_discussion_lease_reaper` (maintenance beat every 2 min)
- Worker service: `eliteew-celery-discussion-worker-prod` in `docker/stack/stack0_b.yml` (+ baked/dev-bind overrides)

## Frontend live transport

**SoT:** while session `queued` or `running`, the SPA **subscribes** to `GET …/events` with **authenticated fetch** (`apiFetchWithAuth`, `Accept: text/event-stream`). Native `EventSource` is not used — that API cannot send the OAuth2 Bearer the route requires (`require_oauth2_user`).

Happy path **must not** poll `GET …/discussion/{id}` on an interval. Redis SSE events (`discussion_session`, `council_turn`, pause/segment/document/`error`) trigger a PG GET refresh (PG remains SoT). Keep-alive comments are ignored.

| Condition | Mode |
|-----------|------|
| `queued` \| `running` and SSE healthy | `sse` |
| `queued` \| `running` and Redis/SSE degrade | `poll` fallback (2.5s GET) + honest caption `discussionLiveDegraded` |
| any `paused_*` / `completed` / `cancelled` | `idle` — no SSE, no poll |

Policy: `discussionLiveTransport.ts`. Wire: `discussionSse.ts` + `useDiscussionSession`. Unexpected stream EOF (proxy/server close) is **degrade** — backoff + poll + `discussionLiveDegraded` — not a healthy 250ms reconnect. In-flight GET refresh is dropped if the active chat or session identity changed. SSE retries with backoff while the session stays queued/running so poll can recover to live.

Regression:

```text
pnpm exec vitest run src/features/desktop-ai-chat/discussion
```

Locks: `discussionLiveTransport.test.ts`, `discussionSse.test.ts`, `useDiscussionSession.liveTransport.test.ts`.

## Frontend

- Module: `shared/web/frontend/src/features/desktop-ai-chat/discussion/`
- HTTP: `discussion/api.ts` via `@/services/api/client` (BASE `/api/v1/desktop/ai-chat`); live events via `discussionSse.ts` → `apiFetchWithAuth` (not EventSource)
- Setup sheet + one Discussion bubble (Process | Document) + control bar
- Bubble header **Закрыть панель** (`discussionPanelClose` / `data-testid=discussion-panel-close`) dismisses the Process UI only — local key in `DesktopAiChatAppDiscussionDock` (`closedDiscussionPanelKeys`); **does not** call finish/cancel APIs. **Завершить** / **Отменить** still own the discussion process. Reopen via **Показать дискуссию** (`discussion-panel-reopen`). Lock: `discussion/__tests__/DiscussionBubble.panelClose.test.tsx` + AppView atomization (dock owns the key).
- Focus ring on bubble/setup chrome: import `DESKTOP_CHROME_FOCUS_VISIBLE` from `pages/Desktop/components/DesktopAppChrome` (not from `pages/Desktop/constants` — that barrel does not re-export it).
- Setup panel: opaque dense surface (same `desktop-surface-panel-strong` recipe as Blueprint / chat modals) — not glass/`--desktop-bg-primary`
- Setup is **portaled to `document.body`** with embedded window portal z-index; sticky **Закрыть** + footer **Отмена**; Escape closes
- Portaled surfaces **sync Desktop CSS tokens** from `#desktop-main` via `useSyncDesktopThemeFromMain` (same pattern as GAF library picker) — without this the panel loses typography/surface tokens
- Layout kinship: Blueprint commands modal (icon header, scroll body, footer CTA)
- Empty Discussion **anchor** chat rows (`metadata.desktop_discussion`, empty `content`) are **hidden** from the message list; Process UI is `DiscussionBubble` (hydrated from `discussion_session_id` on chat load)
- Setup is **chat-scoped** (`DiscussionSetupHost` + `useDiscussionSetupChatNav` in compose; **all** `setActiveId` paths use the guarded dispatcher):
  - Header ✕ / Cancel close the sheet for the active chat only
  - Switching to another chat while setup is open is **blocked**; confirm is also portaled **above** the setup sheet (`embeddedModalZ + 20`, not `ConfirmDeleteModal` / ModalAdvanced z≈1400); confirm closes setup then navigates; cancel stays on the current chat with setup open
- On any `paused_*`: interjection composer in the Discussion bubble **and** the main chat composer (send routes to `…/interjections`, not `/stream`)
- Thin wires: `DesktopAiChatAppView` mounts `DesktopAiChatAppDiscussionDock` (Process bubble / reopen) and `DesktopAiChatAppOverlays` (`DiscussionSetupHost`); overflow **⋯ → Начать дискуссию**; blueprint header **Пройти интервью** when the artifact has interview topic/goal
- OpenAPI: paths under `openapi/pilot/desktop.openapi.json` / `src/generated/desktop-openapi.ts` (refresh with stack0 `--refresh-openapi-pilots`)

## Speech generation

- `generate_discussion_speech` default `max_tokens=2048`, hard cap `4096` (2× prior 1024/2048)

## Presets

Catalog (API `GET /discussion/presets`, FE fallback `discussion/presets.ts`; order is `catalog_order`):

| id | User name | Lane |
|----|-----------|------|
| `brainstorm` | Мозговой штурм | Debate among heroes |
| `product_review` | Разбор продукта | Debate |
| `marketing_strategy` | Маркетинговая стратегия | Debate |
| `responsibility_assignment` | Распределение ответственностей | Debate |
| `interview` | **Интервью** | Heroes **interview the participant**; `min_roster=1`; no `rebuttal` between AIs; after a user answer the next relation is a follow-up question (`challenge`/`opening`) |
| `decision` | Принятие решения | Debate toward one next step |
| `negotiation` | Переговоры | Positions / concessions / red lines |

Side-loaded via `presets/__init__.py` → `importlib`. Speech includes `goal_rubric` and optional `relation_hints`. Setup CTA uses the selected preset’s `min_roster` / `max_roster`.

## Ops

| Step | Command / check |
|------|-----------------|
| Migration | `20260807_01` + `20260807_02` in `apply-eliteew-migrations.sh`. Prod: `SELECT version,name FROM schema_migrations WHERE version IN ('20260807_01','20260807_02');` + columns / `idx_desktop_ai_discussion_sessions_active_owner`. |
| Release | From command-center: `bash docker/scripts/eliteew-deploy.sh release stack0 --all --yes --refresh-openapi-pilots`. Worker container: `stack0-eliteew-celery-discussion-worker-prod-baked` (compose must inject `ELASTICSEARCH_EXTERNAL_PORT` + stack1 port block like companion — Celery autodiscover imports `DatabaseConfig`). |
| Smoke | Setup → visible **Закрыть**; switch chat → confirm; start with role → AI labels `Name (role)`; second active discussion on another chat → `409 discussion_already_active_for_account`. Active bubble → **Закрыть панель** (process still live) → **Показать дискуссию**; Finish/Cancel end process. Raise-hand → interjection → Continue → Finish → Document. Active discussion → `POST …/stream` → `409 discussion_active`. |

First prod cutover: migration + baked line **2026-08-07**. Live tag advances with each `release stack0 --all` (e.g. `prod-baked-20260807-0120`); verify via runtime env / `podman ps` / provenance, not a frozen family id.

## Rollback

- Drop tables `desktop_ai_discussion_turns`, `desktop_ai_discussion_sessions`.
- Stop/remove discussion Celery worker; queue can remain unused.
- SPA without Discussion menu is safe if API 404s presets (fallback cards still show; start fails closed).

## Related

- [DESKTOP-LLAMA-CHAT.md](../DESKTOP-LLAMA-CHAT.md)
- Process plan (group surfaces / live SSE gap): `documentation/plans/product/desktop/DESKTOP-AI-CHAT-GROUP-SURFACES-PLAN.md` *[operator-local process plan; gitignored — not living canon]* — supersedes retired Cursor plan `desktop_discussion_mode_4ca4228c` (not in tree)
