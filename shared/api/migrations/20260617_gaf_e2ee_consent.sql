-- GAF Chat E2EE mutual consent state.
-- Ordinary chat remains default; E2EE requires both participants to opt in.

ALTER TABLE public.gaf_chats
    ADD COLUMN IF NOT EXISTS e2ee_status TEXT NOT NULL DEFAULT 'off',
    ADD COLUMN IF NOT EXISTS e2ee_requested_by_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS e2ee_user_1_consented_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS e2ee_user_2_consented_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS e2ee_activated_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS e2ee_declined_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS e2ee_disabled_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS e2ee_updated_at TIMESTAMPTZ;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'gaf_chats_e2ee_status_check'
          AND conrelid = 'public.gaf_chats'::regclass
    ) THEN
        ALTER TABLE public.gaf_chats
            ADD CONSTRAINT gaf_chats_e2ee_status_check
            CHECK (e2ee_status IN ('off', 'pending', 'active', 'declined'));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_gaf_chats_e2ee_status
    ON public.gaf_chats (e2ee_status, e2ee_updated_at DESC);
