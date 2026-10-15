-- Trusted user flag (admin-granted) + GAF system account (no login; service messages only).
-- System user id must match api/gaf_chat/constants.py DEFAULT_GAF_SYSTEM_USER_ID unless ELITE_GAF_SYSTEM_USER_ID is set.
-- INSERT touches users PII: apply_migrations.sh prepends SET encryption.pii_key when ENCRYPTION_MASTER_KEY is in migrations/.env (same value as API).

ALTER TABLE users ADD COLUMN IF NOT EXISTS is_trusted BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_system_account BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN users.is_trusted IS 'Admin-granted: show trusted badge (GAF/profile).';
COMMENT ON COLUMN users.is_system_account IS 'Internal account: cannot SSO login; GAF notifications only.';

-- bcrypt for literal "password" — not used for SSO; satisfies NOT NULL.
INSERT INTO users (
    id,
    username,
    email,
    password_hash,
    role,
    is_active,
    is_verified,
    full_name,
    is_system_account,
    preferences
) VALUES (
    '00000000-0000-4000-8000-000000000001'::uuid,
    'elite_system',
    'gaf-system@noreply.elite.internal',
    '$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW',
    'emperyworld_member',
    TRUE,
    FALSE,
    'Elite Система',
    TRUE,
    '{}'::jsonb
)
ON CONFLICT (id) DO UPDATE SET
    is_system_account = EXCLUDED.is_system_account,
    full_name = EXCLUDED.full_name,
    username = EXCLUDED.username,
    email = EXCLUDED.email;
