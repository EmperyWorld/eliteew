-- Solo Desktop AI Chat: paid time slot (UTC), energy charged on purchase/extend.

BEGIN;

ALTER TABLE desktop_ai_chats
    ADD COLUMN IF NOT EXISTS solo_slot_ends_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS solo_slot_started_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS solo_slot_duration_hours SMALLINT;

CREATE INDEX IF NOT EXISTS idx_desktop_ai_chats_solo_slot_ends_at
    ON desktop_ai_chats (solo_slot_ends_at)
    WHERE solo_slot_ends_at IS NOT NULL;

COMMIT;
