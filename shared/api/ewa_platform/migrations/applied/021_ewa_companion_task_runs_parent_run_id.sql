-- Phase 4.7: first-class parent linkage for nested workflow/tool runs.
-- Backfill from legacy plan_payload.workflow_parent_run_id.

ALTER TABLE ewa_companion_task_runs
    ADD COLUMN IF NOT EXISTS parent_run_id text;

COMMENT ON COLUMN ewa_companion_task_runs.parent_run_id IS
    'Optional parent task run id for nested workflow child tool runs (declarative workflows).';

UPDATE ewa_companion_task_runs
SET parent_run_id = NULLIF(TRIM(plan_payload->>'workflow_parent_run_id'), '')
WHERE parent_run_id IS NULL
  AND plan_payload ? 'workflow_parent_run_id'
  AND NULLIF(TRIM(plan_payload->>'workflow_parent_run_id'), '') IS NOT NULL;

CREATE INDEX IF NOT EXISTS ewa_companion_task_runs_principal_parent_idx
    ON ewa_companion_task_runs (principal_id, parent_run_id)
    WHERE parent_run_id IS NOT NULL;
