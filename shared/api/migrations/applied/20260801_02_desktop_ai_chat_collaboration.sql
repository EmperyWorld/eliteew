-- Desktop AI Chat collaboration foundation (Wave 0)
-- Version: 20260801_02
--
-- Members table for friend invites (Wave 1+), author_user_id on messages,
-- uploaded_by on attachments. Backfill existing user messages / attachments
-- to the chat owner. No behavior change until invite API (Wave 1).

BEGIN;

CREATE TABLE IF NOT EXISTS desktop_ai_chat_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id UUID NOT NULL REFERENCES desktop_ai_chats (id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL DEFAULT 'guest',
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    invited_by UUID REFERENCES users (id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    responded_at TIMESTAMPTZ,
    CONSTRAINT desktop_ai_chat_members_role_check CHECK (role IN ('guest')),
    CONSTRAINT desktop_ai_chat_members_status_check CHECK (
        status IN ('pending', 'accepted', 'rejected', 'revoked', 'left')
    ),
    CONSTRAINT desktop_ai_chat_members_chat_user_uq UNIQUE (chat_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_desktop_ai_chat_members_user_status
    ON desktop_ai_chat_members (user_id, status);

CREATE INDEX IF NOT EXISTS idx_desktop_ai_chat_members_chat_status
    ON desktop_ai_chat_members (chat_id, status);

ALTER TABLE desktop_ai_chat_messages
    ADD COLUMN IF NOT EXISTS author_user_id UUID REFERENCES users (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_desktop_ai_chat_messages_author
    ON desktop_ai_chat_messages (author_user_id)
    WHERE author_user_id IS NOT NULL;

ALTER TABLE desktop_ai_chat_attachments
    ADD COLUMN IF NOT EXISTS uploaded_by UUID REFERENCES users (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_desktop_ai_chat_attachments_uploader
    ON desktop_ai_chat_attachments (uploaded_by)
    WHERE uploaded_by IS NOT NULL;

-- Backfill: historical human turns / attachments belong to the chat creator.
UPDATE desktop_ai_chat_messages AS m
SET author_user_id = c.user_id
FROM desktop_ai_chats AS c
WHERE m.chat_id = c.id
  AND m.role = 'user'
  AND m.author_user_id IS NULL;

UPDATE desktop_ai_chat_attachments AS a
SET uploaded_by = c.user_id
FROM desktop_ai_chats AS c
WHERE a.chat_id = c.id
  AND a.uploaded_by IS NULL;

COMMIT;
