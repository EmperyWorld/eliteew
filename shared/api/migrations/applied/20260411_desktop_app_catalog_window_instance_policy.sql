-- Per-app window instance policy for desktop shell.
-- allow_multiple_windows=false => effective max is 1.
ALTER TABLE desktop_app_catalog
  ADD COLUMN IF NOT EXISTS allow_multiple_windows BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS max_window_instances INTEGER NOT NULL DEFAULT 1;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'desktop_app_catalog_max_window_instances_check'
  ) THEN
    ALTER TABLE desktop_app_catalog
      ADD CONSTRAINT desktop_app_catalog_max_window_instances_check
      CHECK (max_window_instances >= 1);
  END IF;
END $$;

COMMENT ON COLUMN desktop_app_catalog.allow_multiple_windows IS 'Whether this app can have multiple simultaneous desktop windows.';
COMMENT ON COLUMN desktop_app_catalog.max_window_instances IS 'Maximum simultaneous desktop windows for app (>=1).';
