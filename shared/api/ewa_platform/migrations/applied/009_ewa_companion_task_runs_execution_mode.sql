-- Phase 1.8: execution_mode on companion task runs (sync vs async Celery).
ALTER TABLE ewa_companion_task_runs
    ADD COLUMN IF NOT EXISTS execution_mode text NOT NULL DEFAULT 'sync';

COMMENT ON COLUMN ewa_companion_task_runs.execution_mode IS
    'sync = completed in HTTP turn; async = Celery companion_run_task (Phase 1 BO plan).';
