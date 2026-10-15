-- GAF Chat: 1:1 chats and messages. Apply to ai_services (same as friends):
--   docker exec -i stack1-postgres psql -U ai_user -d ai_services < api/migrations/gaf_chat_tables.sql

-- Chats (1:1): create without last_read columns (FK to gaf_messages added after gaf_messages exists)
CREATE TABLE IF NOT EXISTS gaf_chats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id_1 UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user_id_2 UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_message_at TIMESTAMPTZ,
    archived_at_user_1 TIMESTAMPTZ,
    archived_at_user_2 TIMESTAMPTZ,
    CONSTRAINT gaf_chats_no_self CHECK (user_id_1 != user_id_2)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_gaf_chats_unique_pair
    ON gaf_chats (LEAST(user_id_1, user_id_2), GREATEST(user_id_1, user_id_2));

CREATE INDEX IF NOT EXISTS idx_gaf_chats_user_id_1 ON gaf_chats (user_id_1);
CREATE INDEX IF NOT EXISTS idx_gaf_chats_user_id_2 ON gaf_chats (user_id_2);
CREATE INDEX IF NOT EXISTS idx_gaf_chats_last_message_at ON gaf_chats (last_message_at DESC NULLS LAST);

-- Messages
CREATE TABLE IF NOT EXISTS gaf_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id UUID NOT NULL REFERENCES gaf_chats(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    body_ciphertext TEXT NOT NULL,
    body_plain_preview TEXT,
    nonce BYTEA,
    algorithm VARCHAR(64),
    encryption_version VARCHAR(32),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    edited_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ,
    deleted_for_sender BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_for_recipient BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_gaf_messages_chat_created ON gaf_messages (chat_id, created_at);
CREATE INDEX IF NOT EXISTS idx_gaf_messages_sender_created ON gaf_messages (sender_id, created_at);

-- Add read state columns to gaf_chats (FK to gaf_messages)
ALTER TABLE gaf_chats
    ADD COLUMN IF NOT EXISTS last_read_message_id_user_1 UUID REFERENCES gaf_messages(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS last_read_message_id_user_2 UUID REFERENCES gaf_messages(id) ON DELETE SET NULL;

-- E2E: encrypted session keys (server does not decrypt)
CREATE TABLE IF NOT EXISTS gaf_message_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id UUID NOT NULL REFERENCES gaf_chats(id) ON DELETE CASCADE,
    message_id UUID REFERENCES gaf_messages(id) ON DELETE SET NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    encrypted_key_payload TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gaf_message_keys_chat_user ON gaf_message_keys (chat_id, user_id);
