# UGS Frontend Contract And Regression Baseline

## Purpose

Living frontend contract for UGS Hub, workflows, realtime handling, and desktop
deep links. Use this (plus [UGS-DESKTOP-SHELL.md](./desktop/UGS-DESKTOP-SHELL.md)
and [UGS-FLOW-AND-CONFIG.md](./UGS-FLOW-AND-CONFIG.md)) as the product entry —
not historical wave logs or release checklist stubs (soft-retired → `trash/`).

It is intentionally short and operational: future refactors must stay
judgeable against this known-good behavior baseline.

## Current Surface Map

### Primary surfaces

- `web/frontend/src/components/UGSHub.tsx`
  Hub orchestrator: tabs, filters, modals, quick launch, provider health. Result parsing / generation modal / task actions delegated to `components/UGS/hub/*` and `hooks/ugsHub/*`.
- `web/frontend/src/components/UGS/hub/results/*`
  Result payload parsing, unified-content previews, `UgsHubResultContent`.
- `web/frontend/src/components/UGS/hub/generation/*`
  Default payloads and `UgsHubGenerationModal`.
- `web/frontend/src/hooks/ugsHub/*`
  `useUgsHubTasksFeed`, `useUgsHubTaskActions`, `useUgsHubTabItems`.
- `web/frontend/src/hooks/ugsHub/useUgsHubController.ts`
- `web/frontend/src/hooks/ugsHub/useUgsHubGeneration.ts`
- `web/frontend/src/hooks/ugsHub/ugsHubClient.ts`
- `web/frontend/src/components/UGS/hub/shell/UgsHubTabPanels.tsx`
- `web/frontend/src/components/UGS/hub/shell/UgsHubModals.tsx`
  Header, stats, quick launch, tab bar, tasks toolbar, result/tariff modals, loading state.
- `web/frontend/src/services/api/ugs/ugsHubTasksPolling.ts` — shared adaptive poll intervals
- `web/frontend/src/hooks/ugsHub/useUgsHubActiveStreamPollState.ts`
- `web/frontend/src/hooks/ugsHub/useUgsHubDocumentVisible.ts`
- `web/frontend/src/components/UGS/hub/useUgsHubFilterMetadata.ts`
- `web/frontend/src/components/UGS/hub/shell/UgsHubFiltersSection.tsx`
  TTL cache for `/result/:id` fetches in Hub modal.
- `web/frontend/src/hooks/ugsHub/useUgsHubTabItems.ts`
  Tab rail: `workflows` + `admin_history` only when `showUgsAdminLink` (non-admin never sees dead Workflow tab).
- `web/frontend/src/components/UGS/UGSWorkflowsTab.tsx`
  Thin Workflows tab shell (loading + compose toolbar/list/QuickExecute).
- `web/frontend/src/components/UGS/workflows/useUgsWorkflowsTabController.ts`
  React Query, filters, execute/duplicate/export/import/delete handlers.
- `web/frontend/src/components/UGS/workflows/ugsWorkflowsFilterUtils.ts`
  Pure filter/sort/project helpers (Vitest: `workflows/__tests__/ugsWorkflowsFilterUtils.test.ts`).
- `web/frontend/src/pages/Desktop/components/UGSDesktopContainer.tsx`
  Desktop shell surface for Hub, Dashboard, Analytics, Admin, Builder.
- `web/frontend/src/features/ugs/shared/ugsDesktopUi.ts`
  Shared desktop-shell Tailwind tokens for all UGS surfaces (forms, tables, badges, workspace KPI tiles, queue-ops and workflow execution status).
- `web/frontend/src/components/UGS/hub/ugsHubThemeTokens.ts`
  Hub-specific filter chips, progress bars, meta badges (extracted from `ugsHubSharedUi`).
- `web/frontend/src/components/UGS/workspace/*`
  Dashboard/Analytics chrome: `UgsWorkspaceShell`, `UgsMetricCard`, `UgsWorkspaceLoading`, `ugsAnalyticsData.ts`.
- `web/frontend/src/features/ugs/admin-v2/ugsAdminV2Ui.tsx`
  Admin v2 section/table/search helpers on desktop tokens.
