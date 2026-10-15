# Desktop Ensemble Actions (Wave 1 + Wave 2)

Mid-turn **read-only research probes** inside Ассистент **blueprint** ensemble — so heroes do not only *write* a research plan; the turn can *run* bounded web / RAG / vault / KBSEW checks and inject findings into later steps.

Not Assistant agentic DAG. Not solo `run_tool_loop` inside every hero. Not marketing AMKA.

## Problem / cause

Blueprint `stream_turn` was a markdown pipeline: template → hero steps → assemble → finalizer. Context (RAG/vault/KBSEW prefetch + one-shot web) was gathered **once** before heroes. Wave 1 packs existed, but the planner seeded queries from **user text / rp1 heuristics**, not from an agent decision after uncertainty — heroes could invent facts without choosing tools.

## Scope

| In | Out |
|----|-----|
| `research_plan_v1` → pack **after** `rp1` (Wave 1+2) | Full per-hero OpenAI tool loop on every council turn (v1) |
| `code_architecture_audit_v1` → pack **after** `caa2` inventory (Wave 2) | UGS image, file writes, desktop automation |
| Analysis / hypothesis / explicit «проверь в сети\|доках\|файлах» → **pre_step** | Arbitrary remote MCP marketplace |
| **User-armed web** (`use_web_search` + admin gate → `capabilities.web`) → **pre_step** — no trigger phrase required | Writing files / shell from research pack |
| Agent-decided JSON sidecar when draft/gaps present; heuristic fallback on miss | Confusing Desktop ensemble with EWA `task_run` |
| Shared Research Tool Surface (`research_tools` + MCP `research` server) | |

**Kill-switch:** `desktop_ai_chat_config.defaults.ensemble_actions_enabled` — default **on**; `false` / `0` / `off` → mode `skip`, `skipped_reason=disabled` (SSE `ensemble_action_done` with `ran: false`).

## Wave 2 — agent-decided research (primary product fix)

1. After `rp1` / `caa2` (or pre_step), planner calls a short JSON sidecar: `{need_tools, actions[{kind,query,reason}], abstain_reason}` with input = **hero draft + gaps + capabilities**, not raw user-text seeds alone.
2. Execution still goes through `run_action_pack` + existing runners + `ensemble_action_*` SSE.
3. Finalizer honesty: claim «нашли в сети/коде» (or EN equivalents) **without** a citation → `ungrounded_research_claim`; web registry (`W*`) without any `【W…】` in body → `web_citation_missing`.
4. **Grounding (Cause):** if registry has `W*` and the assembled body cites **none**, finalizer appends a deterministic `## Evidence` block (titles/URLs from registry only + `【Wn】`) **before** honesty gates — no sentence-level invent. Repair may attach citation IDs **only** from `allowed_sources` when `*_citation_missing`; still bans new IDs/facts.
5. Sidecar miss / empty parse → heuristic `query_planner` fallback; `need_tools=false` without web capability → honest empty pack; **with** `capabilities.web` → still inject ≥1 web probe (`ensure_web_when_armed`).
6. Findings inject is citation-clean: RAG/vault dump headers (`[source=…]`, `score=`, `content_id`, RAG intro) are stripped in `actions/merge.py` so models do not echo `raw_source_label` / `raw_rag_marker`.

Canonical path: `actions/agent_planner.py` → `orchestrate.py` → `runners/dispatch.py` → `artifact_finalizer.ensure_web_evidence_section`.

## Shared Research Tool Surface

| Tool | Backend reuse | Surface |
|------|---------------|---------|
| `web_search` | ensemble web runner / `run_web_search_with_sources` | Desktop (+ EWA via `mcp_call` with context) |
| `chat_rag_search` | chat RAG runner | Desktop |
| `project_vault_search` | vault RAG + ACL | Desktop |
| `kbsew_*` | MCP `kbsew_native` | Desktop + EWA |

MCP Host default allowlist: `kbsew` + `research` (`research_native`). Code: `api/services/research_tools/`, `mcp_host/transports/research_native.py`.

## Trigger

1. Template `research_plan_v1` / artifact `research_plan` → mode `after_rp1`.
2. Template `code_architecture_audit_v1` / artifact `code_architecture_audit` → mode `after_caa2`.
3. Else if **user armed web search** (`capabilities.web`) → mode `pre_step`. Toggle implies use; trigger words like «найди в сети» are optional wording, not a gate.
4. Else if analysis/hypothesis **or** explicit verify-in-web/docs/files heuristics → mode `pre_step`.
5. Else → `skip` with `not_in_scope` — **no** action SSE (metadata not written for this skip).
6. If capabilities empty → `skip` with `no_capabilities` (honest metadata + SSE `ensemble_action_done` `ran: false` — never fake «искали»).

**Planner:** when `capabilities.web`, the pack always includes ≥1 `web` action (`ensure_web_when_armed`), even if the sidecar abstains or only plans `chat_rag`.

**Empty chat RAG (Cause):** if turn prefetch already set `rag_ctx.chat_rag_chunks == 0`, `blueprint_hook` disables `capabilities.chat_rag` via `capabilities_without_empty_chat_rag` before planning — do not re-probe the same empty index after `rp1` (avoids false `ensemble_actions_ungrounded` WARNING). Empty-only ungrounded packs log at **INFO**; WARNING only when `error_count > 0`.

