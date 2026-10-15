-- Music Evolution: allow XL Base render targets up to 300s (studio parity).
BEGIN;

ALTER TABLE music_evolution_runs
    DROP CONSTRAINT IF EXISTS music_evolution_runs_duration_seconds_check;

ALTER TABLE music_evolution_runs
    ALTER COLUMN duration_seconds SET DEFAULT 195;

ALTER TABLE music_evolution_runs
    ADD CONSTRAINT music_evolution_runs_duration_seconds_check
        CHECK (duration_seconds BETWEEN 30 AND 300);

COMMIT;
