-- EWA platform orchestration tables (idempotent).
-- Mirror of persistence_pg/orchestration_asyncpg._SCHEMA_STATEMENTS for operator psql apply.

CREATE TABLE IF NOT EXISTS ewa_orchestration_session (
    session_id text PRIMARY KEY,
    state jsonb NOT NULL DEFAULT '{}'::jsonb,
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ewa_orchestration_event (
    id bigserial PRIMARY KEY,
    session_id text NOT NULL REFERENCES ewa_orchestration_session (session_id) ON DELETE CASCADE,
    seq int NOT NULL,
    event jsonb NOT NULL,
    UNIQUE (session_id, seq)
);

CREATE INDEX IF NOT EXISTS ewa_orchestration_event_session_seq_idx
    ON ewa_orchestration_event (session_id, seq);
