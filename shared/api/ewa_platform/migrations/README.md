# EWA platform PostgreSQL migrations

This is a separate database lifecycle from [application migrations](../../migrations/README.md). Target `EWA_DATABASE_URL` and the intended [EWA database](../../../../docker/stack/stack-ewa-postgres.yml), never the application or Keycloak database. SQL presence does not establish live application status.

## Runner behavior

[apply_ewa_migrations.sh](apply_ewa_migrations.sh) requires `EWA_DATABASE_URL`, discovers all `applied/*.sql`, and applies legacy rename **002 before 001**, then the remaining files in lexical order. The special order prevents empty new tables from shadowing legacy orchestration data. The runner has no applied-migration ledger and attempts all files each time. Review repeatability of the selected SQL against the target data; do not infer blanket safety from `IF NOT EXISTS` statements.

When host `psql` is available, the runner uses it with the DSN and `ON_ERROR_STOP=1`. Otherwise it requires Docker and Python for a literal `docker exec` fallback, with `EWA_MIGRATE_EWA_PG_CONTAINER` defaulting to `stack-ewa-postgres`. It does not use `ELITEEW_CONTAINER_RUNTIME` for this fallback. A Podman-only host therefore needs host `psql` or an explicitly reviewed alternative.

No whole-set transaction, automatic rollback or dry-run mode is implemented. Before an authorized schema change, follow [the EWA runbook](../../../../documentation/platform/docker-re_doc/EWA-POSTGRES-RUNBOOK.md) for target identification and backup/recovery. Do not log the DSN or credentials.

```bash
# From monorepository root with EWA_DATABASE_URL supplied securely.
bash shared/api/ewa_platform/migrations/apply_ewa_migrations.sh
```

The formerly documented `ewa-migration-018-apply-and-verify.sh` is absent from this checkout. It is not a supported command.

## Current source SQL catalog

36 files are present, through **036**. Each link below opens the SQL; names describe scope, not proof of production execution.

- [001_orchestration.sql](applied/001_orchestration.sql). Creates: `ewa_orchestration_event`, `ewa_orchestration_session`.
- [002_rename_legacy_amka_orchestration_tables.sql](applied/002_rename_legacy_amka_orchestration_tables.sql).
- [003_ewa_companion_profile.sql](applied/003_ewa_companion_profile.sql). Creates: `ewa_companion_profile`, `ewa_companion_profile_audit`.
- [004_ewa_companion_task_runs_and_quick_presets.sql](applied/004_ewa_companion_task_runs_and_quick_presets.sql). Creates: `ewa_companion_quick_action_presets`, `ewa_companion_task_runs`, `ewa_companion_task_steps`.
- [005_ewa_companion_episodes.sql](applied/005_ewa_companion_episodes.sql). Creates: `ewa_companion_episodes`.
- [006_ewa_companion_episode_link.sql](applied/006_ewa_companion_episode_link.sql). Creates: `ewa_companion_episode_link`.
- [007_ewa_atoms.sql](applied/007_ewa_atoms.sql). Creates: `ewa_atom`, `ewa_atom_edge`.
- [008_ewa_companion_plans.sql](applied/008_ewa_companion_plans.sql). Creates: `ewa_companion_plan_goals`, `ewa_companion_plan_tasks`, `ewa_companion_plans`.
- [009_ewa_companion_task_runs_execution_mode.sql](applied/009_ewa_companion_task_runs_execution_mode.sql).
- [010_ewa_companion_turn_dedup.sql](applied/010_ewa_companion_turn_dedup.sql). Creates: `ewa_companion_turn_dedup`.
- [011_ewa_companion_task_runs_workflow.sql](applied/011_ewa_companion_task_runs_workflow.sql).
- [012_ewa_companion_workflow_catalog.sql](applied/012_ewa_companion_workflow_catalog.sql). Creates: `ewa_companion_workflow_catalog`, `ewa_companion_workflow_catalog_audit`.
- [013_ewa_platform_settings.sql](applied/013_ewa_platform_settings.sql). Creates: `ewa_platform_setting`, `ewa_platform_setting_audit`.
- [014_ewa_companion_image_generation_settings.sql](applied/014_ewa_companion_image_generation_settings.sql).
- [015_ewa_companion_user_workflows.sql](applied/015_ewa_companion_user_workflows.sql). Creates: `ewa_companion_user_workflows`.
- [016_ewa_companion_tool_router_mode_partial.sql](applied/016_ewa_companion_tool_router_mode_partial.sql).
- [017_ewa_platform_settings_catalog_reconcile.sql](applied/017_ewa_platform_settings_catalog_reconcile.sql).
- [018_ewa_companion_task_runs_revision.sql](applied/018_ewa_companion_task_runs_revision.sql).
- [019_ewa_platform_settings_prod_orchestrator_profile.sql](applied/019_ewa_platform_settings_prod_orchestrator_profile.sql).
- [020_ewa_companion_workflow_catalog_reflect_week.sql](applied/020_ewa_companion_workflow_catalog_reflect_week.sql).
- [021_ewa_companion_task_runs_parent_run_id.sql](applied/021_ewa_companion_task_runs_parent_run_id.sql).
- [022_ewa_companion_workflow_engine_v2_settings.sql](applied/022_ewa_companion_workflow_engine_v2_settings.sql).
- [023_ewa_agentic_substrate.sql](applied/023_ewa_agentic_substrate.sql). Creates: `ewa_agentic_checkpoint_logs`, `ewa_agentic_inbound_messages`, `ewa_agentic_sessions`, `ewa_agentic_task_tree`.
- [024_ewa_agentic_condense_atomic.sql](applied/024_ewa_agentic_condense_atomic.sql).
- [025_ewa_platform_settings_agentic_substrate.sql](applied/025_ewa_platform_settings_agentic_substrate.sql).
- [026_ewa_platform_settings_wf_tool_flags.sql](applied/026_ewa_platform_settings_wf_tool_flags.sql).
- [027_ewa_platform_settings_reactive_chrome.sql](applied/027_ewa_platform_settings_reactive_chrome.sql).
- [028_ewa_agentic_step_scheduler.sql](applied/028_ewa_agentic_step_scheduler.sql).
- [029_ewa_platform_settings_262k_gpu141_profile.sql](applied/029_ewa_platform_settings_262k_gpu141_profile.sql).
- [030_ewa_agentic_task_tree_awaiting_child.sql](applied/030_ewa_agentic_task_tree_awaiting_child.sql).
- [031_ewa_companion_task_status_checks.sql](applied/031_ewa_companion_task_status_checks.sql).
- [032_ewa_platform_settings_admin_consolidation_h1_h3.sql](applied/032_ewa_platform_settings_admin_consolidation_h1_h3.sql).
- [033_ewa_agentic_task_tree_node_kind_expert_chat.sql](applied/033_ewa_agentic_task_tree_node_kind_expert_chat.sql).
- [034_ewa_companion_prompt_blocks.sql](applied/034_ewa_companion_prompt_blocks.sql). Creates: `ewa_companion_prompt_block`, `ewa_companion_prompt_block_audit`.
- [035_ewa_companion_chat_condense_min_messages.sql](applied/035_ewa_companion_chat_condense_min_messages.sql).
- [036_ewa_companion_plan_task_due_time.sql](applied/036_ewa_companion_plan_task_due_time.sql).