- Workflow Builder frontend shell retired on 2026-07-28; previous token owner moved to soft-retired under `trash/` (id 20260728-135649).
- `web/frontend/src/components/UltimateDocEditor/store/editorStore.ts`
  Embedded UGS consumer using streamed image generation.
- `web/frontend/src/features/ugs/admin-v2/UGSAdminV2Panel.tsx`
  **Canonical UGS Admin UI** (Unified Admin section `ugsV2` + desktop `ugs-admin`).
  Card-based `features/ugs/admin/` was removed. Snapshot tables, bulk validation,
  and safe bulk enable/disable/patch for providers, types, workflows, and
  DB-backed model routing. Granular `/api/v1/ugs/admin/*` CRUD remains for
  Admin Users ops and aux calls (`llama-models`, `bootstrap-runtime`).

### Shared data / realtime primitives

- `web/frontend/src/services/api/ugs/dashboard.ts`
  Read models for tasks, stats, types, providers, analytics.
- `web/frontend/src/services/api/ugs/stream.ts`
  SSE parser and callbacks for streamed UGS generation.
- `web/frontend/src/hooks/api/useUgsDashboard.ts`
  React Query polling baseline for Hub task/stats/provider views.
- `web/frontend/src/hooks/api/useUgsTasks.ts`
  Per-task status/result queries for targeted polling.
- `web/frontend/src/services/api/ugs/queryKeys.ts`
  Shared React Query key contract for UGS data consumers.
- `web/frontend/src/services/api/ugs/taskRealtime.ts`
  Shared task patch contract for stream payload -> task cache merge.

## Admin v2 Routing/Auth/Bulk Contract

As of 2026-05-06, UGS Admin v2 and runtime share the same DB-backed model routing
contract:

- Model resolution order is
  `type_overrides -> domain_defaults -> category_defaults -> provider_defaults -> generation_providers.config_json.default_model -> model_routes.global_default_model -> env fallback`.
- Runtime passes `generation_types.category` into the resolver; Admin v2
  `resolved_models_by_type` must match the same category-aware route preview.
- `model_routes.patch` is partial. For scoped maps (`provider_defaults`,
  `category_defaults`, `domain_defaults`, `type_overrides`), `null` or blank
  values delete that scoped route. `model_routes.replace` remains the full
  replacement operation.
- Provider-level `config_json.default_model` / `config_json.models` are allowed
  only for `provider_type` `llama`, `llama`, or `miso`. Existing legacy fields
  on other providers are surfaced as warnings with an autofix cleanup operation;
  backend validation rejects new raw `config_json` writes that try to introduce
  those fields again.
- The provider bulk action "apply model to all provider types" writes a
  provider default plus `type_overrides` for every current type of that provider,
  so it wins over domain/category routes instead of silently changing only a
  low-priority provider default.
- SPA Unified Admin / desktop admin entry visibility is **role-only**
  (`admin`, `emperyworld_admin`) via `ugsAdminAccess.ts` — same role set as
  `require_admin_user`. Env `UGS_ADMIN_EMAILS` is **API break-glass only** for
  `require_ugs_admin_user` and is **never** mirrored in the FE. Keycloak
  realm-management roles such as `realm-admin` do not grant product-admin
  access by themselves.
- `/api/v1/ugs/admin/v2/bulk` returns aggregate counts and
  `operation_results[]` with per-entity `applied` / `skipped` / `failed`
  details; the UI keeps the confirm dialog open after apply to show those
  details.
- Admin v2 `Настройки` tab is writable via bulk operations
  `settings.create`, `settings.patch`, and `settings.delete`, matching legacy
  `/api/v1/ugs/admin/settings` uniqueness on `(scope, key, company_id,
  project_id, user_id)`.
- Runtime provider bootstrap remains a granular admin action (not v2 bulk):
  `POST /api/v1/ugs/admin/providers/bootstrap-runtime`. Admin v2 exposes it on
  Overview and Providers tabs; successful bootstrap refreshes the v2 snapshot.
  Deprecated mount `/api/ugs/admin` (no `/v1`) stays for external callers with
  deprecation headers; FE must call `/api/v1/ugs/admin` only.
- Admin v2 `Модели` discovers live Llama inventories through
  `GET /api/v1/ugs/admin/llama-models?base_url=…` and merges them with snapshot
  `model_inventory` for route/default pickers; DB persistence uses
  `provider.models.refresh`.
