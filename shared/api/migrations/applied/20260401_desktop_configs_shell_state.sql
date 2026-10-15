-- Ephemeral shell state: recents, virtual desktops, window snapshot, clock prefs (JSON merge via API).
ALTER TABLE desktop_configs
ADD COLUMN IF NOT EXISTS shell_state JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN desktop_configs.shell_state IS 'Desktop shell state (recent apps, virtual desktops, windows snapshot, etc.); merged via PATCH /desktop/shell-state';
