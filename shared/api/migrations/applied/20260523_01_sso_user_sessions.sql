-- EliteEW SSO session registry: immediate browser/mobile replacement enforcement.

CREATE TABLE IF NOT EXISTS public.sso_user_sessions (
    keycloak_sub TEXT NOT NULL,
    client_class TEXT NOT NULL CHECK (client_class IN ('browser', 'mobile')),
    current_session_id TEXT NOT NULL,
    client_id TEXT NOT NULL,
    username TEXT,
    email TEXT,
    auth_time_epoch BIGINT,
    issued_at_epoch BIGINT,
    first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    previous_session_id TEXT,
    replaced_at TIMESTAMPTZ,
    replaced_by_session_id TEXT,
    ip_address TEXT,
    user_agent TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    PRIMARY KEY (keycloak_sub, client_class)
);

CREATE INDEX IF NOT EXISTS idx_sso_user_sessions_last_seen
    ON public.sso_user_sessions (last_seen_at DESC);

COMMENT ON TABLE public.sso_user_sessions IS
    'Current Keycloak SSO session per user and client class (browser/mobile) for immediate replacement enforcement.';

CREATE TABLE IF NOT EXISTS public.sso_session_audit_events (
    id BIGSERIAL PRIMARY KEY,
    event_type TEXT NOT NULL,
    keycloak_sub TEXT,
    username TEXT,
    email TEXT,
    client_class TEXT,
    client_id TEXT,
    session_id TEXT,
    replaced_session_id TEXT,
    ip_address TEXT,
    user_agent TEXT,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sso_session_audit_events_created
    ON public.sso_session_audit_events (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sso_session_audit_events_user
    ON public.sso_session_audit_events (keycloak_sub, created_at DESC);

COMMENT ON TABLE public.sso_session_audit_events IS
    'Semantic SSO login/replacement audit events. Raw JWT and refresh tokens are never stored.';
