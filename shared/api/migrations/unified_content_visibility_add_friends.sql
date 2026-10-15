-- Allow visibility = 'friends' in unified_content (was only private, shared, public).
-- Apply to the same DB as API (e.g. ai_services):
--   docker exec -i stack1-postgres psql -U ai_user -d ai_services < api/migrations/unified_content_visibility_add_friends.sql

ALTER TABLE unified_content DROP CONSTRAINT IF EXISTS check_visibility;
ALTER TABLE unified_content DROP CONSTRAINT IF EXISTS unified_content_visibility_valid;
ALTER TABLE unified_content ADD CONSTRAINT unified_content_visibility_valid
  CHECK (visibility IN ('private', 'shared', 'public', 'friends'));
