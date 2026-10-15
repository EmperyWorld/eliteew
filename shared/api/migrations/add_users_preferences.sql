-- Add preferences JSONB column to users if missing (for profile/settings).
-- Run once: psql -f api/migrations/add_users_preferences.sql <connection>
ALTER TABLE users ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{}';
