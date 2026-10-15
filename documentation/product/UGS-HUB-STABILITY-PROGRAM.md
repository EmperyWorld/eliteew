# UGS Hub stability program (living)

**Updated:** 2026-07-28
**Status:** Historical wave checklist **Done**; this file is the living ops + FE/runtime invariant hub.
**Detail contract:** [ugs_frontend_contract_and_regression_baseline.md](ugs_frontend_contract_and_regression_baseline.md).
**Flow/env:** [UGS-FLOW-AND-CONFIG.md](UGS-FLOW-AND-CONFIG.md).
**Queue ops:** [platform/docker-re_doc/UGS-QUEUE-OPERATIONS-RUNBOOK.md](../platform/docker-re_doc/UGS-QUEUE-OPERATIONS-RUNBOOK.md).

---

## 1. Invariants (do not regress)

| Area | Invariant |
|------|-----------|
| SSE Hub launch | Hub uses `POST /generate/stream` + `runUgsGenerationStream`; compact task poll must not null-wipe richer SSE fields |
| Owner scope | Status/result HTTP maps non-owner to 403 |
| Provider grid | ComfyUI always eligible in status merge; empty provider payload = failed, not completed |
| Queue-ops | Canonical stale keys `pending_orphan` / `pending_in_queue` / `processing` / `total` |
| Detached crash | `finalize_detached_generation_failure` → `error_type=detached_execution_crash` |
| Idempotency | Same user+type+key reuses `request_id` in reusable statuses |
| Billing | `completed` + deduct in one transaction; deduct fail → `billing_failed`, not free complete |
| Worker lease | Redis NX lease; Postgres advisory lock fallback |
| Desktop theme | UGS surfaces use `#desktop-main` tokens — no isolated violet/slate shell |
| Hub tab rail | Non-admin: overview/active/history/results only; `workflows` + `admin_history` require UGS admin (matches API) |
| Hub Overview | Launch + see work only — **no** full queue-ops panel (even for admins) |
| Hub queue snapshot UI | Admin cue = Workflows `UgsHubQueueOpsStrip` → UGS Admin; full panel unit-tested / Admin / API |

---

## 2. Operator smoke checklist

1. `GET /api/v1/ugs/health`
2. `GET /api/v1/ugs/providers/status` — ComfyURL should match living topology when env set
3. Admin: `GET /api/v1/ugs/admin/queue-ops` → `status` + hints
4. Hub: short SSE generation → `completed`
5. Tray: `GET /api/v1/ugs/tasks/tray-summary` updates transitions

Script: `bash docker/scripts/ugs-stack0-smoke.sh`. With `TOKEN` / `UGS_ADMIN_TOKEN`, queue-ops must include `operator_slo`. Optional generate path proof: `TOKEN=… UGS_SMOKE_SSE=1 bash docker/scripts/ugs-stack0-smoke.sh` (SSE `generate/stream` → `event: result`). After stack0 release, run health smoke; for contract proof of generate, set `UGS_SMOKE_SSE=1`.

---

## 3. Architecture notes (post-remediation)

