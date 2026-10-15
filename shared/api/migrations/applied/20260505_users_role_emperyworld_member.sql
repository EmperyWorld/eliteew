-- Align legacy member role string in app DB (Keycloak uses emperyworld_member).
BEGIN;

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_valid;

UPDATE users SET role = 'emperyworld_member' WHERE role = 'brotherhood_member';

ALTER TABLE users ADD CONSTRAINT users_role_valid CHECK (
    role IN ('admin', 'emperyworld_member', 'ai_agent', 'moderator')
);

COMMIT;