- Admin v2 **Типы** row click / Bulk edit open a full `GenerationTypeUpdate`
  editor (`TypesBulkEditModal`): `display_name`, `category`, `description`,
  `provider`, `model_name`, `parameters`, `complexity`, `estimated_time`,
  `max_retries`, `priority`, `cost_credits`, `is_active`, `metadata`.
  `type_key` is immutable. Prefer **Модели** / `model_routes` for resolved
  models; `model_name` remains a legacy fallback field. Ops still go through
  `type.patch` validate/apply (no delete).
- Admin v2 **Воркфлоу** row click opens a full `ComfyUIWorkflowUpdate` editor:
  `name`, `category`, `description`, `version`, `estimated_time`, `is_active`,
  `model_dependencies`, `json_body`, `metadata`. `slug` is immutable. Ops use
  `workflow.patch` (+ optional `workflow.set_active`).
- Admin v2 bulk kinds exposed in UI (2026-08-06 matrix):

| Bulk kind | Tab / surface | Notes |
|-----------|---------------|-------|
| `provider.create` | Providers → Add provider | Full `GenerationProviderCreate` incl. display_label, api_key_required, cost/fallback fields |
| `provider.patch` | Providers → Bulk edit | |
| `provider.set_enabled` | Providers | Selection or visible rows |
| `provider.default_model.set` | Providers / Models | |
| `provider.models.refresh` | Providers / Models | |
| `type.create` | Types → Create type | Required: type_key, category, display_name, provider |
| `type.patch` | Types → row / Bulk edit | |
| `type.set_active` | Types | |
| `type.clear_model_names` | Types → Clear model_name | Selection or visible rows |
| `workflow.create` | Workflows → Create workflow | |
| `workflow.patch` | Workflows → row editor | |
| `workflow.set_active` | Workflows | |
| `workflow.import_from_disk` | Workflows / Models | Optional overwrite checkbox |
| `model_routes.patch` | Models | Scoped route editor + allowlist-only patch |
| `model_routes.replace` | Models → advanced JSON | Full document replace; prefilled from snapshot |
| `settings.create` | Settings | |
| `settings.patch` | Settings | |
| `settings.delete` | Settings | |
| Overview quick actions | Overview | `provider.set_enabled`, `type.set_active` on all rows |
| Autofix recommendations | Models | Emits bundled ops from snapshot |

Not in v2 bulk UI: runtime provider bootstrap (`POST …/providers/bootstrap-runtime` only).
Legacy REST still has `DELETE` for providers/types/workflows — **not** exposed in Admin v2 bulk (intentional; no soft-delete contract in v2).
Users / credits / trusted badge live outside snapshot tabs (`/api/v1/ugs/admin/users*`).
Backend bulk also gained `type.create` / `workflow.create` (2026-08-06) so create no longer depends on legacy POST alone.

## Realtime Contract

### Polling baseline

- Hub list views poll `/tasks`.
- `useUgsDashboard` uses adaptive polling:
  - active tasks: 15s
  - idle/no recent active tasks: 30s
- Provider health and stats poll slower than task lists.

### Per-task polling

- **Hub launch path (2026-05):** `UGSHub` starts jobs via `POST /generate/stream` (`runUgsGenerationStream`);
  progress updates the React Query task cache from SSE; dashboard task polling backs off to **60s**
  while a stream is open (`ugsActiveStreamRegistry`), and refetches use **`GET /tasks?compact=1`**
  (lighter rows; SSE/cache still holds full `input_data` for active jobs).
