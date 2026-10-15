-- Backfill: orphaned unified_content rows still tied to soft-deleted projects.
-- Matches delete_project vault cleanup (project_id scope + eliteew-proj-* folder + desktop icons).

UPDATE unified_content uc
SET deleted_at = COALESCE(uc.deleted_at, p.deleted_at),
    updated_at = NOW(),
    project_id = NULL,
    folder_item_id = NULL
FROM projects p
WHERE uc.project_id = p.id
  AND p.deleted_at IS NOT NULL
  AND uc.deleted_at IS NULL;

UPDATE unified_content uc
SET project_id = NULL,
    folder_item_id = NULL,
    updated_at = NOW()
FROM projects p
WHERE uc.project_id = p.id
  AND p.deleted_at IS NOT NULL
  AND uc.deleted_at IS NOT NULL;

UPDATE unified_content uc
SET deleted_at = COALESCE(uc.deleted_at, p.deleted_at),
    updated_at = NOW(),
    project_id = NULL,
    folder_item_id = NULL
FROM projects p
WHERE uc.folder_item_id = ('eliteew-proj-' || p.id::text)
  AND p.deleted_at IS NOT NULL
  AND uc.deleted_at IS NULL
  AND uc.project_id IS NULL;

UPDATE unified_content uc
SET folder_item_id = NULL,
    updated_at = NOW()
FROM projects p
WHERE uc.folder_item_id = ('eliteew-proj-' || p.id::text)
  AND p.deleted_at IS NOT NULL
  AND uc.deleted_at IS NOT NULL
  AND uc.project_id IS NULL;

DELETE FROM desktop_items di
USING projects p
WHERE di.item_id = ('eliteew-proj-' || p.id::text)
  AND p.deleted_at IS NOT NULL;
