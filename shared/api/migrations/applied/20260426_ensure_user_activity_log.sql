-- Ensure user_activity_log exists on environments that never ran the file that landed only under applied/.
-- Safe to re-run: IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS public.user_activity_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    description TEXT,
    ip_address TEXT,
    user_agent TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_activity_log_user_created
    ON public.user_activity_log (user_id, created_at DESC);

COMMENT ON TABLE public.user_activity_log IS 'Audit-style events for profile/security actions (avatar, profile, sessions); paginated via user profile API';