- Per-task polling uses `queued` and `retrying` in fast-poll `ACTIVE_STATUSES` (2026-05-27).
- Hub task list uses `useUgsTasksInfinite` (offset pages + «Загрузить ещё» + scroll-sentinel auto load-more via `useUgsTasksAutoLoadMore`); dashboard stats via `useUgsDashboard({ includeTasks: false })`.
- Hub shell header secondary link is **Analytics** (`ugs-analytics`), not Dashboard; Quick Launch has no «all types» CTA to Dashboard. Lock: `UgsHubShellHeader.declutter.test.tsx`.
- Hub task chrome (Active/History/Results/Admin history panels, toolbar, task filters, status/category badges, status filter options, tabBar chips, task rows, pagination, result/tariff modals, result body, loading skeleton) uses `ugsHub` i18n — no hardcoded RU labels on those surfaces. Helpers: `ugsHubStatusLabel` / `ugsHubCategoryLabel` in `ugsHubTaskListMeta.ts`. Timestamps accept active locale via `formatDateTime` / `formatRelativeTime`.
- Hub quick-launch default payloads (`buildDefaultPayload(t, type)` in `ugsHubDefaultPayload.ts`) and audio result placeholder WebVTT (`buildUgsHubAudioPlaceholderCaptionsVtt(t)` → `captionsSrc` on Hub result `InlineAudioPreview` / `UgsUnifiedContentAudioPreview`) use `ugsHub.generationDefaults.*` / `ugsHub.result.vttFallbackCue` + `result.captionsTrackLabel`; shared preview chrome uses `desktopUi.inlineAudio.*`. Lock: `ugsHubDefaultPayload.i18n.test.ts`, `ugsHubResultTariff.i18n.test.ts`, `InlineAudioPreview.test.tsx`.
- Hub Workflows tab chrome (`UgsWorkflowsToolbar`, `UgsWorkflowsListSection`, tab loading) uses `ugsHub.workflows.*` — EN/RU parity for title/filters/empty/error/Comfy cue.
- Hub Workflows cards (`WorkflowCard.tsx`) use `ugsHub.workflows.card*` keys plus shared `status.*` / `category.*`.
- Hub Workflows quick execute modal (`QuickExecuteModal.tsx`) uses `ugsHub.workflows.quick*` keys (RU/EN).
- Hub Workflows builder shell (`UGSWorkflowBuilderPage.tsx`) — **retired** (absent from active `src/`); do not expect `ugsHub.workflows.builder*` UI on Hub. Living Hub Workflows = list/cards/quick-execute (`WorkflowCard`, toolbar) only.
- ~~Workflow Builder floating panels / node configuration / starter templates~~ — **retired** with the builder shell (locale keys under `workflowBuilder.*` may linger unused).
- Hub Workflows actions (`useUgsWorkflowsTabController` toasts/confirms, duplicate name suffix) use `ugsHub.workflows.toast*` keys.
- Hub controller/generation/task hooks (`useUgsHubController`, `useUgsHubGeneration`, `useUgsHubTaskActions`) use `ugsHub.toast.*` for user-visible toasts/confirms (API `detail` passthrough unchanged); CSV export column headers use `ugsHub.csvExport.*`; lock: `ugsHubResultTariff.i18n.test.ts`.
- Hub Workflows helpers (`formatEstimatedTime`, `formatRuntimeError`, disabled/status labels) take `TFunction<'ugsHub'>`; card timestamps use active `i18n.language`.
- UGS admins see a compact **queue snapshot** strip on вкладке «Воркфлоу» (`UgsHubQueueOpsStrip` → UGS Admin). Full `UgsHubQueueOpsPanel` is **not** mounted on Hub «Обзор» (Overview is launch + work preview only); panel remains available for isolation tests / Admin surfaces. Shared hook `useUgsQueueOpsSnapshot`.
- Queue-ops service boundary normalizes legacy stale keys into canonical fields (`pending_orphan`, `pending_in_queue`, `processing`, `total`) via `normalizeUgsQueueOpsSnapshot` in `services/api/ugs/queueOps.ts`.
- When queue-ops reports backlog (`total_queued ≥ 20`, stale candidates, or warning hints), UGS admin Hub prefetches up to **3** extra task pages via `useUgsHubTasksBacklogPrefetch` (scroll-sentinel and «Загрузить ещё» unchanged).
- Scroll + backlog prefetch share **`createCoalescedFetchNextPage`** to avoid duplicate parallel page fetches.
- All long-running streams should use `runUgsStreamWithRegistry` (Hub: `runUgsGenerationStream`).
- Poll refetch merges via `mergeUgsTasksPoll` to preserve fresher SSE fields over compact rows.
- Stream seed insertion into infinite task caches is single-row/single-page: new tasks are inserted only into the first loaded page, not duplicated across every cached page.
- `useUgsTasksInfinite` caps active loaded pages for Hub task history and sets explicit query `gcTime`; deep history should be reached via filters/search rather than unbounded active cache growth.
- Non-zero offset poll merges compare incoming page rows against the cached page at the same offset, so page 2+ compact refreshes preserve SSE-enriched fields correctly.
- Regression coverage fixes the page cap / `gcTime` constants and same-offset page resolution in `src/hooks/api/__tests__/useUgsTasksInfiniteCache.test.ts`.
- **Fallback:** `useUGSGenerationStatus` polls `/status/:id` every **15s** until terminal (when SSE is not used).
- `useUGSGenerationResult` reads `/result/:id` on demand.

