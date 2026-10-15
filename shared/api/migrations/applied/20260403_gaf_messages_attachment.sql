-- GAF Chat: optional file attachment per message + recipient saved copy id (Content Manager).
-- Apply: docker exec -i stack1-postgres psql -U ai_user -d ai_services < api/migrations/applied/20260403_gaf_messages_attachment.sql

ALTER TABLE gaf_messages
    ADD COLUMN IF NOT EXISTS attachment_content_id UUID REFERENCES unified_content(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS attachment_mime_type VARCHAR(200),
    ADD COLUMN IF NOT EXISTS attachment_name VARCHAR(500),
    ADD COLUMN IF NOT EXISTS attachment_size BIGINT,
    ADD COLUMN IF NOT EXISTS attachment_recipient_saved_id UUID REFERENCES unified_content(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_gaf_messages_attachment_content
    ON gaf_messages (attachment_content_id) WHERE attachment_content_id IS NOT NULL;
