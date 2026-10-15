# UGS Workflow Builder Contract

**Обновлено:** 2026-07-28 · retired surface note.

## Status

The legacy UGS Workflow Builder frontend surface was removed from the active
frontend/runtime on 2026-07-28.

- retired frontend paths moved to soft-retired under `trash/` (id 20260728-135649)
- active UGS surfaces no longer expose create/open-builder actions
- legacy `#workflow-builder` hashes must no-op

Related: [ugs_frontend_contract_and_regression_baseline.md](ugs_frontend_contract_and_regression_baseline.md), [desktop/UGS-DESKTOP-SHELL.md](desktop/UGS-DESKTOP-SHELL.md).

## What remains active

- UGS workflow listing, filtering, quick execute, duplicate/export/delete, and execution history stay active in `UGSWorkflowsTab`.
- DB-first catalog workflows (`comfyui_workflows`) may still surface as runnable/read-only workflow records inside UGS cards.
- OpenAPI/generated schemas may still mention historical `WorkflowBuilder*` DTO names until the backend contract is retired separately; they no longer map to an active frontend editor shell.

## Operator rule

Do not restore `WorkflowBuilder.tsx`, `UGSWorkflowBuilderPage.tsx`, `features/workflow-builder/`, or `workflowBuilderRoute.ts` back into active `src/` without an explicit new product task and fresh canon.