- `WorkflowService` is a thin facade over domain modules under `api/services/ugs/workflow_*.py`.
- **Admin HTTP:** package `api/routers/ugs_admin/` (`register_*_routes`, same pattern as `routers/ugs/`); mount unchanged via `from api.routers.ugs_admin import router`.
- **Billing:** `billing_service.BillingService` thin facade — typed mixin chain `LimitsMixin → StatsMixin → CreditsMixin` (+ `PackagesMixin`); `completed` + deduct are one transaction (`deduct_credits_without_commit`).
- **Queue:** `QueueManagerService` inherits `QueueStaleReconciliationMixin` (`queue_stale_reconciliation.py`); enqueue/stats stay on the parent. Queue-ops snapshot includes derived `operator_slo` (oldest age + failed share) for Hub metrics. FE types come from the UGS OpenAPI pilot (`UGSQueueOpsOperatorSlo` → `schemas.ts` / `queueOps.ts`) — no hand-rolled SLO overlay.
- **Direct execution:** facade `direct_generation_execution.py` + `direct_generation_{payload,execute,errors,finalize}.py`.
- **ComfyUI provider execution:** `provider_execution_comfyui.py` (URL/health/fetch + thin dispatch) + `provider_execution_comfyui_media.py` (image/video/image_studio/generic image) + `provider_execution_comfyui_music.py` (ACE/DiffRhythm/m2m audio); mixin import path via `provider_manager_service_v2` unchanged.
- **Text provider execution:** `provider_execution_text.py` (Llama text/chat + thin mixin) + `provider_execution_text_media.py` (document analysis helpers + Faster-Whisper STT); mixin method names unchanged on `ProviderExecutionTextMixin`.
- **Submit path:** thin `generation_submit.GenerationSubmitMixin` + `generation_submit_helpers.py` (idempotency/cache/queue publish/wait); import path `from api.services.ugs.generation_submit import GenerationSubmitMixin` unchanged.
- **IMC RAG:** facade `providers/imc_rag_research_provider.py` + `imc_rag_{markdown,prompts,llama_client,orchestration}.py` + `imc_rag_orchestrate_{helpers,pipeline}.py` (orchestration re-exports keep test import paths).
- **Admin FE bulk modal:** `ProvidersBulkEditModal` shell + `providersBulkEditUtils` / `useProvidersBulkEditState` / `ProvidersBulkEditForm`.
- **Admin UI:** UGS Admin v2 is the only operator console (Unified Admin `ugsV2` + desktop `ugs-admin`). Legacy card UI removed; granular `/api/v1/ugs/admin/*` retained for Users + aux (`bootstrap-runtime`, `llama-models`).

---

## 4. Mobile surface decision

| Surface | Platform |
|---------|----------|
| UGS Hub, Dashboard, Admin, Workflow Builder | **Desktop** (EliteEW SPA) |
| Mobile | Chat / IME / related Android surfaces only — **no** full Hub/Admin port in current program |

See [mobile/ANDROID-UGS-AI-CHAT-IME-AND-NAV.md](mobile/ANDROID-UGS-AI-CHAT-IME-AND-NAV.md).

---

## 5. Related tests

- API: `test_ugs_*` (queue, openapi, openwebui, health, admin_v2, …)
- FE: `src/services/api/ugs/__tests__` (incl. `queueOpsOperatorSlo.contract.test.ts`), Hub queue-snapshot widgets (strip + isolated panel), generation form-first modal, admin-v2 guardrails

---

## 6. Hub premium UX (Overview / generation / i18n)

| Surface | Contract |
|---------|----------|
| **Overview** | User job: launch + see work. No operator queue console / full queue-ops panel. |
| **Shell header** | Secondary Analytics link (`ugs-analytics`); no Dashboard CTA. Degraded providers → Admin shortcut. |
| **Quick Launch** | Type tiles only; no «all types» navigate-away to Dashboard. |
| **Workflows (admin)** | Compact `UgsHubQueueOpsStrip` — Hub ops cue; opens UGS Admin. |
| **Generation modal** | Form-first: prompt textarea primary; JSON / priority / `type_key` under «Дополнительно» / Advanced. |
| **i18n** | Namespace `ugsHub` (RU/EN) for shell, tabs, tabBar, taskRow, taskFilters, pagination, loading, panels, toolbar, status/category, result/tariff modals, **`toast.*`** (Hub hooks toasts/confirms), **`csvExport.*`** (task CSV headers), workflows toolbar/list/cards/quick*/builder*/toasts/helpers, stats, overview, quickLaunch, generation, queue-snapshot, **`generationDefaults.*`** (quick-launch sample payloads via `buildDefaultPayload(t, type)`), **`result.vttFallbackCue`** + **`result.captionsTrackLabel`** (Hub audio result placeholder WebVTT wired into `InlineAudioPreview` / `AuthenticatedAudioPreview` via `buildUgsHubAudioPlaceholderCaptionsVtt(t)`). Builder editor: `workflowBuilder.floating.*` (panel chrome), `workflowBuilder.nodeConfig.*` (node config form), `workflowBuilder.types.*` / `workflowBuilder.utility.*` (generation + utility node labels on palette/cards/badge), `workflowBuilder.templates.<key>.name|description` (12 starter template catalog labels via `workflowTemplateLabel` / `workflowTemplateDescription`), and `workflowBuilder.templateNodes.*` (52 custom starter-graph node/field titles via `templateNodeLabel` / `resolveTemplateNodeLabel`; EN stored in templates, RU/EN at render). |
