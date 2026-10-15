-- EWRP: optional first-slide cover mode (title + background image only)
ALTER TABLE ewrp_jobs
  ADD COLUMN IF NOT EXISTS first_slide_style VARCHAR(32);

COMMENT ON COLUMN ewrp_jobs.first_slide_style IS
  'First slide cover: standard (default) or title_only (title + background image, no bullets/chrome)';
