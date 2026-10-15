-- Mobile Android: authenticated support diagnostics upload (Keycloak Bearer).

CREATE TABLE IF NOT EXISTS public.mobile_support_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    category TEXT NOT NULL DEFAULT 'general',
    app_version_name TEXT,
    app_version_code INTEGER,
    device_model TEXT,
    bundle_text TEXT NOT NULL,
    client_ip TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mobile_support_reports_user_created
    ON public.mobile_support_reports (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_mobile_support_reports_created
    ON public.mobile_support_reports (created_at DESC);

COMMENT ON TABLE public.mobile_support_reports IS
    'Sanitized mobile support bundles from authenticated app users. No OAuth tokens stored.';
