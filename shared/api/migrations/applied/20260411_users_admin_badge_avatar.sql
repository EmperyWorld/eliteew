-- Admin-defined custom badge (label + optional hint) for profile / GAF / friends.
-- System GAF user: default avatar to public app icon (SVG in frontend static).

ALTER TABLE users ADD COLUMN IF NOT EXISTS admin_badge_label VARCHAR(64) NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS admin_badge_hint VARCHAR(512) NULL;

COMMENT ON COLUMN users.admin_badge_label IS 'Admin-set short badge label (shown as chip next to trusted).';
COMMENT ON COLUMN users.admin_badge_hint IS 'Optional tooltip / longer text for admin badge.';

-- Logo served from EliteEW web static: /emperyworld-icon.svg
UPDATE users
SET avatar_url = '/emperyworld-icon.svg'
WHERE id = '00000000-0000-4000-8000-000000000001'::uuid;