### Stream contract

`streamUgsGeneration()` accepts SSE events:

- `started`
- `queued`
- `progress`
- `keep_alive`
- `result`
- `error`
- `cancelled`

Terminal behavior:

- `result` resolves with final payload
- `error` throws
- `cancelled` throws

### Shared task patch shape

When stream payloads are merged into task-like UI state, these fields are treated
as canonical:

- `request_id -> task.id`
- `status`
- `stage`
- `progress`
- `progress_message`
- `execution_backend`
- `provider_name`
- `provider_attempt`
- `retry_count`
- `queued_at`
- `last_heartbeat_at`
- `result`
- `result_preview`
- `metadata`
- `error`
- `error_type`

Compact poll rows may omit heavy fields. Frontend merge must preserve cached `input_data`, `result`, `result_preview`, and `metadata` when the incoming compact row has `null`/`undefined`; this protects retry and result-preview flows.

### Workflow execution history

- Workflow execution history panels are capped to avoid N-card polling fan-out when many workflow cards are expanded.
- Active execution histories still use the adaptive interval from `ugsWorkflowExecutionPolling`: 15s for pending/running, 30s for terminal-only lists, and no polling when auto-refresh is disabled.
- Workflow Builder keyboard nudging supports all arrow keys (`ArrowLeft`, `ArrowRight`, `ArrowUp`, `ArrowDown`); Shift keeps the larger step.
- Workflow payload/error guard tests cover execution status labels, provider timeout/connect recovery text, and disabled quick-execute labels.

### OpenAPI pilot

- UGS has a dedicated pilot slice: `shared/web/frontend/openapi/pilot/ugs.openapi.json`.
- Generated types: `shared/web/frontend/src/generated/ugs-openapi.ts`.
- Refresh path: `cd shared/web/frontend && pnpm run openapi:extract-pilots && pnpm run openapi:pilot:ugs` (or full `pnpm run openapi:refresh-pilots` when updating all pilots).
- Typed-contract boundary (2026-05, Wave 6 2026-08-06): backend envelopes for tasks, tray summary, metrics/provider status, queue-ops, workflows and workflow executions use concrete Pydantic response models. `GenerationTypeListResponse.types` `$ref`s public `GenerationTypeResponse` (admin twin is `AdminGenerationTypeResponse` to avoid OpenAPI name collision). Frontend code must consume them through `src/services/api/ugs/schemas.ts` and stable service aliases (`types.ts` — `GenerationType` / documented `ProvidersSummary` flatten, `ugsAdmin.ts`, `ugsAdminV2.ts`) rather than importing `src/generated/ugs-openapi.ts` directly from components.
- Flexible payload bags remain flexible by design: `input_data`, `metadata`, `result`, `result_preview`, workflow `workflow_data`, and queue-ops nested diagnostics may contain provider-specific JSON. Runtime guards normalize the edge before cache/UI consumers:
  - task compact rows: `normalizeUgsTaskRows` in `services/api/ugs/dashboard.ts`;
  - provider status summary: `normalizeUgsProvidersSummary` in `services/api/ugs/dashboard.ts` (OpenAPI `UGSProvidersStatusResponse` → Hub flatten);
  - SSE payloads: `normalizeUgsStreamEventPayload` in `services/api/ugs/stream.ts`;
  - workflow list/execution wrappers: `normalizeWorkflowList` / `normalizeExecutionList` in `components/UGS/workflows/utils.ts`.
