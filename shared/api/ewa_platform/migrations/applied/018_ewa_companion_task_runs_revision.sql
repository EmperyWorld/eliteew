-- Optimistic concurrency for companion task runs (client/UI run_revision).
ALTER TABLE ewa_companion_task_runs
    ADD COLUMN IF NOT EXISTS run_revision integer NOT NULL DEFAULT 1;

COMMENT ON COLUMN ewa_companion_task_runs.run_revision IS
    'Monotonic revision bumped on every successful run update; optional expect_revision on patch.';