**Routing:** short substantive messages with web armed do **not** hard-fall to `heuristic_legacy` (Wave 2 packs only run on blueprint). Pure brief acknowledgements («ок»/«да») stay `legacy` even with web armed. Explicit «найди/проверь в сети» → `blueprint`. Web-armed research/world-practice intent prefers template `research_plan_v1` — including RU imperatives («исследуй»/«изучи»), not only noun stem «исследован»; long `it_ui_states_v1` phrases must not win on specificity alone when research bias or research_plan keywords match.

**Finalizer:** registry has `W*` sources but body cites none → deterministic `## Evidence` append, then re-validate (gate `web_citation_missing` remains for raw validate). Bare product term «RAG» is not `raw_rag_marker` (dump styles only). Repair prompt allows existing `allowed_sources` IDs on `*_citation_missing`.

## Package layout

```text
shared/api/services/desktop_chat_ensemble/actions/
  types.py, capability.py, gate.py, query_planner.py, agent_planner.py, budget.py
  merge.py, stream_emit.py, orchestrate.py, blueprint_hook.py
  runners/{web,project_rag,kbsew,dispatch}.py
shared/api/services/research_tools/   # shared surface
```

Hook: `blueprint/stream_step_loop.py` (action pack + gate after `ensemble_plan`; facade `blueprint/stream_turn.py`). Helper: `blueprint_hook.stream_action_pack_phase`.

## Budget (`budget.py`)

| Cap | Value |
|-----|-------|
| Actions per pack | `MAX_ACTIONS_PER_PACK = 4` |
| Web | ≤ `MAX_WEB_ACTIONS = 2` |
| chat_rag + project_vault combined | ≤ `MAX_RAG_ACTIONS = 2` |
| KBSEW | ≤ `MAX_KBSEW_ACTIONS = 1` |
| Findings inject | `MAX_FINDINGS_CHARS = 6000` |
| Per-result detail | `MAX_RESULT_DETAIL_CHARS = 2400` |
| Per-action timeout | `ACTION_TIMEOUT_SEC = 45` |

Empty / error per action → honest row; pack continues; no fabricated facts.

## SSE (ensemble)

| Event | Payload (high level) |
|-------|----------------------|
| `ensemble_action_start` | `mode`, `total`, `actions[]` |
| `ensemble_action_progress` | `action_id`, `kind`, `index`, `total`, `status`, `summary` |
| `ensemble_action_done` | `ran`, `mode`, `skipped_reason?`, `results_summary[]`, `citation_ids[]` |

SPA: `streamEventHandlers.ts` → composer hint (`hintEnsembleActions*`). Keep-alive comments still apply during long probes.

## Metadata

Assistant message may include:

```json
"ensemble_actions": {
  "ran": true,
  "mode": "after_rp1",
  "skipped_reason": null,
  "results_summary": [{"action_id": "…", "kind": "web", "status": "ok"}],
  "citation_ids": ["W3", "P2"]
}
```

Merged sources land in `context_summary` / evidence ledger like other public `context_sources`.

## Failure / edge-case matrix

| Axis | Contract |
|------|----------|
| Offline / tool fail | Per-action `error`; pack continues; document notes gaps |
| Dual-flag | `use_web_search=false` → no web actions even if planner wants them |
| Permission | Same gates as solo tools + project RAG ACL; KBSEW/web default deny without admin/config |
| Regression | `tests/test_desktop_chat_ensemble_actions.py`; `tests/test_mcp_host.py` (research server); FE `streamEventHandlers.ensembleActions.test.ts` |

## Operator smoke

1. Ensemble chat: «не знаю X — найди в сети/доках» (arm **Веб-поиск** for web).
2. During stream: `ensemble_action_progress` + composer hint.
3. Final artifact: citations in Evidence; metadata `ensemble_actions.ran`; no claim «нашли в сети» without citation when capabilities off → skip / `no_capabilities`.

## Solo Desktop (Wave 3)

`run_tool_loop`: up to **3** tool rounds; factual asks get one refuse-to-invent nudge if tools were unused. Same Research tools via native registry + `mcp_call` (`server_id=research|kbsew`).

## Assistant (Wave 4)

Same MCP Host (`mcp_list` / `mcp_call`); research tools available when host enabled. Do **not** route companion `task_run` / WorkflowRuntimeKind through Desktop ensemble packs.

## Related

- Hub: [DESKTOP-LLAMA-CHAT.md](DESKTOP-LLAMA-CHAT.md) (blueprint architecture + SSE list)
- MCP Host: [ELITEEW-MCP-HOST-AND-SERVERS.md](../platform/ELITEEW-MCP-HOST-AND-SERVERS.md)
- Templates: [DESKTOP-ENSEMBLE-PLAN-AUTHORING.md](DESKTOP-ENSEMBLE-PLAN-AUTHORING.md)
- Code: `shared/api/services/desktop_chat_ensemble/actions/`
- FE: `shared/web/frontend/src/features/desktop-ai-chat/hooks/desktopAiChatStream/streamEventHandlers.ts`

## Non-goals (still out of v1)

- Per-hero full tool-router sidecar in ensemble
- Executable steps for all 18 templates
- Writing files, UGS from council, EWA agentic substrate via Desktop Chat
