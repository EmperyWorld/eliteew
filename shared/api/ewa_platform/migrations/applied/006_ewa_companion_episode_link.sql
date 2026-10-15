-- Wave 1 (project «Mela's Ascension»): lightweight graph edges between companion episodic rows.
-- Mirrors init in persistence_pg/companion_asyncpg._COMPANION_SCHEMA_STATEMENTS.

CREATE TABLE IF NOT EXISTS ewa_companion_episode_link (
    id text PRIMARY KEY,
    principal_id text NOT NULL REFERENCES ewa_companion_profile (principal_id) ON DELETE CASCADE,
    from_episode_id text NOT NULL REFERENCES ewa_companion_episodes (id) ON DELETE CASCADE,
    to_episode_id text NOT NULL REFERENCES ewa_companion_episodes (id) ON DELETE CASCADE,
    relation text NOT NULL DEFAULT 'related',
    emotion_tag text,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT ewa_episode_link_no_self CHECK (from_episode_id <> to_episode_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS ewa_companion_episode_link_edge_uniq_v1
    ON ewa_companion_episode_link (principal_id, from_episode_id, to_episode_id, relation);

CREATE INDEX IF NOT EXISTS ewa_companion_episode_link_from_idx
    ON ewa_companion_episode_link (principal_id, from_episode_id);

CREATE INDEX IF NOT EXISTS ewa_companion_episode_link_to_idx
    ON ewa_companion_episode_link (principal_id, to_episode_id);
