-- EWA companion episodic memory: Postgres audit / source-of-truth for the Qdrant vector store.
-- Mirrors schema init in persistence_pg/companion_asyncpg._COMPANION_SCHEMA_STATEMENTS.
-- See documentation/product/ewa/EWA-COMPANION-HCM-MEMORY.md for the HCM (Hierarchical Context Management) design.

CREATE TABLE IF NOT EXISTS ewa_companion_episodes (
    id text PRIMARY KEY,
    principal_id text NOT NULL REFERENCES ewa_companion_profile (principal_id) ON DELETE CASCADE,
    turn_id text,
    kind text NOT NULL DEFAULT 'turn_user',
    source text NOT NULL DEFAULT 'chat_turn',
    persona text NOT NULL DEFAULT 'parent',
    importance real NOT NULL DEFAULT 0.5,
    valence real NOT NULL DEFAULT 0.5,
    body text NOT NULL,
    extra jsonb NOT NULL DEFAULT '{}'::jsonb,
    vector_status text NOT NULL DEFAULT 'pending',
    vector_model text,
    vector_dim integer,
    created_at timestamptz NOT NULL DEFAULT now(),
    indexed_at timestamptz
);

CREATE INDEX IF NOT EXISTS ewa_companion_episodes_principal_created_idx
    ON ewa_companion_episodes (principal_id, created_at DESC);

CREATE INDEX IF NOT EXISTS ewa_companion_episodes_principal_pending_idx
    ON ewa_companion_episodes (principal_id, vector_status)
    WHERE vector_status = 'pending';

CREATE INDEX IF NOT EXISTS ewa_companion_episodes_principal_kind_idx
    ON ewa_companion_episodes (principal_id, kind, created_at DESC);
