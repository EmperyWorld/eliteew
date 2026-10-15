-- Continuity W3: principal-bound encrypted browser SSO recovery capsules.
-- Retention default 7d; ciphertext only (no bearer tokens in plaintext columns).

CREATE TABLE IF NOT EXISTS public.web_sso_recovery_capsules (
    keycloak_sub TEXT NOT NULL PRIMARY KEY,
    terminal_reason TEXT NOT NULL,
    ciphertext BYTEA NOT NULL,
    schema_version INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_web_sso_recovery_capsules_expires
    ON public.web_sso_recovery_capsules (expires_at);

COMMENT ON TABLE public.web_sso_recovery_capsules IS
    'Encrypted Continuity W3 recovery capsules (principal-bound, single-use). Never store access/refresh tokens.';
