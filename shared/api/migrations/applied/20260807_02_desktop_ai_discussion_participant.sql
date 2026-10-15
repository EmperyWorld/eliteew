-- Desktop AI Discussion: participant label + one active session per owner
-- Version: 20260807_02
--
-- Additive columns + unique active-owner index.
-- Rollback: DROP INDEX idx_desktop_ai_discussion_sessions_active_owner;
--   ALTER TABLE … DROP COLUMN participant_display_name, participant_role_title;

BEGIN;

ALTER TABLE desktop_ai_discussion_sessions
    ADD COLUMN IF NOT EXISTS participant_display_name TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS participant_role_title TEXT NOT NULL DEFAULT 'инкогнито';

CREATE UNIQUE INDEX IF NOT EXISTS idx_desktop_ai_discussion_sessions_active_owner
    ON desktop_ai_discussion_sessions (owner_user_id)
    WHERE status IN (
        'queued',
        'running',
        'paused_checkpoint',
        'paused_user',
        'paused_goal',
        'paused_error'
    );

COMMIT;