- Contract guard tests: backend `api/tests/test_ugs_openapi_contracts.py` covers task, stats, metrics, analytics, provider-status, queue-ops, workflow response schemas, and GenerationType list `$ref`; frontend `src/services/api/ugs/__tests__/ugsContractGuards.test.ts`, `openapiSsotWave6.contract.test.ts`, and `src/components/UGS/workflows/__tests__/workflowPayloadGuards.test.ts`.
- Operator UI contract tests:
  - `src/services/api/ugs/__tests__/queueOpsNormalization.test.ts` for stale key normalization.
  - `src/components/UGS/hub/__tests__/UgsHubQueueOpsWidgets.test.tsx` for queue-snapshot strip/panel badges, DLQ count, Redis PG fallback warning, and provider degradation alert shortcut (panel isolated; not Overview-mounted).
- `src/components/UGS/hub/generation/__tests__/UgsHubGenerationModal.test.tsx` for form-first prompt + Advanced JSON disclosure.
  - `src/components/UGS/hub/__tests__/ugsHubEmptyStateTokens.test.ts` for desktop token classes on Hub empty state.
  - `src/components/UGS/workflows/__tests__/workflowPayloadGuards.test.ts` for execution status labels and catalog execute guards.

## Desktop UI Theme Contract (2026-06)

All UGS React surfaces inside `#desktop-main[data-theme]` must use shared helpers — **not** hardcoded `slate-*`, `violet-*`, or `bg-white/10` shell chrome.

| Rule | Detail |
|------|--------|
| Source of theme | `useDesktopShellTheme()` → `UgsHubShellThemeProvider` |
| Shared classes | Import from `features/ugs/shared/ugsDesktopUi.ts` first; hub-specific from `ugsHubThemeTokens.ts` |
| Modals | `UgsHubModalFrame` + `ugsHubSharedUi` |
| Workflows | `ugsWorkflowsSharedUi.ts`; execution badges via `ugsWorkflowExecutionStatusBadgeClass()` |
| Builder | Retired 2026-07-28; legacy shell/theme helpers moved to soft-retired under `trash/` (id 20260728-135649) and must not be referenced by active UGS surfaces |
| Lock | UGS runtime no longer exposes builder routing or shell CTAs; legacy `#workflow-builder` hashes must no-op |
| Node accents | ReactFlow node-type color gradients may remain as type semantics (not desktop shell chrome) |

**No new env keys or DB migrations** were introduced for this theme program. Type-only frontend fixes: `schemas.ts` (`UgsAdminTypeSchema` alias), `queueOps.ts` (`UgsQueueOpsStaleCandidates` from OpenAPI).

**Regression gate:**

```bash
cd shared/web/frontend
pnpm exec vitest run src/components/UGS src/features/ugs src/services/api/ugs
```

Canon: [UGS-DESKTOP-SHELL.md](./desktop/UGS-DESKTOP-SHELL.md) § UI theme and shared tokens.

## Desktop / Deep-Link Contract

### Canonical behavior

Legacy UGS hash routes are normalized into desktop handoff:

- `#ugs-hub -> #desktop + { view: "hub" }`
- `#ugs -> #desktop + { view: "dashboard" }`
- `#ugs-analytics -> #desktop + { view: "analytics" }`
- `#ugs-admin -> #desktop + { view: "admin" }`
- `#workflow-builder?...` is retired and must no-op; desktop must not open a builder/editor surface from legacy hashes.

### Shared handoff primitives

- storage key:
  `eliteew.desktop.deepLink.ugs`
- event:
  `eliteew:desktop-ugs-deeplink`

The same resolver and storage key must be used by production code and Playwright
helpers to avoid route drift.

### Consumption rules

- desktop reads the pending payload from `sessionStorage`
- desktop removes it after consume
- desktop opens a single UGS window with `initialPayload`
- in-app UGS navigation stays inside the UGS desktop window

## Known-Good Regression Baseline

### Playwright E2E (актуальные пути)

Каталог: **`shared/web/frontend/e2e/`** (конфиг **`playwright.config.ts`**). Ранее упоминавшийся **`test_all/e2e/`** в репозитории **нет**.

По состоянию дерева: `content-manager-doceditor.spec.ts`, `marketing-dashboard.wave2.spec.ts`, `ugs-hub-deeplink.spec.ts` (без auth), `ugs-hub-smoke.spec.ts`, `ugs-hub-wave4.spec.ts` (gated: `DESKTOP_SHELL_E2E_RUN=1` + `MC_E2E_BASE_URL`), и **`ugs-hub-generate-stream-golden.spec.ts`** (тот же desktop gate + `UGS_HUB_E2E_MOCK_STREAM=1`, fixture `e2e/fixtures/ugs-generate-stream-golden.sse` на `POST /api/v1/ugs/generate/stream`). Отдельных файлов уровня `ugs-ui.spec.ts` / `desktop.spec.ts` в этом каталоге сейчас **нет**.

