-- Resolve unified_content orphans (user_id not in users) and add FK to users(id).
-- Option: reassign orphans to system/test user 00000000-0000-0000-0000-000000000001 (must exist in users).
-- Apply: docker exec -i stack1-postgres psql -U ai_user -d ai_services < shared/api/migrations/unified_content_resolve_orphans_and_fk.sql

BEGIN;

-- 1. Log affected rows
DO $$
DECLARE
  rec record;
  sys_user_id uuid := '00000000-0000-0000-0000-000000000001';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = sys_user_id) THEN
    RAISE EXCEPTION 'System user % does not exist in users. Create it or use another existing user_id.', sys_user_id;
  END IF;
  FOR rec IN
    SELECT uc.id, uc.user_id
    FROM unified_content uc
    WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = uc.user_id)
  LOOP
    RAISE NOTICE 'Reassigning content id % from orphan user_id % to system user', rec.id, rec.user_id;
  END LOOP;
END $$;

-- 2. Reassign all orphan rows (any user_id not in users) to system user
UPDATE unified_content uc
SET user_id = '00000000-0000-0000-0000-000000000001'::uuid
WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = uc.user_id);

-- 3. Add FK (optional but recommended for integrity)
ALTER TABLE unified_content
  ADD CONSTRAINT unified_content_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT;

COMMIT;
