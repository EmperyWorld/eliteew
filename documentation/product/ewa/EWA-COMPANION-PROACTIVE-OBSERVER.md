# EWA companion proactive observer

Source contract review: 2026-10-11. The SPA initiates HTTP observation ticks and renders a separate hint above the chat transcript. The observer records context and suggests ordinary chat prompts; it does not autonomously dispatch desktop actions. [HCM](EWA-COMPANION-HCM-MEMORY.md), [protocol review](EWA-COMPANION-PROACTIVE-PROTOCOL.md), [content-hint policy](EWA-OBSERVER-CONTENT-HINTS-SAFETY.md) and [automation policy](EWA-COMPANION-PROACTIVE-AUTOMATION.md) define related boundaries.

## HTTP input, response and errors

`POST /api/v1/ewa/companion-observation` uses [router](../../../shared/api/ewa_platform/gateways/routers/companion_chat.py) and [models](../../../shared/api/ewa_platform/schemas/pydantic/companion_observation.py). It requires `require_oauth2_user`; principal is the authenticated user's id, not a caller-selectable body field.

Request:

```json
{"trigger":"active_app_changed","observation":{"app_component":"DocEditor","window_id":"doc-1","title":"notes.md","open_windows_count":2},"shell_context":null}
```

- Required `trigger`: string length 1–64, not a Pydantic enum. `observation`: arbitrary JSON-compatible map, default empty. `shell_context`: optional typed [CompanionShellContextIn](../../../shared/api/ewa_platform/schemas/pydantic/companion_chat.py), default null.
- Composer recognizes `focus_change`, `window_opened`, `window_closed`, `workspace_switched`, `active_app_changed`, `idle`, `manual_tick` after trimming/lowercasing. Unknown strings still pass request validation; anticipation returns no hint/episode, while other router stages may still run.
- Normalization uses the shared shell helper for anticipation; app/window/title prefer the observation then active-window data. Weak non-idle/non-manual payload only produces an INFO marker, not a mandatory rejection.

Successful 200 shape:

```json
{"ok":true,"accepted":true,"hint":null,"episode_recorded":false,"presence":{"mode":"chat","continuity_applied":false,"hint_suppressed_reason":null}}
```

`hint`, when present: string kind/text, related-episode string array, optional arbitrary suggested-action map. `presence`: mode, continuity-applied flag and nullable suppress reason. These model fields do not enforce a universal 400-character hint bound; anticipation and soft-initiative builders implement their own truncation. Protocol-review questions have their own templates.

`accepted:true` means the router passed its limiter/profile boundary; it does **not** prove PG episode insertion. `episode_recorded:true` means insertion produced a row, not that vector indexing succeeded. Rate-limited requests return 200 with `ok:true`, `accepted:false`, no hint, false episode flag and null presence. The internal retry-after value is logged, not returned as a 429/header contract here.

Pool absent → structured EWA 503, checked before rate limiting. A request that passes the limiter then finds no profile → 404 `companion_profile_not_initialized`; an exhausted bucket can return 200 before that profile read. Invalid body/model fields → 422. Shared auth determines missing/invalid-token behavior. Initial profile-fetch errors are not generically converted into a successful empty hint; best-effort insert/recall catches apply later.

## Processing and cost

1. Check pool, principal and process-local token bucket; fetch profile.
2. Derive presence; optionally decay/persist continuity.
3. Build anticipation: normalize shell, best-effort insert episode, compose memory window and template copy, optional plan-task suffix/action.
4. Apply contemplation suppression, or soft-initiative rewrite/budget.
5. Optionally build deterministic proactive review, with its priority rules; return typed response.

[Anticipation composer](../../../shared/api/ewa_platform/companion/persona/anticipation.py) creates an observation episode with random UUID, `kind: observation`, `source: proactive_observer`, importance 0.35, valence 0.55, current seed, null turn id and extra trigger/window/app. Body is `observation:<trigger> app=<...> title=<...>` truncated to 320 characters. Importance is currently fixed, not derived from trigger. Insert failure is caught and leaves `episode_recorded:false`.

