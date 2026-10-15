-- Storefront media: remote icon and preview image URLs (HTTPS CDN etc.; CSP may need CSP_IMG_EXTRA).
-- Idempotent: safe if columns already exist (e.g. applied manually).
ALTER TABLE desktop_app_catalog
  ADD COLUMN IF NOT EXISTS icon_url TEXT,
  ADD COLUMN IF NOT EXISTS icon_url_2x TEXT,
  ADD COLUMN IF NOT EXISTS preview_url TEXT,
  ADD COLUMN IF NOT EXISTS preview_url_2x TEXT;
