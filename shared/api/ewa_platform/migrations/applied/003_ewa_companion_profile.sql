-- EWA companion profile (one row per authenticated principal).
-- Mirrors schema init in persistence_pg/companion_asyncpg._COMPANION_SCHEMA_STATEMENTS

CREATE TABLE IF NOT EXISTS ewa_companion_profile (
    principal_id text PRIMARY KEY,
    schema_version text NOT NULL DEFAULT '1',
    seed_persona_id text NOT NULL DEFAULT 'parent',
    baseline jsonb NOT NULL DEFAULT '{}'::jsonb,
    learned_preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
    style_parameters jsonb NOT NULL DEFAULT '{}'::jsonb,
    companion_revision bigint NOT NULL DEFAULT 1 CHECK (companion_revision >= 1),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ewa_companion_profile_audit (
    id bigserial PRIMARY KEY,
    principal_id text NOT NULL REFERENCES ewa_companion_profile (principal_id) ON DELETE CASCADE,
    action text NOT NULL,
    detail jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ewa_companion_profile_audit_principal_created_idx
    ON ewa_companion_profile_audit (principal_id, created_at DESC);
