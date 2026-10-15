-- Move existing EWA companion-created unified_content into the EwaFile desktop folder (ewa_file).
-- Safe to re-run: only rows not already in ewa_file.

UPDATE unified_content
SET folder_item_id = 'ewa_file',
    updated_at = NOW()
WHERE deleted_at IS NULL
  AND folder_item_id IS DISTINCT FROM 'ewa_file'
  AND (
      source_service = 'ewa_companion'
      OR metadata->>'source' LIKE 'ewa_companion%'
      OR 'ewa-companion' = ANY(COALESCE(tags, ARRAY[]::varchar[]))
  );
