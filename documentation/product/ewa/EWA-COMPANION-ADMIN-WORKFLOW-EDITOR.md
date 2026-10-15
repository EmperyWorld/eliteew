# Companion admin: workflow catalog and editor

Source-backed admin workflow HTTP/UI contract · reviewed 2026-10-11. This guide covers the v1 action catalog and editor. It does not certify DAG/user-workflow execution, all admin panels or a production rollout.

## Identity, gates and routes

[Router](../../../shared/api/ewa_platform/gateways/routers/companion_admin.py) is mounted under `/api/v1/ewa/admin/companion`. Every route below requires OAuth identity with role `admin` or `emperyworld_admin`; wrong role → 403. [Workflow flags](../../../shared/api/ewa_platform/companion/workflows/config.py) define admin feature/write, master and PG catalog activation. Disabled feature → 503 `ewa_companion_admin_disabled`; disabled write → 503 `ewa_companion_admin_write_disabled`; disabled PG catalog on mutations → 503 `ewa_companion_wf_pg_catalog_disabled`. Mutations then require the EWA pool, otherwise structured 503. Authentication/model validation can fail before handler gates.

| Method and suffix | Request | Response and boundary |
| --- | --- | --- |
| GET `/status` | none | admin_enabled, admin_write_enabled, pg_catalog_enabled; feature flag need not be on |
| GET `/workflows` | none | workflows summary array + schema_version `companion_workflow_catalog_v1`; action builtins with eligible PG overrides |
| GET `/workflows/{id}` | optional integer query version | definition, effective_enabled, source, optional catalog_enabled/pg_version; 404 `companion_workflow_not_found` when no fallback exists |
| POST `/workflows/validate` | `{definition: <typed v1>}` | ok, workflow_id, version, step_count, tool_names, errors, warnings; no writes; feature required, write/PG flags not required |
| POST `/workflows` | same typed definition envelope | detail response; create or overwrite a PG version; all write/PG/pool gates |
| PUT `/workflows/{id}/enable` | `{version: <int >=1>}` | detail; validates stored definition, activates that version and disables other versions |
| PUT `/workflows/{id}/disable` | no body | detail for previously active version; disabled PG override can expose builtin fallback |
| GET `/workflows/{id}/audit` | integer limit default 50, storage clamp 1–200 | workflow_id, entries; feature required; empty if PG flag/pool absent |
| GET `/chat-workflows` | none | read-only identifiers reflect_week, plan_month, file_focus + schema_version `companion_chat_workflow_catalog_v1`; latter two are reserved |

[Models](../../../shared/api/ewa_platform/schemas/pydantic/companion_admin.py) define summary id/version/titles/mode/enabled/effective/source/gate/tags/step_count. Detail contains the typed [definition](../../../shared/api/ewa_platform/schemas/pydantic/companion_workflow.py), not a run status. Audit entries contain id, workflow id/version, action, optional actor, detail map and created timestamp. Model/typed-body violations → standard 422 before service validation; malformed typed input is not always returned as `ok:false`.

