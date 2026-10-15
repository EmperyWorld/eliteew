-- Internal video calls: app-owned call records with opaque stack11/Jitsi rooms.
-- Apply:
-- docker exec -i stack1-postgres psql -U ai_user -d ai_services < shared/api/migrations/20260503_video_calls.sql

CREATE TABLE IF NOT EXISTS video_calls (
    id UUID PRIMARY KEY,
    provider VARCHAR(32) NOT NULL DEFAULT 'jitsi',
    room_name VARCHAR(160) NOT NULL UNIQUE,
    status VARCHAR(32) NOT NULL DEFAULT 'ringing',
    created_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    gaf_chat_id UUID REFERENCES gaf_chats(id) ON DELETE CASCADE,
    caller_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    callee_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT video_calls_status_check CHECK (status IN ('ringing', 'active', 'ended', 'missed')),
    CONSTRAINT video_calls_no_self_call CHECK (caller_user_id <> callee_user_id)
);

CREATE INDEX IF NOT EXISTS idx_video_calls_gaf_chat_created
    ON video_calls (gaf_chat_id, created_at DESC)
    WHERE gaf_chat_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_video_calls_caller_created
    ON video_calls (caller_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_video_calls_callee_created
    ON video_calls (callee_user_id, created_at DESC);

