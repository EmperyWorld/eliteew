-- EWA companion prompt blocks (platform prose overrides; code canon seeded at API bootstrap).
-- Resolution: non-empty body_text → else Python PROMPT_BLOCK_CANON.

CREATE TABLE IF NOT EXISTS ewa_companion_prompt_block (
    block_key text PRIMARY KEY,
    category text NOT NULL DEFAULT 'system',
    description text NOT NULL DEFAULT '',
    body_text text NOT NULL DEFAULT '',
    updated_at timestamptz NOT NULL DEFAULT now(),
    updated_by text
);

CREATE TABLE IF NOT EXISTS ewa_companion_prompt_block_audit (
    id bigserial PRIMARY KEY,
    block_key text NOT NULL,
    action text NOT NULL,
    actor_sub text,
    detail jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ewa_companion_prompt_block_audit_key_created_idx
    ON ewa_companion_prompt_block_audit (block_key, created_at DESC);

CREATE INDEX IF NOT EXISTS ewa_companion_prompt_block_category_idx
    ON ewa_companion_prompt_block (category);