Migration 018 adds `run_revision` for optimistic task-run updates; 021 adds parent-run linkage; 023 establishes agentic persistence; 028 adds scheduler claim/retry columns; 033 expands task-tree node kinds; 034 adds prompt-block overrides/audit; 035 adjusts a condense setting; 036 adds optional task `due_time` and `due_duration_minutes`. Inspect SQL for constraints, guards and update conditions.

## Verification and bootstrap

[ewa-platform-migrations-verify.sh](../../../../docker/scripts/ewa-platform-migrations-verify.sh) uses `ELITEEW_CONTAINER_RUNTIME` (default Podman) and the `EWA_SMOKE_EWA_PG_CONTAINER`, `EWA_SMOKE_EWA_PG_USER`, `EWA_SMOKE_EWA_DB` overrides. It checks selected tables, task-run revisions/parent linkage, agentic scheduler/status/node-kind constraints and selected settings. It does **not** comprehensively validate every migration, including all post-033 changes.

```bash
# Diagnostic against an authorized target; not executed by this audit.
ELITEEW_CONTAINER_RUNTIME=podman bash docker/scripts/ewa-platform-migrations-verify.sh
```

The API also initializes parts of the EWA schema and seeds/reconciles [the settings catalog](../settings/catalog_entries.py). Bootstrap parity and migration replay need separate review; a green diagnostic is not a complete schema diff or proof of recovery. See [platform overview](../README.md) and [database documentation](../../../../documentation/database/README.md).

## Migration 018 — run_revision (operator runbook)

[018 SQL](applied/018_ewa_companion_task_runs_revision.sql) adds `run_revision integer NOT NULL DEFAULT 1` to `ewa_companion_task_runs`. It supports optimistic task-run updates. The full runner above includes this file; the diagnostic checks the column. No migration-018 one-shot wrapper exists. Inspect backup/target and partial-application state before an authorized apply; do not treat a schema filename as proof that an instance was upgraded.

## Migration 021 — parent_run_id (operator runbook)

[021 SQL](applied/021_ewa_companion_task_runs_parent_run_id.sql) adds the parent-run relation and its backfill/index. The full runner includes this file; the diagnostic checks `parent_run_id`. A column check alone does not verify that nested workflow data/behavior are correct. Confirm the relevant parent/child task-run scenario separately after an authorized rollout.
