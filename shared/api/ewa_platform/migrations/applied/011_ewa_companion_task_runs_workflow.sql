-- WF-1: link durable task runs to declarative action workflow catalog entries.
ALTER TABLE ewa_companion_task_runs
    ADD COLUMN IF NOT EXISTS workflow_id text,
    ADD COLUMN IF NOT EXISTS workflow_version integer;

COMMENT ON COLUMN ewa_companion_task_runs.workflow_id IS
    'Optional action workflow_id (CompanionWorkflowDefinitionV1.workflow_id) when run was started by workflow engine.';

COMMENT ON COLUMN ewa_companion_task_runs.workflow_version IS
    'Pinned workflow definition version for this run (audit / replay).';