### Что исторически покрывали удалённые suite (ориентир для ручной проверки)

- UGS desktop entry opens and renders through the desktop shell.
- UGS quick execute workflow history/results paths work in deterministic mocked e2e.
- Ultimate Doc Editor no longer crashes on load and resolves both direct and alias routes.
- Desktop shell route survives auth/session restore.
- Content manager route still coexists with desktop/UGS routing changes.

## Current Risks To Preserve During Refactor

- `UGSHub.tsx` thin shell (~240 lines after controller split); orchestration in `useUgsHubController`; result/generation/actions in `hub/*` and `hooks/ugsHub/*`.
- `UGSWorkflowsTab.tsx` is a thin shell; React Query for workflows and open execution panels lives in `useUgsWorkflowsTabController.ts`. Execution lists poll **15s** while pending/running, **30s** when terminal-only (`ugsWorkflowExecutionPolling.ts`).
- Hub cache: SSE/poll/list ops via `ugsHubTaskCacheFacade`; list mutations via `useUgsHubTaskCache`; poll intervals via `ugsHubTasksPolling`.
- Task polling pauses on **workflows** tab and when browser tab is hidden; admin server history loads **lazily** on tab open.
- Desktop deep-link logic can drift if tests stop importing the shared resolver/key.
- Heavy desktop routes remain vulnerable to TDZ/circular-import regressions if they reintroduce barrel-based lazy imports.

## Operator smoke (prod)

1. `GET /api/v1/ugs/admin/queue-ops` — `status`, `hints`, `stale_candidates`.
2. UGS Hub (admin) — Workflows strip (`ugs-hub-queue-ops-strip`); Overview must **not** show full queue-ops panel; при backlog — background task prefetch (no Overview badge required).
3. Queue worker + Redis lease; при degrade — [UGS-QUEUE-OPERATIONS-RUNBOOK.md](../platform/docker-re_doc/UGS-QUEUE-OPERATIONS-RUNBOOK.md).
4. Optional desktop E2E: `pnpm run test:e2e:desktop` — [DESKTOP-SHELL-E2E-CI.md](./desktop/DESKTOP-SHELL-E2E-CI.md).
5. FE release gate for Hub/Builder surfaces: `pnpm run build:react-compiler` in `shared/web/frontend` (not bare `pnpm run build`).

## Acceptance Checks For Future Changes

Every large UGS frontend refactor should preserve the following:

- Hub task lists continue to show active, history, results, and failed states correctly.
- Quick execute in workflow catalog still exposes execution history and result visibility.
- Desktop deep links continue to resolve through `#desktop`.
- Doc Editor streamed generation keeps working with the same terminal/error semantics.
- Deterministic e2e stays green before expanding live-smoke coverage.
- Unified Admin exposes UGS Admin only as section `ugsV2` (legacy section id `ugs`
  deep-links migrate to `ugsV2`). Granular `/api/v1/ugs/admin/{providers,types,workflows,settings}`
  routes must continue working alongside `/api/v1/ugs/admin/v2/*`.
- UGS runtime model selection is centralized in DB-backed `ugs_settings.model_routes`
  and `generation_providers.config_json.default_model/models`. Admin v2 must not
  expose direct model editing on generation types; `generation_types.model_name`
  is legacy/read-only metadata with validation warnings.
- Env model values are emergency bootstrap/fallback only. If the resolver reaches
  env fallback, Admin v2 should surface this as configuration debt in the model
  routing snapshot/audit.
- Admin v2 `Модели` exposes autofix recommendations as selectable bulk operations:
  recommendations are only previews until the operator confirms the shared
  validate/apply dialog.
- Text generation uses one shared model route by default
  (`qwen3-14b-q4_k_m.gguf` in current stack0/stack2 env). Embeddings and rerank
  stay separate service contours: `LLAMA_EMBEDDING_MODEL` for embeddings and
  `RAG_RERANK_BASE_URL` → stack2 `LLAMA_RERANK_FILE` for rerank.
