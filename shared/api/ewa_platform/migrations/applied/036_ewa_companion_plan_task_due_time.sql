-- Optional local wall-clock time for companion plan tasks (Calendar timed slots).

ALTER TABLE ewa_companion_plan_tasks
    ADD COLUMN IF NOT EXISTS due_time time;

ALTER TABLE ewa_companion_plan_tasks
    ADD COLUMN IF NOT EXISTS due_duration_minutes smallint;

COMMENT ON COLUMN ewa_companion_plan_tasks.due_time IS
    'Local wall-clock start time on due_date; NULL = all-day in Calendar overlay.';

COMMENT ON COLUMN ewa_companion_plan_tasks.due_duration_minutes IS
    'Timed slot length in minutes when due_time is set; default 60 in app layer.';
