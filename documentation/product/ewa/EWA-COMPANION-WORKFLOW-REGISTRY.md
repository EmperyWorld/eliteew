# Companion: workflow registry and confirmation boundaries

Source-backed registry/catalog contract · reviewed 2026-10-11. Registration, catalog validation and helper tests establish bounded behavior. They do not certify every workflow completes, survives concurrency or produces a real external artifact.

## Execution families and registry

[Unified registry](../../../shared/api/ewa_platform/companion/orchestration/workflow_registry.py) exposes `chat_llm` and `action` kinds for its known builtins. `workflow_runtime_kind(id)` recognizes chat and action builtin ids only; it is not a complete PG/user-workflow resolver. Definition resolution prefers a supplied matching PG definition, then chat metadata, then action builtins. Legacy `workflows/registry.py` and `workflows/runner.py` are compatibility re-exports for the chat path.

The current chat catalog has one executable workflow, `reflect_week`. Its catalog `llm_compose` step is metadata, not a durable task to enqueue. `plan_month` and `file_focus` are enum/admin identifiers reserved by this runner; the matcher does not implement them. User DAG v2 definitions belong to a separate schema, state store and engine described in [workflow engine v2](EWA-COMPANION-WORKFLOW-ENGINE-V2.md); they are not instances of the v1 action-step model.

[Action builtin registry](../../../shared/api/ewa_platform/companion/workflows/action/registry.py) caches three validated definitions:

| Id | Mode and declared steps | Source gate |
| --- | --- | --- |
| `music_full_cycle_v1` | async: music pipeline, then playback confirmation | `EWA_COMPANION_WF_MUSIC_FULL_V1` |
| `doc_package_v1` | sync: confirmed file creation, then editor open | `EWA_COMPANION_WF_DOC_PACKAGE_V1` |
| `catalog_list_file_create_dev_v1` | sync/dev: catalog list, then confirmed file creation | `EWA_COMPANION_WF_CATALOG_LIST_FILE_CREATE_DEV` |

All three declare `enabled:false`; recognized gate resolvers also require the action master. Definitions are not evidence of a live model, broker, file store or successful playback/editor operation.

## Flags and triggers

[Workflow config](../../../shared/api/ewa_platform/companion/workflows/config.py) reads flags through `os.getenv`; normal application settings bootstrap can install the catalog-backed environment shim described in [settings](EWA-PLATFORM-SETTINGS-DB.md). Direct helper import in an isolated process is not proof of loaded PG settings.

Action master `EWA_COMPANION_WF_ENGINE_ENABLED`, PG catalog `EWA_COMPANION_WF_PG_CATALOG`, three builtin gates, admin feature/write and DAG adapter/engine flags default off. `EWA_COMPANION_USER_WORKFLOWS_ENABLED` defaults on independently; `EWA_COMPANION_WF_DATA_TRANSFORMER_ENABLED` defaults on but still requires the master. “All workflows are off by default” is therefore inaccurate. Reflect-week's separate `EWA_COMPANION_WORKFLOW_REFLECT_WEEK_ENABLED` defaults off and is resolved by [plan config](../../../shared/api/ewa_platform/companion/plans/config.py), without the action master.

[Action triggers](../../../shared/api/ewa_platform/companion/workflows/action/triggers.py) have a builtin-only sync matcher and PG-aware async matcher. [Runtime catalog](../../../shared/api/ewa_platform/companion/services/workflow_catalog.py) requires the action master for matching; it supports regex and `quick_intent_id` triggers plus an explicit quick workflow id. The v1 schema also accepts `tool_router_tool` and `manual_admin`, but this matcher does not execute those trigger kinds. Regex order is catalog order, not best semantic match; runtime list is sorted by workflow id. [Quick intents](EWA-COMPANION-QUICK-INTENTS.md) and pre-tool resume phases can route earlier.

[Action starter](../../../shared/api/ewa_platform/companion/workflows/action/starter.py) checks user workflows first, selects gated DAG v2 when appropriate, then matches catalog actions. Music/doc builtins have specialized starters; other actions use [generic starter](../../../shared/api/ewa_platform/companion/workflows/user/generic_workflow_starter.py). This is not one universal Celery execution loop: generic v1 can dispatch inline and hand off background children. Bearer context for later user-workflow steps is cached in Redis rather than copied into plan payload; persistence/auth/recovery details need their own user-workflow review.

## PG merge and validation

Runtime list reads enabled PG rows only when master+PG flags and pool permit it, falls back to builtins/chat metadata, and suppresses duplicate builtin ids for successfully parsed PG definitions. `get_runtime_workflow` returns a definition and does not itself assert effective activation. PG activation combines row `enabled`, master and applicable recognized gate; an unknown custom `env_gate` is not looked up by the builtin resolver and falls back to definition `enabled`. Do not invent arbitrary custom gates by naming an environment variable alone.

