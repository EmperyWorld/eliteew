-- Phase 3: idempotent companion chat turns (client_turn_id replay).
CREATE TABLE IF NOT EXISTS ewa_companion_turn_dedup (
    id text PRIMARY KEY,
    principal_id text NOT NULL REFERENCES ewa_companion_profile (principal_id) ON DELETE CASCADE,
    client_turn_id text NOT NULL,
    response_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (principal_id, client_turn_id)
);

CREATE INDEX IF NOT EXISTS ewa_companion_turn_dedup_principal_created_idx
    ON ewa_companion_turn_dedup (principal_id, created_at DESC);

COMMENT ON TABLE ewa_companion_turn_dedup IS
    'Replay cache for companion chat turns keyed by (principal_id, client_turn_id); Phase 3 BO plan.';
