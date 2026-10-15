-- Tombstones for notification-center dismiss so persist-on-emit / stale PUT cannot revive a row.
ALTER TABLE user_notification_center
    ADD COLUMN IF NOT EXISTS dismissed_ids JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN user_notification_center.dismissed_ids IS
    'Dismissed notification ids (tombstones); GET/PUT items must not include these ids.';
