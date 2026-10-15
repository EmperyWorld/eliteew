# Desktop orchestration: model, policy and execution

Explanation · checked against source on 2026-10-11. This flow belongs to [core/orchestrator.py](../core/orchestrator.py), not companion chat's tool loop. It proposes at most one desktop intent per turn.

## Turn order

1. Read the session snapshot, increment `turns`, set `last_observation_kind`, append an `observation` event and optional `companion_context` metadata event.
2. Collect configured UGS/documents/content hints concurrently. Documents/content share one per-turn shell-state HTTP cache. Their values are normalized before the `domain_hints` event. An optional driver exception becomes a degraded hint containing the exception type; it does not abort the turn.
3. Derive a narrow heuristic: active-app change suggests `focus_window`; cancellation, snapshots and failure observations otherwise suggest nothing.
4. Always call `ctx.llm.complete('orch_turn_v1', variables=...)`. Variables contain observation, heuristic, hints or null, and optional truncated `companion_wire`. The default [StubLlmClient](../llm/client.py) returns `stub`; the HTTP client is opt-in.
5. [Parse a model intent](../llm/intent_proposal.py) from JSON/fenced JSON. A runtime-wellformed model intent wins. Absent, null or malformed model intent falls back to the heuristic; it does not necessarily suppress the heuristic. Even a cancellation observation can be followed by a valid model intent.
6. Evaluate the selected mapping through `ctx.policy`. Denial appends `policy_denied`, saves `last_branch: policy_denied`, and skips the driver. No selected intent saves `last_branch: no_intent`.
7. On allow, call `execute_intent`, append its mapping as `intent_result`, and save `last_branch: intent_executed` plus `last_intent_kind`.

`intent_executed` means the driver call completed, not that `result.ok` is true. Unsupported HTTP intents and transport failures can return a negative result under that branch. An uncaught model/driver exception can interrupt the turn after journal writes; the complete turn is not one atomic transaction.

## BasicDesktopPolicyEngine

[The engine](../policy/engine.py) requires the [minimum intent shape](INTENT-CATALOG.md), then:

- focus/close/shell patch/desktop config patch: allow;
- open app: allow only when the component is in the engine allowlist;
- deep link: allow only with role `orchestration_deep_link` in `PolicyContext.role_names`;
- other kinds: deny.

[HTTP composition](../desktop/runtime.py) builds role names from the user's single `role` field and reads `EWA_DESKTOP_ORCH_APP_ALLOWLIST`. It does not populate a complete Keycloak realm-role set here. `StubPolicyEngine` denies all; `AllowAllPolicyEngine` is a development implementation. A policy verdict is not a check of orchestration session ownership; see DOC-CODE-009 in [the issue log](../../../../docs/CODE_ISSUES.md).

## Model and telemetry

`EWA_ORCH_USE_HTTP_LLM` selects [HttpOrchestrationLlmClient](../llm/http_orch_llm.py); `EWA_ORCH_LLM_MODEL` overrides the configured default model. Tool schemas are prompt sketches, not automatically invoked tools. Context slimming/logging is implemented in [context_budget.py](../llm/context_budget.py). The client splits the serialized tool sketch by Python character positions, while telemetry measures UTF-8 byte lengths; these are different units.

The orchestrator logs `[STEP] ewa_desktop_orch_timing` with total/hint/model/execute milliseconds and branch. These timers do not prove successful external mutations. The policy sees the final intent mapping, not the raw completion text, and is applied after model/heuristic selection.

Related: [HTTP/persistence reference](DESKTOP-ORCHESTRATION.md), [driver boundaries](DRIVERS-ROADMAP.md), [module norms](../GOALS-AND-NORMS.md).
