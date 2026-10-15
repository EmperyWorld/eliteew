-- desktop_items: unique (config_id, item_id) for INSERT ... ON CONFLICT in desktop.py
-- (ensure_system_folders, ensure_app_store_icon). Without this index, GET /desktop/config returns 500:
-- "there is no unique or exclusion constraint matching the ON CONFLICT specification".

-- Reparent direct children off duplicate rows onto the canonical row (first by created_at, then id).
UPDATE desktop_items AS child
SET parent_id = keeper.id
FROM desktop_items AS dup
INNER JOIN LATERAL (
    SELECT id
    FROM desktop_items k
    WHERE k.config_id = dup.config_id AND k.item_id = dup.item_id
    ORDER BY k.created_at NULLS LAST, k.id
    LIMIT 1
) AS keeper ON true
WHERE child.parent_id = dup.id
  AND dup.id <> keeper.id;

-- Drop duplicate rows (same config_id + item_id), keep canonical row.
DELETE FROM desktop_items AS di
WHERE di.id IN (
    SELECT id
    FROM (
        SELECT id,
               ROW_NUMBER() OVER (
                   PARTITION BY config_id, item_id
                   ORDER BY created_at NULLS LAST, id
               ) AS rn
        FROM desktop_items
    ) sub WHERE sub.rn > 1
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_desktop_items_config_item_id
    ON desktop_items (config_id, item_id);

COMMENT ON INDEX ux_desktop_items_config_item_id IS
    'Idempotent inserts: ON CONFLICT (config_id, item_id) in desktop router (system folders, app store icon).';
