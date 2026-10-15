-- E5 / V-M5: DB CHECK for companion task-run and task-step statuses (app enums in run_lifecycle + DAG/mirror).
-- Idempotent DROP + ADD.

ALTER TABLE ewa_companion_task_runs
    DROP CONSTRAINT IF EXISTS ewa_companion_task_runs_status_check;

ALTER TABLE ewa_companion_task_runs
    ADD CONSTRAINT ewa_companion_task_runs_status_check
    CHECK (status IN (
        'pending','running','awaiting_confirmation','completed','failed','cancelled'
    ));

ALTER TABLE ewa_companion_task_steps
    DROP CONSTRAINT IF EXISTS ewa_companion_task_steps_status_check;

ALTER TABLE ewa_companion_task_steps
    ADD CONSTRAINT ewa_companion_task_steps_status_check
    CHECK (status IN (
        'pending','running','in_progress','awaiting_confirmation','completed','failed','cancelled','skipped'
    ));
