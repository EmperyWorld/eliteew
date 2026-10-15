-- Preinstalled (factory) catalog apps: auto-install for eligible users; non-removable via API.
ALTER TABLE desktop_app_catalog
ADD COLUMN IF NOT EXISTS is_factory BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN desktop_app_catalog.is_factory IS 'OEM preinstall for users who can see the app; uninstall blocked.';
