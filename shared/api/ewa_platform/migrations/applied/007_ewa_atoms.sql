-- EWA knowledge-graph atoms (Star / Comet / Nebula) + directed edges.
-- Mirrors init in persistence_pg/companion_asyncpg._COMPANION_SCHEMA_STATEMENTS.
-- See documentation/product/ewa/EWA-ATOM-LAYER.md.

CREATE TABLE IF NOT EXISTS ewa_atom (
    id text PRIMARY KEY,
    principal_id text NOT NULL REFERENCES ewa_companion_profile (principal_id) ON DELETE CASCADE,
    particle_kind text NOT NULL CHECK (particle_kind IN ('star', 'comet', 'nebula')),
    atom_timestamp timestamptz NOT NULL,
    importance real NOT NULL CHECK (importance >= 0.0 AND importance <= 1.0),
    tags text[] NOT NULL DEFAULT '{}'::text[],
    payload jsonb NOT NULL,
    particle jsonb NOT NULL DEFAULT '{}'::jsonb,
    meta jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ewa_atom_principal_ts_idx
    ON ewa_atom (principal_id, atom_timestamp DESC);

CREATE INDEX IF NOT EXISTS ewa_atom_principal_kind_idx
    ON ewa_atom (principal_id, particle_kind, atom_timestamp DESC);

CREATE INDEX IF NOT EXISTS ewa_atom_tags_gin_idx
    ON ewa_atom USING gin (tags);

CREATE TABLE IF NOT EXISTS ewa_atom_edge (
    id text PRIMARY KEY,
    principal_id text NOT NULL REFERENCES ewa_companion_profile (principal_id) ON DELETE CASCADE,
    from_atom_id text NOT NULL REFERENCES ewa_atom (id) ON DELETE CASCADE,
    to_atom_id text NOT NULL REFERENCES ewa_atom (id) ON DELETE CASCADE,
    link_kind text NOT NULL CHECK (link_kind IN ('temporal', 'semantic', 'affective')),
    weight real NOT NULL DEFAULT 1.0,
    meta jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT ewa_atom_edge_no_self CHECK (from_atom_id <> to_atom_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS ewa_atom_edge_uniq_v1
    ON ewa_atom_edge (principal_id, from_atom_id, to_atom_id, link_kind);

CREATE INDEX IF NOT EXISTS ewa_atom_edge_from_idx
    ON ewa_atom_edge (principal_id, from_atom_id);

CREATE INDEX IF NOT EXISTS ewa_atom_edge_to_idx
    ON ewa_atom_edge (principal_id, to_atom_id);
