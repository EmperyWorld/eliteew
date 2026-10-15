-- Desktop AI Chat Discussion mode (explicit multi-turn sessions)
-- Version: 20260807_01
--
-- Additive: discussion sessions + turns. No change to existing council/stream
-- tables. Rollback: DROP TABLE desktop_ai_discussion_turns, desktop_ai_discussion_sessions.

BEGIN;

CREATE TABLE IF NOT EXISTS desktop_ai_discussion_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id UUID NOT NULL REFERENCES desktop_ai_chats (id) ON DELETE CASCADE,
    owner_user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    anchor_message_id UUID REFERENCES desktop_ai_chat_messages (id) ON DELETE SET NULL,
    preset_id VARCHAR(64) NOT NULL,
    topic TEXT NOT NULL DEFAULT '',
    goal TEXT NOT NULL DEFAULT '',
    roster JSONB NOT NULL DEFAULT '[]'::jsonb,
    intensity VARCHAR(32) NOT NULL DEFAULT 'professional_confrontational',
    status VARCHAR(32) NOT NULL DEFAULT 'queued',
    pause_reason VARCHAR(64),
    pause_requested BOOLEAN NOT NULL DEFAULT FALSE,
    total_ai_turns INTEGER NOT NULL DEFAULT 0,
    checkpoint_ai_turns INTEGER NOT NULL DEFAULT 0,
    segment_index INTEGER NOT NULL DEFAULT 0,
    version INTEGER NOT NULL DEFAULT 1,
    last_actor_hero_id VARCHAR(64),
    last_actor_user_id UUID REFERENCES users (id) ON DELETE SET NULL,
    document_markdown TEXT,
    document_transcript_version INTEGER,
    document_stale BOOLEAN NOT NULL DEFAULT FALSE,
    lease_owner VARCHAR(128),
    lease_expires_at TIMESTAMPTZ,
    client_request_id UUID,
    settings JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT desktop_ai_discussion_sessions_status_check CHECK (
        status IN (
            'queued',
            'running',
            'paused_checkpoint',
            'paused_user',
            'paused_goal',
            'paused_error',
            'completed',
            'cancelled'
        )
    ),
    CONSTRAINT desktop_ai_discussion_sessions_intensity_check CHECK (
        intensity IN ('calm', 'professional_confrontational', 'sharp')
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_desktop_ai_discussion_sessions_active_chat
    ON desktop_ai_discussion_sessions (chat_id)
    WHERE status IN (
        'queued',
        'running',
        'paused_checkpoint',
        'paused_user',
        'paused_goal',
        'paused_error'
    );

CREATE INDEX IF NOT EXISTS idx_desktop_ai_discussion_sessions_chat_updated
    ON desktop_ai_discussion_sessions (chat_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_desktop_ai_discussion_sessions_lease
    ON desktop_ai_discussion_sessions (lease_expires_at)
    WHERE status = 'running' AND lease_expires_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS desktop_ai_discussion_turns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES desktop_ai_discussion_sessions (id) ON DELETE CASCADE,
    ordinal INTEGER NOT NULL,
    actor_type VARCHAR(16) NOT NULL,
    hero_id VARCHAR(64),
    author_user_id UUID REFERENCES users (id) ON DELETE SET NULL,
    relation VARCHAR(32) NOT NULL DEFAULT 'opening',
    reply_to_turn_id UUID REFERENCES desktop_ai_discussion_turns (id) ON DELETE SET NULL,
    tone VARCHAR(64),
    content TEXT NOT NULL DEFAULT '',
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    client_request_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT desktop_ai_discussion_turns_actor_check CHECK (
        actor_type IN ('ai', 'user', 'system')
    ),
    CONSTRAINT desktop_ai_discussion_turns_relation_check CHECK (
        relation IN (
            'opening',
            'support',
            'challenge',
            'rebuttal',
            'synthesis',
            'user_interjection',
            'moderator'
        )
    ),
    CONSTRAINT desktop_ai_discussion_turns_session_ordinal_uq UNIQUE (session_id, ordinal)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_desktop_ai_discussion_turns_client_req
    ON desktop_ai_discussion_turns (session_id, client_request_id)
    WHERE client_request_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_desktop_ai_discussion_turns_session_ord
    ON desktop_ai_discussion_turns (session_id, ordinal);

COMMIT;
