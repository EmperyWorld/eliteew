-- P2 SSOT: backfill content_shares from legacy unified_content.shared_with_user_ids.
-- Writers stop syncing the array after this migration; readers keep dual-read until P3 cleanup.
-- Apply: docker exec -i stack1-postgres psql -U ai_user -d ai_services < api/migrations/applied/20260718_content_shares_ssot_backfill_shared_with_user_ids.sql

INSERT INTO content_shares (
    id,
    content_id,
    shared_by_user_id,
    shared_with_user_id,
    permission,
    expires_at,
    created_at,
    accessed_at,
    access_count
)
SELECT
    gen_random_uuid(),
    uc.id,
    (uc.user_id)::text,
    (recipient_id)::text,
    'view',
    NULL,
    COALESCE(uc.updated_at, uc.created_at, NOW()),
    NULL,
    0
FROM unified_content uc
CROSS JOIN LATERAL unnest(uc.shared_with_user_ids) AS recipient_id
WHERE uc.deleted_at IS NULL
  AND uc.shared_with_user_ids IS NOT NULL
  AND COALESCE(cardinality(uc.shared_with_user_ids), 0) > 0
  AND NOT EXISTS (
      SELECT 1
      FROM content_shares cs
      WHERE cs.content_id = uc.id
        AND cs.shared_with_user_id = (recipient_id)::text
  );
