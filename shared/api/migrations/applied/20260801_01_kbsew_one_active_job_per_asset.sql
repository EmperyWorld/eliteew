-- KBSEW: at most one active (queued|running) ingestion job per asset
-- Version: 20260801_01
--
-- Collapses duplicate active jobs (keep oldest), then enforces the invariant
-- with a partial unique index. Jobs cascade when their asset is deleted.

CREATE SCHEMA IF NOT EXISTS kbsew;

-- Collapse duplicates before unique index (oldest active job wins).
WITH ranked AS (
    SELECT
        id,
        ROW_NUMBER() OVER (
            PARTITION BY asset_id
            ORDER BY created_at ASC, id ASC
        ) AS rn
    FROM kbsew.ingestion_jobs
    WHERE status IN ('queued', 'running')
      AND asset_id IS NOT NULL
)
UPDATE kbsew.ingestion_jobs AS j
SET
    status = 'failed',
    progress_pct = 100,
    message = 'Superseded: duplicate active job collapsed by 20260801_01 migration',
    locked_at = NULL,
    locked_by = NULL,
    updated_at = now()
FROM ranked AS r
WHERE j.id = r.id
  AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS uq_kbsew_jobs_one_active_per_asset
    ON kbsew.ingestion_jobs (asset_id)
    WHERE status IN ('queued', 'running')
      AND asset_id IS NOT NULL;

-- Replace SET NULL with CASCADE so deleted assets do not leave orphan jobs.
DO $$
DECLARE
    fk_name text;
BEGIN
    SELECT con.conname
    INTO fk_name
    FROM pg_constraint AS con
    JOIN pg_class AS rel ON rel.oid = con.conrelid
    JOIN pg_namespace AS nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'kbsew'
      AND rel.relname = 'ingestion_jobs'
      AND con.contype = 'f'
      AND pg_get_constraintdef(con.oid) LIKE '%asset_id%';

    IF fk_name IS NOT NULL THEN
        EXECUTE format(
            'ALTER TABLE kbsew.ingestion_jobs DROP CONSTRAINT %I',
            fk_name
        );
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint AS con
        JOIN pg_class AS rel ON rel.oid = con.conrelid
        JOIN pg_namespace AS nsp ON nsp.oid = rel.relnamespace
        WHERE nsp.nspname = 'kbsew'
          AND rel.relname = 'ingestion_jobs'
          AND con.conname = 'ingestion_jobs_asset_id_fkey'
    ) THEN
        ALTER TABLE kbsew.ingestion_jobs
            ADD CONSTRAINT ingestion_jobs_asset_id_fkey
            FOREIGN KEY (asset_id)
            REFERENCES kbsew.assets (id)
            ON DELETE CASCADE;
    END IF;
END $$;