[Catalog persistence](../../../shared/api/ewa_platform/persistence_pg/companion_workflow_catalog_asyncpg.py) declares version primary key and one-enabled-version partial index; insert/update and enable operations use transactions with audit. Current JSONB conversion accepts mappings only and loses default-codec string definitions/details: [DOC-CODE-034](../../../docs/CODE_ISSUES.md#doc-code-034--workflow-catalog-jsonb-strings-lose-definitions-and-audit-detail). PG behavior documented here follows source branches, not a successful deployed catalog read.

[Pydantic v1 model](../../../shared/api/ewa_platform/schemas/pydantic/companion_workflow.py) requires id `^[a-z][a-z0-9_]{2,63}$`, positive version, bilingual nonempty titles, at least one trigger and 1–20 steps. Step keys must be unique; dependencies must reference known keys. Kinds: `tool`, `confirm_gate`, `delay`, `llm_compose`, `noop`. Tool steps need tool_name; regex needs nonblank pattern; tool-router trigger needs tool_name. Retry accepts max attempts 1–5, backoff/delay 0–300000 ms; trigger confidence 0–1 defaults .65. Unknown fields follow default model behavior (ignored), not a strict extra-field rejection policy.

Service validation also checks registered tool names and emits broad-regex warnings. It does not prove executable step kind/graph/retry semantics or compile regex: an invalid regex can return `ok:true` then fail during matching ([DOC-CODE-035](../../../docs/CODE_ISSUES.md#doc-code-035--workflow-validation-accepts-invalid-regex-triggers)). Raw malformed-version reporting has a separate conversion failure ([DOC-CODE-041](../../../docs/CODE_ISSUES.md#doc-code-041--raw-workflow-validator-can-raise-while-reporting-a-bad-version)); typed HTTP validation rejects that input earlier.

## Confirmation and continuation

[Celery step handlers](../../../shared/api/ewa_platform/companion/jobs/step_handlers.py) register music normal/XL Base, image, presentation, generic tool dispatch, confirm gate and DAG-node steps. Unknown step-kind dispatch can fall back to a registered tool name; otherwise executor reports unsupported. A declared schema kind is not automatically a registered durable handler.

Celery confirm gate marks step/run `awaiting_confirmation`, writes `kind:workflow_confirm_gate` with step index/key/workflow id, and publishes task-step/awaiting events. [Generic confirmation helper](../../../shared/api/ewa_platform/companion/workflows/action/confirm_flow.py) cancels the run, or marks the gate completed and enqueues the next higher pending step; enqueue failure marks the run failed, while no pending successor marks it completed. It has optimistic run updates, but step update/enqueue/run update are not one atomic transaction.

Two current integration defects limit that intended path:

- [Public confirmation](../../../shared/api/ewa_platform/companion/orchestration/task_run_confirm.py) replaces confirmation state with a claim before calling the workflow helper, losing gate kind/index and causing generic confirmation to fall through: [DOC-CODE-036](../../../docs/CODE_ISSUES.md#doc-code-036--public-confirm-claim-erases-workflow-gate-state-before-resume).
- [Inline declarative dispatch](../../../shared/api/ewa_platform/companion/workflows/user/declarative_advance.py) stores only step_key for a confirm gate; the generic helper requires kind/index, and the default empty step-row list can leave the gate step unmarked: [DOC-CODE-037](../../../docs/CODE_ISSUES.md#doc-code-037--inline-declarative-confirm-gates-save-an-incomplete-resume-state).

Continuation for non-user generic catalog runs reloads only a builtin id and ignores stored catalog version; custom PG ids can stop and overridden builtins can use different steps: [DOC-CODE-038](../../../docs/CODE_ISSUES.md#doc-code-038--generic-catalog-workflow-continuation-reloads-only-builtins). These are reasons to avoid claiming universal pause/resume success from a direct helper test.

## Admin, migrations and verification

[Admin workflow contract/editor](EWA-COMPANION-ADMIN-WORKFLOW-EDITOR.md) covers status/list/detail/validate/save/enable/disable/audit and separate chat identifiers. Disable of a PG override can restore a still-enabled builtin; it is not a universal workflow kill switch. Saving an existing enabled version keeps it enabled ([DOC-CODE-040](../../../docs/CODE_ISSUES.md#doc-code-040--saving-an-existing-workflow-version-keeps-live-activation)).

[Migration catalog](../../../shared/api/ewa_platform/migrations/README.md) includes 012 (workflow catalog), 020 (reflect-week metadata) and 021 (parent run id). Schema initialization also exists in Python. Presence/parse does not prove an applied live schema or migration postconditions.

Existing registry/executor/generic-confirm/tool-catalog selection: **23 passed, 1 failed**. The failure reports four registry tools lacking v2 metadata ([DOC-CODE-039](../../../docs/CODE_ISSUES.md#doc-code-039--four-registered-tools-lack-required-v2-catalog-metadata)); the direct generic-confirm test does not enter the public claim path. Mocked/pure probes reproduced JSONB loss, regex rejection gap, both gate-state mismatches and custom-id continuation loss without live PG/broker/model operations. Complete task-run HTTP/ACL, DAG/user DSL, auth-cache/capacity/retry and external tool acceptance remain independent review work.

```bash
EWA_COMPANION_EPISODIC_RERANK_ENABLED=0 PYTHONPATH=shared .venv/bin/python -m pytest shared/api/tests/test_ewa_companion_workflow_registry.py shared/api/tests/test_ewa_companion_workflow_executor.py shared/api/tests/test_ewa_companion_workflow_confirm_gate.py shared/api/tests/test_companion_tool_catalog_contract.py -q -o cache_dir=/tmp/eliteew-documentation-pytest
```

The command currently exposes the known catalog metadata failure. No feature flags, code, schema, tests, migrations or deployment were changed in this audit.