Service validation checks registered tool names and broad-regex warnings. Save/enable semantic failure → 422 `companion_workflow_invalid` with errors; save attempts an audit-fail record. Enable missing version → 404 `companion_workflow_version_not_found`; disable without active row → 404 `companion_workflow_not_enabled`. Uncaught storage/model/converter exceptions are not all translated into friendly errors. Regex syntax is currently unchecked ([DOC-CODE-035](../../../docs/CODE_ISSUES.md#doc-code-035--workflow-validation-accepts-invalid-regex-triggers)). Validate does not prove execution, output delivery or capacity.

## Version selection and storage limitations

Admin list starts with three action builtins and groups all PG versions when PG catalog is enabled. It chooses an enabled version or otherwise the latest returned version, then sorts by id. This differs from runtime matching, which lists enabled PG rows and also includes chat metadata. Detail uses requested PG version, otherwise enabled then latest; if no PG row exists it can fall back to a builtin even when a version query was supplied. The action admin list/detail do not automatically include unified reflect-week metadata; the separate chat list exposes identifiers.

[Persistence](../../../shared/api/ewa_platform/persistence_pg/companion_workflow_catalog_asyncpg.py) performs transactional catalog/audit mutations with a partial unique enabled-version index. New rows start disabled, regardless of JSON definition.enabled. Saving the same `(workflow_id, version)` updates its definition and leaves its existing activation unchanged; it is not immutable create-only versioning or an assured “Save never changes live behavior” boundary ([DOC-CODE-040](../../../docs/CODE_ISSUES.md#doc-code-040--saving-an-existing-workflow-version-keeps-live-activation)). There is no revision/If-Match field or separate prior-Validate receipt required by the save API. Enable sends only id/version and validates the stored row, not the current unsaved editor text.

Catalog JSONB conversion currently drops string definitions/audit details under the default asyncpg codec ([DOC-CODE-034](../../../docs/CODE_ISSUES.md#doc-code-034--workflow-catalog-jsonb-strings-lose-definitions-and-audit-detail)). List can skip such invalid rows; detail/enable/disable can encounter model errors. No live database catalog success was established here. See [registry](EWA-COMPANION-WORKFLOW-REGISTRY.md) for actual gate resolution and continuation limits.

## Editor behavior

[Action workflows tab](../../../shared/web/frontend/src/features/ewa/admin/EwaCompanionActionWorkflowsTab.tsx) fetches list/detail/audit via [admin client](../../../shared/web/frontend/src/features/ewa/admin/ewaCompanionAdminApi.ts). [Write helper](../../../shared/web/frontend/src/features/ewa/admin/ewaCompanionAdminWriteGate.ts) computes `workflowWriteEnabled = status.admin_write_enabled && status.pg_catalog_enabled`; missing status is read-only. Backend still enforces role/gates on every request.

[Template](../../../shared/web/frontend/src/features/ewa/admin/ewaCompanionWorkflowTemplate.ts) uses local sentinel `__new_workflow__`, id `my_workflow_v1`, version 1, disabled/async, a placeholder regex and confirmed file_create step. It also sets placeholder `env_gate:EWA_COMPANION_WF_MY_WORKFLOW_V1`. Unknown custom gate names are not resolved as arbitrary env flags by the runtime builtin gate resolver; template fields must be reconciled with actual activation semantics before use.

[Editor helper](../../../shared/web/frontend/src/features/ewa/admin/ewaCompanionWorkflowEditorState.ts) parses an object-only JSON root and fingerprints `editorText.trim()`. A successful validation stores that fingerprint. Current text must equal it for `isWorkflowEditorValidated`; successful-save/detail reload resets validation. Edge whitespace is ignored by the pure fingerprint; the change handler explicitly invalidates a previous successful validation when edited.

Validate is available in a read-only open editor. Save/Enable appear inactive before validation, but their HTML disabled state only checks write/pending (and draft for Enable); click handlers display “Validate first” and block mutation when not validated. Disable requires write and a selected existing workflow, without a validation gate. Monaco is lazy-loaded and read-only when write is off.

Save parses and submits current definition, selects the returned id and invalidates catalog queries. Enable parses current id/version but sends only those two fields; it does not save unsaved steps. Consequently validating an edited definition and clicking Enable can activate older stored content at that version. The operator must save the reviewed definition first and inspect returned stored detail. UI fingerprint is a client convenience, not a server-side binding between validation, save and activation. Editing during in-flight validation or switching/refetching definitions requires independent component/race coverage; the helper tests do not establish that boundary.

## Verification and operator procedure

Three existing template/fingerprint/write-helper suites passed **6 tests**. They use pure/mock client state; no mounted editor, network or actual admin mutation was performed. The registry/executor/catalog backend selection returned **23 passed, 1 failed** for missing tool metadata; workflow JSONB and confirmation limits were reproduced separately with pure/mock probes. No source/test/configuration was changed to make these checks pass.

For an authorized local test catalog: inspect status and role, create a distinct id/version, edit the template, Validate, Save, inspect stored detail/audit, then Validate that stored definition and Enable its returned version. Verify runtime gate/prerequisites separately. After Disable, check whether a same-id builtin remains effective. Use a new version for changed definitions; current API does not enforce immutability. Live mutation/smoke was not executed here.

See [admin UI](EWA-COMPANION-ADMIN-UI.md), [write gating](EWA-COMPANION-ADMIN-WRITE-GATING.md), [settings](EWA-PLATFORM-SETTINGS-DB.md) and [workflow registry](EWA-COMPANION-WORKFLOW-REGISTRY.md). Historical phase “Done” claims are not present-day acceptance of every linked subsystem.
