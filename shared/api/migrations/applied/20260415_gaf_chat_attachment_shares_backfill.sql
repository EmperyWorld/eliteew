-- Backfill content_shares for existing GAF messages with attachments (recipient could not preview before fix).
-- Apply: docker exec -i stack1-postgres psql -U ai_user -d ai_services < api/migrations/applied/20260415_gaf_chat_attachment_shares_backfill.sql

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
    m.attachment_content_id,
    m.sender_id::text,
    (CASE WHEN c.user_id_1 = m.sender_id THEN c.user_id_2 ELSE c.user_id_1 END)::text,
    'view',
    NULL,
    NOW(),
    NULL,
    0
FROM gaf_messages m
JOIN gaf_chats c ON c.id = m.chat_id
WHERE m.attachment_content_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1
      FROM content_shares cs
      WHERE cs.content_id = m.attachment_content_id
        AND cs.shared_with_user_id = (
            CASE WHEN c.user_id_1 = m.sender_id THEN c.user_id_2 ELSE c.user_id_1 END
        )::text
  );
