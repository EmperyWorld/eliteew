-- GAF: ответ на сообщение (reply / quote)
ALTER TABLE gaf_messages
    ADD COLUMN IF NOT EXISTS reply_to_message_id UUID REFERENCES gaf_messages(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_gaf_messages_reply_to
    ON gaf_messages (reply_to_message_id)
    WHERE reply_to_message_id IS NOT NULL;
