-- ============================================================================
--  EliteEW · Empery World — one-shot migration
--  https://eliteew.ru  ·  Author: po&T <keysray70@gmail.com>
-- ============================================================================
--  Purpose:
--    The legacy import path created multiple physical rows in `unified_content`
--    for the same logical artefact (same `file_hash` + `original_filename`).
--    When the EWA companion listed the catalogue, the LLM saw 30+ distinct
--    `uc=` IDs for ~10 real files and started inventing aliases.
--
--    This migration:
--      1) Adds an idempotent `is_archived` column to `unified_content`
--         (BOOLEAN NOT NULL DEFAULT FALSE), without breaking older code paths.
--      2) Reports the number of logical groups that have duplicates.
--      3) Marks every duplicate **except** the canonical row (oldest non-archived
--         by `created_at`) as `is_archived=TRUE` and stamps `archived_at`.
--
--  Invariants:
--    - Idempotent: re-running this script does not flip already-archived rows
--      back or pick a different canonical row (canonical = MIN(created_at)).
--    - Read path is unaffected if `is_archived` is ignored by older code;
--      the runtime gateway already de-duplicates at read time
--      (see `companion/storage/catalog_listing.py`).
--    - Safe even when the table is large: filters by (file_hash, original_filename)
--      with the existing indexes; the UPDATE is bounded by a per-group window.
--
--  Operator notes:
--    - Run inside a transaction; review the SELECT report before COMMIT.
--    - To audit without writing, replace `COMMIT;` with `ROLLBACK;`.
-- ============================================================================

BEGIN;

ALTER TABLE unified_content
    ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

-- Report: how many groups have duplicates that are still live (not archived).
WITH dup_groups AS (
    SELECT
        file_hash,
        original_filename,
        COUNT(*) AS cnt,
        MIN(created_at) AS canonical_created_at
    FROM unified_content
    WHERE file_hash IS NOT NULL
      AND COALESCE(NULLIF(BTRIM(original_filename), ''), '') <> ''
      AND is_archived = FALSE
    GROUP BY file_hash, original_filename
    HAVING COUNT(*) > 1
)
SELECT
    COUNT(*)                                                     AS duplicate_groups,
    COALESCE(SUM(cnt), 0)::BIGINT                                AS total_rows_in_groups,
    COALESCE(SUM(cnt), 0)::BIGINT - COUNT(*)::BIGINT             AS rows_to_archive
FROM dup_groups;

-- Mark every row that is NOT the canonical (oldest) per (file_hash, original_filename) as archived.
WITH ranked AS (
    SELECT
        id,
        ROW_NUMBER() OVER (
            PARTITION BY file_hash, original_filename
            ORDER BY created_at ASC, id ASC
        ) AS rn
    FROM unified_content
    WHERE file_hash IS NOT NULL
      AND COALESCE(NULLIF(BTRIM(original_filename), ''), '') <> ''
      AND is_archived = FALSE
)
UPDATE unified_content uc
SET is_archived = TRUE,
    archived_at = COALESCE(uc.archived_at, NOW())
FROM ranked r
WHERE uc.id = r.id
  AND r.rn > 1;

-- Final tally after archival.
SELECT
    COUNT(*) FILTER (WHERE is_archived = TRUE) AS archived_rows,
    COUNT(*) FILTER (WHERE is_archived = FALSE) AS live_rows,
    COUNT(*) AS total_rows
FROM unified_content;

COMMIT;
