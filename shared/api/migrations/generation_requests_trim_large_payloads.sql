-- One-time trim of large output_data/input_data in generation_requests to reduce TOAST (was ~4.4 GB).
-- Run: docker exec -i stack1-postgres psql -U ai_user -d ai_services < api/migrations/generation_requests_trim_large_payloads.sql
-- After running: VACUUM (ANALYZE) generation_requests;

-- Trim output_data: rows older than 90 days OR pg_column_size(output_data) > 512 KB
-- Replace with minimal skeleton so status/history is preserved.
DO $$
DECLARE
  batch_size int := 200;
  affected int;
  total_affected int := 0;
BEGIN
  LOOP
    WITH candidates AS (
      SELECT id FROM generation_requests
      WHERE (created_at < NOW() - INTERVAL '90 days' OR pg_column_size(COALESCE(output_data, '{}'::jsonb)) > 512*1024)
      AND (output_data IS NULL OR (output_data->>'trimmed') IS NULL)
      LIMIT batch_size
    ),
    upd AS (
      UPDATE generation_requests gr
      SET output_data = jsonb_build_object(
        'result', NULL,
        'trimmed', true,
        'trimmed_at', to_char(NOW(), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
      )
      FROM candidates c WHERE gr.id = c.id
      RETURNING 1
    )
    SELECT COUNT(*) INTO affected FROM upd;

    total_affected := total_affected + affected;
    EXIT WHEN affected = 0;
    RAISE NOTICE 'Trimmed batch: % rows (total %)', affected, total_affected;
    PERFORM pg_sleep(0.2);
  END LOOP;
  RAISE NOTICE 'Done. Total output_data trimmed: %', total_affected;
END $$;

-- Optionally trim large input_data for same old/large rows (uncomment if needed for audit)
/*
DO $$
DECLARE
  batch_size int := 200;
  affected int;
  total_affected int := 0;
BEGIN
  LOOP
    WITH candidates AS (
      SELECT id FROM generation_requests
      WHERE (created_at < NOW() - INTERVAL '90 days' OR pg_column_size(COALESCE(input_data, '{}'::jsonb)) > 256*1024)
      AND input_data IS NOT NULL AND jsonb_typeof(input_data) = 'object'
      AND (input_data->>'trimmed') IS NULL
      LIMIT batch_size
    ),
    upd AS (
      UPDATE generation_requests gr
      SET input_data = jsonb_build_object('trimmed', true, 'trimmed_at', to_char(NOW(), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
      FROM candidates c WHERE gr.id = c.id
      RETURNING 1
    )
    SELECT COUNT(*) INTO affected FROM upd;
    total_affected := total_affected + affected;
    EXIT WHEN affected = 0;
    PERFORM pg_sleep(0.2);
  END LOOP;
END $$;
*/