After insertion it schedules [single-row re-embedding](../../../shared/api/ewa_platform/companion/episodic/reembed.py) using the running event loop. This is best-effort in-process work, not a durable Celery job. The normal pending backlog is a separate recovery path. The episode can be recorded even if the eventual hint is suppressed.

Recall calls the shared [memory composer](../../../shared/api/ewa_platform/companion/memory/retrieval.py) with episodic top-k 8. Query includes trigger/app/title and active-desktop/workspace labels. Returned memory bullets are filtered/humanized, capped at three and truncated to 240 characters. Anticipation copy is persona/character dependent and bounded to 400 characters. HCM off short-circuits to legacy/profile/story memory rather than guaranteeing an empty sidebar. Idle is suppressed for a newly initialized profile only when there are no normalized open windows, no profile memory and revision <=1; established profiles can still receive idle hints without a shell snapshot.

There is no full chat-turn completion call, transcript append or observation SSE stream. However, shared recall may call embedding, Qdrant and an optional cross-encoder `/v1/rerank` scoring endpoint; re-embedding runs separately. It is not a guaranteed one-insert/one-embedding cost. Retrieval timers do not bound all PG/profile/plan operations. No separate server polling timer is introduced by this endpoint.

## Presence, continuity and soft initiative

[Presence helpers](../../../shared/api/ewa_platform/companion/ux/presence_mode.py) read `learned_preferences.companion_presence_v1` (mapping mode or legacy string), normalize to chat/contemplation and activate server silence only with `EWA_COMPANION_CONTEMPLATION_ENABLED` (default 0). `presence.mode` reflects stored mode even when that flag is off. With contemplation active, final hint is null and suppress reason contemplation; episode/recall work has already occurred.

