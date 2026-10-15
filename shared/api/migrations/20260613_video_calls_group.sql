-- Group video calls: participants table and nullable callee for multi-party rooms.
-- Apply:
-- docker exec -i stack1-postgres psql -U ai_user -d ai_services < shared/api/migrations/20260613_video_calls_group.sql

ALTER TABLE video_calls
    ADD COLUMN IF NOT EXISTS call_kind VARCHAR(16) NOT NULL DEFAULT 'direct';

ALTER TABLE video_calls
    DROP CONSTRAINT IF EXISTS video_calls_no_self_call;

ALTER TABLE video_calls
    ALTER COLUMN callee_user_id DROP NOT NULL;

ALTER TABLE video_calls
    ADD CONSTRAINT video_calls_call_kind_check
    CHECK (call_kind IN ('direct', 'group'));

ALTER TABLE video_calls
    ADD CONSTRAINT video_calls_direct_pair_check
    CHECK (
        call_kind = 'group'
        OR (
            callee_user_id IS NOT NULL
            AND caller_user_id <> callee_user_id
        )
    );

CREATE TABLE IF NOT EXISTS video_call_participants (
    call_id UUID NOT NULL REFERENCES video_calls(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(16) NOT NULL DEFAULT 'participant',
    invited_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (call_id, user_id),
    CONSTRAINT video_call_participants_role_check CHECK (role IN ('host', 'participant'))
);

CREATE INDEX IF NOT EXISTS idx_video_call_participants_user
    ON video_call_participants (user_id, call_id);
