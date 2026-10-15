-- Курсорина investigation missions (principal-scoped JSON state).
-- Idempotent: CREATE IF NOT EXISTS. Runtime also calls ensure_schema() as safety net.
-- Related: documentation/product/desktop/KURSORINA.md

CREATE TABLE IF NOT EXISTS kursorina_missions (
  id TEXT PRIMARY KEY,
  principal_id TEXT NOT NULL,
  goal TEXT NOT NULL,
  status TEXT NOT NULL,
  state_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS kursorina_missions_principal_updated_idx
  ON kursorina_missions (principal_id, updated_at DESC);
