-- Desktop AI Chat — personal Memory Cells (portable RAG memory)
-- Version: 20260801_03
--
-- Owner-scoped cells (≤3 enforced in app; hard ceiling 5 in trigger).
-- Chat may bind at most one cell via desktop_ai_chats.memory_cell_id.

BEGIN;

CREATE TABLE IF NOT EXISTS desktop_ai_memory_cells (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL DEFAULT 'Память',
    description TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'ready',
    source_chat_id UUID REFERENCES desktop_ai_chats (id) ON DELETE SET NULL,
    message_count_indexed INTEGER NOT NULL DEFAULT 0,
    chunk_count INTEGER NOT NULL DEFAULT 0,
    char_count INTEGER NOT NULL DEFAULT 0,
    last_built_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT desktop_ai_memory_cells_status_check CHECK (
        status IN ('ready', 'building', 'failed')
    )
);

CREATE INDEX IF NOT EXISTS idx_desktop_ai_memory_cells_owner
    ON desktop_ai_memory_cells (owner_user_id);

CREATE INDEX IF NOT EXISTS idx_desktop_ai_memory_cells_owner_updated
    ON desktop_ai_memory_cells (owner_user_id, updated_at DESC);

-- Hard ceiling (5): app default is 3 via admin defaults; trigger blocks runaway inserts.
CREATE OR REPLACE FUNCTION desktop_ai_memory_cells_quota_ceiling()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    cell_count INTEGER;
BEGIN
    SELECT COUNT(*)::INTEGER INTO cell_count
    FROM desktop_ai_memory_cells
    WHERE owner_user_id = NEW.owner_user_id;
    IF TG_OP = 'INSERT' AND cell_count >= 5 THEN
        RAISE EXCEPTION 'memory_cell_hard_quota'
            USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_desktop_ai_memory_cells_quota ON desktop_ai_memory_cells;
CREATE TRIGGER trg_desktop_ai_memory_cells_quota
    BEFORE INSERT ON desktop_ai_memory_cells
    FOR EACH ROW
    EXECUTE FUNCTION desktop_ai_memory_cells_quota_ceiling();

ALTER TABLE desktop_ai_chats
    ADD COLUMN IF NOT EXISTS memory_cell_id UUID
        REFERENCES desktop_ai_memory_cells (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_desktop_ai_chats_memory_cell
    ON desktop_ai_chats (memory_cell_id)
    WHERE memory_cell_id IS NOT NULL;

COMMIT;