[Continuity](EWA-COMPANION-EVOLUTION-CANON.md#l0b--continuity-micro-state) uses its own default-off flag. The router attempts a shallow profile patch when decay changes state; exceptions are logged and clear `continuity_applied`. Otherwise the flag can be true for a non-neutral tint or absolute valence >=0.05. This is not a revision/transaction-completion receipt.

[Soft initiative](../../../shared/api/ewa_platform/companion/proactive/soft_initiative.py) defaults off and uses `companion_soft_initiative_v1` day/count/last-hint/snooze state. Source daily cap 3 (0–24), minimum gap 45 minutes (0–1440). Enabled successful anticipation is rewritten in partner tone, kind soft_initiative, and returns updated budget state for a best-effort profile patch. Exceptions in that patch are logged while the hint can still be returned; no atomic shared quota claim exists.

Budget, min-gap or snooze denial sets the router's common suppress reason `soft_initiative_budget`, without returning the helper's finer reason. Contemplation prevents later proactive review. Soft budget denial does **not** prevent later deterministic proactive review: risk/gap/follow-up can replace an anticipation hint, and any review suggestion can populate an empty hint. The resulting presence suppress reason can remain set alongside a review hint. Server soft snooze is not a universal review-engine snooze; local UI snooze hides returned hints separately.

Current clock defect: state normalization/emission uses local `date.today()` despite an injected `now`; it is not guaranteed to be the UTC day or the supplied instant's day. Three existing tests fail at the present date: [DOC-CODE-023](../../../docs/CODE_ISSUES.md#doc-code-023--soft-initiative-day-calculation-ignores-the-injected-clock).

Review uses profile/shell and trigger observation; it does not load active/completed task runs. Its missing shown/dismissed persistence and naive timestamp defects are documented in the [protocol reference](EWA-COMPANION-PROACTIVE-PROTOCOL.md). Anticipation suggested actions use `type: suggest_chat_prompt` plus prompt text; review uses `kind: proactive_review` plus quick replies and serialized suggestion. These maps are different shapes, both handled by the client.

## Rate limiting and client pacing

[Limiter](../../../shared/api/ewa_platform/companion/ux/observation_rate_limit.py): principal-keyed token buckets within one process. Source cap 120/minute, clamp 20–480, burst equals allowance. `EWA_COMPANION_OBSERVATION_RATE_LIMIT_DISABLED` truthy skips it. Singleton cap is read at creation; updating settings does not recreate an already-instantiated limiter. Workers/replicas do not share buckets.

[SPA constants](../../../shared/web/frontend/src/features/ewa/companionObservationConstants.ts) currently specify **10,000 ms poll**, **8,000 ms minimum request gap**, **45,000 ms idle threshold**. The old 7/5/30-second documentation was stale. Hook options can override these defaults; this is client pacing, not server enforcement.

[Tick hook](../../../shared/web/frontend/src/features/ewa/useEwaCompanionAnticipationTick.ts):

- Needs enabled state, principal and a shell bridge snapshot. Skips hidden documents and concurrent in-flight ticks. A visibility change triggers a tick when visible; initial mount uses the interval rather than an immediate unconditional request.
- Reads active app/window/title, window count and active desktop; supports old synthetic snapshot shape. Trigger priority: initial active app/open windows, workspace change, app change, focus change, count increase/decrease, then idle after recorded pointer/key interaction. A title-only change does not have its own trigger, and idle can repeat after the threshold.
- Checks [local trigger preferences](../../../shared/web/frontend/src/features/ewa/companionObservationTriggerPrefs.ts) and request gap. Those preferences are cached/mirrored through the user-workflow API, not an authorization check enforced by the observation handler.
- Updates last key/request time before POST. Success stores returned hint (including null), unless local silence/snooze hides it. Failure logs degradation and can leave the prior hint visible; unchanged activity is not automatically retried as a distinct delta. Dismiss clears local hint; a later server hint can replace it.

[Local snooze](../../../shared/web/frontend/src/features/ewa/companionUx/companionProactiveSnoozeStorage.ts) expires at the end of the browser's local day. [Protocol wrapper](../../../shared/web/frontend/src/features/ewa/companionUx/CompanionProtocolStrips.tsx) best-effort mirrors soft snooze to the profile. Contemplation control PATCHes presence with optimistic revision; UI silence can apply independently of whether the server feature flag activates it. Clicking a hint chip sends an ordinary chat prompt, which can then append transcript and execute its separately authorized workflow.

## Verification and extensions

Existing nine-file prompt/ledger/truth/review/anticipation/presence/soft/rate/preference suite: **42 passed, 3 failed**. All failures are injected-clock/day soft tests; no code/test change was made to force acceptance. Episodic rerank was disabled in this bounded run; mocks replaced storage/recall. Five frontend hint/tick/protocol suites: **14 passed**, mocked API/browser state. An initial Vitest invocation rejected the obsolete minWorkers option; the supported one-worker invocation passed. No production browser timing, model/vector load or live HTTP/PG was measured.

To reproduce the bounded backend check from the repository root with existing dependencies:

```bash
EWA_COMPANION_EPISODIC_RERANK_ENABLED=0 PYTHONPATH=shared .venv/bin/python -m pytest shared/api/tests/test_ewa_companion_prompt_blocks.py shared/api/tests/test_ewa_companion_execution_ledger.py shared/api/tests/test_ewa_companion_truth_guards.py shared/api/tests/test_ewa_companion_proactive_review.py shared/api/tests/test_ewa_companion_anticipation.py shared/api/tests/test_ewa_companion_presence_mode.py shared/api/tests/test_ewa_companion_soft_initiative.py shared/api/tests/test_companion_observation_rate_limit.py shared/api/tests/test_companion_observation_trigger_prefs.py -q -o cache_dir=/tmp/eliteew-documentation-pytest
```

A future event transport, richer content-derived hint, distributed quota or autonomous action requires explicit design/source evidence. Current transport remains HTTP ticks; historical realtime/Cause roadmap documents under trash are not implemented guarantees. Topology/log collection belongs to [the topology source of truth](../../platform/PRODUCTION-TOPOLOGY-STATE.md), not a duplicated host table here.
