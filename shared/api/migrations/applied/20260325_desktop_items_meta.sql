-- Optional JSON metadata for desktop items (e.g. project folder guard release).
ALTER TABLE desktop_items
	ADD COLUMN IF NOT EXISTS meta JSONB NOT NULL DEFAULT '{}'::jsonb;
