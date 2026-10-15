-- MusicForge: align duration check with API/product max (60–240).
-- Was 60–220 in MVP create; capabilities/schema clamp at 240 caused IntegrityError 500.
BEGIN;

ALTER TABLE music_forge_runs
    DROP CONSTRAINT IF EXISTS music_forge_runs_duration_seconds_check;

ALTER TABLE music_forge_runs
    ADD CONSTRAINT music_forge_runs_duration_seconds_check
        CHECK (duration_seconds BETWEEN 60 AND 240);

COMMIT;
